// ============================================================================
// „Nie langweilig" in numbers (e-log; docs/superpowers/specs/2026-10-22-erlebnis-design.md §7, abenteuer §10; plan
// docs/superpowers/plans/2026-10-22-e-log.md §2.5). Pure: a session's event log and its 1-Hz samples (VR.EventLog,
// src/main/eventlog.js) → the metrics every release review measures, E§7's targets per player type and a verdict.
//   analyze({events, samples, t0, t1, exclude}) — events {t, kind, sub, w, inView}; samples {t, movers, landmark, sky,
//   input, place, x, z}; exclude: windows [a, b] whose time leaves the clock (a part skipped because its feature does not
//   exist yet: its minutes leave the targets). The definitions:
//   · weighted: events of weight ≥ 2 in view; per minute of the session's (active) time; one moment told by two sources
//     (the same sub within 2 s: the festival and its milestone toast) counts once, the heavier (merged: how many);
//   · gaps: between consecutive weighted events, the session's edges included (start → first, last → end); the longest
//     (the first of equals) and the p90 (nearest rank); a session with none has one gap, its whole length;
//   · movers · landmark · sky · lmSky: the shares of the samples with a moving actor in view, a known landmark, a sky event,
//     either of the last two; handsFree: the share with input 'intent' or 'idle' (watching), and the input mix;
//   · variety: the distinct kinds of the events in view (any weight) in the best 10-minute window (a shorter session is
//     its own window, marked full: false); subVariety: the distinct kind:sub in view;
//   · spam: consecutive weighted pairs closer than 8 s, and per 10 minutes; majors: weight ≥ 4 in view, per minute, and
//     the pairs closer than 60 s; encounters and story beats (in view or not) per 10 minutes.
//   TARGETS (E§7 + A§10's majors), typeOf (the walk is measured as the builder), verdict(m, type, {chapterOpen}),
//   describeGap(gap, samples, events), table(rows) (markdown), p90(list).
//   f-flow (R50-03, docs/superpowers/plans/2026-10-23-f-flow.md §2.2): "seen" is weighed by the screen share the log
//   records — SS.seen(e): out of view 0; in view 1 from SEEN_FULL (1 % of the screen), below it frac / SEEN_FULL; an event
//   without a place (a toast: frac 0 in view) or without a frac (older logs) counts 1. The counts (weighted.n, perMin)
//   add the seen share; the yes/no measures (the gaps, spam, majors, variety) take an event as seen from SEEN_HALF (0.5:
//   half a full sighting); weighted.full = the weighted events seen so, seenShare = the mean seen of the weighted in view.
//   repeat: the most frequent kind:sub among all of the session's events and its share (the act that repeats), with the
//   most frequent kind among the events seen beside it — a verdict row ≤ 0.40 for every player type.
// ============================================================================
(function (VR) {
  'use strict';
  const SS = VR.SessionStats = VR.SessionStats || {};
  const WIN = 600, SPAM = 8, MAJOR_GAP = 60, ONE = 2;
  // ---- f-flow: seen by the screen share
  SS.SEEN_FULL = 0.01; SS.SEEN_HALF = 0.5;
  SS.seen = function (e) {
    if (!e || !e.inView) return 0;
    const f = e.frac;
    if (f === undefined || f === null || !(f > 0)) return 1;   // (a toast — in view, no place — or an older log: whole)
    return Math.min(1, f / SS.SEEN_FULL);
  };
  const seenOK = (e) => SS.seen(e) >= SS.SEEN_HALF - 1e-12;
  // the most frequent key among a list and its share
  const topOf = (list, key) => { const c = new Map(); let best = '', bn = 0; for (const e of list) { const k = key(e); const n = (c.get(k) || 0) + 1; c.set(k, n); if (n > bn) { bn = n; best = k; } } return { name: best, n: bn, of: list.length, share: list.length ? bn / list.length : 0 }; };
  // ---- f-flow end

  SS.p90 = function (list) {
    if (!list || !list.length) return 0;
    const s = list.slice().sort((a, b) => a - b);
    return s[Math.max(0, Math.ceil(0.9 * s.length) - 1)];
  };

  // the active clock: time with the excluded windows taken out (merged, clipped to the session)
  function clockOf(t0, t1, exclude) {
    const W = [];
    for (const e of exclude || []) { const a = Math.max(t0, Math.min(e[0], e[1])), b = Math.min(t1, Math.max(e[0], e[1])); if (b > a) W.push([a, b]); }
    W.sort((p, q) => p[0] - q[0]);
    const M = [];
    for (const w of W) { const L = M[M.length - 1]; if (L && w[0] <= L[1]) L[1] = Math.max(L[1], w[1]); else M.push(w.slice()); }
    const inside = (t) => M.some(w => t >= w[0] && t < w[1]);
    const at = (t) => { let c = t - t0; for (const w of M) { if (t >= w[1]) c -= w[1] - w[0]; else if (t > w[0]) c -= t - w[0]; } return c; };
    return { inside, at, dur: at(t1), windows: M };
  }

  SS.analyze = function (log, opts) {
    void opts;
    const t0 = +log.t0 || 0, t1 = +log.t1 || 0, C = clockOf(t0, t1, log.exclude);
    const keep = (t) => t >= t0 && t <= t1 && !C.inside(t);
    const evs = (log.events || []).filter(e => e && keep(+e.t)).slice().sort((a, b) => a.t - b.t);
    const smp = (log.samples || []).filter(s => s && keep(+s.t));
    const dur = C.dur, minutes = dur / 60, per10 = (n) => (minutes > 0 ? n * 10 / minutes : 0);
    const m = { t0, t1, dur, minutes, events: { n: evs.length, inView: evs.filter(e => e.inView).length }, samples: smp.length };

    // the weighted events — one moment told by two sources (the festival opening and its milestone toast; two craft of
    // one flyby: the same sub within 2 s) counts once, the heavier (f-flow: and the better seen of the two) — and the
    // gaps between them (on the active clock; f-flow: those seen ≥ 0.5 end a gap)
    const IV = [];
    let merged = 0;
    for (const e of evs) {
      if (!(e.w >= 2 && e.inView)) continue;
      const s = SS.seen(e); if (!(s > 0)) continue;
      let j = IV.length - 1;
      while (j >= 0 && !(e.sub && IV[j].sub === e.sub) && e.t - IV[j].t < ONE) j--;
      if (j >= 0 && e.sub && IV[j].sub === e.sub && e.t - IV[j].t < ONE) { merged++; const q = IV[j], sk = Math.max(q._seen, s); if (e.w > q.w) IV[j] = Object.assign({}, e, { t: q.t, _seen: sk }); else q._seen = sk; continue; }
      IV.push(Object.assign({}, e, { _seen: s }));
    }
    const W = IV.filter(e => e._seen >= SS.SEEN_HALF - 1e-12);
    let seenSum = 0; for (const e of IV) seenSum += e._seen;
    m.weighted = { n: seenSum, perMin: minutes > 0 ? seenSum / minutes : 0, merged, full: W.length, inView: IV.length };
    m.seenShare = IV.length ? seenSum / IV.length : 0;
    const gaps = [];
    let pa = t0, pc = 0;
    for (const e of W) { const c = C.at(e.t); gaps.push({ a: pa, b: e.t, d: +(c - pc).toFixed(3) }); pa = e.t; pc = c; }
    gaps.push({ a: pa, b: t1, d: +(dur - pc).toFixed(3) });
    let longest = gaps[0];
    for (const g of gaps) if (g.d > longest.d) longest = g;
    m.gaps = { list: gaps, longest, p90: SS.p90(gaps.map(g => g.d)) };

    // the samples' shares
    const share = (f) => (smp.length ? smp.filter(f).length / smp.length : 0);
    m.movers = share(s => (s.movers | 0) >= 1);
    m.landmark = share(s => !!s.landmark);
    m.sky = share(s => !!s.sky);
    m.lmSky = share(s => !!s.landmark || !!s.sky);
    m.inputs = { micro: share(s => s.input === 'micro'), intent: share(s => s.input === 'intent'), idle: share(s => s.input === 'idle'), build: share(s => s.input === 'build') };
    m.handsFree = m.inputs.intent + m.inputs.idle;

    // variety: the best 10-minute window (on the play clock: a window is 600 s of the session as it ran; f-flow: the
    // events seen ≥ 0.5)
    const seen = evs.filter(seenOK);
    const kindsIn = (a, b) => { const k = new Set(); for (const e of seen) if (e.t >= a && e.t <= b) k.add(e.kind); return k; };
    let best = null;
    if (t1 - t0 <= WIN) best = kindsIn(t0, t1);
    else {
      const starts = new Set([t0, t1 - WIN]);
      for (const e of seen) { starts.add(e.t); starts.add(e.t - WIN); }
      for (const s of starts) { if (s < t0 || s > t1 - WIN) continue; const k = kindsIn(s, s + WIN); if (!best || k.size > best.size) best = k; }
    }
    m.variety = { n: best ? best.size : 0, kinds: best ? [...best].sort() : [], window: Math.min(WIN, t1 - t0), full: t1 - t0 >= WIN };
    m.subVariety = new Set(seen.map(e => e.kind + ':' + e.sub)).size;

    // spam, majors, encounters, story
    const pairs = [];
    for (let i = 1; i < W.length; i++) if (C.at(W[i].t) - C.at(W[i - 1].t) < SPAM) pairs.push([W[i - 1].t, W[i].t]);
    m.spam = { n: pairs.length, per10: per10(pairs.length), pairs };
    const Mj = evs.filter(e => e.w >= 4 && seenOK(e));
    let close = 0; for (let i = 1; i < Mj.length; i++) if (C.at(Mj[i].t) - C.at(Mj[i - 1].t) < MAJOR_GAP) close++;
    m.majors = { n: Mj.length, perMin: minutes > 0 ? Mj.length / minutes : 0, close };
    const enc = evs.filter(e => e.kind === 'encounter').length, story = evs.filter(e => e.kind === 'story' && e.src !== 'offer').length;   // (a-regie: an offer is seen, not a beat)
    m.encounters = { n: enc, per10: per10(enc) };
    m.story = { n: story, per10: per10(story) };
    // f-flow: the act that repeats — over all of the session's events; the kind seen most beside it
    m.events.seen = seen.length;
    m.repeat = topOf(evs, e => e.kind + ':' + (e.sub || ''));
    m.repeat.kind = topOf(seen, e => e.kind);
    return m;
  };

  // ---------------------------------------------------------------- the targets (E§7) and the verdict
  // [op, value] — op '>=' at least, '<=' at most, 'range' [lo, hi]; null: not a target for this type. Units: perMin a
  // minute; longest, p90 seconds; movers, lmSky, handsFree shares; variety kinds in 10 minutes; spam, encounters, story
  // per 10 minutes; majors a minute (A§10: at most one of weight ≥ 4 per 60 s)
  SS.TARGETS = {
    builder: { perMin: ['>=', 1.5], longest: ['<=', 90], p90: ['<=', 50], movers: ['>=', 0.70], lmSky: ['>=', 0.60], variety: ['>=', 8], spam: ['<=', 2], encounters: ['range', 0, 0], story: null, handsFree: ['>=', 0.30], majors: ['<=', 1], repeat: ['<=', 0.40] },
    adventurer: { perMin: ['>=', 2.5], longest: ['<=', 60], p90: ['<=', 35], movers: ['>=', 0.75], lmSky: ['>=', 0.50], variety: ['>=', 10], spam: ['<=', 3], encounters: ['range', 2, 4], story: ['>=', 1], handsFree: ['>=', 0.40], majors: ['<=', 1], repeat: ['<=', 0.40] },
    pilot: { perMin: ['>=', 2.0], longest: ['<=', 75], p90: ['<=', 45], movers: ['>=', 0.50], lmSky: ['>=', 0.80], variety: ['>=', 8], spam: ['<=', 2], encounters: ['range', 0, 1], story: null, handsFree: ['>=', 0.60], majors: ['<=', 1], repeat: ['<=', 0.40] },
  };
  SS.ROWS = [
    ['perMin', 'weight ≥ 2 seen / min'], ['longest', 'longest gap (s)'], ['p90', 'p90 gap (s)'], ['movers', 'moving actor in view'],
    ['lmSky', 'landmark or sky in view'], ['variety', 'variety (kinds / 10 min)'], ['spam', 'spam (< 8 s, / 10 min)'],
    ['encounters', 'encounters / 10 min'], ['story', 'story beats / 10 min'], ['handsFree', 'hands-free share'], ['majors', 'majors (w ≥ 4) / min'],
    ['repeat', 'most repeated event (share of all)'],
  ];
  // the other session types measured by a player type's targets (the walk of wave 3 is the builder's open world)
  SS.ALIAS = { walk: 'builder', explorer: 'builder' };
  SS.typeOf = (type) => (SS.TARGETS[type] ? type : SS.ALIAS[type] || 'builder');
  const valueOf = (m, key) => {
    switch (key) {
      case 'perMin': return m.weighted ? m.weighted.perMin : 0;
      case 'longest': return m.gaps && m.gaps.longest ? m.gaps.longest.d : 0;
      case 'p90': return m.gaps ? m.gaps.p90 : 0;
      case 'variety': return m.variety ? m.variety.n : 0;
      case 'spam': return m.spam ? m.spam.per10 : 0;
      case 'encounters': return m.encounters ? m.encounters.per10 : 0;
      case 'story': return m.story ? m.story.per10 : 0;
      case 'majors': return m.majors ? m.majors.perMin : 0;
      case 'repeat': return m.repeat ? m.repeat.share : 0;
      default: return +m[key] || 0;
    }
  };
  const fmt = (v) => (Math.abs(v) >= 10 || Number.isInteger(v) ? String(Math.round(v * 10) / 10) : v.toFixed(2));
  const targetText = (t) => (t[0] === 'range' ? (t[1] === t[2] ? `= ${t[1]}` : `${t[1]}–${t[2]}`) : `${t[0] === '>=' ? '≥' : '≤'} ${t[1]}`);
  SS.verdict = function (m, type, opts) {
    const base = SS.typeOf(type), T = SS.TARGETS[base], o = opts || {}, rows = [];
    for (const [key, label] of SS.ROWS) {
      const t = T[key]; if (!t) continue;
      if (key === 'story' && !o.chapterOpen) continue;
      const v = valueOf(m, key);
      const ok = t[0] === '>=' ? v >= t[1] - 1e-9 : t[0] === '<=' ? v <= t[1] + 1e-9 : v >= t[1] - 1e-9 && v <= t[2] + 1e-9;
      let note = '';
      if (key === 'variety' && m.variety && !m.variety.full) note = `in ${Math.round(m.variety.window)} s (${(m.variety.window / 60).toFixed(1)} of 10 min)`;
      rows.push({ key, label, value: v, text: fmt(v), target: targetText(t), ok, note });
    }
    return { type, base, rows, met: rows.filter(r => r.ok).length, total: rows.length };
  };
  // the metrics of several sessions beside their targets, as a markdown table (the plan, the release review)
  SS.table = function (list, opts) {
    const V = list.map(([type, m]) => [type, m, SS.verdict(m, type, opts)]);
    let s = '| metric | ' + V.map(([type, , v]) => `${type}${v.base !== type ? ' (' + v.base + "'s targets)" : ''}`).join(' | ') + ' |\n|---|' + V.map(() => '---|').join('') + '\n';
    for (const [key, label] of SS.ROWS) {
      const cells = V.map(([, , v]) => { const r = v.rows.find(q => q.key === key); return r ? `${r.text} (${r.target}) ${r.ok ? '✓' : '✗'}${r.note ? ' · ' + r.note : ''}` : '—'; });
      if (cells.every(c => c === '—')) continue;
      s += `| ${label} | ${cells.join(' | ')} |\n`;
    }
    s += '| **targets met** | ' + V.map(([, , v]) => `**${v.met} / ${v.total}**`).join(' | ') + ' |\n';
    return s;
  };

  // ---------------------------------------------------------------- where a gap was and what was in view meanwhile
  SS.describeGap = function (gap, samples, events) {
    const a = gap.a, b = gap.b, S = (samples || []).filter(s => s.t >= a && s.t < b), n = S.length || 1;
    const places = {}, landmarks = {}, inputs = { micro: 0, intent: 0, idle: 0, build: 0 };
    let mv = 0, mvN = 0, sky = 0;
    for (const s of S) {
      if (s.place) places[s.place] = (places[s.place] || 0) + 1;
      if (s.landmark) landmarks[s.landmark] = (landmarks[s.landmark] || 0) + 1;
      if (s.sky) sky++;
      mv += s.movers | 0; if ((s.movers | 0) >= 1) mvN++;
      if (inputs[s.input] !== undefined) inputs[s.input]++;
    }
    for (const k in inputs) inputs[k] = S.length ? inputs[k] / S.length : 0;
    const pos = (s) => (s && Number.isFinite(s.x) ? [s.x, s.z] : null);
    const inside = (events || []).filter(e => e.t > a && e.t < b).map(e => ({ t: e.t, kind: e.kind, sub: e.sub, w: e.w, inView: !!e.inView, seen: +SS.seen(e).toFixed(2) }));   // (f-flow: and how much of it was seen)
    return { a, b, d: gap.d, samples: S.length, places, landmarks, sky: S.length ? sky / n : 0, movers: S.length ? mv / n : 0, moversShare: S.length ? mvN / n : 0, inputs, from: pos(S[0]), to: pos(S[S.length - 1]), inside };
  };

  // ---------------------------------------------------------------- e-access: the release gate (waves §6.6)
  // verdicts by type → { fails, warns, lines }: a gated type that misses a target fails the release; a warned one is
  // reported only; a type that did not run counts as a fail when it is gated (the gate cannot be passed by skipping)
  SS.GATE = { gate: ['builder'], warn: ['adventurer'] };
  SS.gate = function (verdicts, cfg) {
    const c = cfg || SS.GATE, out = { fails: 0, warns: 0, lines: [] };
    for (const t of c.gate || []) {
      const v = verdicts && verdicts[t];
      if (!v) { out.fails++; out.lines.push(`gate ${t}: did not run`); continue; }
      const miss = v.rows.filter(r => !r.ok).map(r => r.key);
      if (miss.length) { out.fails++; out.lines.push(`gate ${t}: ${v.met}/${v.total} — missed ${miss.join(', ')}`); } else out.lines.push(`gate ${t}: ${v.met}/${v.total} ✓`);
    }
    for (const t of c.warn || []) {
      const v = verdicts && verdicts[t]; if (!v) { out.lines.push(`warn ${t}: did not run`); continue; }
      const miss = v.rows.filter(r => !r.ok).map(r => r.key);
      if (miss.length) { out.warns++; out.lines.push(`warn ${t}: ${v.met}/${v.total} — missed ${miss.join(', ')}`); } else out.lines.push(`warn ${t}: ${v.met}/${v.total} ✓`);
    }
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SS;
})(typeof VR !== 'undefined' ? VR : ((typeof globalThis !== 'undefined' ? globalThis : self).VR = (typeof globalThis !== 'undefined' ? globalThis : self).VR || {}));

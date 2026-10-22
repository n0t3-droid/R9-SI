// „Nie langweilig" in numbers (docs/superpowers/specs/2026-10-22-erlebnis-design.md §7; plan
// docs/superpowers/plans/2026-10-22-e-log.md §2.5): src/shared/sessionstats.js (VR.SessionStats, pure) on synthetic logs —
//  · the weighted events (weight ≥ 2 and in view) per minute; the gaps between them with the session's edges, the longest
//    and the p90 (nearest rank); an empty session; excluded windows (a skipped part's minutes leave the clock);
//  · the samples' shares: a moving actor in view, a landmark or a sky event, hands-free (intent or watching) and the mix;
//  · variety (distinct kinds in view, the best 10-minute window), spam (weighted pairs < 8 s, per 10 minutes), majors
//    (weight ≥ 4 per minute and pairs < 60 s), encounters and story beats per 10 minutes;
//  · the targets table of E§7 (builder · adventurer · pilot; the walk uses the builder's) and a verdict per type;
//  · describeGap: where a gap was and what was in view meanwhile.
//   bash test/wt_run.sh sessionstats.js 300
const path = require('path');
const SS = require(path.join(__dirname, '..', 'src', 'shared', 'sessionstats.js'));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
check(!!SS && typeof SS.analyze === 'function' && typeof SS.verdict === 'function' && !!SS.TARGETS, 'VR.SessionStats exists (analyze, verdict, TARGETS)');
check(!!(globalThis.VR && globalThis.VR.SessionStats === SS), 'it is VR.SessionStats too (the page and the node tests share it)');

const E = (t, w, inView, kind, sub) => ({ t, w, inView: inView !== false, kind: kind || 'ambient', sub: sub || 'x' });
const S = (t, o) => Object.assign({ t, movers: 0, landmark: '', sky: '', input: 'idle' }, o || {});

// ---------------------------------------------------------------- the weighted events and the gaps
{
  const m = SS.analyze({ t0: 0, t1: 160, events: [E(10, 2), E(40, 3), E(100, 2), E(20, 1), E(70, 3, false)], samples: [] });
  check(m.weighted.n === 3 && near(m.weighted.perMin, 3 / (160 / 60)), `three weighted events in view in 160 s: ${m.weighted.n}, ${m.weighted.perMin.toFixed(3)} a minute (the weight-1 one and the one out of view do not count)`);
  check(JSON.stringify(m.gaps.list.map(g => g.d)) === JSON.stringify([10, 30, 60, 60]), `the gaps include the edges: start → 10, 10 → 40, 40 → 100, 100 → end (${m.gaps.list.map(g => g.d).join(', ')})`);
  check(m.gaps.longest.d === 60 && m.gaps.longest.a === 40 && m.gaps.longest.b === 100, `the longest gap is the first of the longest: 40 → 100 (${JSON.stringify(m.gaps.longest)})`);
  check(m.gaps.p90 === 60, `p90 by nearest rank of [10, 30, 60, 60] is 60 (${m.gaps.p90})`);
  check(near(m.dur, 160) && near(m.minutes, 160 / 60), `the session's length: ${m.dur} s`);
}
{
  const m = SS.analyze({ t0: 0, t1: 100, events: [E(10, 2, false), E(50, 1)], samples: [] });
  check(m.weighted.n === 0 && m.gaps.list.length === 1 && m.gaps.longest.d === 100 && m.gaps.p90 === 100 && m.weighted.perMin === 0, 'a session with nothing weighted in view: one gap, its whole length, 0 a minute');
}
{
  const ten = []; for (let i = 1; i <= 9; i++) ten.push(E(ten.length ? ten[ten.length - 1].t + i : 1, 2));   // gaps 1, 2, …, 9 then the end
  const t1 = ten[ten.length - 1].t + 10;
  const m = SS.analyze({ t0: 0, t1, events: ten, samples: [] });
  check(JSON.stringify(m.gaps.list.map(g => g.d)) === '[1,2,3,4,5,6,7,8,9,10]' && m.gaps.p90 === 9, `p90 of the gaps 1 … 10 is 9 (nearest rank: the 9th of 10) — got ${m.gaps.p90}`);
  check(SS.p90([]) === 0 && SS.p90([5]) === 5 && SS.p90([3, 1, 2]) === 3, 'p90 of nothing is 0, of one gap the gap, unsorted input is sorted');
}
// excluded windows: a skipped part's minutes leave the clock (and its events)
{
  const m = SS.analyze({ t0: 0, t1: 160, exclude: [[100, 130]], events: [E(10, 2), E(40, 2), E(110, 4, true, 'story'), E(140, 2)], samples: [S(5), S(105), S(120), S(150)] });
  check(near(m.dur, 130), `a 30-s window excluded: the session counts 130 s (${m.dur})`);
  check(m.weighted.n === 3 && JSON.stringify(m.gaps.list.map(g => g.d)) === '[10,30,70,20]', `the events inside it are dropped and the gap across it is shortened by it: ${m.gaps.list.map(g => g.d).join(', ')}`);
  check(m.samples === 2, `the samples inside it are dropped too (${m.samples} of 4 kept)`);
  check(m.majors.n === 0 && m.story.n === 0, 'the major inside the window does not count');
}
// unsorted input, samples outside the session
{
  const m = SS.analyze({ t0: 100, t1: 200, events: [E(170, 2), E(120, 2), E(90, 2), E(230, 2)], samples: [S(50), S(150), S(250)] });
  check(m.weighted.n === 2 && m.gaps.list.map(g => g.d).join() === '20,50,30' && m.samples === 1, 'the events are sorted, those outside the session and its samples outside are ignored');
}

// ---------------------------------------------------------------- the samples' shares
{
  const smp = [S(1, { movers: 2, input: 'micro' }), S(2, { movers: 0, landmark: 'citadel', input: 'idle' }), S(3, { movers: 1, sky: 'low_sun', input: 'intent' }), S(4, { input: 'build' }), S(5, { movers: 3, input: 'idle' })];
  const m = SS.analyze({ t0: 0, t1: 6, events: [], samples: smp });
  check(near(m.movers, 3 / 5), `the share of samples with a moving actor in view: ${m.movers}`);
  check(near(m.lmSky, 2 / 5) && near(m.landmark, 1 / 5) && near(m.sky, 1 / 5), `a landmark or a sky event: ${m.lmSky} (landmark ${m.landmark}, sky ${m.sky})`);
  check(near(m.handsFree, 3 / 5), `hands-free = intent or watching (idle): ${m.handsFree}`);
  check(near(m.inputs.micro, 0.2) && near(m.inputs.idle, 0.4) && near(m.inputs.intent, 0.2) && near(m.inputs.build, 0.2), `the input mix ${JSON.stringify(m.inputs)}`);
  const z = SS.analyze({ t0: 0, t1: 6, events: [], samples: [] });
  check(z.movers === 0 && z.lmSky === 0 && z.handsFree === 0 && z.samples === 0, 'no samples: every share 0 (not NaN)');
}

// ---------------------------------------------------------------- variety, spam, majors, encounters, story
{
  const ev = [E(1, 1, true, 'ambient'), E(2, 2, true, 'social'), E(3, 2, true, 'ambient'), E(4, 2, true, 'travel'), E(5, 3, false, 'sky'), E(6, 2, true, 'social', 'kids')];
  const m = SS.analyze({ t0: 0, t1: 60, events: ev, samples: [] });
  check(m.variety.n === 3 && m.variety.kinds.join() === 'ambient,social,travel' && m.variety.full === false && near(m.variety.window, 60), `variety: the distinct kinds in view (${m.variety.kinds.join(', ')}); a 1-min session is its own window, marked short`);
  check(m.subVariety === 4, `the distinct kind:sub in view: ${m.subVariety}`);
  // the best 10-minute window of a 20-minute session
  const long = [E(10, 2, true, 'a'), E(20, 2, true, 'b'), E(30, 2, true, 'c'), E(700, 2, true, 'd'), E(710, 2, true, 'e'), E(720, 2, true, 'f'), E(730, 2, true, 'g'), E(740, 2, true, 'a')];
  const L = SS.analyze({ t0: 0, t1: 1200, events: long, samples: [] });
  check(L.variety.n === 5 && L.variety.full === true && near(L.variety.window, 600), `variety per 10 minutes is the best window (${L.variety.n}: ${L.variety.kinds.join(',')})`);
}
{
  const m = SS.analyze({ t0: 0, t1: 60, events: [E(0.5, 2), E(5, 2), E(20, 2), E(26, 3), E(40, 2), E(43, 1), E(44, 2, false)], samples: [] });
  check(m.spam.n === 2 && near(m.spam.per10, 20) && m.spam.pairs.length === 2, `spam: two weighted pairs closer than 8 s (0.5–5, 20–26) → ${m.spam.n}, ${m.spam.per10} per 10 minutes`);
}
{
  // one moment told by two sources (the festival opens, its milestone toast comes with it): it counts once, the heavier
  const ev = [E(10, 3, true, 'social', 'festival'), E(10.2, 2, true, 'travel', 'flyby'), E(10.4, 2, true, 'milestone', 'festival'), E(11.5, 2, true, 'travel', 'flyby'), E(40, 2, true, 'sky', 'balloon')];
  const m = SS.analyze({ t0: 0, t1: 60, events: ev, samples: [] });
  check(m.weighted.n === 3 && m.weighted.merged === 2 && m.spam.n === 1 && m.gaps.list.length === 4, `one moment told twice within 2 s (the festival and its milestone toast; a flyby seen twice) counts once: ${m.weighted.n} weighted, ${m.weighted.merged} merged, spam ${m.spam.n}`);
}
{
  const m = SS.analyze({ t0: 0, t1: 300, events: [E(10, 4, true, 'encounter'), E(50, 4, true, 'story'), E(200, 5, true, 'milestone'), E(250, 4, false, 'encounter')], samples: [] });
  check(m.majors.n === 3 && near(m.majors.perMin, 0.6) && m.majors.close === 1, `majors (weight ≥ 4 in view): ${m.majors.n}, ${m.majors.perMin} a minute, ${m.majors.close} pair under 60 s`);
  check(m.encounters.n === 2 && near(m.encounters.per10, 4) && m.story.n === 1 && near(m.story.per10, 2), `encounters ${m.encounters.n} (${m.encounters.per10} / 10 min, in view or not), story beats ${m.story.n} (${m.story.per10} / 10 min)`);
}

// ---------------------------------------------------------------- the targets and the verdict
{
  const T = SS.TARGETS;
  check(['builder', 'adventurer', 'pilot'].every(k => T[k]), 'the three player types have targets');
  const row = (t, k) => T[t][k];
  check(row('builder', 'perMin')[1] === 1.5 && row('adventurer', 'perMin')[1] === 2.5 && row('pilot', 'perMin')[1] === 2.0, 'E§7: weighted events per minute ≥ 1.5 · 2.5 · 2.0');
  check(row('builder', 'longest')[1] === 90 && row('adventurer', 'longest')[1] === 60 && row('pilot', 'longest')[1] === 75, 'the longest gap ≤ 90 · 60 · 75 s');
  check(row('builder', 'p90')[1] === 50 && row('adventurer', 'p90')[1] === 35 && row('pilot', 'p90')[1] === 45, 'p90 gap ≤ 50 · 35 · 45 s');
  check(row('builder', 'movers')[1] === 0.7 && row('adventurer', 'movers')[1] === 0.75 && row('pilot', 'movers')[1] === 0.5, 'a moving actor in view ≥ 0.70 · 0.75 · 0.50');
  check(row('builder', 'lmSky')[1] === 0.6 && row('adventurer', 'lmSky')[1] === 0.5 && row('pilot', 'lmSky')[1] === 0.8, 'a landmark or sky event ≥ 0.60 · 0.50 · 0.80');
  check(row('builder', 'variety')[1] === 8 && row('adventurer', 'variety')[1] === 10 && row('pilot', 'variety')[1] === 8, 'variety ≥ 8 · 10 · 8');
  check(row('builder', 'spam')[1] === 2 && row('adventurer', 'spam')[1] === 3 && row('pilot', 'spam')[1] === 2, 'spam ≤ 2 · 3 · 2');
  check(JSON.stringify(row('builder', 'encounters')) === '["range",0,0]' && JSON.stringify(row('adventurer', 'encounters')) === '["range",2,4]' && JSON.stringify(row('pilot', 'encounters')) === '["range",0,1]', 'encounters per 10 min 0 · 2–4 · 0–1');
  check(row('builder', 'handsFree')[1] === 0.3 && row('adventurer', 'handsFree')[1] === 0.4 && row('pilot', 'handsFree')[1] === 0.6, 'hands-free ≥ 0.30 · 0.40 · 0.60');
  check(['builder', 'adventurer', 'pilot'].every(k => row(k, 'majors')[0] === '<=' && row(k, 'majors')[1] === 1), 'A§10: at most one major (weight ≥ 4) a minute, for everyone');
  check(!row('builder', 'story') && !!row('adventurer', 'story') && !row('pilot', 'story'), 'story beats: only the adventurer');
  check(SS.typeOf('walk') === 'builder' && SS.typeOf('builder') === 'builder' && SS.typeOf('pilot') === 'pilot', 'the walk is measured by the builder\'s targets');

  const good = { weighted: { perMin: 2 }, gaps: { longest: { d: 80 }, p90: 40 }, movers: 0.8, lmSky: 0.7, variety: { n: 9, full: true, window: 600 }, spam: { per10: 1 }, majors: { perMin: 0.2 }, encounters: { per10: 0 }, story: { per10: 0 }, handsFree: 0.35 };
  const V = SS.verdict(good, 'builder');
  check(V.type === 'builder' && V.met === V.total && V.total === 10 && V.rows.every(r => r.ok), `a session at the builder's targets meets all ${V.total} (${V.met})`);
  const bad = Object.assign({}, good, { gaps: { longest: { d: 120 }, p90: 40 }, handsFree: 0.1 });
  const B = SS.verdict(bad, 'walk');
  check(B.type === 'walk' && B.base === 'builder' && B.met === B.total - 2 && !B.rows.find(r => r.key === 'longest').ok && !B.rows.find(r => r.key === 'handsFree').ok, `a 120-s gap and a hands-free share of 0.1 miss two rows (${B.met}/${B.total})`);
  const A = SS.verdict(Object.assign({}, good, { encounters: { per10: 3 }, story: { per10: 0 } }), 'adventurer', { chapterOpen: true });
  check(A.rows.find(r => r.key === 'encounters').ok && !A.rows.find(r => r.key === 'story').ok && A.total === 11, `the adventurer: 3 encounters in the 2–4 range, no beat while a chapter is open misses (${A.met}/${A.total})`);
  const A2 = SS.verdict(Object.assign({}, good, { encounters: { per10: 3 } }), 'adventurer');
  check(A2.total === 10 && !A2.rows.find(r => r.key === 'story'), 'no chapter open: the story row is not counted');
  const short = SS.verdict(Object.assign({}, good, { variety: { n: 9, full: false, window: 300 } }), 'builder');
  const vr = short.rows.find(r => r.key === 'variety');
  check(vr.ok && /300|5/.test(vr.note || ''), `a session shorter than 10 minutes notes its window for variety (${vr.note})`);
  check(typeof SS.table === 'function' && /Builder|builder/.test(SS.table([['builder', good]])), 'a markdown table of metrics and targets for the plan and the review');
}

// ---------------------------------------------------------------- describing a gap
{
  const smp = [];
  for (let t = 0; t < 100; t++) smp.push(S(t + 0.5, { movers: t < 50 ? 0 : 2, landmark: t >= 30 && t < 40 ? 'citadel' : '', sky: t >= 80 ? 'low_sun' : '', input: t < 70 ? 'micro' : 'idle', place: t < 60 ? 'wild' : 'street', x: t, z: -t }));
  const ev = [E(10, 2, true, 'travel', 'cart'), E(90, 2, true, 'social', 'bells'), E(50, 1, true, 'ambient', 'birds'), E(60, 2, false, 'travel', 'flyby')];
  const m = SS.analyze({ t0: 0, t1: 100, events: ev, samples: smp });
  const G = SS.describeGap(m.gaps.longest, smp, ev);
  check(G.a === 10 && G.b === 90 && G.d === 80, `the longest gap 10 → 90 (${G.a} → ${G.b})`);
  check(G.places.wild === 50 && G.places.street === 30, `where: ${JSON.stringify(G.places)} samples`);
  check(near(G.movers, (0 * 40 + 2 * 40) / 80, 1e-9) && near(G.moversShare, 0.5), `what moved in view: ${G.movers} on average, in ${G.moversShare} of it`);
  check(G.landmarks.citadel === 10 && near(G.sky, 10 / 80), `the landmarks seen (${JSON.stringify(G.landmarks)}) and the sky (${G.sky})`);
  check(near(G.inputs.micro, 60 / 80) && near(G.inputs.idle, 20 / 80), `the input meanwhile ${JSON.stringify(G.inputs)}`);
  check(G.from && G.from[0] === 10 && G.to && G.to[0] === 89, `from (${G.from}) to (${G.to})`);
  check(G.inside.length === 2 && G.inside.some(e => e.sub === 'birds') && G.inside.some(e => e.sub === 'flyby' && !e.inView), 'what happened inside it but did not count: the birds (weight 1), the flyby out of view');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

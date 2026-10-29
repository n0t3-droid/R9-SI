// Die Regie (a-story; plan docs/superpowers/plans/2026-10-29-a-story.md §3, spec docs/superpowers/specs/
// 2026-10-22-abenteuer-design.md §10). The pure scheduler, src/main/regie.js Regie.Sched, on synthetic streams:
//   1. the rules one by one: spacing 8 s, one major a minute, story beats 5 min apart, Bauruhe ≤ 2, nothing during a
//      scene, the jittered target 18–42 s, not the kind of the last two
//   2. ten seeds × 30 min, a world with the life director's rotation offering 70 % of the time, the story's beat ready
//      from minute 2 on, encounters (w 4) offered now and then, independent sky events (meteors w 2, an aurora w 3) that
//      never ask, Bauruhe stretches of 40 s: the longest gap between weight-≥2 events ≤ 75 s (builder 90 s), every start
//      the Regie made or allowed ≥ 8 s after the one before, ≤ 1 major in any 60 s, beats ≥ 300 s apart, during Bauruhe
//      only weight ≤ 2, ≥ 1 beat per 10 min while the story has one ready
//   3. pure: the same seed and stream, the same choices; another seed, other choices
//   bash test/wt_run.sh regie.js 300
const fs = require('fs'), path = require('path');
global.VR = {};
const P = path.join(__dirname, '../src/main/regie.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
if (!fs.existsSync(P)) { console.log('  ✗ src/main/regie.js missing'); console.log('FAILED 1'); process.exit(1); }
require(P);
const R = VR.Regie, S = R.Sched;

console.log('1 · the rules');
{
  const q = new S(7);
  q.seen(10, 2, 'ambient');
  check(!q.allow(17.9, 2, 'ambient') && q.allow(18.1, 2, 'ambient'), 'spacing: 8 s after the last start');
  q.seen(20, 4, 'encounter');
  check(!q.allow(40, 4, 'encounter') && q.allow(40, 3, 'wow') && q.allow(80.1, 4, 'encounter'), 'one major a minute (weight 3 may come between)');
  q.seen(100, 4, 'story');
  check(!q.allow(390, 4, 'story') && q.allow(401, 4, 'story'), 'story beats 5 min apart');
  q.bauruhe = true;
  check(!q.allow(500, 3, 'wow') && q.allow(500, 2, 'ambient') && q.budget(500) === 2, 'Bauruhe: weight ≤ 2');
  q.bauruhe = false; q.scene = true;
  check(!q.allow(500, 1, 'ambient') && q.choose(500, [{ source: 'x', act: 'a', weight: 2, kind: 'ambient', start: () => true }], '') === null, 'nothing during a scene');
  q.scene = false;
  let lo = 99, hi = 0; for (let k = 0; k < 500; k++) { const v = q.jit(k); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  check(lo >= 18 && hi <= 42 && hi - lo > 20, `the jittered target ${lo.toFixed(1)}–${hi.toFixed(1)} s`);
  const q2 = new S(3); q2.seen(0, 2, 'sky'); q2.seen(10, 2, 'travel');
  const A = { source: 'a', act: 'birds', weight: 2, kind: 'sky' }, B = { source: 'a', act: 'cart', weight: 2, kind: 'ambient' };
  check(q2.choose(80, [A, B], 'plaza') === B && q2.choose(80, [A], 'plaza') === A, 'not the kind of the last two (unless nothing else)');
  check(q2.choose(12, [A, B], 'plaza') === null, 'no fill before the gap is due');
}

console.log('2 · synthetic streams');
function run(seed, o) {
  o = o || {};
  const q = new S(seed, { builder: !!o.builder });
  let x = (seed * 2654435761) >>> 0 || 1; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const ev = [], controlled = [], choices = [], DT = 0.25, DUR = o.dur || 1800;
  let bauUntil = -1, nextBau = 120 + rnd() * 200, nextSky = 20 + rnd() * 60, nextEnc = 60 + rnd() * 90, ldOn = true, ldFlip = 0;
  let storyReady = 120, storyAgain = 0;
  const KINDS = ['ambient', 'travel', 'sky', 'social'];
  for (let t = 0; t < DUR; t += DT) {
    // Bauruhe stretches (a builder at work)
    if (t >= nextBau) { bauUntil = t + 40; nextBau = t + 150 + rnd() * 200; }
    q.bauruhe = t < bauUntil;
    // the independent sky: a meteor (w 2) or an aurora (w 3), never asking
    if (t >= nextSky) { const w = rnd() < 0.2 ? 3 : 2; ev.push([t, w, 'sky', 'sky']); q.seen(t, w, 'sky'); nextSky = t + 40 + rnd() * 120; }
    // the life director's own slots (they ask: allow)
    if ((ldFlip -= DT) <= 0) { ldOn = rnd() < 0.7; ldFlip = 5 + rnd() * 20; }
    if (ldOn && Math.abs((t % 30) - 0) < DT / 2 && q.allow(t, 2, 'ambient')) { ev.push([t, 2, 'ambient', 'ld']); controlled.push([t, 2, 'ambient']); q.seen(t, 2, 'ambient'); }
    // the offers
    const offers = [];
    if (ldOn) offers.push({ source: 'ld', act: 'act' + Math.floor(t / 7) % 5, weight: 2, kind: KINDS[Math.floor(t / 7) % 4], start: () => true });
    if (t >= storyReady && t >= storyAgain) offers.push({ source: 'story', act: 'beat', weight: 4, kind: 'story', start: () => true });
    if (t >= nextEnc) offers.push({ source: 'foes', act: 'enc', weight: 4, kind: 'encounter', start: () => true });
    const of = q.choose(t, offers, 'wild');
    if (of) {
      of.start(); q.started(t, of); choices.push(of.act + '@' + t);
      ev.push([t, of.weight, of.kind, of.source]); controlled.push([t, of.weight, of.kind, q.bauruhe]);
      q.seen(t, of.weight, of.kind);
      if (of.kind === 'story') storyAgain = t + 30;   // (the next beat's conditions come half a minute later)
      if (of.kind === 'encounter') nextEnc = t + 90 + rnd() * 120;
    }
  }
  const w2 = ev.filter(e => e[1] >= 2).map(e => e[0]);
  let gap = w2.length ? w2[0] : DUR; for (let i = 1; i < w2.length; i++) gap = Math.max(gap, w2[i] - w2[i - 1]); gap = Math.max(gap, DUR - w2[w2.length - 1]);
  let space = Infinity; for (let i = 1; i < controlled.length; i++) space = Math.min(space, controlled[i][0] - controlled[i - 1][0]);
  const majors = ev.filter(e => e[1] >= 4 && e[3] !== 'sky').map(e => e[0]); let maj = Infinity; for (let i = 1; i < majors.length; i++) maj = Math.min(maj, majors[i] - majors[i - 1]);
  const beats = ev.filter(e => e[2] === 'story').map(e => e[0]); let bsp = Infinity; for (let i = 1; i < beats.length; i++) bsp = Math.min(bsp, beats[i] - beats[i - 1]);
  const bau = controlled.filter(c => c[3] === true && c[1] > 2).length;
  // beats per 10 min while one was ready (from minute 2)
  const perTen = beats.length / ((DUR - 120) / 600);
  return { gap, space, maj, bsp, bau, beats: beats.length, perTen, n: ev.length, choices };
}
let worst = { gap: 0, space: Infinity, maj: Infinity, bsp: Infinity, bau: 0, perTen: Infinity };
for (let s = 1; s <= 10; s++) { const r = run(s * 7919); worst.gap = Math.max(worst.gap, r.gap); worst.space = Math.min(worst.space, r.space); worst.maj = Math.min(worst.maj, r.maj); worst.bsp = Math.min(worst.bsp, r.bsp); worst.bau += r.bau; worst.perTen = Math.min(worst.perTen, r.perTen); }
check(worst.gap <= 75, `the longest gap ${worst.gap.toFixed(1)} s ≤ 75 s (10 seeds × 30 min)`);
check(worst.space >= 8, `every start the Regie made or allowed ≥ 8 s apart (closest ${worst.space.toFixed(2)} s)`);
check(worst.maj >= 60, `≤ 1 major a minute (closest two ${worst.maj.toFixed(1)} s apart)`);
check(worst.bsp >= 300, `story beats ≥ 5 min apart (closest ${worst.bsp.toFixed(1)} s)`);
check(worst.bau === 0, 'during Bauruhe nothing above weight 2 (' + worst.bau + ')');
check(worst.perTen >= 1, `≥ 1 beat per 10 min while one is ready (${worst.perTen.toFixed(2)})`);
let wb = 0; for (let s = 1; s <= 10; s++) wb = Math.max(wb, run(s * 104729, { builder: true }).gap);
check(wb <= 90, `builder: the longest gap ${wb.toFixed(1)} s ≤ 90 s`);

console.log('3 · pure');
const a = run(4242).choices.join(','), b = run(4242).choices.join(','), c = run(4243).choices.join(',');
check(a === b && a.length > 100, 'the same seed and stream: the same choices');
check(a !== c, 'another seed: other choices');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

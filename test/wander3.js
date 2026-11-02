// o-wander3 (R58-03) — the Wanderregisseur is no longer starved (docs/superpowers/plans/2026-11-02-o-wander3.md):
// the real W.Actor, the Regie and the event log walk 5 minutes over synthetic ground (test/wander3_sim.js) on a busy
// Herzwelt (other sources note a start every 11 s, a third of them seen; a craft closes in every 20 s) — before the fix
// 0 moments in 300 s (only the hard beats): now on flat land, in a forest, on a sky isle and mixed, Balanced and Very Low,
// a staged moment at least every 40 s, ≥ 8 in 5 min, never two of ours within 8 s; the instrument (why / stage) is there;
// a claim holds the other sources off, a story beat not.
//   bash test/wt_run.sh wander3.js 300
const S = require('./wander3_sim.js');
const V = global.VR;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const ext = []; for (let t = 5; t < 300; t += 11) ext.push({ t, seen: (t | 0) % 3 === 0 });
for (const tier of [2, 0]) for (const terrain of ['flat', 'forest', 'isle', 'mixed']) {
  const r = S.walk({ terrain, tier, ext, ships: true });
  const tag = `${tier ? 'Balanced' : 'Very Low'} · ${terrain}`;
  check(r.moments >= 8, `${tag}: ${r.moments} staged moments (+ ${r.beats} beats) in 5 min (≥ 8)`);
  check(r.mgap <= 40, `${tag}: the longest wait for a staged moment ${r.mgap} s (≤ 40)`);
  check(r.gap <= 40, `${tag}: the longest wait ${r.gap} s (≤ 40)`);
  check(r.close >= 8, `${tag}: two of ours ≥ 8 s apart (closest ${r.close} s)`);
  if (tier === 2 && terrain === 'flat') check(r.why && r.why.early > 0 && r.stage && r.stage.ok > 0, 'the instrument: why (seconds per reason) and the stage counts in stats()');
}
{ const r = S.walk({ terrain: 'flat', dur: 120 }); check(r.moments >= 4 && r.close >= 8, `a calm walk: ${r.moments} moments in 2 min, ≥ 8 s apart`); }
// the claim
{
  const g = V.game, R = V.Regie;
  R.claim(g, 3);
  check(R.claimed(g) && R.allow(g, 2, 'ambient', 'zz') === false, 'while the walker claims the slot another ambient source waits');
  const sp = R.of(g).sched; sp.lastBeat = -1e9; sp.lastStart = -1e9;
  check(R.allow(g, 2, 'story') === true, 'a story beat is not held by the claim');
  g.time += 3.1; check(!R.claimed(g), 'the claim runs out (≤ R.CLAIM s)');
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');

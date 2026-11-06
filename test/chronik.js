// r-chronik · VR.Chronik — the world simulation and its ledger (plan docs/superpowers/plans/2026-11-07-r-chronik.md).
// Pure rules (src/shared/chronik.js) on a synthetic region: determinism from seed + clock, the ecology's balance over
// 100 game days (no extinction, no explosion), village projects that complete, the ledger's cap and importance filter,
// save/load round-trip, catch-up after a long absence, the step's cost, the place names, the language keys.
//   bash test/wt_run.sh chronik.js 300
require('./load_shared.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
const fs = require('fs'), path = require('path');
const C = VR.Chronik, N = VR.Names;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
check(!!(C && C.create && C.advance && C.save && C.load && C.notable && C.deed), 'VR.Chronik is there');
if (!C) { console.log('FAILED 1'); process.exit(1); }

// a synthetic region: a lake in the middle, forest to the west, meadows east, hills north; three villages
const sample = (x, z) => {
  const d = Math.hypot(x - 100, z + 60);
  if (d < 150) return { b: 'water', h: 60, w: 1 };
  if (z < -500) return { b: 'cold', h: 120, w: 0.2 };
  if (x < -150) return { b: 'forest', h: 72, w: 0.6 };
  if (x > 500) return { b: 'dry', h: 70, w: 0.1 };
  return { b: 'meadow', h: 68, w: d < 300 ? 0.8 : 0.4 };
};
const VILS = [{ id: '0_0', name: 'Lindenau', x: 320, z: 200 }, { id: '1_0', name: 'Mohnbrunn', x: -380, z: 120 }, { id: '0_1', name: 'Kleefeld', x: 260, z: -420 }];
const mk = (seed) => C.create(seed, { ox: 0, oz: 0, sample, villages: VILS });

// ---------------------------------------------------------------- determinism
{
  const a = mk(4242), b = mk(4242), c = mk(77);
  for (const q of [a, b, c]) { for (let d = 1; d <= 10; d++) C.advance(q, d, 0); C.advance(q, 10, 6000); }
  check(JSON.stringify(C.save(a)) === JSON.stringify(C.save(b)), 'the same seed and clock → the same world (10 days)');
  check(JSON.stringify(C.save(a)) !== JSON.stringify(C.save(c)), 'another seed → another history');
  // stepping in small pieces equals one call (within the fine range: gaps ≤ 2 days)
  const s = mk(4242);
  for (let t = 0; t <= 10 * 24000 + 6000; t += 2400) C.advance(s, Math.floor(t / 24000), t % 24000);
  C.advance(s, 10, 6000);
  check(JSON.stringify(C.save(s)) === JSON.stringify(C.save(a)), 'many small steps = the same world as one advance');
  const z = mk(4242); const r0 = C.advance(z, 0, 0);
  check(r0.events.length === 0 && r0.out.length === 0 && z.ev.length === 0, 'at t = 0 nothing happens (golden: a deterministic no-op)');
}

// ---------------------------------------------------------------- ecology over 100 game days
{
  const s = mk(9001), hist = [];
  for (let d = 1; d <= 100; d++) { C.advance(s, d, 0); hist.push(C.totals(s)); }
  const n0 = C.totals(mk(9001)), last = hist[hist.length - 1];
  let minA = [1e9, 1e9, 1e9, 1e9], maxA = [0, 0, 0, 0], minP = [1e9, 1e9, 1e9, 1e9], maxP = [0, 0, 0, 0];
  for (const h of hist) for (let k = 0; k < 4; k++) { minA[k] = Math.min(minA[k], h.animals[k]); maxA[k] = Math.max(maxA[k], h.animals[k]); minP[k] = Math.min(minP[k], h.plants[k]); maxP[k] = Math.max(maxP[k], h.plants[k]); }
  console.log('    animals start ' + n0.animals.map(v => v.toFixed(0)).join('/') + ' · min ' + minA.map(v => v.toFixed(0)).join('/') + ' · max ' + maxA.map(v => v.toFixed(0)).join('/') + ' · day 100 ' + last.animals.map(v => v.toFixed(0)).join('/'));
  console.log('    plants  start ' + n0.plants.map(v => v.toFixed(0)).join('/') + ' · min ' + minP.map(v => v.toFixed(0)).join('/') + ' · max ' + maxP.map(v => v.toFixed(0)).join('/'));
  check(minA.every((v, k) => v >= Math.max(3, n0.animals[k] * 0.25)), 'no species dies out (each ≥ ¼ of its start, ≥ 3)');
  check(maxA.every((v, k) => v <= n0.animals[k] * 4 + 10 && v <= s.cap.animals[k]), 'no explosion (each ≤ 4 × its start and ≤ the land\'s capacity)');
  check(minP.every((v, k) => v > n0.plants[k] * 0.3) && maxP.every((v, k) => v <= s.n * 1.0001), 'plant cover stays between 30 % of its start and full');
  // seasons: the flowers bloom in spring/summer and fade in autumn/winter (the year: 12 days)
  const fl = (d) => hist[d - 1].plants[0];
  check(fl(89) > fl(84) * 1.02 || fl(90) > fl(85), 'the meadow flowers grow back in spring');
  const year = [];
  for (let d = 85; d <= 96; d++) year.push(fl(d));
  check(Math.max(...year.slice(0, 6)) > Math.min(...year.slice(6)) * 1.05, 'flowers: spring/summer above autumn/winter (' + year.map(v => v.toFixed(0)).join(' ') + ')');
  const kinds = {}; for (const e of s.ev) kinds[e.k] = (kinds[e.k] || 0) + 1;
  console.log('    ledger kinds ' + JSON.stringify(kinds));
  check(kinds.born > 0, 'families are born (' + (kinds.born | 0) + ')');
  check((kinds.built | 0) > 0 && (kinds.fell | 0) + (kinds.storm | 0) + (kinds.rain | 0) > 0, 'buildings and weather in the ledger');
  check(s.ev.length <= C.MAXEV, 'the ledger is capped (' + s.ev.length + ' ≤ ' + C.MAXEV + ')');
  check(s.ev.every((e, i) => i === 0 || e.i > s.ev[i - 1].i), 'events in order');
  check(C.families(s).length > 0 || kinds.born > 0, 'families tracked');
}

// ---------------------------------------------------------------- villages
{
  const s = mk(31), outs = [];
  for (let d = 1; d <= 30; d++) { const r = C.advance(s, d, 0); for (const o of r.out) outs.push(o); }
  const v0 = s.vil[0];
  console.log('    ' + s.vil.map(v => v.name + ' ' + JSON.stringify(v.res) + ' built ' + v.built.join(',') + (v.proj ? ' proj ' + v.proj.k + ' ' + v.proj.p.toFixed(2) : '')).join(' · '));
  check(outs.length >= 3, 'building projects complete within 30 days (' + outs.length + ': ' + outs.map(o => o.vid + ':' + o.k).join(' ') + ')');
  check(outs.every(o => o.d >= 2), 'nothing is built in the first two game days');
  check(s.vil.every(v => ['wood', 'grain', 'stone', 'cloth'].every((r, k) => Number.isInteger(v.res[k]) && v.res[k] >= 0 && v.res[k] < 100000)), 'resources stay whole numbers in range');
  check(s.ev.some(e => e.k === 'trade'), 'villages trade with their neighbours');
  check(s.ev.some(e => e.k === 'built' && e.v.vil), 'a finished building is in the ledger with its village');
  void v0;
}

// ---------------------------------------------------------------- ledger: deeds, importance, text
{
  const s = mk(5);
  C.advance(s, 4, 12000);
  const e = C.deed(s, 'freed', { x: 300, z: 210 });
  check(e && e.imp >= 7 && s.ev[s.ev.length - 1] === e, 'a deed of the player is written with its importance (' + (e && e.imp) + ')');
  const top = C.notable(s, 5, 10);
  check(top.length > 0 && top.every(x => x.imp >= 5) && top.length <= 10, 'notable(5) returns only important events (' + top.length + ')');
  check(top.every((x, i) => i === 0 || x.i < top[i - 1].i), 'notable: newest first');
  VR.I18N.set ? VR.I18N.set('de') : (VR.I18N.lang = 'de');
  const de = C.text(e, s), born = s.ev.find(x => x.k === 'born');
  check(/Leuchtfeuer|Außenposten|befreit/.test(de), 'deed text (de): ' + de);
  if (born) { const t = C.text(born, s); check(/familie|Familie/.test(t) && !/\{|undefined/.test(t), 'born text (de): ' + t); }
  VR.I18N.set ? VR.I18N.set('en') : (VR.I18N.lang = 'en');
  if (born) { const t = C.text(born, s); check(/family/.test(t) && !/\{|undefined/.test(t), 'born text (en): ' + t); }
  let bad = 0; for (const x of s.ev) { for (const L of ['de', 'en']) { VR.I18N.set ? VR.I18N.set(L) : (VR.I18N.lang = L); const t = C.text(x, s); if (!t || /\{|undefined|NaN/.test(t)) { bad++; if (bad < 4) console.log('      bad: ' + L + ' ' + x.k + ' ' + t); } } }
  check(bad === 0, 'every event reads well in both languages (' + s.ev.length + ' events)');
  VR.I18N.set ? VR.I18N.set('de') : (VR.I18N.lang = 'de');
}

// ---------------------------------------------------------------- save / load
{
  const s = mk(123);
  C.advance(s, 7, 9000); C.deed(s, 'befriend', { x: 10, z: 10, sp: 'fox' });
  const o = C.save(s), txt = JSON.stringify(o);
  const r = C.load(JSON.parse(txt));
  check(JSON.stringify(C.save(r)) === txt, 'save → load → save is the same (' + (txt.length / 1024).toFixed(1) + ' KB)');
  check(txt.length < 60000, 'the save is compact (< 60 KB)');
  C.advance(s, 12, 3000); C.advance(r, 12, 3000);
  check(JSON.stringify(C.save(r)) === JSON.stringify(C.save(s)), 'a loaded world goes on exactly like the original');
  check(C.load(null) === null && C.load({ v: 99 }) === null && C.load({ v: 1, junk: 1 }) === null, 'a missing, newer or broken save → null (a fresh Chronik)');
}

// ---------------------------------------------------------------- catch-up
{
  const fine = mk(777), coarse = mk(777);
  for (let d = 1; d <= 24; d++) for (let h = 0; h < 24000; h += 4000) C.advance(fine, d, h);
  C.advance(fine, 25, 0);
  const r = C.advance(coarse, 25, 0);
  const tf = C.totals(fine), tc = C.totals(coarse);
  console.log('    fine ' + tf.animals.map(v => v.toFixed(0)).join('/') + ' · catch-up ' + tc.animals.map(v => v.toFixed(0)).join('/') + ' · built ' + fine.vil.map(v => v.built.length).join('/') + ' vs ' + coarse.vil.map(v => v.built.length).join('/'));
  check(coarse.t === fine.t && coarse.day === 25, 'the catch-up reaches the clock');
  check(tc.animals.every((v, k) => Math.abs(v - tf.animals[k]) <= Math.max(6, tf.animals[k] * 0.3)), 'animals after a catch-up within 30 % of the fine run');
  check(tc.plants.every((v, k) => Math.abs(v - tf.plants[k]) <= Math.max(4, tf.plants[k] * 0.15)), 'plants after a catch-up within 15 %');
  check(coarse.vil.every((v, i) => Math.abs(v.built.length - fine.vil[i].built.length) <= 1), 'the villages built about as much');
  check(r.events.length <= 30, 'a catch-up does not flood the ledger (' + r.events.length + ' new)');
  const far = mk(778); const t0 = Date.now(); C.advance(far, 400, 0); const ms = Date.now() - t0;
  check(far.day === 400 && ms < 1500, 'a year-long absence catches up quickly (' + ms + ' ms)');
}

// ---------------------------------------------------------------- cost
// every game minute for two days; a day's boundary (the heavy step) timed as the best of 3 clones of the same state —
// this 2-CPU machine runs other agents' browsers, so one timing alone measures their load as much as ours
{
  const w = mk(41); for (let d = 1; d <= 40; d++) C.advance(w, d, 0); for (let i = 0; i < 30; i++) C.advance(C.load(C.save(w)), 40, 1000 + i * 700);   // (the JIT warm: steady state, as in the worker after its first minutes)
  const s = mk(42); C.advance(s, 3, 0);
  const ms = (f) => { const t0 = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t0) / 1e6; };
  let worst = 0, sum = 0, n = 0, worstDay = 0, rawDay = 0;
  for (let m = 1; m <= 1440 * 6; m++) {
    const t = 3 * 1440 + m, day = Math.floor(t / 1440), tod = Math.round((t % 1440) * 24000 / 1440);
    if (t % 60 === 0) {
      const best = Math.min(...[0, 1, 2].map(() => { const k = C.load(C.save(s)); return ms(() => C.advance(k, day, tod)); }));
      rawDay = Math.max(rawDay, ms(() => C.advance(s, day, tod)));
      if (t % 1440 === 0) worstDay = Math.max(worstDay, best); else if (best > worst) { worst = best; s.worstM = m; }
      sum += best; n++;
      continue;
    }
    const x = ms(() => C.advance(s, day, tod)); sum += x; n++; if (x > worst && m > 2) worst = x;
  }
  console.log('    per game minute: mean ' + (sum / n).toFixed(4) + ' ms · worst hour/minute step ' + worst.toFixed(3) + ' ms (minute ' + s.worstM + ') · worst day boundary ' + worstDay.toFixed(3) + ' ms (boundaries: best of 3 clones; single-shot worst ' + rawDay.toFixed(2) + ' ms)');
  check(worst <= 2 && worstDay <= 2, 'the sim\'s tick ≤ 2 ms per game-minute step (minutes ' + worst.toFixed(3) + ' ms, day boundary ' + worstDay.toFixed(3) + ' ms)');
}

// ---------------------------------------------------------------- places and names
{
  const names = new Set();
  for (const k of ['born', 'fell', 'bloom', 'storm', 'rain', 'wander']) for (const b of ['meadow', 'forest', 'water', 'cold', 'dry', 'shore']) for (let s = 0; s < 40; s++) {
    const p = N.chronikPlace(k, b, s * 7919 + 3);
    if (!p || !p.de || !p.en || !p.inDe || !p.inEn) { check(false, 'place name for ' + k + '/' + b); continue; }
    names.add(p.de);
    if (N.blocked(p.de) || N.reserved(p.de) || N.blocked(p.en)) check(false, 'blocked place name ' + p.de + ' / ' + p.en);
    if (/^(Rehau|Silbersee|Düsterwald|Auenland|Bruchtal|Nebelberge|Fangorn)$/i.test(p.de)) check(false, 'a famous fictional place: ' + p.de);
  }
  check(names.size >= 60, 'many different place names (' + names.size + ': ' + [...names].slice(0, 8).join(', ') + ' …)');
  const s = mk(4242); C.advance(s, 20, 0);
  const pl = Object.values(s.pl);
  check(pl.length > 0 && pl.length <= 80, 'places get names from what happened there (' + pl.length + ': ' + pl.slice(0, 5).map(p => p.de + '/' + p.en).join(', ') + ')');
}

// ---------------------------------------------------------------- language keys
{
  const de = VR.I18N.dict.de, en = VR.I18N.dict.en;
  const miss = C.KEYS.filter(k => !(de && de[k] !== undefined) || !(en && en[k] !== undefined));
  check(C.KEYS.length > 20 && miss.length === 0, 'every Chronik key in both tables (' + C.KEYS.length + (miss.length ? ', missing ' + miss.slice(0, 6).join(' ') : '') + ')');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

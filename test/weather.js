// A1 Atmosphäre — the weather machine (src/main/weather.js): a deterministic schedule from the world seed and the
// absolute time (host and guests agree), biome-weighted kinds, /wetter, the comfort modes, smooth transitions, the wet
// ground and the rainbow after rain, dawn fog in valleys, lightning with thunder delayed by distance, the MP sync.
const ROOT = '/home/claude/vr';
require(ROOT + '/src/shared/core.js'); require(ROOT + '/src/shared/biomes.js');
try { require(ROOT + '/src/main/weather.js'); } catch (e) { console.log('  (weather.js: ' + e.message.split('\n')[0] + ')'); }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const W = VR.Weather, B = (k) => VR.biomeByKey(k);
check(typeof W === 'function', 'VR.Weather exists');
if (typeof W !== 'function') { console.log('FAIL ' + fails); process.exit(1); }

// ---------------------------------------------------------------- 1. climate of a biome
check(W.climate(B('plains')) === 'temperate' && W.climate(B('forest')) === 'temperate', 'plains and forest are temperate');
check(W.climate(B('desert')) === 'dry' && W.climate(B('badlands')) === 'dry', 'desert and badlands are dry');
check(W.climate(B('jungle')) === 'wet' && W.climate(B('swamp')) === 'wet', 'jungle and swamp are wet');
check(W.climate(B('snowy_plains')) === 'cold' && W.climate(B('frozen_peaks')) === 'cold', 'snowy plains and frozen peaks are cold');
check(W.climate(B('ember_wastes')) === null && W.climate(B('hollow_core')) === null, 'the Underforge and the Hollow have no weather');
check(W.climate(B('drift_isles')) === 'temperate', 'the Drift isles have weather');

// ---------------------------------------------------------------- 2. the schedule
const seed = 4242;
const a = W.slotAt(seed, 300000), b = W.slotAt(seed, 300000);
check(JSON.stringify(a) === JSON.stringify(b), 'the same seed and time give the same slot');
check(a.start <= 300000 && 300000 < a.end, 'the slot contains the time asked for');
check(JSON.stringify(W.slotAt(seed, a.start)) === JSON.stringify(a) && JSON.stringify(W.slotAt(seed, a.end - 1)) === JSON.stringify(a), 'every tick of a slot maps to that slot');
// contiguous, 5–20 minutes (6000–24000 ticks; a short remainder joins its neighbour, so at most 30000)
let T = 24000, ok = true, minL = 1e9, maxL = 0, n = 0, prevEnd = null;
while (T < 24000 * 40) { const s = W.slotAt(seed, T); const L = s.end - s.start; minL = Math.min(minL, L); maxL = Math.max(maxL, L); if (prevEnd !== null && s.start !== prevEnd) ok = false; prevEnd = s.end; T = s.end; n++; }
check(ok, 'slots follow each other without gaps or overlaps over 40 days (' + n + ' slots)');
check(minL >= 6000 && maxL <= 30000, 'slot lengths between 6000 and 30000 ticks (' + minL + '…' + maxL + ')');
// another seed: another sequence
let differ = 0, cmp = 0;
for (let t = 24000 * 2; t < 24000 * 200; t += 7919) { cmp++; if (W.slotAt(seed, t).u !== W.slotAt(seed + 1, t).u) differ++; }
check(differ / cmp > 0.3, 'another seed gives another sequence (' + differ + '/' + cmp + ' differ)');
// far in the future: still cheap
const t0 = process.hrtime.bigint(); for (let i = 0; i < 1000; i++) W.slotAt(seed, 1e9 + i * 5000); const us = Number(process.hrtime.bigint() - t0) / 1000 / 1000;
check(us < 1000, 'a slot a billion ticks ahead costs ' + us.toFixed(1) + ' µs (< 1 ms)');

// ---------------------------------------------------------------- 3. kinds by climate
check(W.kindFor(0.0, 'temperate') === 'clear' && W.kindFor(0.5, 'temperate') === 'cloudy' && W.kindFor(0.75, 'temperate') === 'fog' && W.kindFor(0.9, 'temperate') === 'rain' && W.kindFor(0.99, 'temperate') === 'storm', 'temperate 45/25/10/15/5: u 0 clear · 0.5 cloudy · 0.75 fog · 0.9 rain · 0.99 storm');
check(W.kindFor(0.9, 'dry') === 'cloudy' && W.kindFor(0.99, 'dry') === 'fog' && W.kindFor(0.8, 'dry') === 'clear', 'dry 85/10/5: u 0.8 clear · 0.9 cloudy · 0.99 fog');
check(W.kindFor(0.9, 'cold') === 'snow' && W.kindFor(0.5, 'cold') === 'cloudy', 'cold: the shower that rains in temperate land snows');
check(W.kindFor(0.6, 'wet') === 'fog' && W.kindFor(0.7, 'wet') === 'rain' && W.kindFor(0.95, 'wet') === 'storm', 'wet 30/25/10/25/10: u 0.6 fog · 0.7 rain · 0.95 storm');
const freq = (cl) => { const c = {}; let N = 0; for (let k = 0; k < 4000; k++) { const s = W.slotAt(seed, 24000 * 3 + k * 23000); const kd = W.kindFor(s.u, cl); c[kd] = (c[kd] || 0) + 1; N++; } for (const x in c) c[x] = Math.round(c[x] / N * 100); return c; };
const near = (v, w) => Math.abs((v || 0) - w) <= 4;
const ft = freq('temperate'), fd = freq('dry'), fw = freq('wet'), fc = freq('cold');
check(near(ft.clear, 45) && near(ft.cloudy, 25) && near(ft.fog, 10) && near(ft.rain, 15) && near(ft.storm, 5), 'temperate frequencies ≈ 45/25/10/15/5: ' + JSON.stringify(ft));
check(near(fd.clear, 85) && near(fd.cloudy, 10) && near(fd.fog, 5) && !fd.rain && !fd.storm && !fd.snow, 'dry ≈ 85/10/5 and never rain: ' + JSON.stringify(fd));
check(near(fw.clear, 30) && near(fw.rain, 25) && near(fw.storm, 10), 'wet ≈ 30/25/10/25/10: ' + JSON.stringify(fw));
check(near(fc.snow, 25) && !fc.rain && !fc.storm, 'cold snows instead of raining: ' + JSON.stringify(fc));
// a new world starts fair: the whole first day is clear
let firstDay = true; for (let t = 0; t < 24000; t += 500) if (new W(seed).kindAt(t, 'wet') !== 'clear') firstDay = false;
check(firstDay, 'the first day of a world is clear');
check(W.absTicks({ day: 3, ticks: 1500 }) === 73500, 'absolute ticks = day · 24000 + ticks');

console.log(fails ? 'FAIL ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

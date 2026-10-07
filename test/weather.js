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

// ---------------------------------------------------------------- 4. the session: /wetter, comfort modes, Zen lock
const plains = B('plains'), snowy = B('snowy_plains');
// a time in the future whose scheduled temperate kind is clear (so a forced kind is visible)
let Tc = 24000 * 5; const wq = new W(seed); while (wq.kindAt(Tc, 'temperate') !== 'clear') Tc += 3000;
const ws = new W(seed);
ws.force('storm', Tc, 12000);
check(ws.kindAt(Tc + 100, 'temperate') === 'storm' && ws.kindAt(Tc + 11900, 'temperate') === 'storm', '/wetter gewitter holds for 12000 ticks');
check(ws.kindAt(Tc + 12001, 'temperate') === wq.kindAt(Tc + 12001, 'temperate'), '… then the schedule takes over again');
ws.force(null, Tc);
check(ws.kindAt(Tc + 100, 'temperate') === 'clear', '/wetter auto returns to the schedule at once');
check(ws.force('hagel', Tc) === false, 'an unknown kind is refused');
// calm: only clear and cloudy; off: always clear
const wc = new W(seed); wc.mode = 'calm'; const wo = new W(seed); wo.mode = 'off';
let calmOk = true, offOk = true, normalKinds = new Set();
for (let t = 24000 * 2; t < 24000 * 60; t += 4999) { const k = wc.kindAt(t, 'wet'); if (k !== 'clear' && k !== 'cloudy') calmOk = false; if (wo.kindAt(t, 'wet') !== 'clear') offOk = false; normalKinds.add(new W(seed).kindAt(t, 'wet')); }
check(normalKinds.has('storm') && normalKinds.has('rain') && normalKinds.has('fog'), 'normal mode has every kind of a wet climate: ' + [...normalKinds].join(' '));
check(calmOk, '„Ruhig" only ever shows clear or cloudy skies');
check(offOk, '„Aus" is always clear');
wc.force('storm', Tc); check(wc.kindAt(Tc + 10, 'temperate') === 'cloudy', '„Ruhig" also tames a forced storm');

// ---------------------------------------------------------------- 5. smooth transitions
const ctx = (T, o) => Object.assign({ T, biome: plains, y: 70, tod: 6000, sunUp: 1, nearWater: false }, o || {});
const run = (w, T0, secs, o, each) => { let T = T0; for (let i = 0; i < secs * 10; i++) { T += 2; const S = w.update(0.1, ctx(T, o)); if (each) each(S, i / 10); } return T; };
const wt = new W(seed);
let Tn = run(wt, Tc, 30);   // settle in clear weather
check(wt.update(0.1, ctx(Tn)).rain === 0, 'clear weather: no rain');
wt.force('rain', Tn);
let r1 = 0, r60 = 0; Tn = run(wt, Tn, 60, null, (S, t) => { if (Math.abs(t - 0.9) < 0.01) r1 = S.rain; if (Math.abs(t - 59.9) < 0.01) r60 = S.rain; });
check(r1 > 0 && r1 < 0.2, 'rain eases in: ' + r1.toFixed(3) + ' after 1 s');
check(r60 > 0.9, '… and pours after a minute: ' + r60.toFixed(3));
const S60 = wt.update(0.1, ctx(Tn));
check(S60.cloud > 0.8 && S60.sunMul < 0.4 && S60.wind >= 1.9, 'rain: clouds ' + S60.cloud.toFixed(2) + ', sun ×' + S60.sunMul.toFixed(2) + ', wind ' + S60.wind.toFixed(2));
// a jump in time (sleep, /time set) never makes the sky flash: values move by the same small step
const before = wt.update(0.1, ctx(Tn)).rain; wt.force(null, Tn); const after = wt.update(0.1, ctx(Tn + 24000 * 3)).rain;
check(Math.abs(after - before) < 0.05, 'a jump of three days moves the rain smoothly (' + before.toFixed(3) + ' → ' + after.toFixed(3) + ')');

// ---------------------------------------------------------------- 6. the wet ground and the rainbow
const wr = new W(seed);
let T2 = run(wr, Tc, 10);
wr.force('rain', T2);
let rbRain = 0; T2 = run(wr, T2, 120, null, (S) => { rbRain = Math.max(rbRain, S.rainbow); });
const wetRain = wr.update(0.1, ctx(T2)).wet;
check(wetRain > 0.9, 'two minutes of rain: the ground is wet (' + wetRain.toFixed(2) + ')');
check(rbRain === 0, 'no rainbow while it rains');
wr.force('clear', T2);
let rbAfter = 0; T2 = run(wr, T2, 45, null, (S) => { rbAfter = Math.max(rbAfter, S.rainbow); });
check(rbAfter > 0.1 && rbAfter <= 0.35, 'after the rain, in sunshine: a rainbow (alpha ' + rbAfter.toFixed(2) + ' ≤ 0.35)');
const wNight = new W(seed); let T3 = run(wNight, Tc, 10); wNight.force('rain', T3); T3 = run(wNight, T3, 120); wNight.force('clear', T3);
let rbNight = 0; run(wNight, T3, 45, { sunUp: 0 }, (S) => { rbNight = Math.max(rbNight, S.rainbow); });
check(rbNight === 0, 'no rainbow without the sun');
T2 = run(wr, T2, 180);
check(wr.update(0.1, ctx(T2)).wet < 0.3, 'three more minutes of sunshine dry the ground (' + wr.update(0.1, ctx(T2)).wet.toFixed(2) + ')');

// ---------------------------------------------------------------- 7. fog: thick at dawn in the valley, light by day
const wf = new W(seed); wf.force('fog', Tc);
const fogDawn = (() => { wf.update(0.1, ctx(Tc + 10, { tod: 23500, y: 66 })); wf.snap(); return wf.update(0.1, ctx(Tc + 12, { tod: 23500, y: 66 })); })();
check(Math.abs(fogDawn.fogMul - 3) < 0.05 && fogDawn.fogEnd === 48, 'dawn fog in the valley: density ×' + fogDawn.fogMul.toFixed(2) + ', fog end ' + fogDawn.fogEnd);
check(fogDawn.fogLayer[1] > 0 && fogDawn.fogLayer[0] > 63 && fogDawn.fogLayer[0] < 80, 'a fog layer lies in the valley (top ' + fogDawn.fogLayer[0] + ', density ' + fogDawn.fogLayer[1].toFixed(3) + ')');
const fogHill = (() => { wf.update(0.1, ctx(Tc + 14, { tod: 23500, y: 120 })); wf.snap(); return wf.update(0.1, ctx(Tc + 16, { tod: 23500, y: 120 })); })();
check(fogHill.fogMul < 2 && fogHill.fogLayer[1] > 0, 'from the hill the fog lies below (density ×' + fogHill.fogMul.toFixed(2) + ', the layer stays)');
const fogNoon = (() => { wf.update(0.1, ctx(Tc + 18, { tod: 6000, y: 66 })); wf.snap(); return wf.update(0.1, ctx(Tc + 20, { tod: 6000, y: 66 })); })();
check(fogNoon.fogMul < 3 && fogNoon.fogEnd > 48, 'by noon the fog has thinned (density ×' + fogNoon.fogMul.toFixed(2) + ', fog end ' + fogNoon.fogEnd + ')');
const fogLake = (() => { wf.update(0.1, ctx(Tc + 22, { tod: 1000, y: 110, nearWater: true })); wf.snap(); return wf.update(0.1, ctx(Tc + 24, { tod: 1000, y: 110, nearWater: true })); })();
check(Math.abs(fogLake.fogMul - 3) < 0.05, 'dawn fog over water, even up high (density ×' + fogLake.fogMul.toFixed(2) + ')');

// ---------------------------------------------------------------- 8. snow where it is cold
const wsn = new W(seed); wsn.force('rain', Tc); wsn.update(0.1, ctx(Tc, { biome: snowy })); wsn.snap();
const Ssn = wsn.update(0.1, ctx(Tc + 2, { biome: snowy }));
check(Ssn.snow > 0.9 && Ssn.rain === 0 && wsn.snowing, 'a forced shower over the snowy plains falls as snow');

// ---------------------------------------------------------------- 9. lightning and thunder
let rs = 1; const rand = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const wl = new W(seed); wl.rand = rand; wl.force('storm', Tc);
const strikes = []; let flashes = 0;
run(wl, Tc, 120, null, () => { const s = wl.takeStrike(); if (s) { strikes.push(s); if (s.flash > 0) flashes++; } });
check(strikes.length >= 4 && strikes.length <= 15, 'a two-minute storm: ' + strikes.length + ' strikes (every 8–25 s)');
check(strikes.every(s => s.delay >= 0.5 && s.delay <= 4 && Math.abs(s.delay - s.dist / 343) < 0.01), 'thunder follows 0.5–4 s later, by distance (' + strikes.map(s => s.delay.toFixed(1)).join(' ') + ')');
check(strikes.every(s => s.flash >= 0.25 && s.flash <= 1 && s.gain > 0 && s.gain <= 1) && strikes.some(s => s.flash > 0.6) || strikes.length < 3, 'near strikes flash brighter');
const wl2 = new W(seed); wl2.rand = rand; wl2.mode = 'off'; wl2.force('storm', Tc); let n2 = 0;
run(wl2, Tc, 60, null, () => { if (wl2.takeStrike()) n2++; });
check(n2 === 0, '„Aus": no lightning');

// ---------------------------------------------------------------- 10. the guests see the host's forced weather
const host = new W(seed), guest = new W(seed);
host.force('fog', Tc, 9000);
guest.fromNet(JSON.parse(JSON.stringify(host.toNet())));
check(guest.kindAt(Tc + 100, 'temperate') === 'fog' && guest.kindAt(Tc + 9100, 'temperate') === host.kindAt(Tc + 9100, 'temperate'), 'a forced kind reaches the guests and ends at the same tick');
host.force(null, Tc); guest.fromNet(host.toNet());
check(guest.kindAt(Tc + 100, 'temperate') === 'clear', '… and so does /wetter auto');
check(W.CLEAR && W.CLEAR.rain === 0 && W.CLEAR.cloud === 0.2 && W.CLEAR.sunMul === 1, 'VR.Weather.CLEAR is the clear sample (today\'s sky)');

console.log(fails ? 'FAIL ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// Weather machine (A1 Atmosphäre): the schedule is a pure function of the world seed, the day and the climate, so
// the host and every guest agree; climates follow the biomes; Nebel only at dawn; transitions are smooth; bolts come
// every 8–25 s and are heard 0.5–4 s later.
//   bash test/wt_run.sh weather.js
require('./load_shared.js');
require('../src/main/weather.js');
const WX = VR.WX, DAY = 24000;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const B = (k) => VR.biomeByKey(k);
const SEED = 424242, OTHER = 7;

// ---- climates: from the biome table (src/shared/biomes.js), caves and the Underforge / Hollow have no weather
const cl = (k) => WX.climateOf(B(k), 'overworld');
check(cl('desert') === 'dry' && cl('savanna') === 'dry' && cl('badlands') === 'dry', 'deserts, savannas and badlands are dry');
check(cl('plains') === 'temperate' && cl('beach') === 'temperate' && cl('drift_isles') === 'temperate', 'plains, beaches and the drift isles are temperate');
check(cl('meadow') === 'wet' && cl('jungle') === 'wet' && cl('swamp') === 'wet', 'meadows, jungles and swamps are wet');
check(cl('snowy_plains') === 'cold' && cl('frozen_peaks') === 'cold' && cl('snowy_taiga') === 'cold', 'snowy biomes are cold');
check(cl('deep_dark') === 'none' && cl('hollow_core') === 'none' && cl('ember_wastes') === 'none', 'caves, the Hollow and the Underforge have no weather');
check(WX.climateOf(B('plains'), 'underforge') === 'none' && WX.climateOf(null, 'overworld') === 'temperate', 'the Underforge dimension has no weather; no biome means temperate');

// ---- determinism: the same seed and time give the same weather, another seed gives other weather
let same = true, differ = 0, samples = 0;
for (let A = 0; A < 40 * DAY; A += 997) {
  const a = WX.kindAt(SEED, A, 'temperate', 'normal'), b = WX.kindAt(SEED, A, 'temperate', 'normal');
  if (a !== b) same = false;
  samples++; if (a !== WX.kindAt(OTHER, A, 'temperate', 'normal')) differ++;
}
check(same, 'the same seed and time always give the same kind');
check(differ > samples / 4, 'another seed gives other weather (' + differ + ' of ' + samples + ' samples differ)');
check(JSON.stringify(WX.slotAt(SEED, 123456)) === JSON.stringify(WX.slotAt(SEED, 123456)), 'the slot of a time is stable');

// ---- slots: 5–20 real minutes (6000–23999 ticks at 20 ticks a second), contiguous, varied
{
  let A = 0, lens = [], ok = true;
  for (let i = 0; i < 300; i++) {
    const s = WX.slotAt(SEED, A);
    if (!(s.start <= A && A < s.end)) ok = false;
    lens.push(s.end - s.start); A = s.end;
  }
  check(ok, 'every time falls into exactly one slot, and the slots follow each other');
  check(lens.every(l => l >= 6000 && l <= 23999), 'slots last 5–20 minutes (6000–23999 ticks)');
  check(new Set(lens).size > 100, 'slot lengths vary (' + new Set(lens).size + ' different lengths in 300 slots)');
}

// ---- the first day is fair: no rain, snow, storm or fog at all
{
  let bad = 0;
  for (const climate of ['dry', 'temperate', 'wet', 'cold']) for (let A = 0; A < DAY; A += 37) {
    const k = WX.kindAt(SEED, A, climate, 'normal'); if (!['klar', 'bewoelkt'].includes(k)) bad++;
  }
  check(bad === 0, 'the first day is fair in every climate');
}

// ---- climate rules over many days
const KINDS_OF = (climate, mode, days) => {
  const seen = {};
  for (let d = 0; d < days; d++) for (let t = 0; t < DAY; t += 113) {
    const k = WX.kindAt(SEED, d * DAY + t, climate, mode || 'normal'); seen[k] = (seen[k] || 0) + 1;
  }
  return seen;
};
const only = (seen, allowed) => Object.keys(seen).every(k => allowed.includes(k));
{
  const dry = KINDS_OF('dry', 'normal', 60), cold = KINDS_OF('cold', 'normal', 60), wet = KINDS_OF('wet', 'normal', 60), tmp = KINDS_OF('temperate', 'normal', 60), none = KINDS_OF('none', 'normal', 60);
  check(only(dry, ['klar', 'bewoelkt', 'nebel']), 'dry climates never rain, storm or snow (' + Object.keys(dry).join(', ') + ')');
  check(only(cold, ['klar', 'bewoelkt', 'nebel', 'schnee']), 'cold climates only snow (' + Object.keys(cold).join(', ') + ')');
  check(only(wet, ['klar', 'bewoelkt', 'nebel', 'regen', 'gewitter']) && !wet.schnee, 'wet climates rain and storm, never snow');
  check(only(tmp, ['klar', 'bewoelkt', 'nebel', 'regen', 'gewitter']) && !tmp.schnee, 'temperate climates have no snow');
  check(only(none, ['klar']), 'climates without sky are always clear');
  const total = (s) => Object.values(s).reduce((a, b) => a + b, 0);
  const share = (s, k) => (s[k] || 0) / total(s);
  check(share(wet, 'regen') > 0.12 && share(wet, 'regen') < 0.45, 'wet climates rain about a quarter of the time (' + (share(wet, 'regen') * 100).toFixed(0) + ' %)');
  check(share(cold, 'schnee') > 0.15, 'cold climates snow a good part of the time (' + (share(cold, 'schnee') * 100).toFixed(0) + ' %)');
}

// ---- modes: Ruhig is only clear and cloudy, Aus is always clear
{
  const calm = KINDS_OF('wet', 'calm', 40), off = KINDS_OF('wet', 'off', 40);
  check(only(calm, ['klar', 'bewoelkt']), 'Ruhig never rains, storms, snows or fogs');
  check(only(off, ['klar']), 'Aus is always clear');
  // the switch also wins over a /wetter command: Aus is clear, Ruhig is at most cloudy; Normal shows the command again
  const ctx = { ticks: 12000, day: 5, biome: B('meadow'), dim: 'overworld', lowK: 0 };
  const cmd = new VR.Weather({}); cmd.setSeed(SEED);
  cmd.setMode('off'); cmd.force('gewitter'); for (let i = 0; i < 20; i++) cmd.update(0.5, ctx);
  check(cmd.kind === 'klar', 'Aus: a /wetter gewitter still shows clear sky (got ' + cmd.kind + ')');
  cmd.setMode('calm'); cmd.force('regen'); for (let i = 0; i < 20; i++) cmd.update(0.5, ctx);
  check(cmd.kind === 'bewoelkt', 'Ruhig: a /wetter regen shows cloudy (got ' + cmd.kind + ')');
  cmd.force('bewoelkt'); cmd.update(0.5, ctx);
  check(cmd.kind === 'bewoelkt', 'Ruhig keeps a /wetter bewölkt');
  cmd.setMode('normal'); cmd.force('regen'); for (let i = 0; i < 20; i++) cmd.update(0.5, ctx);
  check(cmd.kind === 'regen', 'on Normal the command shows its rain again');
}

// ---- Nebel: only at dawn (22 000–3 000 ticks), and in some days only
{
  let outside = 0, fogDays = 0, days = 60;
  for (let d = 2; d < days + 2; d++) {
    let fog = false;
    for (let t = 0; t < DAY; t += 61) {
      const A = d * DAY + t, k = WX.kindAt(SEED, A, 'temperate', 'normal');
      if (k === 'nebel') { fog = true; const tod = t; if (!(tod >= 22000 || tod < 3000)) outside++; }
    }
    if (fog) fogDays++;
  }
  check(outside === 0, 'fog only happens in the dawn window (22 000–3 000 ticks)');
  check(fogDays > 5 && fogDays < 40, 'fog comes on some mornings (' + fogDays + ' of ' + days + ' days, temperate)');
  let fogFirst = 0; for (let t = 0; t < 2 * DAY - 2000; t += 61) if (WX.kindAt(SEED, t, 'wet', 'normal') === 'nebel') fogFirst++;
  check(fogFirst === 0, 'no fog before the second morning');
}

// ---- transitions: about 20 s to the new state, smooth, never overshooting
{
  const w = new VR.Weather({});
  w.setSeed(SEED); w.setMode('normal'); w.force('regen');
  const ctx = { ticks: 12000, day: 5, biome: B('meadow'), dim: 'overworld', lowK: 0 };
  let prev = -1, mono = true, over = false, half = null;
  for (let i = 1; i <= 400; i++) {                       // 20 s at 20 steps a second
    w.update(0.05, ctx);
    if (w.v.rain < prev - 1e-12) mono = false;
    if (w.v.rain > 1 + 1e-9) over = true;
    if (i === 10) half = w.v.rain;                       // after 0.5 s: clearly not switched yet
    prev = w.v.rain;
  }
  check(half !== null && half < 0.5, 'the change is not instant (after 0.5 s the rain is ' + (half || 0).toFixed(2) + ')');
  check(w.v.rain >= 0.95, 'after 20 s the rain is at least 95 % (got ' + w.v.rain.toFixed(3) + ')');
  check(mono && !over, 'the transition is monotone and never overshoots');
  w.force(null);
  for (let i = 0; i < 400; i++) w.update(0.05, ctx);
  const sched = WX.kindAt(SEED, 5 * DAY + 12000, WX.climateOf(B('meadow'), 'overworld'), 'normal');
  check(w.kind === sched, 'back to the schedule once the force is lifted (' + sched + ')');
}

// ---- lightning every 8–25 s, thunder 0.5–4 s after each bolt
{
  const heard = [];
  const w = new VR.Weather({ onThunder: (d) => heard.push(d) });
  w.setSeed(SEED); w.setMode('normal'); w.force('gewitter');
  const ctx = { ticks: 15000, day: 6, biome: B('forest'), dim: 'overworld', lowK: 0 };
  const strikes = []; let t = 0, flashOnStrike = 0;
  for (let i = 0; i < 12000; i++) {                       // 600 s
    t += 0.05;
    const before = w.strikes || 0;
    w.update(0.05, ctx);
    if ((w.strikes || 0) !== before) { strikes.push(t); flashOnStrike = Math.max(flashOnStrike, w.flash); }
  }
  const gaps = strikes.slice(1).map((x, i) => x - strikes[i]);
  check(strikes.length >= 25 && strikes.length <= 50, 'a storm strikes about every 16 s (' + strikes.length + ' bolts in 600 s)');
  check(gaps.length > 0 && gaps.every(g => g >= 7.9 && g <= 25.2), 'bolts come every 8–25 s');
  check(flashOnStrike > 0.9, 'a bolt lights the sky at once');
  check(heard.length >= strikes.length - 1 && heard.every(d => d >= 0.5 && d <= 4.0), 'each bolt is heard 0.5–4 s later (' + heard.length + ' thunders)');
  w.force('regen');
  const before = w.strikes;
  for (let i = 0; i < 1200; i++) w.update(0.05, ctx);
  check(w.strikes === before, 'no bolts without a storm');
}

// ---- host and guests agree: the same seed, day and time give the same kind, whatever their frame rate
{
  const host = new VR.Weather(), guest = new VR.Weather();
  host.setSeed(SEED); guest.setSeed(SEED);
  let agree = true, n = 0;
  for (let A = 0; A < 30 * DAY; A += 311) {
    const day = Math.floor(A / DAY), ticks = A % DAY;
    host.update(1 / 30, { ticks, day, biome: B('taiga'), dim: 'overworld', lowK: 0 });
    guest.update(1 / 4, { ticks, day, biome: B('taiga'), dim: 'overworld', lowK: 0 });
    n++; if (host.kind !== guest.kind) agree = false;
  }
  check(agree, 'host and guest agree on every sampled kind (' + n + ' samples)');
  const at = { ticks: 100, day: 9, biome: B('taiga'), dim: 'overworld', lowK: 0 };
  guest.force('schnee'); guest.update(0.01, at);
  check(guest.kind === 'schnee', 'a guest shows the snow the host sent');
  guest.force(null); guest.update(0.01, at); host.update(0.01, at);
  check(guest.kind === host.kind, 'the guest returns to the shared schedule when the host stops forcing (' + guest.kind + ')');
}

// ---- command words: German and English words, the old /weather words, and the schedule ("auto")
check(WX.parse('klar') === 'klar' && WX.parse('Bewölkt') === 'bewoelkt' && WX.parse('nebel') === 'nebel', 'German words');
check(WX.parse('rain') === 'regen' && WX.parse('thunder') === 'gewitter' && WX.parse('clear') === 'klar' && WX.parse('snow') === 'schnee', 'English and the old /weather words');
check(WX.parse('auto') === 'auto' && WX.parse('normal') === 'auto' && WX.parse('quatsch') === null, 'auto returns to the schedule; unknown words are refused');

// ---- freeze keeps the kind; clearNow lasts until the next slot; no seed means no weather
{
  const forest = B('forest');
  const w = new VR.Weather(); w.setSeed(SEED); w.setMode('normal');
  w.update(0.05, { ticks: 1000, day: 3, biome: forest, dim: 'overworld', lowK: 0, freeze: true });
  const frozen = w.kind;
  w.update(0.05, { ticks: 1000 + 2 * DAY + 6000, day: 6, biome: forest, dim: 'overworld', lowK: 0, freeze: true });
  check(w.kind === frozen, 'a frozen weather stays what it was (' + frozen + ')');
  // a wet day with rain or a storm in its slot: clearNow ends it at once, and the next slot brings the schedule back
  let A0 = -1;
  for (let A = 3 * DAY; A < 40 * DAY && A0 < 0; A += 500) if (['regen', 'gewitter'].includes(WX.kindAt(SEED, A, 'wet', 'normal'))) A0 = A;
  check(A0 >= 0, 'a rainy time exists for the clearNow test');
  if (A0 >= 0) {
    const w2 = new VR.Weather(); w2.setSeed(SEED); w2.setMode('normal');
    const at = (A) => ({ ticks: A % DAY, day: Math.floor(A / DAY), biome: B('meadow'), dim: 'overworld', lowK: 0 });
    w2.update(0.05, at(A0));
    const was = w2.kind;
    w2.clearNow(); w2.update(0.05, at(A0 + 100));
    check(was !== 'klar' && w2.kind === 'klar', 'clearNow ends the ' + was + ' at once');
    const slot = WX.slotAt(SEED, A0);
    w2.update(0.05, at(slot.end + 1));
    check(w2.kind === WX.kindAt(SEED, slot.end + 1, 'wet', 'normal'), 'the next slot brings the schedule back');
  }
  const w3 = new VR.Weather();
  w3.update(0.05, { ticks: 9000, day: 5, biome: forest, dim: 'overworld', lowK: 0 });
  check(w3.kind === 'klar' && w3.v.rain === 0, 'the title screen (no seed) has no weather');
}

// ---- dawn fog depends on the valley: strong low down, weaker on the heights
{
  let fog = null;
  for (let d = 2; d < 200 && fog === null; d++) { const A = d * DAY + 23000; if (WX.kindAt(SEED, A, 'temperate', 'normal') === 'nebel') fog = A; }
  check(fog !== null, 'a foggy dawn exists for the test seed');
  if (fog !== null) {
    const low = new VR.Weather(), high = new VR.Weather();
    low.setSeed(SEED); high.setSeed(SEED); low.setMode('normal'); high.setMode('normal');
    const c = (lowK) => ({ ticks: fog % DAY, day: Math.floor(fog / DAY), biome: B('plains'), dim: 'overworld', lowK });
    for (let i = 0; i < 400; i++) { low.update(0.05, c(1)); high.update(0.05, c(0)); }
    check(low.kind === 'nebel' && low.v.fog > 0.9, 'fog fills the valley (' + low.v.fog.toFixed(2) + ')');
    check(high.kind === 'nebel' && high.v.fog > 0.4 && high.v.fog < 0.7, 'on the heights the fog is thinner (' + high.v.fog.toFixed(2) + ')');
  }
}

// ---- values stay in range
{
  const w = new VR.Weather(); w.setSeed(SEED); w.setMode('normal');
  let ok = true;
  for (let A = 0; A < 6 * DAY; A += 2000) {
    w.update(0.25, { ticks: A % DAY, day: Math.floor(A / DAY), biome: B('jungle'), dim: 'overworld', lowK: 0.5 });
    for (const k of ['rain', 'snow', 'fog', 'cloud', 'sun', 'dark', 'wind', 'exp']) if (!isFinite(w.v[k])) ok = false;
    if (w.v.rain < 0 || w.v.rain > 1 || w.v.snow < 0 || w.v.snow > 1 || w.v.fog < 0 || w.v.fog > 1.001 || w.v.sun < 0 || w.v.sun > 1) ok = false;
  }
  check(ok, 'every visual value is finite and in range');
}

console.log(fails ? fails + ' FAILED' : 'ALL OK');
process.exit(fails ? 1 : 0);

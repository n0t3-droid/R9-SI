// F1 · Licht & Luft: the environment's grade and the exposure's range, in node (env.js on the shared core; no browser).
//  - the grade's lift is zero by day (the sun above about 8°: 09:00 to 15:00 and noon), warm at dawn and dusk, blue at night
//  - the exposure keeps ±0.5 stops around 1: a bright scene gets less light, a dark one more, and a scene at the key wants 1
//    (the key is the log-average luminance a clear noon wants at exposure 1: browser check in test/light.mjs)
//    bash: node test/light_env.js
require('./load_shared.js');
require('../src/main/atmos.js');
require('../src/main/weather.js');
require('../src/main/skybodies.js');
require('../src/main/env.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const fmt = (c) => c.map(v => v.toFixed(4)).join(' ');
const env = new VR.Env();
// the environment at a time of day (ticks: 0 sunrise, 6000 noon, 12000 sunset, 18000 midnight; 1000 ticks an hour)
const at = (t) => {
  env.setTime(t);
  env.update(0.016, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 7, freezeTime: true, freezeWeather: true });
  return env.E;
};

console.log('grade');
{
  const day = [3000, 6000, 9000].map(at);
  check(day.every(E => E.lift.every(v => Math.abs(v) < 1e-9)), `the lift is zero by day: 09:00, 12:00 and 15:00 (${day.map(E => fmt(E.lift)).join(' | ')})`);
  const dawn = at(0), dusk = at(12000);
  check(dawn.lift[0] > 0.005 && dawn.lift[0] > dawn.lift[2], `dawn: the lift is warm (${fmt(dawn.lift)})`);
  check(dusk.lift[0] > 0.005 && dusk.lift[0] > dusk.lift[2], `dusk: the lift is warm (${fmt(dusk.lift)})`);
  const night = at(18000);
  check(night.lift[2] > 0.004 && night.lift[2] > night.lift[0], `night: the lift is blue (${fmt(night.lift)})`);
  check(night.lift.every(v => v >= 0) && dawn.lift.every(v => v >= 0), 'the lift never darkens (every component ≥ 0)');
}

console.log('exposure');
{
  const EX = VR.Atmos.EXPOSURE, A = VR.Atmos;
  check(Math.abs(Math.log2(EX.hi) - 0.5) < 1e-9 && Math.abs(Math.log2(EX.lo) + 0.5) < 1e-9, `the range is ±0.5 stops around 1 (${EX.lo.toFixed(4)} … ${EX.hi.toFixed(4)})`);
  check(Math.abs(A.exposureTarget(Math.log(EX.key)) - 1) < 1e-9, 'a scene at the key wants exposure 1');
  const bright = A.exposureTarget(Math.log(EX.key * 4)), dark = A.exposureTarget(Math.log(EX.key / 16));
  check(bright < 1 && bright >= EX.lo && dark > 1 && dark <= EX.hi, `a bright scene gets less light (${bright.toFixed(3)}), a dark one more (${dark.toFixed(3)}), inside the range`);
  check(A.exposureTarget(Math.log(1e6)) === EX.lo && A.exposureTarget(Math.log(1e-9)) === EX.hi, 'the extremes stop at the range');
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exitCode = fails ? 1 : 0;

// A1 Atmosphäre — Env (src/main/env.js) under the weather sample: a clear sky is exactly v0.39's (test/env_v039.json was
// recorded from v0.39's env.js with freezeWeather and dt 1), clouds/storms/fog change light and fog as the spec says,
// the per-world Himmel „Echter Tag" (sun to 70°, golden hour ±1.5 h, blue hour, darker nights), moon phases by day,
// lightning bolts, the village glow, the wet-look switch.
const ROOT = '/home/claude/vr';
require(ROOT + '/src/shared/core.js'); require(ROOT + '/src/shared/biomes.js'); require(ROOT + '/src/main/weather.js'); require(ROOT + '/src/main/env.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const B = (k) => VR.biomeByKey(k), W = VR.Weather;
const sample = (kind, extra) => Object.assign({}, W.CLEAR, W.TARGET[kind], { kind }, extra || {});
const envAt = (tod, o, day) => { const e = new VR.Env(); e.setTime(tod); e.day = day || 0; return { env: e, E: JSON.parse(JSON.stringify(e.update(1, Object.assign({ dim: 'overworld', biome: B('plains'), eyeSky: 1, renderDist: 8, horizon: 0, freezeTime: true }, o)))) }; };

// ---------------------------------------------------------------- 1. „Aus" / a clear sky = v0.39 exactly
const fix = JSON.parse(require('fs').readFileSync(ROOT + '/test/env_v039.json', 'utf8'));
let worst = 0, where = '', missing = 0;
for (const { c, E: want } of fix) {
  const { E } = envAt(c.t, { dim: c.dim, biome: B(c.bk), eyeSky: c.eyeSky, renderDist: c.rd, horizon: c.hz, underwater: c.uw, waterColor: c.uw ? [0.1, 0.3, 0.5] : null, wx: W.CLEAR, sky: 'dusk' });
  for (const k in want) {
    if (E[k] === undefined) { missing++; continue; }
    const a = [].concat(want[k]), b = [].concat(E[k]);
    for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (!(d <= worst)) { worst = d; where = `${c.dim}/${c.bk} t${c.t} ${k}[${i}] ${a[i]} vs ${b[i]}`; } }
  }
}
check(missing === 0 && worst < 1e-6, `clear weather, Ewige Dämmerung: ${fix.length} v0.39 skies reproduced (worst ${worst.toExponential(1)}${worst >= 1e-6 ? ' at ' + where : ''})`);
const { E: plain } = envAt(6000, {});
check(plain.cloudCover === 0.2 && plain.rain === 0, 'without a weather sample the sky is clear');

// ---------------------------------------------------------------- 2. what the weather does to light and fog
const { E: clr } = envAt(6000, { wx: W.CLEAR }), { E: cld } = envAt(6000, { wx: sample('cloudy') }), { E: stm } = envAt(6000, { wx: sample('storm', { rain: 1 }) });
check(cld.cloudCover === 0.8, 'Bewölkt: cloud cover 0.8');
check(cld.sunColor.every((v, i) => Math.abs(v - clr.sunColor[i] * 0.6) < 1e-9), 'Bewölkt: the sun ×0.6');
check(Math.abs(stm.exposure - clr.exposure * 0.7) < 1e-9, 'Gewitter: exposure ×0.7 (' + clr.exposure.toFixed(3) + ' → ' + stm.exposure.toFixed(3) + ')');
check(stm.wind === 3 && stm.rain === 1, 'Gewitter: wind 3, rain 1');
const { E: fogC } = envAt(23500, { wx: W.CLEAR }), { E: fogD } = envAt(23500, { wx: sample('fog', { fogMul: 3, fogEnd: 48, fogLayer: [72, 0.05] }) });
check(fogD.fog[1] === 48 && Math.abs(fogD.fog[2] - fogC.fog[2] * 3) < 1e-12, 'Nebel at dawn: fog end 48 blocks, density ×3 (' + fogC.fog[2] + ' → ' + fogD.fog[2] + ')');
check(fogD.fogH[1] === 72 && fogD.fogH[2] === 0.05 && fogD.fogH[3] > 0.9, 'the valley fog layer is passed on (top ' + fogD.fogH[1] + ', density ' + fogD.fogH[2] + ', milky sky ' + fogD.fogH[3] + ')');
check(clr.fogH[2] === 0 && clr.fogH[3] === 0, 'no fog layer in clear weather');
const { E: snw } = envAt(6000, { wx: sample('snow') });
check(snw.rain === 1 && snw.wx[1] >= 0.75, 'Schnee: precipitation and an overcast sky');
const { E: ovc } = envAt(18000, { wx: sample('cloudy') });
check(ovc.wx[1] > 0.5 && plain.wx[1] === 0, 'overcast hides the stars (overcast ' + ovc.wx[1] + ')');

// ---------------------------------------------------------------- 3. the wet look and the rainbow follow their switch
const wetS = sample('clear', { wet: 0.8, rainbow: 0.3 });
const { E: wOn } = envAt(5000, { wx: wetS, wet: true }), { E: wOff } = envAt(5000, { wx: wetS, wet: false });
check(wOn.wx[0] === 0.8 && wOn.wx[2] === 0.3, 'wet ground 0.8 and a rainbow 0.3 reach the shaders');
check(wOff.wx[0] === 0 && wOff.wx[2] === 0, '⚙ „Nasser Boden & Regenbogen" off: neither');

// ---------------------------------------------------------------- 4. Himmel „Echter Tag"
const deg = (E) => Math.asin(E.sunDir[1]) * 180 / Math.PI;
const { E: noonR } = envAt(6000, { sky: 'real' }), { E: noonD } = envAt(6000, { sky: 'dusk' });
check(Math.abs(deg(noonR) - 70) < 1, 'Echter Tag: the sun climbs to ' + deg(noonR).toFixed(1) + '° (Ewige Dämmerung: ' + deg(noonD).toFixed(1) + '°)');
const sunsetSum = (E) => E.sunset[0] + E.sunset[1] + E.sunset[2];
check(sunsetSum(envAt(500, { sky: 'real' }).E) > 0.3, 'golden light half an hour after sunrise');
check(sunsetSum(envAt(2000, { sky: 'real' }).E) === 0 && sunsetSum(envAt(10000, { sky: 'real' }).E) === 0, 'no golden light two hours after sunrise or before sunset');
check(sunsetSum(envAt(2000, { sky: 'dusk' }).E) > 0.3, '(Ewige Dämmerung keeps its golden day)');
const { E: midR } = envAt(18000, { sky: 'real' }), { E: midD } = envAt(18000, { sky: 'dusk' });
check(midR.ambSky.every((v, i) => Math.abs(v - midD.ambSky[i] * 0.6) < 1e-9), 'Echter Tag: nights 40 % darker (ambient ' + midD.ambSky[2].toFixed(3) + ' → ' + midR.ambSky[2].toFixed(3) + ')');
const { E: blueR } = envAt(23686, { sky: 'real' }), { E: blueD } = envAt(23686, { sky: 'dusk' });
const br = (c) => c[2] / Math.max(1e-6, c[0]);
check(Math.abs(blueR.sunDir[1] + 0.1) < 0.01 && br(blueR.zenith) > br(blueD.zenith) * 1.5 && br(blueR.horizon) > 1, 'the blue hour before sunrise: zenith b/r ' + br(blueR.zenith).toFixed(1) + ' (dusk mode ' + br(blueD.zenith).toFixed(1) + '), horizon b/r ' + br(blueR.horizon).toFixed(1));

// ---------------------------------------------------------------- 5. the moon's phase follows the days
const ph = (d) => envAt(18000, {}, d).E.wx[3];
const step = ((ph(4) - ph(3)) + 1) % 1;
check(Math.abs(step - 0.125) < 1e-9 && Math.abs(ph(11) - ph(3)) < 1e-9, 'moon phase advances by an eighth each day, a cycle of 8 days (' + ph(3) + ' → ' + ph(4) + ')');

// ---------------------------------------------------------------- 6. lightning: a bolt in the sky for a moment
{
  const e = new VR.Env(); e.setTime(6000);
  const o = { dim: 'overworld', biome: B('plains'), eyeSky: 1, renderDist: 8, freezeTime: true, wx: sample('storm', { rain: 1 }) };
  e.update(0.016, o);
  e.lightning(0.9, [0.6, 0.8]);
  const E1 = JSON.parse(JSON.stringify(e.update(0.016, o)));
  check(E1.bolt[3] > 0.5 && Math.abs(E1.bolt[0] - 0.6) < 1e-9 && Math.abs(E1.bolt[2] - 0.8) < 1e-9, 'a strike draws its bolt toward its direction (' + E1.bolt.map(v => +v.toFixed(2)).join(', ') + ')');
  check(E1.ambSky[1] > stm.ambSky[1] + 0.5, 'and the flash lights the land');
  for (let i = 0; i < 40; i++) e.update(0.016, o);
  check(e.E.bolt[3] === 0, 'gone after half a second');
}
// ---------------------------------------------------------------- 7. village glow at night
check(envAt(18000, { glow: [0.6, 0.8, 0.3] }).E.glow[3] > 0.2, 'a warm glow toward the village at night');
check(envAt(6000, { glow: [0.6, 0.8, 0.3] }).E.glow[3] === 0, 'none by day');

console.log(fails ? 'FAIL ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

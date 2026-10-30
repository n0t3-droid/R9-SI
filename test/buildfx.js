// a-builder · juicy placement (src/main/buildfx.js, VR.BuildFx's pure part):
//  (a) the pop: 0.62 at the click, an overshoot of ~1.07 near 0.09 s, exactly 1 and invisible from 0.16 s; never below
//      0.6 or above 1.08; it fades only in its last part
//  (b) the pitch climb: placements within 0.7 s climb a pentatonic step each (1, 9/8, 5/4, 3/2, 5/3, 2), held at the
//      top; a pause brings the root back; a break starts again
//  (c) the particles by material family: every klang family has a recipe (dust, chips, sparkle, leaves, puff), ≤ 10
//      particles a placement; glass and metal sparkle (emissive)
//  (e) the showcase's orbit camera looks at the centre from its circle (yaw and pitch), the golden hour before sunset
//  (d) the switch: on from Low up, off on Very Low (potato) unless chosen; a chosen value wins; the preset table has it
// usage: node test/buildfx.js
const ROOT = require('path').join(__dirname, '..');
const VR = require(ROOT + '/test/load_shared.js');
require(ROOT + '/src/main/klang.js');
require(ROOT + '/src/main/buildfx.js');
require(ROOT + '/src/main/showcase.js');
const BF = VR.BuildFx;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
if (!BF) { console.log('  ✗ VR.BuildFx exists'); console.log('FAILED 1'); process.exit(1); }

// (a)
const near = (a, b, e) => Math.abs(a - b) <= (e || 0.01);
check(near(BF.popScale(0), 0.62), `at the click: ${BF.popScale(0).toFixed(3)}`);
let peak = 0, peakT = 0, lo = 9, hi = 0;
for (let t = 0; t <= 0.3; t += 0.002) { const s = BF.popScale(t); if (s > peak) { peak = s; peakT = t; } lo = Math.min(lo, s); hi = Math.max(hi, s); }
check(near(peak, 1.07, 0.012) && peakT > 0.06 && peakT < 0.11, `the overshoot ${peak.toFixed(3)} at ${peakT.toFixed(3)} s`);
check(near(BF.popScale(0.16), 1, 0.001) && near(BF.popScale(0.5), 1, 0.001), 'settled at 1 from 0.16 s');
check(lo >= 0.6 && hi <= 1.08, `bounded ${lo.toFixed(2)}…${hi.toFixed(2)}`);
check(BF.popAlpha(0) === 1 && BF.popAlpha(0.08) === 1 && BF.popAlpha(0.16) === 0 && BF.popAlpha(0.13) > 0 && BF.popAlpha(0.13) < 1, 'it fades only at the end');
check(BF.POP_DUR === 0.16 && BF.MAX_POPS <= 8, 'short, and at most 8 at once');

// (b)
const C = new BF.Combo();
const seq = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8].map(t => C.hit(t));
check(JSON.stringify(seq.map(x => +x.toFixed(4))) === JSON.stringify([1, 1.125, 1.25, 1.5, 1.6667, 2, 2]), `a quick run climbs and holds: ${seq.map(x => x.toFixed(2)).join(' ')}`);
check(C.hit(3) === 1, 'after a pause: the root again');
C.hit(3.2); C.reset();
check(C.hit(3.4) === 1, 'a break starts again');

// (d)
check(BF.enabled({ preset: 'potato' }) === false && BF.enabled({ preset: 'low' }) === true && BF.enabled({ preset: 'balanced' }) === true, 'off on Very Low, on from Low');
check(BF.enabled({ preset: 'potato', buildFx: true }) === true && BF.enabled({ preset: 'high', buildFx: false }) === false, 'a chosen value wins');

// (c)
const K = VR.Klang;
const fams = K && K.FAMILIES ? K.FAMILIES : ['grass', 'dirt', 'stone', 'wood', 'sand', 'snow', 'gravel', 'metal', 'carpet', 'water', 'glass'];
check(fams.every(f => BF.FX[f] && BF.FX[f].n > 0 && BF.FX[f].n <= 10 && BF.FX[f].col.length === 3), `every family has a recipe (${fams.length})`);
check(BF.FX.glass.emis > 0 && BF.FX.metal.emis > 0 && !BF.FX.stone.emis, 'glass and metal sparkle');
check(new Set(fams.map(f => BF.FX[f].kind)).size >= 4, `different kinds: ${[...new Set(fams.map(f => BF.FX[f].kind))].join(', ')}`);

// (e)
const SC = VR.Showcase;
{
  const c = [100, 70, -40], q = SC.orbitCam(c, 12, 1.1, 6), cp = Math.cos(q.pitch);
  const f = [-Math.sin(q.yaw) * cp, Math.sin(q.pitch), -Math.cos(q.yaw) * cp], d = [c[0] - q.x, c[1] - q.y, c[2] - q.z], L = Math.hypot(...d);
  check(Math.abs(Math.hypot(q.x - c[0], q.z - c[2]) - 12) < 1e-9 && Math.abs(q.y - 76) < 1e-9, 'the orbit: on its circle, at its height');
  check(f.every((v, i) => Math.abs(v - d[i] / L) < 1e-9), 'and looking straight at the centre');
  check(SC.GOLDEN > 10500 && SC.GOLDEN < 12000 && SC.SPEED > 0.1 && SC.SPEED < 0.3, `the golden hour at ${SC.GOLDEN} (sunset 12000), a round in ${(6.283 / SC.SPEED).toFixed(0)} s`);
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

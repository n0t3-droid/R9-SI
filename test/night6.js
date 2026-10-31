// a-story6 (plan docs/superpowers/plans/2026-10-31-a-story6.md): Aquamarin's night reads as night, the lamplighters walk
// in their world's own night and their lantern casts a warm halo.
//   a  BodySky: the eye opens with the dusk's depth (not when Helia's disc sets), the night's light leans blue, the day
//      untouched; the other worlds untouched
//   b  the lamp round's hour: a strange world's own night (BodySky), the clock's at home
//   c  the halo at the hand: two particles a carrier at night (the glass, a wide warm pool), none by day, none sitting
//   bash test/wt_run.sh night6.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
for (const f of ['klang', 'atmo_lut', 'bodysky', 'i18n', 'lang_en', 'lang_de']) require('../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const BS = V.BodySky, U = V.Universe, D = 180 / Math.PI;
console.log('a · Aquamarin\'s night');
{
  const at = (id, d, tod) => BS.compute(id, [0, 70, 0], U.worldSeconds(d, tod), { tier: 2 });
  // find a dusk (Helia −1…−4°), a deep night (under −15°) and a day on Aquamarin's long day (a week of the clock)
  let dusk = null, deep = null, day = null;
  for (let d = 0; d < 14 && !(dusk && deep && day); d++) for (let t = 0; t < 24000; t += 500) {
    const r = at('aqua', d, t), el = r.light.sunEl * D;
    if (!dusk && el < -1 && el > -4) dusk = r; if (!deep && el < -15) deep = r; if (!day && el > 20) day = r;
  }
  check(!!(dusk && deep && day), 'Aquamarin: a dusk, a deep night and a day found');
  if (dusk && deep && day) {
    check(dusk.expo < 1.2, `at dusk (Helia ${(dusk.light.sunEl * D).toFixed(1)}°) the eye still the day's (exposure ${dusk.expo.toFixed(2)}, was ≈ 2.5: a golden day)`);
    const a = deep.light.ambSky, m = deep.light.moonColor;
    check(deep.expo > 1.2 && deep.expo < 1.7 && a[2] > 1.8 * a[0] && m[2] > 2 * m[0], `the deep night: the eye opens, but less (${deep.expo.toFixed(2)}), the shade and Herzwelt's shine lean blue (${a.map(v => v.toFixed(3))} · ${m.map(v => v.toFixed(3))})`);
    const lumN = (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) * deep.expo, lumD = (0.2126 * day.light.ambSky[0] + 0.7152 * day.light.ambSky[1] + 0.0722 * day.light.ambSky[2]) * day.expo;
    check(lumN < lumD * 0.15, `… and dark: the shade's light at the eye ${lumN.toFixed(3)} against the day's ${lumD.toFixed(3)}`);
    check(day.expo === 0.8 && day.light.night === 0, 'the day untouched (exposure 0.8)');
  }
  // the other worlds keep their night (Ocker: no blue lean)
  let oc = null; for (let d = 0; d < 20 && !oc; d++) for (let t = 0; t < 24000 && !oc; t += 1000) { const r = BS.compute('ocker', [0, 70, 0], U.worldSeconds(d, t), { tier: 2 }); if (r.light.sunEl * D < -15) oc = r; }
  check(!oc || oc.light.ambSky[2] < 1.8 * oc.light.ambSky[0] || oc.expo > 2, 'Ocker\'s night as it was');
}
console.log('b · the lamp round\'s hour');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
for (const f of ['particles', 'voxmodels', 'villagers', 'folkmodel', 'villages', 'festival', 'worldlife', 'natives']) { try { require('../src/main/' + f + '.js'); } catch (e) { check(false, f + '.js loads: ' + e.message.slice(0, 120)); } }
const N = VR.Natives;
{
  const keep = { want: BS.want, cur: BS.cur };
  BS.want = false; BS.cur = null;
  check(N.lampHour(15000) && !N.lampHour(6000), 'at home: the clock\'s evening and night (13000–23300)');
  BS.want = true; BS.cur = { light: { sunEl: 0.4 } };
  check(!N.lampHour(15000), 'on a strange world by its day: no round, whatever the clock');
  BS.cur = { light: { sunEl: -0.2 } };
  check(N.lampHour(6000), '… by its night: the round, whatever the clock');
  BS.want = keep.want; BS.cur = keep.cur;
}
console.log('c · the lantern\'s halo');
{
  const a = { pos: [10, 64, 20], yaw: 0, p: { look: { tool: 'lantern' } }, pose: 'walk' }, b = { pos: [12, 64, 20], yaw: 1, p: { look: { tool: 'lantern' } }, pose: 'sit' }, c = { pos: [11, 64, 22], yaw: 0, p: { look: { tool: 'staff' } } };
  const H = N.lanternAt(a);
  check(Math.abs(H[1] - 64.78) < 1e-6 && Math.hypot(H[0] - 10, H[2] - 20) > 0.25 && Math.hypot(H[0] - 10, H[2] - 20) < 0.45, `the hand's place (${H.map(v => v.toFixed(2))}: beside the body, at the knuckles)`);
  const spawned = [];
  const P = { game: { villages: { known: new Map([['v', { agents: [a, b, c] }]]) } }, clock: 1, spawn(x, y, z, vx, vy, vz, o) { spawned.push([o.size, o.col.slice()]); } };
  check(N.lanternHalos(P, 0.016, [0, 64, 0], 0.1) === 0 && spawned.length === 0, 'by day: no halo');
  const n = N.lanternHalos(P, 0.016, [0, 64, 0], 0.9);
  check(n === 1 && spawned.length === 2 && spawned[0][1][0] > spawned[0][1][2] * 2.5 && spawned[1][0] > 3 * spawned[0][0], `at night: the glass's warm glow and a wide pool round it (${spawned.map(q => q[0]).join(', ')} m), none for a sitter or a staff`);
  check(spawned[1][0] <= 1.6 && spawned[1][1][0] <= 0.36, `the pool soft, not a second sun at arm's length (${spawned[1][0]} m, ${spawned[1][1][0].toFixed(2)})`);
  const far = { game: { villages: { known: new Map([['v', { agents: [a] }]]) } }, clock: 1, spawn() { far.n = (far.n || 0) + 1; } };
  check(N.lanternHalos(far, 0.016, [200, 64, 0], 0.9) === 0, 'none beyond 48 m');
  check(!!(VR.Particles && VR.Particles.prototype._lant6), 'drawn where the lamps\' halos are (Particles.lampGlows: Balanced and up)');
}
console.log('d · the lamps make pools, the shade between them blue (BS.nightGrade)');
{
  const D2 = Math.PI / 180, base = [1.0, 0.84, 0.64];
  const g = (id, el) => { const o = { bt: [0, 0, 0], grade: [1, 1, 1] }; const on = BS.nightGrade && BS.nightGrade(id, el * D2, base, o); return Object.assign(o, { on }); };
  const dn = g('aqua', -20), dy = g('aqua', 20), du = g('aqua', -0.5), oc = g('ocker', -20);
  check(!!dn.on && dn.bt[0] < 0.75 * base[0] && dn.bt[0] > 0.45 && dn.bt[0] / dn.bt[2] >= base[0] / base[2] * 0.98, `the deep night: the lamps' reach shorter, still warm (${dn.bt.map(v => v.toFixed(2))})`);
  check(dn.grade[2] > dn.grade[0] + 0.08 && Math.max(...dn.grade) < 1.12, `… the grade leans blue (${dn.grade.map(v => v.toFixed(2))})`);
  check(!dy.on && !du.on && !oc.on, 'the day, the sunset\'s first degree and Ocker untouched');
  BS.night6 = false; check(!g('aqua', -20).on, 'BS.night6 = false: the old night'); BS.night6 = undefined;
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

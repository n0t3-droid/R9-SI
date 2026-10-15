// t-motion · step 5 (docs/superpowers/plans/2026-10-15-t-motion.md): the living landmarks — nothing in view stands quite
// still. The citadel's beam breathes on a 4 s cycle (the same sparks a second on average) and shoots a ring up at each
// peak; the watchtower's saucer ring runs a chase of lights just outside its rim (the real generator's tower: every light
// in the air, the ring's shell one block in); the portal veil's rings run out from its middle and its light breathes,
// and motes drift out of it; the holo screens switch every 9 s with a scan wipe; the trams' leading nose shines white,
// the trailing one red, their windows glow and the glows ride along; the pantograph sparks now and then; an isle's fall
// streams on into the void. The JS numbers are the shaders' numbers (the MOTION blocks' text). Node only.
//   bash test/wt_run.sh motion_landmarks.js
const V = require('./load_shared.js');
global.performance = global.performance || { now: () => Date.now() };
require('../src/main/motion.js');
require('../src/main/vents.js');
require('../src/main/trams.js');
require('../src/main/shaders.js');
const Mo = VR.Motion, R = VR.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const st = (n) => R.byName[n].defaultState;
const fakeP = () => { const P = { n: 0, list: [], spawn(x, y, z, vx, vy, vz, o) { P.list.push({ x, y, z, vx, vy, vz, col: (o.col || [1, 1, 1]).slice(), size: o.size, life: o.life, alpha: o.alpha === undefined ? 1 : o.alpha }); return 0; }, glow(x, y, z, col, life, size, vy) { P.list.push({ x, y, z, vx: 0, vy: vy || 0, vz: 0, col: col.slice(), size, life, glow: true }); return 0; } }; return P; };

// ---- 1. the citadel's beam: it breathes, the same sparks on average, a ring at each peak
console.log('the citadel\'s beam');
const B = Mo.BEAM;
let mean = 0, lo = 1, hi = 0; for (let k = 0; k < 4000; k++) { const p = Mo.beamPulse(k / 1000); lo = Math.min(lo, p); hi = Math.max(hi, p); mean += (B.rate[0] + B.rate[1] * p) / 4000; }
check(lo < 0.01 && hi > 0.99 && Math.abs(Mo.beamPulse(1.3) - Mo.beamPulse(5.3)) < 1e-9, `the pulse runs 0 … 1 on a ${B.period} s cycle`);
check(Math.abs(mean - 1) < 0.01, `the stream's rate breathes ${B.rate[0]} … ${(B.rate[0] + B.rate[1]).toFixed(2)} of the old one, ${mean.toFixed(3)} on average (no more sparks a second)`);
const H = VR.Heart.CITADEL;
const beamRun = (motion, preset, secs) => {
  const P = fakeP(), g = { particles: P, settings: { preset, motion }, world: { getBlock: () => 0 } }, v = new VR.Vents(g);
  for (let k = 0; k < secs * 60; k++) v.update(1 / 60, [H.x + 20, H.y + 30, H.z + 20]);
  return { v, P };
};
const bOn = beamRun(true, 'high', 12), bOff = beamRun(false, 'high', 12), bLow = beamRun(true, 'low', 12);
const ringN = bOn.P.list.filter(p => p.vy === B.ringV).length;
check(bOn.v.rings === 3 && ringN === 3 * B.ring, `a ring of ${B.ring} sparks shoots up the beam at each peak: ${bOn.v.rings} rings in 12 s (${ringN} sparks at ${B.ringV} blocks/s)`);
const sOn = bOn.P.list.length - ringN, sOff = bOff.P.list.length;
check(Math.abs(sOn - sOff) / sOff < 0.08, `the stream: ${sOn} sparks in 12 s with the pulse, ${sOff} without (within 8 %)`);
check(!bOff.v.rings && bLow.P.list.length === 0, 'without Wind in allem no ring (the old steady stream); Low draws no beam, as before');
const bright = bOn.P.list.filter(p => p.vy !== B.ringV).map(p => p.col[2]);
check(Math.max(...bright) > 1.2 && Math.min(...bright) < 0.8, `the sparks are brighter at the peak: blue ${Math.min(...bright).toFixed(2)} … ${Math.max(...bright).toFixed(2)}`);

// ---- 2. the watchtower's ring: a chase of lights round the rim
console.log('the watchtower\'s ring lights');
const RG = Mo.RING, beacon = st('beacon_red'), stone = st('stone');
// (far from the citadel: its beam out of reach) a watchtower's beacon (the beacon block one above the spawn) and a spire's
const ringWorld = { getBlock: (x, y, z) => (x === 2100 && y === 151 && z === 2100) || (x === 2300 && y === 120 && z === 2100) ? beacon : (x === 2100 && y === 150 && z === 2100) ? stone : 0 };
{
  const P = fakeP(), g = { particles: P, settings: { preset: 'high', motion: true }, world: ringWorld }, v = new VR.Vents(g);
  v.absorb([['beacon', 2100, 150, 2100], ['beacon', 2300, 120, 2100]]);
  for (let k = 0; k < 180; k++) v.update(1 / 60, [2200, 130, 2100]);
  const lights = P.list.filter(p => !p.glow && Math.abs(p.size - RG.size) < 1e-9);
  const ok = lights.every(p => Math.abs(p.y - (150 + RG.dy + 0.5)) < 1e-9 && Math.hypot(p.x - 2100.5, p.z - 2100.5) > 10.9 && Math.hypot(p.x - 2100.5, p.z - 2100.5) < 12);
  const kinds = [...v.beacons.values()].map(b => b[3]).join();
  check(kinds === '2,1', 'the watchtower\'s beacon is told from a spire\'s (its beacon block one above the spawn)');
  check(lights.length >= 16 && lights.length <= 20 && ok, `a chase of ${RG.speed} lights a second round the watchtower's rim only: ${lights.length} in 3 s, all at the window row (${150 + RG.dy}), 11–12 blocks out`);
  const heads = new Set(lights.map(p => Math.round(Math.atan2(p.z - 2100.5, p.x - 2100.5) / (2 * Math.PI) * RG.n + RG.n) % RG.n));
  check(heads.size === RG.n, `the chase goes round all ${RG.n} lights (${heads.size} seen in 3 s)`);
}
// the real tower (the Heartland citadel, seed 4242): every light just outside the ring's shell
{
  const g = new V.OverworldGen(4242, { vgen: 5 }), site = VR.CitadelGen.heartSite(g, H), T = site.towers.find(t => t.kind === 'watch');
  const by = site.y + 1 + T.h + 15, cache = new Map();
  const blockAt = (x, y, z) => { const cx = Math.floor(x / 16), cz = Math.floor(z / 16), key = cx + ',' + cz; let out = cache.get(key); if (!out) { out = g.generate(cx, cz); cache.set(key, out); } return out.blocks[(y << 8) | ((z - cz * 16) << 4) | (x - cx * 16)]; };
  const solid = (s) => !!s && (R.T.flags[s] & VR.F.SOLID);
  let air = 0, shell = 0; const pt = [0, 0, 0];
  for (let k = 0; k < RG.n; k++) {
    Mo.ringLight(k, T.x, by, T.z, pt);
    if (!solid(blockAt(Math.floor(pt[0]), Math.floor(pt[1]), Math.floor(pt[2])))) air++;
    const dx = pt[0] - T.x - 0.5, dz = pt[2] - T.z - 0.5, l = Math.hypot(dx, dz);
    if (solid(blockAt(Math.floor(pt[0] - dx / l), Math.floor(pt[1]), Math.floor(pt[2] - dz / l)))) shell++;
  }
  check(/beacon_red$/.test(R.types[R.T.type[blockAt(T.x, by + 1, T.z)]].name) && !/beacon_red$/.test(R.types[R.T.type[blockAt(T.x, by, T.z)]].name), `the real watchtower (${T.x}, ${T.z}): its beacon block one above the spawn at y ${by}`);
  check(air === RG.n && shell === RG.n, `its ${RG.n} ring lights hang in the air just outside the ring's shell: ${air} in the air, ${shell} with the shell one block in`);
}

// ---- 3. the portal veil: rings run outward, its light breathes; the motes
console.log('the portal veil');
const VL = Mo.VEIL;
const crest = (t) => { let best = 0, br = 0; for (let rd = 1.2; rd < 3.0; rd += 0.001) { const v = Math.sin(rd * VL.k + t * VL.w); if (v > best) { best = v; br = rd; } } return br; };
const c0 = crest(0.3), c1 = crest(0.5);
check(c1 < c0 && Math.abs((c0 - c1) / 0.2 - VL.w / VL.k) < 0.02, `the crests move outward to the rim at ${(VL.w / VL.k).toFixed(2)} blocks/s (${c0.toFixed(3)} → ${c1.toFixed(3)} in 0.2 s)`);
check(Mo.veilRipple(0.5, 1.0) === 0 && Mo.veilRipple(0.8, 2.0) === 0, 'no rings on the hot rim (the first 0.9 blocks)');
const TFS = VR.SHADERS.TRANS_FS;
check(TFS.includes(`sin(rd * ${VL.k.toFixed(1)} + u_time * ${VL.w.toFixed(1)})`) && TFS.includes(`smoothstep(${VL.lo.toFixed(2)}, 1.0,`) && TFS.includes(`smoothstep(${VL.rd0.toFixed(1)}, ${VL.rd1.toFixed(1)}, rd) * ${VL.amp.toFixed(1)}`) && TFS.includes(`(${VL.b0.toFixed(1)} + ${VL.b1.toFixed(1)} * sin(u_time * ${VL.bw.toFixed(1)}))`), 'TRANS_FS (MOTION) draws the rings and the breath with motion.js VEIL\'s numbers');
{
  const veil = st('portal_veil');
  const w = { getBlock: (x, y, z) => (z === 10 && x >= -3 && x <= 3 && y >= 60 && y <= 66) ? veil : 0, topAt: () => 50 };
  const run = (tier) => { const a = new VR.MotionAir({}); a.setOn(true, tier); const P = fakeP(); for (let k = 0; k < 600; k++) a.update(1 / 60, { w, eye: [0, 62, 18], E: { sunDir: [0, -1, 0], night: 1, wind: 1, windDir: [1, 0] }, particles: P }); return { a, P }; };
  const r2 = run(2), r0 = run(0);
  const m = r2.P.list, front = m.filter(p => p.z > 10.5 && p.vz > 0).length, back = m.filter(p => p.z < 10.5 && p.vz < 0).length;
  check(r2.a.veils.length / 6 >= 8 && r2.a.veils.every((_, i) => i % 6 !== 5 || r2.a.veils[i] === 1), `the veil's cells are found and face ±z (${r2.a.veils.length / 6} cells on a 2-block grid)`);
  check(m.length > 60 && front + back === m.length && front > 0.3 * m.length && back > 0.3 * m.length, `motes drift out of the veil on both sides: ${m.length} in 10 s (${front} in front, ${back} behind)`);
  check(m.length <= Math.ceil(10 * Mo.budgetFor(2).cap.veil / Mo.AIR_LIFE.veil) + 4 && r0.P.list.length === 0, `they keep to their cap (Balanced ${Mo.budgetFor(2).cap.veil} live, life ${Mo.AIR_LIFE.veil} s); Very Low none`);
}

// ---- 4. the holo screens: a new picture every 9 s, a scan wipe from the top down
console.log('the holo screens');
const HO = Mo.HOLO;
const seq = []; for (let k = 0; k < 6; k++) seq.push(Mo.holoMode(k * 9 + 3, 0, 0));
check(seq.join() === '0,1,2,0,1,2', `a panel cycles radar → map → readouts every ${HO.period} s (${seq.join(' ')})`);
check(Mo.holoMode(9.3, 0, 0.5) === 1 && Mo.holoMode(9.3, 0, -0.5) === 0 && Mo.holoMode(9.7, 0, -1.4) === 1, 'the wipe runs down the panel in 0.6 s: above the line the new picture, below the old one');
check(Mo.holoMode(12, 0.13, 0) !== Mo.holoMode(12, 0.5, 0), 'neighbouring panels switch at their own times');
const TER = VR.SHADERS.TERRAIN_FS;
check(TER.includes(`u_time / ${HO.period.toFixed(1)} + hc * ${HO.phase}`) && TER.includes(`1.5 - cf * ${HO.wipe.toFixed(1)}`) && TER.includes('mod(floor(cyc) - (d.y > wy ? 0.0 : 1.0), 3.0)'), 'TERRAIN_FS (MOTION) cycles the panels with motion.js HOLO\'s numbers');

// ---- 5. the trams: white ahead, red behind, the windows lit, the glows ride along; sparks now and then
console.log('the trams');
const TR = Mo.TRAM;
const pts = []; for (let x = 0; x <= 300; x++) pts.push(x, 100, 0);
const tramRun = (motion, night) => {
  const P = fakeP(), g = { particles: P, settings: { particles: 1, motion }, env: { night, day: 0, ticks: 0 }, player: { pos: [150, 101, 6] }, dim: 'test' };
  const T = new VR.Trams(g), L = new VR.Trams.Line({ key: 'test', tech: true, names: ['A', 'B'], pts });
  T.lines.set('test', L);
  // a moment the tram runs toward the second station at speed
  let t0 = 0; for (let t = 0; t < L.period; t += 0.25) { const s = L.state(t); if (s.v === 1 && Math.abs(s.c - L.L / 2) < 20) { t0 = t; break; } }
  T.clock = t0; T.update(1 / 60); T.glowT = 0; P.list.length = 0;
  const rnd = Math.random; Math.random = () => 0.99; try { T.update(1 / 60); } finally { Math.random = rnd; }   // (no spark in the measured frame)
  return { T, L, P };
};
{
  const { T, L, P } = tramRun(true, 1);
  const lead = L.cars.find(c => Mo.tramLead(c.idx, L.v)), trail = L.cars.find(c => !Mo.tramLead(c.idx, L.v));
  const nose = (c) => [c.pos[0] + c.forward()[0] * TR.nose, c.pos[2] + c.forward()[1] * TR.nose];
  const red = P.list.filter(p => p.col[1] < 0.2), white = P.list.filter(p => p.col[0] === 1 && p.col[1] > 0.9 && p.col[2] < 0.8);
  const near = (p, n, r) => Math.hypot(p.x - n[0], p.z - n[1]) < r;
  check(L.v === 1 && lead.idx === 1 && trail.idx === 0, 'running to the second station, car 1\'s nose leads');
  check(red.length === 2 && red.every(p => near(p, nose(trail), 1.0)), `the trailing nose shows two red lamps (${red.length})`);
  check(white.length === 4 && white.every(p => near(p, nose(lead), 1.0) || near(p, [nose(lead)[0] + lead.forward()[0] * 3.2, nose(lead)[1] + lead.forward()[1] * 3.2], 1.0)), `the leading nose two white headlights and their glints on the track ahead (${white.length})`);
  const win = P.list.filter(p => p.alpha < 1);
  check(win.length === 2 * 8 && win.every(p => Math.abs(p.y - (lead.pos[1] + TR.winY)) < 0.3), `each car's eight window bays glow (${win.length} for two cars)`);
  const v = lead.vel, sp = Math.hypot(v[0], v[2]);
  check(sp > 6 && P.list.every(p => Math.abs(p.vx - v[0]) < 1e-9 && Math.abs(p.vz - v[2]) < 1e-9), `the glows ride along at the car's speed (${sp.toFixed(1)} blocks/s): no smear behind a running tram`);
  let sparks = 0; for (let k = 0; k < 60 * 30; k++) { T.update(1 / 60); } sparks = T.sparked | 0;
  check(sparks >= 2 && sparks <= 40, `the pantograph sparks now and then while it runs: ${sparks} bursts in 30 s (${TR.spark}/s a car at speed)`);
  const off = tramRun(false, 1);
  check(off.P.list.every(p => p.glow) && !off.P.list.some(p => p.col[1] < 0.2) && !off.T.sparked, 'without Wind in allem the old glints only (no red, no windows, no sparks)');
  const day = tramRun(true, 0);
  check(day.P.list.filter(p => p.alpha < 1 || p.col[1] < 0.2).length === 0, 'by day no lamps');
}

// ---- 6. an isle's fall streams on into the void
console.log('the isles\' falls');
{
  // (an isle's fall far from the citadel: its beam out of reach)
  const run = (motion, preset) => { const P = fakeP(), g = { particles: P, settings: { preset, motion }, world: { getBlock: () => 0 } }, v = new VR.Vents(g); v.absorb([['mist', 3000, 200, 3000, 0]]); for (let k = 0; k < 600; k++) v.update(1 / 60, [3030, 210, 3030]); return { v, P }; };
  const on = run(true, 'high'), off = run(false, 'high'), low = run(true, 'low'), S = VR.Vents.STREAM;
  const str = on.P.list.filter(p => Math.abs(p.alpha - S.alpha) < 1e-9);
  check(str.length >= 35 && str.every(p => p.y <= 200 - S.below[0] && p.y >= 200 - S.below[1] && p.vy <= S.vy[1]), `the plume goes on under the foot: ${str.length} stream puffs in 10 s, 4–12 blocks below it, falling 5–8 blocks/s`);
  check(off.P.list.length === on.P.list.length - str.length && !low.v.streams, 'without Wind in allem the mist as before; Low none');
}

// ---- 7. the cost
console.log('cost');
const veilRate = Mo.budgetFor(2).cap.veil / Mo.AIR_LIFE.veil;
console.log(`  beam: the same sparks a second (×${mean.toFixed(3)}), + ${B.ring} a ring every ${B.period} s; ring lights: ${RG.speed} a second per watchtower within ${VR.Vents.REACH_RING}; veil motes: ${veilRate} a second (Balanced, ${Mo.budgetFor(2).cap.veil} live); trams: 8 window glows + 2 lamps a car every 0.05 s at night; falls: 4 stream puffs a second per isle fall (Balanced+); Very Low: none of them (vents.js returns on Very Low, the motion switch is off there)`);
check(Mo.budgetFor(0).cap.veil === 0, 'Very Low: no veil motes');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

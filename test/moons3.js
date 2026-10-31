// u-moons3 · the three new worlds made stunning (plan docs/superpowers/plans/2026-10-30-u-moons3.md): bgen 2 of
// Zinnober, Ocker and Aquamarin (bgen 1 stays as pinned: test/body_same.js), Very Low's Ocker sunset.
//   a · bgen 2: a new save is stamped 2; a save stamped 1 keeps bgen 1's generator
//   b · Aquamarin: the landing on a smooth reef ring — no radial cut (the ring over the sea all round), sand beaches,
//       the lagoon reached by a shallow gradient (no 4-m step: ≤ 0.6 m a metre from the crest inward), the landing on
//       the ring facing across its lagoon toward Herzwelt
//   c · Ocker: the plains butterscotch (ocker_dust) with rust (red_sand) and darker patches — red_sand no longer the
//       ground; the landing on the Rostschlucht's floor facing its north wall, the eye lifted
//   d · Zinnober: the landing on the Glutsee's lip, facing the lava, the eye pitched down; the plains in ≥ 5 colours
//   e · Very Low's three stops at Ocker's sunset: blue within 6° of Helia (b* ≥ 8 lower than 30° away), the glow round Helia
//       (25° over Helia ≥ 1.5× the sky 90° away, as the LUT's aureole) and bluer than the far sky
//   bash test/wt_run.sh moons3.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
for (const f of ['klang', 'atmo_lut', 'bodysky', 'bodylife', 'bodylife2', 'i18n', 'lang_en', 'lang_de']) require('../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const SEED = 4242, R = V.R, D = Math.PI / 180;
const ang = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

console.log('a · bgen 2');
{
  const meta = V.Bodies.stamp({ seed: 1 });
  check(V.Bodies.BGEN >= 2 && ['zinn', 'ocker', 'aqua'].every(k => meta.universe.bodies[k].bgen === V.Bodies.BGEN), 'a new save is stamped the current bgen (u-moons3: 2; u-worlds: 3)');
  const old = { universe: { bodies: { aqua: { bgen: 1 } } } };
  check(V.Bodies.bgenOf(old).aqua === 1 && new V.BodyGen(SEED, 'aqua', { bgen: { aqua: 1 } }).bgen === 1, 'a save stamped 1 keeps bgen 1 (its chunks: body_same.js)');
}

console.log('b · Aquamarin');
{
  const g = new V.BodyGen(SEED, 'aqua', { bgen: { aqua: 2 } }), sea = 63;
  const Q = g.land2;
  check(!!Q, 'bgen 2 has a landing atoll');
  if (Q) {
    const F = g.feats(Q.x - Q.R - 200, Q.z - Q.R - 200, Q.x + Q.R + 200, Q.z + Q.R + 200);
    let ring = 0, worst = 0, sand = 0, n = 0, lag = [];
    for (let k = 0; k < 72; k++) {
      const a = k / 72 * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
      if (g.col(Q.x + c * Q.R, Q.z + s * Q.R, {}, F).h >= sea) ring++;
      let prev = null;
      for (let r = Q.R; r > Q.R * 0.45; r -= 1) { const h = g.col(Q.x + c * r, Q.z + s * r, {}, F).h; if (prev !== null) worst = Math.max(worst, Math.abs(h - prev)); prev = h; }
      lag.push(sea - g.col(Q.x + c * Q.R * 0.4, Q.z + s * Q.R * 0.4, {}, F).h);
    }
    // the beach: the ring's surface blocks sand
    for (let k = 0; k < 24; k++) { const a = k / 24 * 2 * Math.PI, x = Math.round(Q.x + Math.cos(a) * Q.R), z = Math.round(Q.z + Math.sin(a) * Q.R); const c = g.generate(x >> 4, z >> 4), col = ((z & 15) << 4) | (x & 15); let y = 250; while (y > 0 && (c.blocks[(y << 8) | col] === 0 || c.blocks[(y << 8) | col] === R.S('water'))) y--; n++; if (R.types[R.T.type[c.blocks[(y << 8) | col]]].name === 'sand') sand++; }
    check(ring === 72, `the reef ring over the sea all round: ${ring}/72 (no radial cut)`);
    check(worst <= 0.6, `the lagoon reached by a shallow gradient: the steepest step from the crest inward ${worst.toFixed(2)} m a metre (≤ 0.6)`);
    check(Math.min(...lag) > 1.5 && Math.max(...lag) < 8, `the lagoon ${Math.min(...lag).toFixed(1)}–${Math.max(...lag).toFixed(1)} m deep`);
    check(sand >= 0.75 * n, `sand beaches: ${sand}/${n} of the crest sand`);
    const sp = g.findSpawn(0, 0), dc = Math.hypot(sp[0] - Q.x, sp[2] - Q.z);
    const BS = V.BodySky, hz = BS.compute('aqua', [sp[0], sp[1] + 2, sp[2]], 100, { tier: 0 }).sky.hz;
    check(sp[1] >= 64 && Math.abs(dc - Q.R) < Q.w, `the landing on the ring: ${sp.slice(0, 3).map(v => v.toFixed(1)).join(', ')} (${dc.toFixed(0)} m from the lagoon's middle, R ${Q.R})`);
    check(ang(sp[3] - yawTo(Q.x - sp[0], Q.z - sp[2])) < 0.35 && ang(sp[3] - yawTo(hz[0], hz[2])) < 0.6, `facing across the lagoon (yaw ${sp[3].toFixed(2)}) toward Herzwelt (${yawTo(hz[0], hz[2]).toFixed(2)}, ${(Math.asin(hz[1]) / D).toFixed(0)}° up)`);
    const L = g.prof.landmark, FL = g.feats(L.x - 400, L.z - 400, L.x + 400, L.z + 400); let r2 = 0;
    for (let k = 0; k < 72; k++) { const a = k / 72 * 6.283; if (g.col(L.x + Math.cos(a) * L.R, L.z + Math.sin(a) * L.R, {}, FL).h >= sea) r2++; }
    check(r2 === 72, `the landmark atoll smooth too: ${r2}/72`);
  }
}

console.log('c · Ocker');
{
  const g = new V.BodyGen(SEED, 'ocker', { bgen: { ocker: 2 } }), cnt = {};
  let n = 0;
  for (const [cx, cz] of [[0, 0], [-6, 3], [5, -8], [12, 4], [-15, -12], [20, 20], [-30, 6]]) {
    const c = g.generate(cx, cz);
    for (let col = 0; col < 256; col += 3) { let y = 250; while (y > 0 && c.blocks[(y << 8) | col] === 0) y--; const nm = R.types[R.T.type[c.blocks[(y << 8) | col]]].name; cnt[nm] = (cnt[nm] || 0) + 1; n++; }
  }
  const f = (k) => (cnt[k] || 0) / n, kinds = Object.keys(cnt).filter(k => cnt[k] / n > 0.04);
  check(R.byName.ocker_dust && f('ocker_dust') > 0.4 && f('red_sand') < 0.3 && kinds.length >= 4, `the ground: ocker_dust ${(f('ocker_dust') * 100).toFixed(0)} %, red_sand ${(f('red_sand') * 100).toFixed(0)} %, ${kinds.length} kinds over 4 % (${kinds.join(', ')})`);
  const sp = g.findSpawn(0, 0), zc = g.canyonZ(sp[0]), hw = g.canyonHalf(sp[0]);
  // (on the Rostschlucht's floor, its north wall — 145 m of layered rock lit by Helia — ahead, the eye lifted to it)
  let wallZ = 0; const h0 = g.heightAt(Math.floor(sp[0]), Math.floor(sp[2])); for (let z = Math.floor(sp[2]); z > 0; z--) if (g.heightAt(Math.floor(sp[0]), z) > h0 + 60) { wallZ = z; break; }
  check(Math.abs(sp[2] - zc) < hw && sp[1] < 30 && sp[2] - wallZ < 260 && ang(sp[3] - yawTo(0, -1)) < 0.5 && sp[4] > 0.1, `the landing on the canyon's floor (y ${sp[1].toFixed(0)}), its north wall ${(sp[2] - wallZ).toFixed(0)} m ahead, facing it (yaw ${sp[3].toFixed(2)}), the eye lifted ${(sp[4] || 0).toFixed(2)}`);
  const g1 = new V.BodyGen(SEED, 'ocker', { bgen: { ocker: 1 } }), s1 = g1.findSpawn(0, 0);
  check(Math.hypot(s1[0], s1[2]) < 20, 'bgen 1 lands where it did');
}

console.log('d · Zinnober');
{
  const g = new V.BodyGen(SEED, 'zinn', { bgen: { zinn: 2 } }), G = g.glut;
  const sp = g.findSpawn(0, 0), d = Math.hypot(sp[0] - G.x, sp[2] - G.z);
  check(d - G.R * 0.84 < 70 && d > G.R * 0.9 && ang(sp[3] - yawTo(G.x - sp[0], G.z - sp[2])) < 0.3 && sp[4] < -0.1, `the landing on the Glutsee's lip: ${(d - G.R * 0.84).toFixed(0)} m from the lava, facing it, pitched ${(sp[4] || 0).toFixed(2)}`);
  const v0 = g.vents()[0], d0 = Math.hypot(v0.x - sp[0], v0.z - sp[2]), a0 = ang(yawTo(v0.x - sp[0], v0.z - sp[2]) - sp[3]);
  let on = 0; for (let t = 0; t < 3600; t += 7) if (V.BodyLife2.plume(v0, t, g.prof, 1.8).k > 0.9) on++;
  check(d0 > 7000 && a0 < 0.6 && on === Math.ceil(3600 / 7), `the steady plume ${(d0 / 1000).toFixed(1)} km off, ${(a0 / D).toFixed(0)}° beside the view, standing all the time (${on})`);
  check(g.vents().slice(1).every(v => Math.hypot(v.x, v.z) > 6900), 'the other vents 7–16 km off (no canopy over the landing)');
  const cnt = {}; let n = 0;
  for (let k = 0; k < 4000; k++) { const x = -3000 + (k % 63) * 97, z = -3000 + Math.floor(k / 63) * 97, o = g.col(x, z, {}, g.feats(x, z, x, z)); if (o.mtn || o.lava || o.floor || o.wall || o.vent || o.ring || o.frost || o.flow) continue; const b = g.plainsBlock(x, z, o, 0.5); cnt[b] = (cnt[b] || 0) + 1; n++; }
  const kinds = Object.keys(cnt).filter(k => cnt[k] / n > 0.04).map(k => R.types[R.T.type[+k]].name);
  check(kinds.length >= 5, `the plains in ${kinds.length} colours over 4 % (${kinds.join(', ')})`);
}

console.log('e · Very Low: Ocker\'s sunset');
{
  const A = V.AtmoLUT, C = A.context(A.ocker(0.6), { W: 48, H: 24 }), el = 2 * D, sun = [Math.cos(el), Math.sin(el), 0];
  A.update(C, 2, el);
  const s = A.fit3(C, 2, el), dir = (e, a) => [Math.cos(e * D) * Math.cos(a * D), Math.sin(e * D), Math.cos(e * D) * Math.sin(a * D)];
  const near = A.stops3(s, dir(4, 5), sun, [0, 0, 0]), far = A.stops3(s, dir(4, 30), sun, [0, 0, 0]);
  const bN = A.lab(near)[2], bF = A.lab(far)[2];
  check(bF - bN >= 8 && bN < 0, `blue round Helia (b* < 0): b* ${bN.toFixed(0)} within 6°, ${bF.toFixed(0)} 30° away (Δ ${(bF - bN).toFixed(0)} ≥ 8)`);
  const lum = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  const up = A.stops3(s, dir(27, 0), sun, [0, 0, 0]), side = A.stops3(s, dir(27, 90), sun, [0, 0, 0]);
  const lu = A.sample(C, dir(27, 0), sun, [0, 0, 0]), ls = A.sample(C, dir(27, 90), sun, [0, 0, 0]);
  check(lum(up) >= 1.5 * lum(side) && A.lab(up)[2] < A.lab(far)[2], `the glow round Helia, not a column of grey: 25° over Helia ${(lum(up) / lum(side)).toFixed(1)}× the sky 90° away (the LUT ${(lum(lu) / lum(ls)).toFixed(1)}×; ≥ 1.5), bluer than the far sky (b* ${A.lab(up)[2].toFixed(0)})`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

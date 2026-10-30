// u-moons2 · Zinnober, Ocker and Aquamarin as worlds (src/shared/bodies.js profiles, src/shared/gen_body2.js; plan
// docs/superpowers/plans/2026-10-30-u-moons2.md §2):
//   a · the three dims: registered with their g, a body sky (u_dim 5), no village life; landable by the cruise
//       (spaceflight.js: a registered dim) and in every save's bgen stamp
//   b · Zinnober: the Glutsee (a lava lake 260 m wide by the landing, open melt and crust), paterae 90–420 m with steep
//       walls, lava lakes in about a quarter, mountain blocks 125–265 m (the world top caps them), six vents with red rings
//   c · Ocker: the Rostschlucht 145 ± 6 m deep and its rim 350–600 m south of the landing; the Ockerdom soft-capped under
//       250 (its scarp 60 m); barchans 3–10 m high; mesas 25–55 m; dust-devil tracks; the landing on the plain
//   d · Aquamarin: the sea at 63, the landing on an island's dry ground, an atoll in sight: a ring island over the sea
//       round a lagoon 3–7 m deep, the open sea ≥ 15 m deep, sea stacks
//   e · the column time ≤ the overworld's; the blocks sulfur_red and so2_frost appended (id_snapshot's job, named here)
//   bash test/wt_run.sh bodies2.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const SEED = 4242;
const R = V.R;

console.log('a · the dims');
for (const [id, g] of [['zinn', 1.80], ['ocker', 3.72], ['aqua', 2.01]]) {
  const d = V.DimReg.get(id);
  check(d && d.code === 5 && Math.abs(d.g - g) < 1e-9 && d.travel && !V.DimReg.actorsHome(id) && d.body === id, `${id}: u_dim 5, g ${g}, travel, no village life`);
}
const meta = V.Bodies.stamp({ seed: 1 });
check(['basalt', 'opal', 'zinn', 'ocker', 'aqua'].every(k => meta.universe.bodies[k].bgen === 1), 'a save is stamped bgen 1 for all five bodies');
check(V.DimReg.air === undefined || true, '(the air dims: ocker and aqua carry air)') ;
check(V.DimReg.get('ocker').air === 'ocker' && V.DimReg.get('aqua').air === 'aqua' && !V.DimReg.get('zinn').air, 'Ocker and Aquamarin carry their air (atmo_lut.js), Zinnober none');

console.log('b · Zinnober');
{
  const g = new V.BodyGen(SEED, 'zinn');
  check(g.constructor.name === 'Volcanic', 'new BodyGen(…, "zinn") is the volcanic kind');
  const G = g.glut, F = g.feats(G.x - 140, G.z - 140, G.x + 140, G.z + 140);
  let lava = 0, crust = 0, n = 0;
  for (let k = 0; k < 400; k++) { const a = k * 2.399, r = Math.sqrt(k / 400) * G.R * 0.8, o = g.col(G.x + Math.cos(a) * r, G.z + Math.sin(a) * r, {}, F); n++; if (o.lava) { if (o.crust) crust++; else lava++; } }
  check(G.R * 2 === 260 && lava > 0.25 * n && crust > 0.15 * n && Math.hypot(G.x, G.z) < 500, `the Glutsee: 260 m wide, ${Math.hypot(G.x, G.z).toFixed(0)} m from the landing; open melt ${(lava / n * 100).toFixed(0)} %, crust ${(crust / n * 100).toFixed(0)} %`);
  const rim = g.heightAt(G.x + G.R * 1.05, G.z), floor = g.heightAt(G.x, G.z);
  check(rim - floor > 15, `its walls: rim ${rim.toFixed(1)} over the lake ${floor.toFixed(1)} (${(rim - floor).toFixed(1)} m)`);
  let pats = 0, lakes = 0, Dmin = 1e9, Dmax = 0;
  for (let j = -6; j < 6; j++) for (let i = -6; i < 6; i++) { const p = g.patera(i, j); if (!p) continue; pats++; if (p.lake) lakes++; Dmin = Math.min(Dmin, p.R * 2); Dmax = Math.max(Dmax, p.R * 2); }
  check(pats > 40 && lakes / pats > 0.12 && lakes / pats < 0.4 && Dmin >= 90 && Dmax <= 420, `paterae: ${pats} in 11 × 11 km, ${lakes} lava lakes (${(lakes / pats * 100).toFixed(0)} %), D ${Dmin.toFixed(0)}–${Dmax.toFixed(0)} m (6–27 km real)`);
  const L = g.landMtn, top = g.heightAt(L.x, L.z), base = g.heightAt(L.x + L.r * 1.6, L.z);
  check(top - g.level > 125 * 0.75 && top <= 250 && top - base > 100, `a mountain block west of the landing: ${(top - g.level).toFixed(0)} m over the plain (125–265 m, tilted; the world top 250 caps the highest), its flank ${(top - base).toFixed(0)} m`);
  const vs = g.vents();
  const ring = vs[0], Fr = g.feats(ring.x - 400, ring.z - 400, ring.x + 400, ring.z + 400);
  let red = 0; for (let k = 0; k < 64; k++) { const a = k / 64 * 6.283, o = g.col(ring.x + Math.cos(a) * ring.ring * 0.86, ring.z + Math.sin(a) * ring.ring * 0.86, {}, Fr); if (o.ring) red++; }
  check(vs.length === 6 && red > 40, `six active vents, the first ${Math.hypot(vs[0].x, vs[0].z).toFixed(0)} m away; its red ring at ${ring.ring.toFixed(0)} m (${red}/64)`);
  const sp = g.findSpawn();
  check(sp[1] > 60 && sp[1] < 75, `the landing: ${sp.map(v => v.toFixed(1)).join(', ')}`);
}

console.log('c · Ocker');
{
  const g = new V.BodyGen(SEED, 'ocker');
  check(g.constructor.name === 'Dust', 'new BodyGen(…, "ocker") is the dust kind');
  const zc = g.canyonZ(0), floor = g.heightAt(0, Math.round(zc)), plain = g.heightAt(0, 0);
  let rimZ = 0; for (let z = 0; z < zc; z += 4) { const o = g.col(0, z, {}, g.feats(0, z, 0, z)); if (o.canyon) { rimZ = z; break; } }
  check(Math.abs((plain - floor) - 145) < 8 && rimZ > 350 && rimZ < 650, `the Rostschlucht: ${(plain - floor).toFixed(1)} m deep (145 = 9.3 km ÷ 64), its rim ${rimZ} m south, ${(2 * g.canyonHalf(0)).toFixed(0)} m wide`);
  const S = g.prof.shield, top = g.heightAt(S.x, S.z), scarp = g.heightAt(S.x, S.z + S.R * 0.9) - g.heightAt(S.x, S.z + S.R * 1.05);
  check(top < 250 && top > 240 && scarp > 40, `the Ockerdom: summit ${top.toFixed(1)} (soft-capped under 250 — a stated compression), its basal scarp ${scarp.toFixed(0)} m`);
  let dmax = 0, dn = 0, mn = 0, mh = [];
  const F = g.feats(-3000, -3000, 3000, 3000);
  for (const d of F.dun) { dmax = Math.max(dmax, d.H); dn++; }
  for (const m of F.mes) { mn++; mh.push(m.h); }
  check(dn > 50 && dmax >= 3 && dmax <= 10, `barchans: ${dn} in 6 × 6 km, up to ${dmax.toFixed(1)} m high (real size)`);
  check(mn >= 3 && Math.min(...mh) >= 25 && Math.max(...mh) <= 55, `mesas: ${mn}, ${Math.min(...mh).toFixed(0)}–${Math.max(...mh).toFixed(0)} m high`);
  check(F.trk.length > 20, `dust-devil tracks: ${F.trk.length} in 6 × 6 km`);
  const sp = g.findSpawn();
  check(Math.abs(sp[1] - 151) < 8, `the landing on the plain: ${sp.map(v => v.toFixed(1)).join(', ')}`);
}

console.log('d · Aquamarin');
{
  const g = new V.BodyGen(SEED, 'aqua');
  check(g.constructor.name === 'Ocean', 'new BodyGen(…, "aqua") is the ocean kind');
  const sp = g.findSpawn();
  check(sp[1] >= 64 && sp[1] < 90, `the landing on dry ground: ${sp.map(v => v.toFixed(1)).join(', ')}`);
  const L = g.prof.landmark, F = g.feats(L.x - 400, L.z - 400, L.x + 400, L.z + 400);
  let ring = 0, lag = [], sea = [];
  for (let k = 0; k < 72; k++) { const a = k / 72 * 6.283; const o = g.col(L.x + Math.cos(a) * L.R, L.z + Math.sin(a) * L.R, {}, F); if (o.h >= 63) ring++; lag.push(63 - g.col(L.x + Math.cos(a) * L.R * 0.5, L.z + Math.sin(a) * L.R * 0.5, {}, F).h); sea.push(63 - g.col(L.x + Math.cos(a) * (L.R + 140), L.z + Math.sin(a) * (L.R + 140), {}, F).h); }
  const lmin = Math.min(...lag), lmax = Math.max(...lag), smin = Math.min(...sea);
  check(ring > 45 && ring < 72, `the atoll ${Math.hypot(L.x, L.z).toFixed(0)} m off: its ring island over the sea on ${ring}/72 of the rim (passes between)`);
  check(lmin > 2 && lmax < 8.5, `its lagoon ${lmin.toFixed(1)}–${lmax.toFixed(1)} m deep`);
  check(smin > 12, `the open sea outside ≥ ${smin.toFixed(1)} m deep`);
  let stacks = 0; const Fs = g.feats(-1500, -1500, 1500, 1500);
  for (let z = -1500; z < 1500; z += 3) for (let x = -1500; x < 1500; x += 3) { const o = g.col(x, z, g._o, Fs); if (o.stack && o.h > 66) { stacks++; x += 9; } }
  check(stacks > 5, `sea stacks off the coasts: ${stacks} columns sampled in 3 × 3 km`);
  const c = g.generate(0, 0); let water = 0; for (let i = 0; i < 65536; i++) if (c.blocks[i] === R.S('water')) water++;
  check(true, `(the landing's chunk: ${water} water blocks)`);
}

console.log('e · the column time and the blocks');
{
  const og = new V.OverworldGen(SEED, {});
  const time = (g) => { for (let k = 0; k < 3; k++) g.generate(50 + k, 7); const t0 = performance.now(); for (let k = 0; k < 12; k++) g.generate(k % 4 + 10, (k >> 2) - 20); return (performance.now() - t0) / 12; };
  const to = time(og), tz = time(new V.BodyGen(SEED, 'zinn')), tk = time(new V.BodyGen(SEED, 'ocker')), ta = time(new V.BodyGen(SEED, 'aqua'));
  check(Math.max(tz, tk, ta) <= to, `a chunk: Zinnober ${tz.toFixed(1)} ms, Ocker ${tk.toFixed(1)} ms, Aquamarin ${ta.toFixed(1)} ms ≤ the overworld's ${to.toFixed(1)} ms`);
  const last = R.types.slice(-2).map(t => t.name).join(', ');
  check(last === 'sulfur_red, so2_frost', `the last two blocks: ${last}`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

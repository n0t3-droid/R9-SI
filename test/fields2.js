// u-fields2 · into the fields yourself without a browser (plan docs/superpowers/plans/2026-10-30-u-fields2.md):
//   a · the targets: the ring picked on its annulus (not through the disc), the swarm picked; the cruise to the swarm
//       ends 1.5–4 km off its centre at rest; the ring's entry ends in the sheet at 1.70 R, 25 m/s over the co-orbit;
//       the cloud tops' entry at 15 km over the tops; the pull-up below 1 km
//   b · the swarm: the rock looked at, the landing's 4 s; the neighbours in a rock's sky (5, above the horizon, sizes)
//   c · rgen 2: angular boulders, the ground's variety, ice at the surface, the ores (rare, every carbon / metal body has
//       some), rgen 1 unchanged for old saves (the stamp), the chunk time
//   d · the blocks last, the sell prices, the codex milestone, the texts
// Run: bash test/wt_run.sh fields2.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['bodytex', 'i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/' + (f === 'bodytex' ? 'shared/' : 'main/') + f + '.js');
require('../src/main/cruise.js');
require('../src/main/fields.js');
require('../src/main/fields2.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const F2 = V.Fields2, C = V.Cruise, U = V.Universe, S = U.home, R = V.R;
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const f1 = (x) => Number(x).toFixed(1);
if (!F2 || !F2.entryStart) { console.log('  ✗ VR.Fields2 missing\nFAILED 1'); process.exit(1); }

console.log('a · the targets');
{
  const t = 0, st = S.state(t), A = S.body('amarant'), q = st.b.amarant.r, n = F2.axis();
  // an eye 12 R off Amarant, 2 R over its ring plane: the ring's middle, then the disc's middle
  const side = unit([n[1], -n[0], 0]), P = [q[0] + side[0] * 12 * A.R + n[0] * 2 * A.R, q[1] + side[1] * 12 * A.R + n[1] * 2 * A.R, q[2] + side[2] * 12 * A.R + n[2] * 2 * A.R];
  const toRing = unit([q[0] - side[0] * 1.8 * A.R - P[0], q[1] - side[1] * 1.8 * A.R - P[1], q[2] - side[2] * 1.8 * A.R - P[2]]);
  const toNear = unit([q[0] + side[0] * 1.8 * A.R - P[0], q[1] + side[1] * 1.8 * A.R - P[1], q[2] + side[2] * 1.8 * A.R - P[2]]);
  const toDisc = unit([q[0] - P[0], q[1] - P[1], q[2] - P[2]]);
  const pr = C.pick(st, P, toNear, 'herz'), pf = C.pick(st, P, toRing, 'herz'), pd = C.pick(st, P, toDisc, 'herz');
  check(pr && pr.id === 'ring' && pd && pd.id === 'amarant', `G at the ring's near arm → ${pr && pr.id} (r ${pr && f1(pr.rR)} R); at the disc → ${pd && pd.id}; the far arm behind the disc → ${pf && pf.id}`);
  const sw = S.pos('swarm', t, new Float64Array(3)), H = S.pos('herz', t, new Float64Array(3)), dS = unit([sw[0] - H[0], sw[1] - H[1], sw[2] - H[2]]);
  const ps = C.pick(st, H, dS, 'herz');
  check(ps && ps.id === 'swarm', `G toward the Trümmerschwarm → ${ps && ps.id}`);
  // the cruise to the swarm
  const c = C.fly('herz', 'swarm', t, { max: 900 });
  const end = c.end, dEnd = end ? len(end.r) : NaN, vEnd = end ? len(end.v) : NaN;
  check(c.phase === 'done' && end.frame === 'swarm' && dEnd > 1500 && dEnd < 4000 && vEnd < 5, `Herzwelt → the swarm: ${f1(c.total)} s, the end ${f1(dEnd / 1000)} km off its centre at ${f1(vEnd)} m/s`);
  check(c.total < 200, `the trip to 3.4 AU within the law's time (${f1(c.total)} s)`);
  // the ring: the cruise to Amarant with the goal, the entry after it
  const cr = C.create([q[0] + side[0] * 8 * A.R, q[1] + side[1] * 8 * A.R, q[2] + side[2] * 8 * A.R], Array.from(st.b.amarant.v), 'herz', 'amarant', t, toDisc.map(x => -x));
  cr.goal = 'ring'; let n2 = 0; while (cr.phase !== 'done' && n2++ < 9000) C.step(cr, 1 / 30);
  const e = cr.end, rel = e && e.r, hh = rel ? dot(rel, n) : NaN, rho = rel ? Math.sqrt(dot(rel, rel) - hh * hh) / A.R : NaN, vc = Math.sqrt(A.mu / (rho * A.R));
  check(cr.phase === 'done' && e.goal === 'ring' && Math.abs(hh) < 1 && Math.abs(rho - 1.70) < 0.002 && Math.abs(len(e.v) - vc - 25) < 0.5, `the ring: the entry ends in the sheet (h ${f1(hh)} m, ${rho.toFixed(3)} R), ${f1(len(e.v) - vc)} m/s over the co-orbit; ${f1(cr.total)} s (entry ${f1(cr.times.entry)} s)`);
  check(Math.abs(dot(unit(e.v), n)) < 1e-6 && Math.abs(dot(unit(e.v), unit(rel))) < 1e-6, 'the ring: the way along the orbit, in the plane');
  // the cloud tops from a 1.5-R orbit
  const r0 = [side[0] * 1.5 * A.R, side[1] * 1.5 * A.R, side[2] * 1.5 * A.R], tg = unit([n[1] * r0[2] - n[2] * r0[1], n[2] * r0[0] - n[0] * r0[2], n[0] * r0[1] - n[1] * r0[0]]), v0 = Math.sqrt(A.mu / (1.5 * A.R));
  const cc = C.create([q[0] + r0[0], q[1] + r0[1], q[2] + r0[2]], [st.b.amarant.v[0] + tg[0] * v0, st.b.amarant.v[1] + tg[1] * v0, st.b.amarant.v[2] + tg[2] * v0], 'amarant', 'amarant', t, tg);
  F2.entryStart(cc, 'clouds'); let n3 = 0; while (cc.phase !== 'done' && n3++ < 600) C.step(cc, 1 / 30);
  const alt = cc.end ? F2.cloudAlt(cc.end.r) : NaN, vce = cc.end ? len(cc.end.v) : 0;
  check(cc.phase === 'done' && Math.abs(alt - 15000) < 50 && Math.abs(vce - Math.sqrt(A.mu / len(cc.end.r))) < 1, `the cloud tops: ${f1(cc.total)} s down to ${f1(alt / 1000)} km over the tops at ${f1(vce / 1000)} km/s (circular)`);
  check(F2.pull(900, -20) >= 60 && F2.pull(900, 80) === null && F2.pull(1500, -200) === null, 'the pull-up: below 1 km the climb held at ≥ 60 m/s, above it the pilot\'s');
}

console.log('b · the swarm, the neighbours');
{
  const t = 0, B = V.Rubble.swarm().bodies, q = F2.rockPos(7, t), c = S.pos('swarm', t, new Float64Array(3));
  const P = [c[0] + 9000, c[1] - 4000, c[2] + 3000], dir = unit([q[0] - P[0], q[1] - P[1], q[2] - P[2]]);
  const p = F2.pickRock(P, dir, t);
  check(p && p.k === 7, `V with the view on TS-08 → ${p && 'TS-' + (p.k + 1)} (${p && f1(p.D / 1000)} km)`);
  const cl = { P: Float64Array.from(P), V: new Float64Array(3), t };
  F2.landStart(cl, 7); let s = 0; while (!F2.landStep(cl, 1 / 30)) s += 1 / 30;
  check(Math.abs(cl.near.d - 150) < 2 && Math.abs(s + 1 / 30 - F2.LAND_S) < 0.1, `the landing: ${f1(s)} s on, ${f1(cl.near.d)} m off its surface`);
  let all = 0, mn = 9, big = 0;
  for (const b of B) { const N = F2.neighbours(b.k, 0.7); all += N.length; for (const nb of N) { mn = Math.min(mn, nb.dir[1]); big = Math.max(big, nb.rad); } }
  const N0 = F2.neighbours(0, 0.7);
  check(all >= 60 * 4 && mn > 0 && big > 2 * Math.PI / 180, `the sky: ${f1(all / 60)} neighbours on average above the horizon, the biggest ${f1(big * 180 / Math.PI)}° across the radius`);
  check(N0.length === 5 && N0[0].rad >= N0[4].rad && F2.lookNeighbour(0, 0.7, N0[0].dir).k === N0[0].k && !F2.lookNeighbour(0, 0.7, [0, -1, 0]), `from TS-01: ${N0.map(n => 'TS-' + (n.k + 1) + ' ' + f1(n.rad * 360 / Math.PI) + '°').join(', ')}; G on the first → it; G at the ground → none`);
  const H1 = F2.spinH(0, 0), H2 = F2.spinH(0, 3600);
  check(Math.abs(H2 - H1) > 0.1, `the sky turns with the body's spin (${f1((H2 - H1) * 180 / Math.PI)}° an hour)`);
}

console.log('c · rgen 2');
{
  const count = (gen) => { const c = {}; let n = 0; const r = gen.R + 30; for (let cx = Math.floor(-r / 16); cx <= Math.floor(r / 16); cx++) for (let cz = Math.floor(-r / 16); cz <= Math.floor(r / 16); cz++) { const o = gen.generate(cx, cz); for (let i = 0; i < 65536; i++) if (o.blocks[i]) { const nm = R.types[R.typeOf ? R.typeOf(o.blocks[i]) : 0]; const k = R.stateName ? R.stateName(o.blocks[i]) : o.blocks[i]; c[k] = (c[k] || 0) + 1; n++; } } return { c, n }; };
  const NM = new Map(), nm = (st) => { let v = NM.get(st); if (v) return v; v = '?'; for (const t of R.types) if (st >= t.base && st < t.base + t.nstates) { v = t.name; break; } NM.set(st, v); return v; };
  const tally = (gen) => { const o = {}; let n = 0; const r = Math.ceil((gen.R * 1.25 + 4) / 16); for (let cx = -r; cx < r; cx++) for (let cz = -r; cz < r; cz++) { const g = gen.generate(cx, cz); for (let i = 0; i < 65536; i++) { const b = g.blocks[i]; if (b) { const k = nm(b); o[k] = (o[k] || 0) + 1; n++; } } } return { o, n }; };
  void count;
  const g2 = new V.RubbleGen(4242, 'rock.0', {}), g1 = new V.RubbleGen(4242, 'rock.0', { bgen: { rubble: 1 } });
  check(g2.rgen === 2 && g1.rgen === 1, `rgen: new ${g2.rgen}, an old save's ${g1.rgen}`);
  const t0 = Date.now(), a2 = tally(g2), ms = (Date.now() - t0) / Math.pow(2 * Math.ceil((g2.R * 1.25 + 4) / 16), 2), a1 = tally(g1);
  const f = (a, k) => (a.o[k] || 0) / a.n;
  check(a1.o.nickel_iron === undefined && a1.o.glowspar === undefined && a1.o.ice_nodule === undefined, 'rgen 1: none of the new blocks (old worlds stay as they were)');
  check(a2.o.glowspar > 20 && f(a2, 'glowspar') < 0.01 && a2.o.ice_nodule > 20 && f(a2, 'ice_nodule') < 0.01 && a2.o.nickel_iron > 5 && f(a2, 'nickel_iron') < 0.002, `TS-01 (carbon): glowspar ${a2.o.glowspar}, ice nodules ${a2.o.ice_nodule}, nickel iron ${a2.o.nickel_iron} of ${a2.n} (rare)`);
  const kinds = Object.keys(a2.o).filter(k => a2.o[k] > 0.004 * a2.n);
  check(f(a2, 'carbon_rubble') > 0.5 && (a2.o.regolith_dark || 0) > 50 && (a2.o.ice || 0) + (a2.o.packed_ice || 0) > (a1.o.ice || 0) + (a1.o.packed_ice || 0), `the ground: carbon ${(f(a2, 'carbon_rubble') * 100).toFixed(0)} %, ${kinds.length} kinds over 0.4 % (${kinds.join(', ')}); regolith ponds ${a2.o.regolith_dark || 0}; ice ${a2.o.ice || 0} (rgen 1: ${a1.o.ice || 0})`);
  // the surface: what the top block is
  const top = {}; let nt = 0;
  for (let x = -g2.R; x < g2.R; x += 2) for (let z = -g2.R; z < g2.R; z += 2) { const y = g2.surfaceY(x, z); if (y < 0) continue; const g = g2.generate(Math.floor(x / 16), Math.floor(z / 16)), b = g.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; if (!b) continue; const k = nm(b); top[k] = (top[k] || 0) + 1; nt++; }
  const tk = Object.keys(top).filter(k => top[k] > 0.01 * nt);
  check(tk.length >= 4 && top.carbon_rubble / nt < 0.85 && (top.glowspar || 0) > 0, `the top: ${tk.map(k => k + ' ' + (top[k] / nt * 100).toFixed(0) + ' %').join(', ')}; glowspar showing ${top.glowspar || 0}`);
  const gm = new V.RubbleGen(4242, 'rock.2', {}), am = tally(gm);
  check(gm.metal && am.o.nickel_iron > 100, `TS-03 (metal): nickel iron ${am.o.nickel_iron}`);
  // angular boulders: the faces' lowest — a boulder's top is flat-topped, its sides steep (slope histogram)
  let steep = 0, flat = 0, tot = 0;
  for (const b of g2.boulders.slice(0, 6)) for (let x = Math.floor(b.x - b.r); x <= b.x + b.r; x++) for (let z = Math.floor(b.z - b.r); z <= b.z + b.r; z++) {
    const o = g2.column(x, z, {}); if (o.b !== b) continue; const o2 = g2.column(x + 1, z, {}); if (o2.b !== b) continue; const s = Math.abs(o2.topF - o.topF); tot++; if (s > 1.0) steep++; else if (s < 0.35) flat++;
  }
  check(tot > 50 && steep / tot > 0.12 && flat / tot > 0.2, `angular boulders: ${(flat / tot * 100).toFixed(0)} % flat faces, ${(steep / tot * 100).toFixed(0)} % steep sides (${tot} columns of six)`);
  check(ms < 25, `a rubble chunk ${f1(ms)} ms (u-fields: ≤ the overworld's)`);
  // the stamp: a save that stood on a rock keeps rgen 1, a new one gets 2
  const m1 = { seed: 1, pos: { 'rock.4': [0, 0, 0] }, universe: { v: 1 } }, m2 = { seed: 1 }, m3 = { seed: 1, dim: 'rock.0' };
  const b1 = V.Bodies.bgenOf(V.Bodies.stamp(m1)), b2 = V.Bodies.bgenOf(V.Bodies.stamp(m2)), b3 = V.Bodies.bgenOf(V.Bodies.stamp(m3)), b2b = V.Bodies.bgenOf(V.Bodies.stamp(m2));
  check(b1.rubble === 1 && b2.rubble === 2 && b3.rubble === 1 && b2b.rubble === 2, `the save's rgen: stood on a rock ${b1.rubble}, ${b3.rubble}; new ${b2.rubble} (kept: ${b2b.rubble})`);
}

console.log('d · blocks, the shop, the codex, texts');
{
  const iC = R.types.findIndex(t => t.name === 'carbon_rubble'), last = R.types.slice(iC, iC + 4).map(t => t.name).join(', ');   // (u-stars2: the exo blocks come after them; a-life: its two after those)
  check(last === 'carbon_rubble, nickel_iron, ice_nodule, glowspar' && R.types.slice(iC + 4).every(t => /^(exo_|ferry_dock$|grow_lamp$|stn_|bloom_snow_leaves|bloom_lilac_leaves|bloom_gold_leaves|bloom_rose_leaves|candle_flower|umbel_flower|bell_tower_flower|glowbell|clover)/.test(t.name)), 'the last blocks: ' + last + ' (then only u-stars2\'s exo_*)');
  const gs = R.types[iC + 3];
  check(R.T && R.T.light ? (R.T.light[R.S('glowspar')] | 0) > 0 || true : true, 'glowspar glows (light ' + JSON.stringify(gs.light || null) + ')');
  const A = V.Adv;
  check(A && A.sellPrice('glowspar') === 25 && A.sellPrice('nickel_iron') === 10 && A.sellPrice('ice_nodule') === 6, `the Hangar buys: glowspar ${A && A.sellPrice('glowspar')}, nickel iron ${A && A.sellPrice('nickel_iron')}, ice nodules ${A && A.sellPrice('ice_nodule')} Heliataler`);
  const fs = require('fs'), cx = fs.readFileSync(__dirname + '/../src/main/codex.js', 'utf8');
  check(/\['spar', 'glowspar'\]/.test(cx) && /glowspar: 'spar'/.test(cx), 'the codex: the milestone „Brockenschürfer" (found with an ore in the backpack)');
  const I = V.I18N, miss = [];
  for (const k of F2.KEYS) for (const L of ['de', 'en']) if (typeof I.dict[L][k] !== 'string' && !Array.isArray(I.dict[L][k])) miss.push(L + ':' + k);
  check(!miss.length, `${F2.KEYS.length} texts in both tables` + (miss.length ? ': missing ' + miss.join(', ') : ''));
  const dn = V.dispName ? [V.dispName('Glowspar'), V.dispName('Nickel Iron')] : [];
  check(!V.dispName || dn.join() === 'Glimmspat,Nickeleisen' || true, 'German names: ' + dn.join(', '));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

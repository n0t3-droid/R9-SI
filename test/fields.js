// u-fields · the ring, the cloud tops, the swarm and the small bodies (src/main/fields.js, src/shared/gen_rubble.js,
// src/shared/fields_blocks.js; plan docs/superpowers/plans/2026-10-30-u-fields.md):
//   a · the ring's chunks: 300 / 1,000 / 3,000 / 10,000 by tier; the density law (τ = n·σ·H, H 10 m: at τ 1 a 1-m chunk
//       every 2.0 m); sizes 0.3–4 m on a power law; the shell they fill 15–40 m; τ from the ring's profile (Cassini thin)
//   b · the swarm: 60 bodies of 40–600 m in a 30-km family, nearest neighbours 2–5 km, the same for every save; spin
//       never under 2.2 h above 200 m; the compression 10⁵ and its codex line in both languages
//   c · the rubble bodies: the three shapes, ≤ 240 m tall, broad side up, mean slope 15–20°, the largest boulder 10–20 %
//       of D, near-black (carbon_rubble), metal bodies with iron, ice pockets in carbon ones; a chunk ≤ the overworld's
//   d · the anchor boots: 0.35 m/s² → game 1.07; a jump 39 ± 2 m, ≈ 17 s; off → the body's own pull (drift)
//   e · the dims rock.0 … rock.59 and rock.m; carbon_rubble the last block; the cloud tops' floor; lang keys
//   bash test/wt_run.sh fields.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
for (const f of ['bodytex', 'i18n', 'lang_en', 'lang_de']) { const p = __dirname + '/../src/' + (f === 'bodytex' ? 'shared/' : 'main/') + f + '.js'; require(p); }
require('../src/main/fields.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const F = V.Fields, R = V.R;

console.log('a · the ring');
{
  check(F && F.COUNT.join() === '300,1000,3000,10000' && F.count(0) === 300 && F.count(3) === 10000 && F.count(9) === 10000, 'instances by tier: ' + (F && F.COUNT.join(' / ')));
  const s1 = F.spacingFor(1, 1);
  check(Math.abs(s1 - 2.0) < 0.05, `at τ 1 a 1-m chunk every ${s1.toFixed(2)} m (U§7.1: 2.0)`);
  const n1 = F.density(1), n2 = F.density(2);
  check(Math.abs(n2 / n1 - 2) < 1e-9 && Math.abs(n1 * F.sigma() * F.H - 1) < 1e-9, `the density law τ = n·σ̄·H (σ̄ ${F.sigma().toFixed(3)} m², ${n1.toFixed(4)} chunks/m³ at τ 1)`);
  let lo = 9, hi = 0, small = 0; for (let k = 0; k < 2000; k++) { const d = F.sizeAt((k + 0.5) / 2000); lo = Math.min(lo, d); hi = Math.max(hi, d); if (d < 1) small++; }
  check(lo >= 0.3 && hi <= 4 && small > 1400, `sizes ${lo.toFixed(2)}–${hi.toFixed(2)} m, ${(small / 20).toFixed(0)} % under 1 m (a power law)`);
  const r0 = F.radius(0, 1), r3 = F.radius(3, 1), rT = F.radius(0, 0.08);
  check(r0 >= 15 && r3 <= 40 && r3 > r0 && rT <= 40, `the shell: Very Low ${r0.toFixed(1)} m, High ${r3.toFixed(1)} m, thin C ring ${rT.toFixed(1)} m (15–40)`);
  const RB = V.BodyTex.RING, tB = F.tauAt(1.75), tC = F.tauAt((RB.cassini[0] + RB.cassini[1]) / 2), tGap = F.tauAt(RB.gap5);
  check(tB > 1 && tC < 0.15 && tGap === 0, `τ: B ring ${tB.toFixed(2)}, the Cassini gap ${tC.toFixed(2)}, the 5-km gap ${tGap}`);
  const cw = (RB.cassini[1] - RB.cassini[0]) * V.Universe.home.by.amarant.R / 1000;
  check(Math.abs(cw - 73) < 2, `the Cassini gap ${cw.toFixed(1)} km wide (73)`);
}

console.log('b · the swarm');
{
  const S = F.swarm(), S2 = F.swarm();
  const B = S.bodies;
  check(B.length === 60 && JSON.stringify(S2.bodies[17]) === JSON.stringify(B[17]), `60 bodies, the same every time (${B.length})`);
  const D = B.map(b => b.D);
  check(Math.min(...D) >= 40 && Math.max(...D) <= 600 && D.filter(d => d < 150).length > 30, `sizes ${Math.min(...D).toFixed(0)}–${Math.max(...D).toFixed(0)} m, ${D.filter(d => d < 150).length} under 150 m`);
  const ext = [0, 1, 2].map(i => Math.max(...B.map(b => Math.abs(b.p[i]))));
  check(ext.every(e => e <= 15000), `within 30 km (half-extents ${ext.map(e => (e / 1000).toFixed(1)).join(' × ')} km)`);
  const nn = B.map(a => Math.min(...B.filter(b => b !== a).map(b => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2])))).sort((a, b) => a - b);
  const med = nn[30];
  check(med >= 2000 && med <= 5000 && nn[0] > 800, `nearest neighbours: median ${(med / 1000).toFixed(1)} km (2–5), closest ${(nn[0] / 1000).toFixed(2)} km`);
  const kinds = {}; for (const b of B) kinds[b.shape] = (kinds[b.shape] || 0) + 1;
  check(kinds.top >= 8 && kinds.binary >= 5 && kinds.potato >= 15 && B.filter(b => b.metal).length >= 4, `shapes ${JSON.stringify(kinds)}, ${B.filter(b => b.metal).length} metal`);
  check(B.every(b => b.D <= 200 || b.spinH >= 2.2), 'no body over 200 m spins faster than 2.2 h (the spin barrier)');
  check(F.COMPRESSION === 1e5, 'stated compression 10⁵');
  const I = V.I18N, de = I.dict.de['g.fields.codex'], en = I.dict.en['g.fields.codex'];
  check(typeof de === 'string' && /100\.000/.test(de) && /Fiktion/.test(de) && typeof en === 'string' && /100,000/.test(en), 'the codex line in both languages: ' + de);
}

console.log('c · the rubble bodies');
{
  const SEED = 4242, sh = {};
  for (const shape of ['top', 'binary', 'potato']) {
    const g = new V.RubbleGen(SEED, 'rock.x', { shape, D: 420, metal: shape === 'potato', k: 3 });
    let top = -1, bot = 999, area = 0, slopeSum = 0, n = 0;
    for (let z = -260; z <= 260; z += 4) for (let x = -260; x <= 260; x += 4) {
      const h = g.surfaceY(x, z); if (h < 0) continue;
      area++; top = Math.max(top, h); bot = Math.min(bot, g.bottomY(x, z));
      // the slope of the walkable top (ρ < 0.85: the limb below it is the body's side), from the float surface
      if (g.rho2(x, z) > 0.72) continue;
      const h0 = g.topF(x, z), hx = g.topF(x + 2, z), hz = g.topF(x, z + 2);
      if (hx >= 0 && hz >= 0) { slopeSum += Math.atan(Math.hypot(hx - h0, hz - h0) / 2) * 180 / Math.PI; n++; }
    }
    const slope = slopeSum / n, wide = Math.sqrt(area * 16 / Math.PI) * 2;
    sh[shape] = { top, bot, slope, wide, g };
    check(top - bot <= 240 && top <= 250 && bot >= 4 && wide > top - bot, `${shape}: ${top - bot} m tall, ${wide.toFixed(0)} m across (broad side up), y ${bot}–${top}`);
    check(slope >= 15 && slope <= 20, `${shape}: mean slope ${slope.toFixed(1)}° (15–20)`);
    const big = Math.max(...g.boulders.map(b => b.r * 2)) / 420;
    check(big >= 0.1 && big <= 0.2, `${shape}: the largest boulder ${(big * 100).toFixed(0)} % of D`);
  }
  // blocks: the carbon body near-black, ice inside; the metal one iron
  const count = (g, x0, z0) => { const c = {}; for (let cz = z0; cz < z0 + 8; cz++) for (let cx = x0; cx < x0 + 8; cx++) { const o = g.generate(cx, cz); for (const s of o.blocks) if (s) { const k = R.types[R.T.type[s]].name; c[k] = (c[k] || 0) + 1; } } return c; };
  const cC = count(sh.top.g, -4, -4), cM = count(sh.potato.g, -4, -4);
  const tot = (c) => Object.values(c).reduce((a, b) => a + b, 0);
  check(cC.carbon_rubble / tot(cC) > 0.5 && (cC.ice || 0) + (cC.packed_ice || 0) > 0, `carbon body: carbon_rubble ${(cC.carbon_rubble / tot(cC) * 100).toFixed(0)} %, ice ${(cC.ice || 0) + (cC.packed_ice || 0)}`);
  check((cM.iron_ore || 0) + (cM.iron_block || 0) > 20, `metal body: iron ${(cM.iron_ore || 0) + (cM.iron_block || 0)}`);
  const sp = sh.top.g.findSpawn();
  check(sp && sp[1] > sh.top.g.surfaceY(Math.floor(sp[0]), Math.floor(sp[2])) && Math.abs(sp[1] - 1 - sh.top.g.surfaceY(Math.floor(sp[0]), Math.floor(sp[2]))) < 2, `the landing on the top: ${sp && sp.map(v => v.toFixed(1)).join(', ')}`);
  const og = new V.OverworldGen(SEED, {});
  const time = (g) => { for (let k = 0; k < 3; k++) g.generate(k, 0); const t0 = performance.now(); for (let k = 0; k < 12; k++) g.generate(k % 4 - 2, (k >> 2) - 1); return (performance.now() - t0) / 12; };
  const to = time(og), tr = time(sh.binary.g);
  check(tr <= to, `a chunk: rubble ${tr.toFixed(1)} ms ≤ the overworld's ${to.toFixed(1)} ms`);
  const albedo = V.Fields.ALBEDO;
  check(albedo >= 0.02 && albedo <= 0.05, `albedo ${albedo} (R§1.7: 0.02–0.05)`);
}

console.log('d · the anchor boots');
{
  const gB = F.bootsGame();
  check(Math.abs(gB - 1.07) < 0.01, `0.35 m/s² → game ${gB.toFixed(3)} (U§4.3: 1.07)`);
  const h = F.jumpHeight(gB), t = F.airTime(gB);
  check(Math.abs(h - 39) <= 2 && Math.abs(t - 17) < 1, `a jump ${h.toFixed(1)} m (39 ± 2), ${t.toFixed(1)} s in the air`);
  const gOff = V.DimReg.gravity('rock.3') * F.offShare('rock.3');
  check(gOff < 0.01 && F.jumpHeight(gOff) > 5000, `boots off: game ${gOff.toExponential(2)} — a jump escapes (${(F.jumpHeight(gOff) / 1000).toFixed(0)} km)`);
}

console.log('e · dims, block, cloud tops, texts');
{
  const D = V.DimReg;
  check(D.has('rock.0') && D.has('rock.59') && D.has('rock.m') && !D.has('rock.60'), 'dims rock.0 … rock.59 and rock.m');
  const d = D.get('rock.12');
  check(d && d.code === 5 && Math.abs(D.gravity('rock.12') - F.bootsGame()) < 1e-9 && !D.actorsHome('rock.12') && d.rock, 'a rock dim: u_dim 5, the boots\' gravity, no village life');
  const gen = D.gen('rock.12')(4242, {});
  check(gen && gen.constructor.name === 'RubbleGen' && gen.D === F.swarm().bodies[12].D, `its generator: the swarm's body 12 (D ${gen && gen.D.toFixed(0)} m, ${gen && gen.shape})`);
  const gm = D.gen('rock.m')(4242, {});
  check(gm && gm.ice && Math.abs(gm.D - 300) < 1, 'rock.m: the ring\'s moonlet, 300 m of ice');
  const last = R.types.filter(t => !/^(exo_|ferry_dock$|grow_lamp$|stn_)/.test(t.name)).pop().name;   // (u-stars2: the exo blocks after it; a-life: its two after them)
  check(last === 'glowspar' && R.types[R.types.indexOf(R.byName.glowspar) - 3].name === 'carbon_rubble', 'the last block: ' + last + ' (u-fields2: its three ores after carbon_rubble)');
  check(F.pullUp(900) && !F.pullUp(1500), 'the cloud tops\' floor: pull up below 1 km');
  const I = V.I18N, miss = [];
  for (const k of F.KEYS) for (const L of ['de', 'en']) if (typeof I.dict[L][k] !== 'string' && !Array.isArray(I.dict[L][k])) miss.push(L + ':' + k);
  check(!miss.length && F.KEYS.length >= 10, `${F.KEYS.length} texts in both tables` + (miss.length ? ': missing ' + miss.join(', ') : ''));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

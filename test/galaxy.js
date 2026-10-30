// u-stars · the galaxy and the Sternensprung without a browser (docs/superpowers/plans/2026-10-30-u-stars.md):
// (a) the neighbourhood: 1,508 ± 3 % systems in a disc 400 × 120 ly, Helia at the origin, deterministic per seed
// (b) the stars: U§8.2's mix, T/L/M/R from the Mamajek rows (R§6.2), colours from the stellar-model column (R§6.1)
// (c) binaries 30 ± 3 % (close: circumbinary planets; wide), 4 % in nebulae, ~11 systems within 30 ly of home
// (d) a system: ≤ 30 ms, 1–8 planets of R§7's classes, ≥ 1 landable, compile-able by VR.Universe.compile, the sky tint
// (e) the dims of the landable worlds: resolved on demand, the existing world kinds, their own seed; saves unchanged
// (f) the jump: aberration cos θ' = (cos θ + β)/(1 + β cos θ), Doppler, 8–12 s, β up to 0.99; the lang keys
// Run: node test/galaxy.js   (bash test/wt_run.sh galaxy.js 300 in a worktree)
const VR = require('./load_shared.js');
globalThis.VR = VR;
const ROOT = __dirname + '/../';
require(ROOT + 'src/main/starjump.js');
const G = VR.Galaxy, SJ = VR.StarJump, U = VR.Universe;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const f2 = (x) => Number(x).toFixed(2);
check(!!G && typeof G.system === 'function', 'VR.Galaxy is there');
check(!!SJ && typeof SJ.plan === 'function', 'VR.StarJump is there');
if (!G || !SJ) { console.log('FAILED ' + fails); process.exit(1); }

console.log('(a) the neighbourhood');
const t0 = Date.now(), N = G.build(53), tBuild = Date.now() - t0;
check(Math.abs(N.list.length - 1508) <= 1508 * 0.03, '1,508 ± 3 % systems', N.list.length + ' in ' + tBuild + ' ms');
check(tBuild < 400, 'the neighbourhood is made in < 400 ms', tBuild + ' ms');
for (const s of [1, 7, 99, 12345]) { const n = G.build(s).list.length; check(Math.abs(n - 1508) <= 1508 * 0.03, 'seed ' + s + ': 1,508 ± 3 %', n); }
const home = N.list[0];
check(home.idx === 0 && home.p[0] === 0 && home.p[1] === 0 && home.p[2] === 0 && home.home === true, 'index 0 is Helia at the origin');
check(N.list.every(s => Math.hypot(s.p[0], s.p[2]) <= 200.001 && Math.abs(s.p[1]) <= 60.001), 'every system inside the disc 400 ly across, 120 ly thick');
{ const b = G.build(53); check(JSON.stringify(b.list.slice(0, 40).map(s => [s.p, s.cls, s.name])) === JSON.stringify(N.list.slice(0, 40).map(s => [s.p, s.cls, s.name])), 'the same seed → the same neighbourhood'); }
{ const b = G.build(54); check(b.list[5].name !== N.list[5].name || b.list[5].p[0] !== N.list[5].p[0], 'another seed → another neighbourhood'); }
{ let near = 0; for (const s of N.list) if (s.idx && Math.hypot(...s.p) < 3) near++; check(near === 0, 'no system within 3 ly of home'); }

console.log('(b) the stars');
const cnt = {}; for (const s of N.list.slice(1)) cnt[s.cls] = (cnt[s.cls] || 0) + 1;
const nS = N.list.length - 1, MIX = { M: 0.35, K: 0.22, G: 0.15, F: 0.12, A: 0.08, B: 0.04, O: 0.01, D: 0.03 };
for (const k in MIX) check(Math.abs((cnt[k] || 0) / nS - MIX[k]) < 0.035, 'type ' + k + ' ≈ ' + Math.round(MIX[k] * 100) + ' %', f2((cnt[k] || 0) / nS * 100) + ' %');
check(G.colorOf(40000) === '#5b7bff' && G.colorOf(5800) === '#ffede6' && G.colorOf(3000) === '#ffa349' && G.colorOf(10000) === '#7996ff', 'colours: the model column at its rows (O5 #5b7bff, G2 #ffede6, A0 #7996ff, M5.5 #ffa349)');
{ const c = G.colorOf(3400); check(c > '#ffa000' && c < '#ffb000', 'between rows interpolated, never pure red or blue', c); }
{ const r = N.list.find(s => s.cls === 'M'), g = N.list.find(s => s.cls === 'G'), o = N.list.find(s => s.cls === 'O');
  check(r.T >= 2300 && r.T <= 3900 && r.R < 0.65 && r.L < 0.1, 'an M dwarf: T 2,300–3,900 K, R < 0.65 R☉, L < 0.1 L☉', r.sub + ' ' + r.T + ' K ' + f2(r.R) + ' R☉');
  check(g.T >= 5270 && g.T <= 6000 && Math.abs(g.M - 1) < 0.2, 'a G star near the Sun', g.sub + ' ' + g.T + ' K');
  check(!o || (o.T > 30000 && o.L > 1e4), 'an O star: > 30,000 K, > 10⁴ L☉', o ? o.sub + ' ' + o.T : 'none'); }
{ const wd = N.list.find(s => s.cls === 'D'); check(!!wd && wd.R < 0.02 && wd.T > 6000, 'a white dwarf: Earth-sized, hot', wd && (wd.R + ' R☉ ' + wd.T + ' K')); }
check(N.list.every(s => /^#[0-9a-f]{6}$/.test(s.color)), 'every star a colour');

console.log('(c) binaries, nebulae, reach');
const bins = N.list.filter(s => s.bin), close = bins.filter(s => s.bin.close);
check(Math.abs(bins.length / N.list.length - 0.30) <= 0.03, 'binaries 30 ± 3 %', f2(bins.length / N.list.length * 100) + ' %');
check(close.length > bins.length * 0.35 && close.length < bins.length * 0.65, 'about half of them close pairs', close.length + ' of ' + bins.length);
check(close.every(s => s.bin.a >= 0.05 && s.bin.a <= 0.3) && bins.filter(s => !s.bin.close).every(s => s.bin.a >= 50), 'close 0.05–0.3 AU, wide ≥ 50 AU');
check(bins.every(s => s.bin.M <= s.M + 1e-9), 'the companion is the lighter star');
const neb = N.list.filter(s => s.neb >= 0);
check(Math.abs(neb.length / N.list.length - 0.04) < 0.006, '4 % inside an emission nebula', neb.length);
check(home.neb < 0 && !home.bin, 'home is no binary and in no nebula');
{ let sum = 0, n = 0; for (const s of N.list) { if (Math.random() > 0.15) continue; sum += G.systemsNear(N, s.p, 30).length - 1; n++; }
  check(sum / n > 7 && sum / n < 15, '≈ 11 systems within 30 ly (the jump range)', f2(sum / n)); }
{ const near = G.systemsNear(N, [0, 0, 0], 30); check(near.length >= 4 && near[0].idx === 0 && near.every((s, i) => !i || s.d >= near[i - 1].d), 'systemsNear: home first, sorted by distance', near.length - 1 + ' in reach of home'); }

console.log('(d) a system');
let worst = 0, landless = 0, compiled = 0, cErr = '', nPl = [0, 0, 0, 0, 0, 0, 0, 0, 0], classes = {};
const t1 = Date.now();
for (let i = 1; i < N.list.length; i++) {
  const a = Date.now(), d = G.system(N, i); worst = Math.max(worst, Date.now() - a);
  const pl = d.bodies.filter(b => b.planet);
  nPl[pl.length]++;
  for (const b of pl) classes[b.cls] = (classes[b.cls] || 0) + 1;
  if (!pl.some(b => b.landable && b.dim)) landless++;
  if (i % 50 === 1) { try { const S = U.compile(d); if (S.list.length === d.bodies.length && S.state(1000).b) compiled++; } catch (e) { cErr = String(e.message || e).slice(0, 120); } }
}
const per = (Date.now() - t1) / (N.list.length - 1);
check(worst <= 30, 'a system generated ≤ 30 ms', 'worst ' + worst + ' ms, mean ' + f2(per) + ' ms');
check(nPl[0] === 0 && nPl.slice(1, 9).every(n => n > 0), '1–8 planets, every count seen', nPl.slice(1).join(' '));
check(landless === 0, 'at least one landable world in every system', landless);
for (const c of ['hot', 'giant', 'icegiant', 'super', 'terra', 'lava', 'eye']) check(classes[c] > 0, 'class ' + c + ' (R§7)', classes[c]);
check(compiled === Math.ceil((N.list.length - 1) / 50) && !cErr, 'every system compiles in VR.Universe.compile (Helia\'s record format)', compiled + (cErr ? ' ' + cErr : ''));
{ const S = U.compile(G.system(N, 1)); check(S.list[0].kind === 'star' && S.list.length > 1, 'its star first, then its bodies'); }
{ const cb = close[0], d = G.system(N, cb.idx), st2 = d.bodies.find(b => b.kind === 'star' && b.parent), pl = d.bodies.filter(b => b.planet);
  check(!!st2 && pl.every(b => b.orbit.a / U.AU >= 3 * cb.bin.a), 'a close pair: two stars, every planet circumbinary (a ≥ 3 × the pair)', cb.name); }
{ const rd = N.list.find(s => s.cls === 'M' && s.T < 2900), d = G.system(N, rd.idx), w = d.bodies.find(b => b.landable);
  const sky = G.skyTint(rd.T), sun = G.skyTint(5772);
  check(sky[0] > sky[2] && sun[2] > sun[0], 'the sky under a cool red dwarf is peach, under the Sun blue (R§7)', sky.map(f2).join(',') + ' / ' + sun.map(f2).join(','));
  check(!!w, 'a red dwarf has a landable world', w && w.cls); }
{ const ks = N.list.filter(s => s.cls === 'K' && !s.bin && s.neb < 0).sort((a, b) => Math.hypot(...a.p) - Math.hypot(...b.p))[0];
  check(!!ks, 'a lone K dwarf to visit', ks && ks.name + ' ' + f2(Math.hypot(...ks.p)) + ' ly'); }
{ const d = G.system(N, 7); check(d.name.de === N.list[7].name && /^x7$/.test(d.id), 'the def carries the name and the id x<idx>'); }

console.log('(e) the dims');
{ const D = VR.DimReg, d = G.system(N, 3), w = d.bodies.find(b => b.landable), id = w.dim;
  check(/^x\.\d+\.\d+\.(basalt|opal|zinn|ocker|aqua)$/.test(id) && !/:/.test(id), 'the dim id x.<sys>.<planet>.<kind> (no ":")', id);
  check(D.has(id) && D.get(id).body === id.split('.')[3] && D.get(id).travel === true && D.get(id).code === 5, 'DimReg resolves it on demand: the kind\'s body, travel, u_dim 5');
  check(!D.has('x.foo') && !D.has('x.3.1.lava') && D.has('opal'), 'nothing else is invented; the old dims stay');
  check(D.dimOf({ dim: id }) === id && D.dimOf({ dim: 'x.9.9.nope' }) === 'overworld', 'a save left there opens there; an unknown one at home');
  let gen = null; try { gen = VR.makeGen(id, 53, {}); } catch (e) { gen = String(e.message); }
  check(gen && typeof gen === 'object' && gen.id === id.split('.')[3] && gen.seed !== 53, 'its generator: the existing kind with a seed of its own', gen && gen.seed);
  const g2 = VR.makeGen(id, 53, {}), gO = VR.makeGen(id.split('.')[3], 53, {});
  check(g2.seed === gen.seed && g2.seed !== gO.seed, 'the same world every time, another than the Helia moon\'s'); }

console.log('(f) the jump');
{ const j = SJ.plan(5), j2 = SJ.plan(30), j3 = SJ.plan(9999);
  check(j.dur >= 8 && j.dur <= 12 && j2.dur >= 8 && j2.dur <= 12 && j3.dur <= 12, 'the jump lasts 8–12 s', f2(j.dur) + ' / ' + f2(j2.dur) + ' / ' + f2(j3.dur) + ' s');
  check(Math.abs(j.spin - 2.5) < 1e-9 && j.transit >= 3 && j.transit <= 5 && j.arrive >= 2 && j.arrive <= 3, 'spin-up 2.5 s, transit 3–5 s, arrival 2–3 s');
  const b0 = SJ.at(j, 0).beta, b1 = SJ.at(j, j.spin).beta, bm = SJ.at(j, j.spin + j.transit / 2).beta, be = SJ.at(j, j.dur).beta;
  check(b0 === 0 && Math.abs(b1 - 0.99) < 1e-6 && Math.abs(bm - 0.99) < 1e-6 && be === 0, 'β 0 → 0.99 in the spin-up, held, back to 0', [b0, b1, bm, be].map(f2).join(' '));
  let mono = true; for (let s = 0.05; s < j.spin; s += 0.05) if (SJ.at(j, s).beta < SJ.at(j, s - 0.05).beta) mono = false;
  check(mono, 'β rises steadily');
  const ph = [0.5, 4, j.dur - 0.5].map(s => SJ.at(j, s).phase).join(' ');
  check(ph === 'spin transit arrive', 'the phases', ph);
  const p = SJ.at(j, j.dur);
  check(p.done && p.travelled === 1, 'done at the end, the whole way travelled'); }
{ const c = SJ.aberr(Math.cos(Math.PI / 2), 0.99);
  check(Math.abs(c - 0.99) < 1e-12, 'aberration: a star abeam moves to cos θ\' = β (8.1° ahead at 0.99)', f2(Math.acos(c) * 180 / Math.PI) + '°');
  check(Math.abs(SJ.aberr(0.3, 0) - 0.3) < 1e-12 && Math.abs(SJ.aberr(1, 0.9) - 1) < 1e-12 && Math.abs(SJ.aberr(-1, 0.9) + 1) < 1e-12, 'nothing moves at rest; dead ahead and behind stay');
  const inv = SJ.unaberr(SJ.aberr(0.2, 0.7), 0.7); check(Math.abs(inv - 0.2) < 1e-12, 'the inverse (what the shader samples) undoes it');
  let ahead = 0; for (let k = 0; k < 20000; k++) { const ct = 2 * ((k + 0.5) / 20000) - 1; if (SJ.aberr(ct, 0.99) > Math.cos(30 * Math.PI / 180)) ahead++; }
  check(ahead / 20000 > 0.9, 'at 0.99 c most of the sky bunches into 30° ahead', f2(ahead / 200) + ' %');
  const dA = SJ.doppler(1, 0.99), dB = SJ.doppler(-1, 0.99);
  check(Math.abs(dA - Math.sqrt(1.99 / 0.01)) < 1e-9 && Math.abs(dB - Math.sqrt(0.01 / 1.99)) < 1e-9, 'Doppler: ×14.1 ahead (blue), ×0.071 behind (red)', f2(dA) + ' / ' + f2(dB));
  check(SJ.colorT(5800, dA) > 40000 && SJ.colorT(5800, dB) < 1000, 'a Sun ahead looks hotter than an O star, behind cooler than any dwarf'); }

console.log('(g) the words');
{ require(ROOT + 'src/main/i18n.js'); require(ROOT + 'src/main/lang_de.js'); require(ROOT + 'src/main/lang_en.js');
  const D = (VR.I18N && VR.I18N.dict.de) || {}, E = (VR.I18N && VR.I18N.dict.en) || {};
  const keys = ['g.stars.map', 'g.stars.jump', 'g.stars.land', 'g.stars.home', 'g.stars.arrive', 'g.stars.range', 'g.set.nebulaTrue', 'g.set.jumpFade', 'ctl.starmap'];
  check(keys.every(k => D[k] && E[k]), 'the keys are in both tables', keys.filter(k => !(D[k] && E[k])).join(' ') || 'all'); }

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

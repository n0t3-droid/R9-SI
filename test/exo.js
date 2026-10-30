// u-stars2 · the worlds of other stars without a browser (docs/superpowers/plans/2026-10-30-u-stars2.md):
// (a) rings, signatures, the landed sky (the day clock, a locked sun, the companion), deterministic, from hashes only
// (b) the nearest interesting unvisited system
// (c) the save's xgen (old 1, new 2, kept) and the signature landscapes in the generator (xgen 1 untouched)
// (d) the blocks last, the texts, the jump's boost, band and tunnel
// Run: node test/exo.js   (bash test/wt_run.sh exo.js 300 in a worktree)
const VR = require('./load_shared.js');
globalThis.VR = VR;
require(__dirname + '/../src/main/starjump.js');
const G = VR.Galaxy, E = VR.Exo, SJ = VR.StarJump, R = VR.R;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const f2 = (x) => Number(x).toFixed(2), deg = (r) => (r * 180 / Math.PI).toFixed(1) + '°';
check(!!E && typeof E.sky === 'function', 'VR.Exo is there');
if (!E) { console.log('FAILED 1'); process.exit(1); }
const N = G.build(53);
const find = (fn) => { for (let i = 1; i < N.list.length; i++) { const d = G.system(N, i); for (const b of d.bodies) if (b.planet && fn(d, b)) return [d, b]; } return [null, null]; };

console.log('(a) rings, signatures, the landed sky');
{
  let land = 0, ringL = 0, giants = 0, ringG = 0; const sig = { crystal: 0, violet: 0, glass: 0 };
  for (let i = 1; i < 400; i++) { const d = G.system(N, i); for (const b of d.bodies) { if (!b.planet) continue; const r = E.ring(d, b); if (b.landable) { land++; if (r) ringL++; const s = E.signature(d, b); if (s) sig[s]++; } if (b.kind === 'giant' || b.kind === 'icegiant') { giants++; if (r) ringG++; } } }
  check(Math.abs(ringL / land - 0.22) < 0.05 && Math.abs(ringG / giants - 0.45) < 0.07, 'rings: landable ≈ 22 %, giants ≈ 45 %', f2(ringL / land * 100) + ' %, ' + f2(ringG / giants * 100) + ' %');
  check(sig.crystal > 10 && sig.violet > 10 && sig.glass > 10, 'every signature landscape occurs', JSON.stringify(sig));
  const [d1, p1] = find((d, b) => b.landable && E.ring(d, b));
  check(JSON.stringify(E.ring(d1, p1)) === JSON.stringify(E.ring(G.system(G.build(53), d1.idx), p1)), 'a ring is the same every time');
  const [dc, pc] = find((d, b) => E.signature(d, b) === 'crystal'), [dv, pv] = find((d, b) => E.signature(d, b) === 'violet');
  check(dc.star.T >= 7500 && dv.star.T < 3900 && (pv.base === 'aqua' || pv.base === 'ocker'), 'crystal fields under a hot star, violet growth on a red dwarf\'s world with air', dc.star.type + ' / ' + dv.star.type + ' ' + pv.base);
  // the day clock: a spinning world's sun rises and sets with its own day; a locked world's stands
  const [ds, ps] = find((d, b) => b.landable && !E.locked(b) && !d.star2);
  const day = E.dayLength(ps), els = [];
  for (let k = 0; k < 24; k++) els.push(E.sky(ds, ps, 1000 + day * k / 24).sun[1]);
  const up = els.filter(v => v > 0).length;
  check(day > 600 && day < 4000 && up >= 8 && up <= 16, 'a spinning world: its own day (' + Math.round(day / 60) + ' min), the sun up ' + up + ' of 24 hours');
  const a = E.sky(ds, ps, 1000), b = E.sky(ds, ps, 1000 + day);
  check(Math.hypot(a.sun[0] - b.sun[0], a.sun[1] - b.sun[1], a.sun[2] - b.sun[2]) < 0.08, 'a day later the sun stands where it stood (a solar day)');
  const [dl, pl] = find((d, b) => b.landable && E.locked(b));
  const l1 = E.sky(dl, pl, 0), l2 = E.sky(dl, pl, 50000);
  check(Math.abs(l1.sun[1] - l2.sun[1]) < 1e-6 && Math.asin(l1.sun[1]) > 0.4 && Math.asin(l1.sun[1]) < 0.68, 'a locked world: its sun stands at 24–38°', deg(Math.asin(l1.sun[1])));
  // the companion of a close pair: within ~20° of its primary, moving against it; its light share
  const [db, pb] = find((d, b) => b.landable && d.star2 && d.star2.close && d.star2.L / d.star.L > 0.15);
  const s0 = E.sky(db, pb, 0), seps = []; for (let k = 0; k < 12; k++) seps.push(E.sky(db, pb, k * 3000).sep);
  check(s0.has2 && Math.max(...seps) < 0.36 && Math.max(...seps) - Math.min(...seps) > 0.005, 'a close pair: the companion within 20° of its primary, moving', seps.map(deg).slice(0, 4).join(' '));
  check(s0.k2 > 0.1 && s0.k2 < 1.2, 'its light share L₂/L₁ (d₁/d₂)²', f2(s0.k2));
  const [dw, pw] = find((d, b) => b.landable && d.star2 && !d.star2.close);
  const sw = E.sky(dw, pw, 0);
  check(sw.has2 && sw.k2 < 0.01 && sw.ang2 < 0.002, 'a wide pair: the companion a brilliant point, its light a trace', f2(sw.k2 * 1000) + ' ‰');
  // the sky's frame: the pole is perpendicular to every sun
  const P = [0, Math.sin(s0.phi), -Math.cos(s0.phi)];
  check(Math.abs(P[1] * s0.sun[1] + P[2] * s0.sun[2] - Math.sin(s0.dl)) < 1e-9 && Math.abs(P[1] * s0.sun2[1] + P[2] * s0.sun2[2] - Math.sin(s0.dl)) < 1e-9, 'both suns at the season\'s declination', deg(s0.dl));
  const [dr, pr] = find((d, b) => b.landable && E.ring(d, b)), sr = E.sky(dr, pr, 0);
  check(sr.dl > 0.2, 'a ringed world: summer — its ring\'s face toward us lit', deg(sr.dl));
}

console.log('(b) the nearest interesting unvisited system');
{
  const it = E.interesting(N, 0, [], 30);
  check(!!it && it.d <= 30 && !!it.why, 'from home: ' + (it && it.name) + ' · ' + (it && f2(it.d)) + ' ly · ' + (it && it.why));
  const it2 = E.interesting(N, 0, [it.idx], 30);
  check(!!it2 && it2.idx !== it.idx && it2.d >= it.d, 'visited → the next one', it2 && it2.name + ' ' + f2(it2.d));
  let ms = Date.now(); for (let k = 0; k < 20; k++) E.interesting(N, k * 37 % N.list.length, [], 30); ms = (Date.now() - ms) / 20;
  check(ms < 20, 'found in < 20 ms', f2(ms) + ' ms');
}

console.log('(c) the save\'s xgen and the landscapes');
{
  const B = VR.Bodies;
  const m1 = { seed: 5, dim: 'x.12.3.aqua', universe: { v: 1 } }, m2 = { seed: 5 }, m3 = { seed: 5, pos: { 'x.4.1.opal': [0, 0, 0] } };
  const x1 = B.bgenOf(B.stamp(m1)).exo, x2 = B.bgenOf(B.stamp(m2)).exo, x3 = B.bgenOf(B.stamp(m3)).exo;
  m2.dim = 'x.1.1.aqua'; const x2b = B.bgenOf(B.stamp(m2)).exo;
  check(x1 === 1 && x3 === 1 && x2 === 2 && x2b === 2, `stood on a world of another star: xgen ${x1}, ${x3}; new ${x2} (kept: ${x2b})`);
  const seed = 53, opts = (xg) => ({ bgen: Object.assign(B.bgenOf(B.stamp({ seed })), { exo: xg }) });
  for (const sg of ['crystal', 'violet', 'glass']) {
    const [d, p] = find((dd, b) => E.signature(dd, b) === sg);
    const D = VR.DimReg.get(p.dim);
    const g1 = D.gen(seed, opts(1)), g2 = D.gen(seed, opts(2));
    const ids = { crystal: R.S('exo_crystal'), violet: R.S('exo_moss'), glass: R.S('exo_glass') }, frond = R.S('exo_frond');
    let same = true, n = 0, fr = 0, ms = 0;
    for (const [cx, cz] of [[0, 0], [1, 0], [0, 1], [-1, -1], [3, 2], [-4, 5], [6, -3], [9, 9]]) {
      const a = g1.generate(cx, cz).blocks, t0 = Date.now(), b = g2.generate(cx, cz).blocks; ms += Date.now() - t0;
      const ref = D.gen(seed, opts(1)).generate(cx, cz).blocks;
      for (let i = 0; i < 65536; i++) { if (a[i] !== ref[i]) same = false; if (b[i] === ids[sg]) n++; if (b[i] === frond) fr++; }
    }
    check(same, sg + ': xgen 1 chunks unchanged (an old save\'s world)');
    check(n > 40 && (sg !== 'violet' || fr > 10), sg + ': xgen 2 brings the landscape', n + ' blocks' + (sg === 'violet' ? ', ' + fr + ' fronds' : '') + ' in 8 chunks · ' + p.dim);
    check(ms / 8 < 40, sg + ': a decorated chunk ≤ 40 ms', f2(ms / 8) + ' ms');
    const sp = g2.findSpawn(0, 0), cx = Math.floor(sp[0]) >> 4, cz = Math.floor(sp[2]) >> 4, bl = g2.generate(cx, cz).blocks;
    const lx = Math.floor(sp[0]) & 15, lz = Math.floor(sp[2]) & 15, y = Math.floor(sp[1]);
    const free = (yy) => { const s = bl[(yy << 8) | (lz * 16 + lx)]; return !s || s === frond; };
    check(free(y) && free(y + 1), sg + ': the spawn stands free (not inside the decoration)', sp.map(v => Math.round(v)).join(' '));
  }
}

console.log('(d) the blocks, the texts, the jump');
{
  const LT = R.types.filter(t => !/^(ferry_dock|grow_lamp)$/.test(t.name)), last = LT.slice(-4).map(t => t.name).join(', ');   // (a-life: its two blocks after them)
  check(last === 'exo_crystal, exo_moss, exo_frond, exo_glass', 'the four exo blocks are the last', last);
  const gs = R.types.find(t => t.name === 'glowspar');
  check(LT.indexOf(gs) === LT.length - 5, 'right after glowspar (u-fields2)');
  const fs = require('fs'), de = fs.readFileSync(__dirname + '/../src/shared/names_de.js', 'utf8');
  check(/'Frost Prism': 'Frostprisma'/.test(de) && /'Violet Moss': 'Violettmoos'/.test(de) && /'Violet Frond': 'Violettwedel'/.test(de) && /'Dune Glass': 'Dünenglas'/.test(de), 'German names of the four');
  require(__dirname + '/../src/main/i18n.js'); require(__dirname + '/../src/main/lang_de.js'); require(__dirname + '/../src/main/lang_en.js');
  const I = VR.I18N, keys = ['g.codex.m.stars', 'g.stars2.first', 'g.stars2.why.binary', 'g.stars2.why.nebula', 'g.stars2.why.hot', 'g.stars2.why.dwarf', 'g.stars2.why.ring', 'g.stars2.why.sig.crystal', 'g.stars2.why.sig.violet', 'g.stars2.why.sig.glass', 'g.stars2.next', 'g.stars2.route', 'g.stars2.land.crystal', 'g.stars2.land.violet', 'g.stars2.land.glass', 'g.stars2.ring', 'g.stars2.sun2'];
  const miss = []; for (const k of keys) for (const L of ['de', 'en']) if (!I || !I.dict || (I.dict[L][k] === undefined)) miss.push(L + ':' + k);
  check(!miss.length, keys.length + ' texts in both tables', miss.slice(0, 4).join(' '));
  check(typeof SJ.boost === 'function' && SJ.boost(1) > 0.9 && SJ.boost(1) <= 1 && SJ.boost(14.1) > 30 && SJ.boost(14.1) < 48 && SJ.boost(0.07) < 0.001, 'the stars ahead: D³ with a soft cap (×' + (SJ.boost ? f2(SJ.boost(14.1)) : '?') + ' dead ahead, was ×6)');
  check(SJ.bandK(0) === 1 && SJ.bandK(0.99) < 0.2, 'the band dims as β rises', SJ.bandK && f2(SJ.bandK(0.99)));
  const J = SJ.plan(10), tun = (s) => SJ.tunnel(SJ.at(J, s));
  check(tun(1) === 0 && tun(J.spin + J.transit * 0.5) > 0.95 && tun(J.spin + J.transit * 0.1) < 0.1 && tun(J.dur - 0.5) === 0, 'the streaks only at the transit\'s peak', f2(tun(J.spin + J.transit * 0.3)) + ' at 30 %');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

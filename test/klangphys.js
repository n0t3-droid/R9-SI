// v0.56 · Klangphysik (src/main/klangphys.js), no browser:
//  a · Karplus–Strong: the pitch within 3 cents over three octaves (the allpass's fractional tuning), the 60 dB decay
//      within 25 % of the asked T60, the highs dying faster than the fundamental (the tone mellows), the pick's comb
//  b · the room: Eyring's formula against hand-worked values; a closed stone hall rings long, a wooden room of the same
//      size shorter, a wool-lined one shorter and dark, a room with an open side shorter still, the open field no room
//   bash test/wt_run.sh klangphys.js
const V = require('./load_shared.js');
require('../src/main/klangphys.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const KS = V.KS, RA = V.RoomAcoustics, sr = 48000;

console.log('a · Karplus–Strong');
{
  const cents = [];
  for (const midi of [40, 52, 57, 64, 69, 76, 81]) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const x = KS.render(f, sr, { dur: 0.6, t60: 2, bright: 0.5 });
    const p = KS.pitchOf(x, sr, f * 0.8, f * 1.25);
    cents.push(Math.round(1200 * Math.log2(p / f) * 10) / 10);
  }
  check(cents.every((c) => Math.abs(c) < 3), 'tuned within 3 cents from E2 to A5 (the allpass makes the fraction of a sample)', cents.join(' · ') + ' cents');
  // without the allpass (η ignored) a high note would be far off: the fraction matters
  const f = 1046.5, N = sr / f, off = 1200 * Math.log2((N) / (Math.floor(N - 0.5 - 1e-3) + 0.5));
  check(Math.abs(off) > 10, 'the fraction is worth it: without it C6 would be off by ' + off.toFixed(0) + ' cents');
  // the decay: the envelope of the rendered note falls 60 dB in about T60
  const t60 = 1.0, f2 = 220, x = KS.render(f2, sr, { dur: 2.5, t60, bright: 0.25 });
  const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
  const w = Math.floor(sr * 0.05), r0 = rms(Math.floor(sr * 0.1), Math.floor(sr * 0.1) + w), r1 = rms(Math.floor(sr * 0.6), Math.floor(sr * 0.6) + w);
  const meas = 0.5 / (Math.log10(r0 / r1) * 20 / 60);   // 0.5 s of fall, scaled to 60 dB
  check(Math.abs(meas - t60) / t60 < 0.25, 'the note falls 60 dB in about the asked time', `asked ${t60} s, measured ${meas.toFixed(2)} s`);
  // the tone mellows: the share of the highs (first difference over the signal) falls from the start to later on
  const hi = (a, b) => { let d = 0, s = 0; for (let i = a + 1; i < b; i++) { d += (x[i] - x[i - 1]) ** 2; s += x[i] * x[i]; } return d / s; };
  const h0 = hi(0, Math.floor(sr * 0.05)), h1 = hi(Math.floor(sr * 0.8), Math.floor(sr * 0.85));
  check(h1 < h0 * 0.5, 'bright at the pluck, mellow as it dies (the loss filter takes the highs each pass)', `${h0.toFixed(4)} → ${h1.toFixed(4)}`);
  check(x.every(Number.isFinite) && Math.max(...x.slice(0, 2000).map(Math.abs)) <= 1.01, 'finite, never louder than the burst');
}

console.log('b · the room (Eyring with Kuttruff\'s mean free path)');
{
  // by hand: ℓ̄ = 8 m, ᾱ = 0.05 → V/S = 2, T = 0.322 / (0.05129 + 0.0096) = 5.29 → capped at T_MAX
  const t1 = RA.eyring(8, 0.05), t2 = RA.eyring(4, 0.12);
  const h2 = 0.161 * 1 / (-Math.log(0.88) + 4 * RA.AIR * 1);
  check(t1 === RA.T_MAX, 'a big stone hall is capped at ' + RA.T_MAX + ' s', t1.toFixed(2));
  check(Math.abs(t2 - h2) < 1e-9 && t2 > 1 && t2 < 1.4, 'a 4-m wooden room: 0.161 · 1 / (−ln 0.88 + 0.0048) = ' + h2.toFixed(3) + ' s', t2.toFixed(3));
  // a world of blocks: a box of a given material, the ear in the middle
  const R = V.R, st = (n) => R.byName[n].defaultState;
  const box = (mat, W, H, open) => (x, y, z) => {
    const inX = x > 0 && x < W, inY = y > 0 && y < H, inZ = z > 0 && z < W;
    if (inX && inY && inZ) return 0;
    if (open && x >= W && y > 0 && y < H && z > 0 && z < W) return 0;   // the whole +x side open to the outside
    if (x < -2 || x > W + 2 || y < -2 || y > H + 2 || z < -2 || z > W + 2) return 0;
    return mat;
  };
  const m = (g, W, H) => RA.measure(g, W / 2 + 0.3, H / 2 + 0.2, W / 2 - 0.4);
  const stone = m(box(st('stone'), 14, 9), 14, 9), wood = m(box(st('oak_planks'), 14, 9), 14, 9);
  const woolN = R.byName.white_wool ? 'white_wool' : Object.keys(R.byName).find((n) => /wool/.test(n));
  const wool = m(box(st(woolN), 14, 9), 14, 9), opn = m(box(st('stone'), 14, 9, true), 14, 9);
  const field = RA.measure(() => 0, 0.5, 70.5, 0.5);
  console.log(`     stone ${stone.t60.toFixed(2)} s · wood ${wood.t60.toFixed(2)} s · ${woolN} ${wool.t60.toFixed(2)} s · stone, a side open ${opn.t60.toFixed(2)} s (open ${opn.open.toFixed(2)}) · mean free path ${stone.mfp.toFixed(1)} m`);
  check(stone.open === 0 && stone.mfp > 4 && stone.mfp < 9, 'the closed box: no ray leaves, the mean free path near 4V/S of a 13 × 8 × 13 room (' + (4 * 13 * 8 * 13 / (2 * (13 * 8 * 2 + 13 * 13))).toFixed(1) + ' m)', stone.mfp.toFixed(2));
  check(stone.t60 > wood.t60 && wood.t60 > wool.t60, 'stone rings longer than wood, wood longer than wool');
  check(stone.t60 > 2, 'a closed stone hall rings for seconds', stone.t60.toFixed(2));
  check(opn.t60 < stone.t60 * 0.7 && opn.open > 0.03, 'an open side lets the sound out: clearly shorter (every ray that leaves counts as α = 1)', opn.t60.toFixed(2));
  check(RA.bucket(wool) % 2 === 1 && RA.bucket(stone) % 2 === 0, 'the wool room\'s impulse is a dark one, the stone hall\'s not');
  check(RA.bucket(field) === null && field.open === 1, 'the open field: no room at all');
  check(RA.bucket(stone) > RA.bucket(wood), 'the stone hall takes a longer impulse than the wooden room');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

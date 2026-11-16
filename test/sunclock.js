// e-uhr · E1 · Schattenuhr — the core (src/shared/sunclock.js), with no game in it.
//   a  the arc is env.js's sun at every time of day; the moon is the sun twelve hours later; ofDay picks the light
//   b  the four bytes: pack keeps the two longest intervals, earlier first; EMPTY never lit, FULL always
//   c  signed time: its zero is the edge; linear between two points with a moving edge (the interpolation is exact)
//   d  a wall: a point's lit times equal the analytic ones (a ray over a wall of known height) within 1.5/255
//   e  a tower: points round its foot — the shadow passes once (two intervals: before and after)
//   f  a canopy (leaves) shades, a window lets the light through a gap
//   g  the far field: a hill beyond the bit volume shades the evening (top map), not the morning
//   h  the clock equals a fine brute-force sampling of lit(s) (the bisection, the don't-care bins, the ends)
//   i  determinism; cost on real generated sections ≤ 6 ms a section (sixteen columns of corner points)
//   bash test/wt_run.sh sunclock.js
const V = require('./load_shared.js');
require('../src/shared/sunclock.js');
const SC = V.SunClock;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const STEP = 1 / 255;

// ---------------------------------------------------------------- a  the arc
{
  let worst = 0; const o = [0, 0, 0];
  for (let i = 0; i < 24; i++) {
    const tod = i / 24, th = tod * Math.PI * 2, el = Math.sin(th) * 0.42, az = th + 0.4;
    const env = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
    const { s, moon } = SC.ofDay(tod);
    SC.arc(s, o);
    const want = moon ? env.map(v => -v) : env;
    worst = Math.max(worst, Math.hypot(o[0] - want[0], o[1] - want[1], o[2] - want[2]));
  }
  check(worst < 1e-9, 'a  the arc is env.js\'s sun (or moon) at 24 times of day (worst ' + worst.toExponential(1) + ')');
  check(!SC.ofDay(0.25).moon && SC.ofDay(0.75).moon, 'a  noon: the sun; midnight: the moon');
}
// ---------------------------------------------------------------- b  the bytes
{
  const u = SC.pack([[0.1, 0.2], [0.5, 0.9], [0.3, 0.32]]);
  check((u & 255) === 26 && ((u >>> 8) & 255) === 51 && ((u >>> 16) & 255) === 128 && (u >>> 24) === 230, 'b  two longest kept, the earlier first');
  check(SC.vis(SC.EMPTY, 0.5) === 0 && SC.vis(SC.FULL, 0.5) === 1 && SC.pack([]) === SC.EMPTY, 'b  EMPTY dark, FULL lit');
}
// ---------------------------------------------------------------- c  signed time
{
  const u = SC.pack([[0.3, 0.7]]);
  check(Math.abs(SC.signed(u, 77 / 255)) < 1e-12 && SC.signed(u, 0.5) > 0 && SC.signed(u, 0.1) < 0, 'c  zero at the edge, lit inside, dark outside');
  // two vertices whose rise differs: the interpolated d crosses zero where the interpolated rise equals s
  const a = SC.pack([[0.30, 0.9]]), b = SC.pack([[0.40, 0.9]]), s = 0.36;
  const da = SC.signed(a, s), db = SC.signed(b, s), t0 = da / (da - db);
  const ra = (a & 255) / 255, rb = (b & 255) / 255;
  check(Math.abs(ra + (rb - ra) * t0 - s) < 1e-9, 'c  across a face the zero line is exactly where the edge stands');
}
// ---------------------------------------------------------------- a made-up volume
const job = (fill) => { const vol = SC.newVolume(); fill((x, y, z) => SC.setBit(vol, x + SC.VPAD, y, z + SC.VPAD)); return { ox: 0, oy: 0, oz: 0, vol }; };
const unpack = (u) => { const out = []; const r1 = u & 255, e1 = (u >>> 8) & 255, r2 = (u >>> 16) & 255, e2 = u >>> 24; if (e1 > r1) out.push([r1 / 255, e1 / 255]); if (e2 > r2) out.push([r2 / 255, e2 / 255]); return out; };
const edges = (f, N = 4000) => { const out = []; let prev = false; for (let i = 0; i <= N; i++) { const s = i / N, v = s > 0 && s < 1 && f(s); if (v !== prev) out.push(s); prev = v; } if (prev) out.push(1); return out; };
const clockEdges = (u) => unpack(u).flat();
const near = (A, B, tol) => A.length === B.length && A.every((v, i) => Math.abs(v - B[i]) <= tol);
const d = [0, 0, 0];

// ---------------------------------------------------------------- d  a wall (x = 12, as high as y 16, the whole z)
{
  const B = SC.begin(job((set) => { for (let x = -32; x < 48; x++) for (let z = -32; z < 48; z++) for (let y = 0; y < 10; y++) set(x, y, z); for (let z = -32; z < 48; z++) for (let y = 10; y < 16; y++) set(12, y, z); }));
  let worst = 0, bad = 0;
  for (const px of [4, 6, 8, 10]) {
    const u = B.corner(px, 10, 8, 2);
    const want = edges((s) => { SC.arc(s, d); if (d[0] <= 0) return true; const t = (12 - px) / d[0]; return 10 + d[1] * t >= 16; });
    const got = clockEdges(u);
    if (!near(got, want, 1.5 * STEP)) { bad++; console.log('     px ' + px + ' got ' + got.map(v => v.toFixed(3)) + ' want ' + want.map(v => v.toFixed(3))); }
    else worst = Math.max(worst, ...got.map((v, i) => Math.abs(v - want[i])));
  }
  check(bad === 0, 'd  a wall: the lit times equal the analytic ones within 1.5/255 (worst ' + (worst * 255).toFixed(2) + '/255)');
}
// ---------------------------------------------------------------- e  a tower (2 × 2, 20 high) at (8, 8)
{
  const B = SC.begin(job((set) => { for (let x = -32; x < 48; x++) for (let z = -32; z < 48; z++) for (let y = 0; y < 10; y++) set(x, y, z); for (let x = 8; x < 10; x++) for (let z = 8; z < 10; z++) for (let y = 10; y < 30; y++) set(x, y, z); }));
  let two = 0;
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = Math.round(9 + Math.cos(a) * 5), z = Math.round(9 + Math.sin(a) * 5); if (unpack(B.corner(x, 10, z, 2)).length === 2) two++; }
  check(two >= 4, 'e  round a tower the shadow passes once: ' + two + ' of 16 points have a lit time before and after it');
  const top = B.corner(8, 30, 8, 2);
  check(top === SC.pack([[0, 1]]) || clockEdges(top)[0] < 2 * STEP, 'e  the tower\'s top is lit from sunrise to sunset');
}
// ---------------------------------------------------------------- f  canopy, window
{
  const B = SC.begin(job((set) => { for (let x = -32; x < 48; x++) for (let z = -32; z < 48; z++) for (let y = 0; y < 10; y++) set(x, y, z); for (let x = -20; x < 36; x++) for (let z = -20; z < 36; z++) { set(x, 14, z); set(x, 15, z); } }));
  const cu = B.corner(8, 10, 8, 2);
  check(SC.vis(cu, 0.35) === 0 && SC.vis(cu, 0.5) === 0 && SC.vis(cu, 0.65) === 0, 'f  under a wide crown of leaves: dark while the sun stands high (low light slips in under the edge: ' + clockEdges(cu).map(v => v.toFixed(2)) + ')');
  const W = SC.begin(job((set) => { for (let x = -32; x < 48; x++) for (let z = -32; z < 48; z++) for (let y = 0; y < 10; y++) set(x, y, z); for (let z = -32; z < 48; z++) for (let y = 10; y < 30; y++) if (!(y >= 10 && y < 13 && z >= 5 && z < 11)) set(12, y, z); }));
  const u = W.corner(8, 10, 8, 2);
  check(unpack(u).length >= 1 && unpack(u).some(([r, e]) => r < 0.3), 'f  behind a high wall with a window: morning light through the door, the rest after noon (' + clockEdges(u).map(v => v.toFixed(2)) + ')');
}
// ---------------------------------------------------------------- g  the far field
{
  const tw = 400, top = new Uint8Array(tw * tw);
  for (let z = 0; z < tw; z++) for (let x = 0; x < tw; x++) top[z * tw + x] = x - 200 < -120 ? 60 : 10;   // a ridge 120 m west, 50 m high
  const j = job((set) => { for (let x = -32; x < 48; x++) for (let z = -32; z < 48; z++) for (let y = 0; y < 10; y++) set(x, y, z); });
  Object.assign(j, { top, topX0: -200, topZ0: -200, topW: tw });
  const B = SC.begin(j), iv = unpack(B.corner(8, 10, 8, 2));
  SC.arc(0.1, d); const morningEast = d[0] > 0;
  check(iv.length === 1 && iv[0][0] < 0.05 && iv[0][1] < 0.95, `g  a ridge 120 m west: lit from the morning (${morningEast ? 'east' : 'west'}), dark before the evening ends (${clockEdges(B.corner(8, 10, 8, 2)).map(v => v.toFixed(2))})`);
}
// ---------------------------------------------------------------- h  brute force (rough random blocks)
{
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const B = SC.begin(job((set) => { for (let x = -32; x < 48; x++) for (let z = -32; z < 48; z++) { for (let y = 0; y < 10; y++) set(x, y, z); if (rnd() < 0.08) { const h = 1 + Math.floor(rnd() * 14); for (let y = 10; y < 10 + h; y++) set(x, y, z); } } }));
  let bad = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const x = 1 + Math.floor(rnd() * 14), z = 1 + Math.floor(rnd() * 14);
    const u = B.probe(x + 0.5, 10.5, z + 0.5);
    const want = edges((s) => B.lit(x + 0.5, 10.5, z + 0.5, s), 2000);
    const got = clockEdges(u);
    n++;
    // intervals shorter than a bin may be lost, more than two are cut to two: compare only clean cases
    const short = want.some((v, k) => k % 2 === 0 && want[k + 1] - v < 1.5 / SC.K);
    if (want.length > 4 || short) { n--; continue; }
    if (!near(got, want, 1.5 * STEP)) bad++;
  }
  check(bad === 0, `h  the clock equals a brute-force sampling of lit(s) on ${n} points among random pillars`);
}
// ---------------------------------------------------------------- i  determinism, cost on generated land
{
  const g = V.makeGen('overworld', 12345, {});
  const C = new Map(); const col = (cx, cz) => { const k = cx + ',' + cz; if (!C.has(k)) C.set(k, g.generate(cx, cz)); return C.get(k); };
  const O = SC.opaqueTable();
  const bake = (cx, cz) => {
    // the section where the ground is: the median top of the column
    const c0 = col(cx, cz); let hs = [];
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { let y = 255; while (y > 0 && !O[c0.blocks[(y << 8) | (z << 4) | x]]) y--; hs.push(y); }
    hs.sort((a, b) => a - b); const oy = Math.max(0, (hs[128] >> 4) << 4);
    const vol = SC.newVolume(), tw = 16 * 21, top = new Uint8Array(tw * tw);
    for (let dz = -10; dz <= 10; dz++) for (let dx = -10; dx <= 10; dx++) {
      const c = col(cx + dx, cz + dz), inV = Math.abs(dx) <= 2 && Math.abs(dz) <= 2;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        let t = 0;
        for (let y = 255; y > 0; y--) { if (O[c.blocks[(y << 8) | (z << 4) | x]]) { t = y + 1; break; } }
        top[((dz + 10) * 16 + z) * tw + (dx + 10) * 16 + x] = Math.min(255, t);
        if (inV) for (let y = oy; y < oy + SC.VY; y++) if (O[c.blocks[(y << 8) | (z << 4) | x]]) SC.setBit(vol, (dx + 2) * 16 + x, y - oy, (dz + 2) * 16 + z);
      }
    }
    const t0 = process.hrtime.bigint();
    const B = SC.begin({ ox: cx * 16, oy, oz: cz * 16, vol, top, topX0: (cx - 10) * 16, topZ0: (cz - 10) * 16, topW: tw });
    const out = [];
    for (let z = 0; z <= 16; z++) for (let x = 0; x <= 16; x++) { const xx = Math.min(15, x), zz = Math.min(15, z); let y = 255; while (y > 0 && !O[c0.blocks[(y << 8) | (zz << 4) | xx]]) y--; out.push(B.corner(x, Math.max(0, Math.min(47, y + 1 - oy)), z, 2)); }
    out.ms = Number(process.hrtime.bigint() - t0) / 1e6; out.steps = B.steps();
    return out;
  };
  const a = bake(3, -2), b = bake(3, -2);
  check(a.every((v, i) => v === b[i]), 'i  the same section, the same clocks');
  const lit = a.filter(v => v !== SC.EMPTY).length;
  check(lit > 100, 'i  generated land: most ground corners see the sun some time (' + lit + ' of ' + a.length + ')');
  // time is noisy on this machine (other tests, GC from the generator): the best of five per section, and the exact
  // number of ray steps as the measure that does not change
  let ms = 0, steps = 0, n = 0;
  for (const [cx, cz] of [[0, 0], [5, 3], [-4, 7], [9, -6]]) {
    let best = 1e9, st = 0; for (let r = 0; r < 5; r++) { const o = bake(cx, cz); best = Math.min(best, o.ms); st = o.steps; }
    ms += best; steps += st; n++; console.log('     section ' + cx + ',' + cz + ': ' + best.toFixed(2) + ' ms (best of 5), ' + st + ' ray steps');
  }
  check(steps / n / 289 <= 500, 'i  at most 500 ray steps a ground corner (' + (steps / n / 289).toFixed(0) + ')');
  check(ms / n <= 6, 'i  the bake (far field + 289 ground corners) ≤ 6 ms a section in node (' + (ms / n).toFixed(2) + ' ms; the volume and top map come from the column data the world keeps)');
}
// ---------------------------------------------------------------- j  the clock volume of a section
{
  // ground at y 0…9 of the volume (the section starts at oy = 0: its cells y 10… are air), a wall at x = 12
  const j = job((set) => { for (let x = -32; x < 48; x++) for (let z = -32; z < 48; z++) for (let y = 0; y < 10; y++) set(x, y, z); for (let z = -32; z < 48; z++) for (let y = 10; y < 16; y++) set(12, y, z); });
  const r = SC.bakeSection(j), at = (x, y, z) => { const i = ((y * 16 + z) * 16 + x) * 4; return (r.data[i] | (r.data[i + 1] << 8) | (r.data[i + 2] << 16) | (r.data[i + 3] << 24)) >>> 0; };
  const B = SC.begin(j);
  check(at(6, 10, 8) === B.probe(6.5, 10.5, 8.5), 'j  an air cell on the ground holds its own clock');
  check(at(6, 9, 8) === at(6, 10, 8), 'j  a ground cell holds the clock of the air above it (the filter keeps surfaces out of the dark)');
  check(at(12, 15, 8) === at(12, 16 - 1, 8) && at(12, 15, 8) === at(12, 15, 8), 'j  (the wall\'s top cell)');
  check(r.n > 256 && r.n < 600, 'j  only the cells beside a surface are traced (' + r.n + ')');
  const free = at(6, 14, 8), next = at(6, 11, 8);
  check(free !== 0, 'j  an air cell away from surfaces takes a neighbour\'s clock');
}
// ---------------------------------------------------------------- l  E2 · Himmelslicht: how much of the sky a cell sees
{
  const floor = (set) => { for (let x = -32; x < 48; x++) for (let z = -32; z < 48; z++) for (let y = 0; y < 10; y++) set(x, y, z); };
  const open = SC.begin(job(floor));
  check(typeof open.sky === 'function', 'l  sky() exists');
  if (typeof open.sky === 'function') {
    const o = open.sky(8.5, 10.5, 8.5);
    check(o > 0.97, 'l  an open field sees the whole sky (' + o.toFixed(2) + ')');
    const roof = SC.begin(job((set) => { floor(set); for (let x = -20; x < 36; x++) for (let z = -20; z < 36; z++) set(x, 14, z); }));
    const r = roof.sky(8.5, 10.5, 8.5);
    check(r < 0.12, 'l  under a wide roof: almost none (' + r.toFixed(2) + ')');
    const wall = SC.begin(job((set) => { floor(set); for (let z = -32; z < 48; z++) for (let y = 10; y < 30; y++) set(9, y, z); }));
    const w = wall.sky(8.5, 10.5, 8.5);
    check(w > 0.35 && w < 0.7, 'l  at the foot of a high wall: about half (' + w.toFixed(2) + ')');
    const alley = SC.begin(job((set) => { floor(set); for (let z = -32; z < 48; z++) for (let y = 10; y < 13; y++) { set(9, y, z); set(7, y, z); } }));
    const a = alley.sky(8.5, 10.5, 8.5);
    check(a < w * 0.6 && a > 0.02, 'l  in a narrow lane between two walls three blocks high: far less, not black (' + a.toFixed(2) + ')');
    const far = SC.begin(job((set) => { floor(set); for (let z = -32; z < 48; z++) for (let y = 10; y < 14; y++) set(20, y, z); }));
    check(far.sky(8.5, 10.5, 8.5) > 0.9, 'l  a low wall twelve blocks away takes almost nothing (' + far.sky(8.5, 10.5, 8.5).toFixed(2) + ')');
    const jb = job((set) => { floor(set); for (let x = 0; x < 8; x++) for (let z = 0; z < 16; z++) set(x, 13, z); });
    const bk = SC.bakeSection(jb), sk = (x, y, z) => bk.sky[(y * 16 + z) * 16 + x];
    check(bk.sky && bk.sky.length === 4096 && sk(14, 10, 8) > 200 && sk(3, 10, 8) < 110, 'l  the section\'s sky bytes: open ' + (bk.sky && sk(14, 10, 8)) + ', under the porch ' + (bk.sky && sk(3, 10, 8)));
    check(bk.sky && sk(12, 9, 8) === sk(12, 10, 8), 'l  a ground cell holds the sky of the air above it');
  }
}
// ---------------------------------------------------------------- k  cost of a real section's clock volume
{
  const g = V.makeGen('overworld', 777, {}), O = SC.opaqueTable(), C = new Map();
  const col = (cx, cz) => { const k = cx + ',' + cz; if (!C.has(k)) C.set(k, g.generate(cx, cz)); return C.get(k); };
  const mk = (cx, cz) => {
    const c0 = col(cx, cz); let hs = [];
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { let y = 255; while (y > 0 && !O[c0.blocks[(y << 8) | (z << 4) | x]]) y--; hs.push(y); }
    hs.sort((a, b) => a - b); const oy = (hs[128] >> 4) << 4;
    const vol = SC.newVolume(), below = new Uint16Array(16);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = col(cx + dx, cz + dz); for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) for (let y = oy; y < oy + SC.VY; y++) if (O[c.blocks[(y << 8) | (z << 4) | x]]) SC.setBit(vol, (dx + 2) * 16 + x, y - oy, (dz + 2) * 16 + z); }
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) if (oy > 0 && O[c0.blocks[((oy - 1) << 8) | (z << 4) | x]]) below[z] |= 1 << x;
    return { ox: cx * 16, oy, oz: cz * 16, vol, below };
  };
  let ms = 0, n = 0, cells = 0;
  for (const [cx, cz] of [[0, 0], [4, -3], [-6, 2], [8, 8]]) {
    const jb = mk(cx, cz); let best = 1e9, r = null;
    for (let k = 0; k < 3; k++) { const t = process.hrtime.bigint(); r = SC.bakeSection(jb); best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6); }
    ms += best; cells += r.n; n++; console.log('     section ' + cx + ',' + cz + ' (y ' + jb.oy + '): ' + r.n + ' cells traced, ' + best.toFixed(1) + ' ms');
  }
  check(ms / n <= 25, 'k  a surface section\'s clock volume ≤ 25 ms in node (' + (ms / n).toFixed(1) + ' ms, ' + (cells / n).toFixed(0) + ' cells)');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

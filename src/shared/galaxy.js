// ============================================================================
// VR.Galaxy — the seeded neighbourhood of Helia (u-stars · docs/superpowers/plans/2026-10-30-u-stars.md; universe spec
// §8.1–§8.3; docs/universe/REFERENCE.md §6–§7). Pure: the main thread, the workers and node run it.
//   Galaxy.build(seed)                 → the neighbourhood {seed, list: [system …], grid} (cached per seed)
//   Galaxy.systemsNear(N, p, ly)       → the systems within ly of p (light years), nearest first, each with d
//   Galaxy.system(N, idx)              → the system as a def in Helia's record format (VR.Universe.compile takes it)
//   Galaxy.colorOf(T) · skyTint(T)     → a star's colour (the stellar-model column, R§6.1) · the sky under it (R§7)
//   Galaxy.dimOf(sys, planet, kind)    → the dim id of a world one can land on: x.<sys>.<planet>.<kind>
// A disc 400 ly across and 120 ly thick holds 1,508 systems (one per 10,000 ly³): 40-ly sectors, each with ⌊λ + u⌋
// candidates (λ = 6.4, u from (seed, sector)), kept inside the disc. Index 0 is Helia at the origin. Star types are drawn
// for variety (U§8.2), not in the real 75 % red dwarfs; 30 % binaries (half of them close pairs with circumbinary
// planets); 4 % of the systems lie inside one of four emission nebulae. Names from our own syllables, never one of the
// block list (fiction, brands, the bright stars' own names — test/names.js).
// The worlds one can land on are the existing world kinds (gen_body.js: basalt, opal, zinn, ocker, aqua) with a seed of
// their own; DimReg resolves their ids on demand (a save left there opens there; nothing else changes for old saves).
// ============================================================================
(function (VR) {
  'use strict';
  const AU = 1.495978707e11, R_SUN = 6.957e8, MU_SUN = 1.32712440018e20, R_EARTH = 6.371e6, LY_AU = 63241.077;
  const DISC_R = 200, DISC_H = 60, SECTOR = 40, LAMBDA = SECTOR * SECTOR * SECTOR / 10000;
  // ---------------------------------------------------------------- random numbers from integers (no Math.random)
  function hash(a, b, c, d) {
    let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ Math.imul(d | 0, 0x85ebca77)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return (h ^ (h >>> 15)) >>> 0;
  }
  function rng(seed) {   // mulberry32
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------------------------------------------------------------- the stars (R§6.1, §6.2)
  // the main sequence (Mamajek): T K, L L☉, R R☉, M M☉ — interpolated in log T
  const MS = [[41400, 3.5e5, 11.4, 43], [31400, 4.5e4, 7.1, 17.7], [15700, 590, 3.3, 4.7], [9700, 38, 2.2, 2.18], [8100, 12.3, 1.8, 1.88],
    [7220, 7.2, 1.7, 1.61], [6550, 3.6, 1.5, 1.33], [5770, 1.02, 1.01, 1.0], [5270, 0.46, 0.81, 0.88], [4440, 0.17, 0.70, 0.70],
    [3850, 0.069, 0.59, 0.57], [3430, 0.016, 0.36, 0.37], [3060, 0.0030, 0.20, 0.162], [2570, 0.00052, 0.12, 0.085]];
  function mainSeq(T) {
    const t = clamp(T, MS[MS.length - 1][0], MS[0][0]);
    for (let i = 0; i < MS.length - 1; i++) {
      const a = MS[i], b = MS[i + 1];
      if (t <= a[0] && t >= b[0]) {
        const k = Math.log(a[0] / t) / Math.log(a[0] / b[0]), g = (x, y) => Math.exp(lerp(Math.log(x), Math.log(y), k));
        return { L: g(a[1], b[1]), R: g(a[2], b[2]), M: g(a[3], b[3]) };
      }
    }
    return { L: MS[0][1], R: MS[0][2], M: MS[0][3] };
  }
  // the T of a main-sequence star of mass M (for a companion)
  function tOfMass(M) {
    const m = clamp(M, 0.085, 43);
    for (let i = 0; i < MS.length - 1; i++) {
      const a = MS[i], b = MS[i + 1];
      if (m <= a[3] && m >= b[3]) { const k = Math.log(a[3] / m) / Math.log(a[3] / b[3]); return Math.round(Math.exp(lerp(Math.log(a[0]), Math.log(b[0]), k))); }
    }
    return 2570;
  }
  // the stellar-model colours (Harre & Heller 2021 via R§6.1): never pure red, never pure blue
  const COL = [[40000, '5b7bff'], [28000, '5e7fff'], [10000, '7996ff'], [7200, 'b8c5ff'], [6500, 'dddeff'], [5800, 'ffede6'],
    [5300, 'ffdec0'], [4400, 'ffb177'], [3900, 'ffa25a'], [3000, 'ffa349'], [2300, 'ff7d24']];
  const rgbOf = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const hex2 = (v) => ('0' + clamp(Math.round(v), 0, 255).toString(16)).slice(-2);
  function interpHex(table, T) {
    const t = clamp(T, table[table.length - 1][0], table[0][0]);
    for (let i = 0; i < table.length - 1; i++) {
      const a = table[i], b = table[i + 1];
      if (t <= a[0] && t >= b[0]) {
        if (t === a[0]) return '#' + a[1];
        const k = Math.log(a[0] / t) / Math.log(a[0] / b[0]), A = rgbOf(a[1]), B = rgbOf(b[1]);
        return '#' + hex2(lerp(A[0], B[0], k)) + hex2(lerp(A[1], B[1], k)) + hex2(lerp(A[2], B[2], k));
      }
    }
    return '#' + table[table.length - 1][1];
  }
  const colorOf = (T) => interpHex(COL, T);
  // the Rayleigh sky under a star (R§7's table, single scattering, no eye adaptation): peach under TRAPPIST-like stars,
  // deep blue under A stars → linear 0–1 sRGB triples
  const SKY = [[10000, '6891ff'], [5772, '8eb3ff'], [4450, 'b3cfff'], [3850, 'd2e4ff'], [3050, 'fff5e3'], [2566, 'ffdcab']];
  const skyTint = (T) => rgbOf(interpHex(SKY, T).slice(1)).map(v => v / 255);
  const lin = (hex) => rgbOf(hex.replace('#', '')).map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });

  // the classes (U§8.2: M 35, K 20, G 15, F 12, A 8, B 4, O 1, white dwarfs 3 — the 2 % left to K) and their T ranges
  const CLASS = [['M', 0.35, 2400, 3850], ['K', 0.22, 3900, 5270], ['G', 0.15, 5300, 5950], ['F', 0.12, 6000, 7220],
    ['A', 0.08, 7300, 9700], ['B', 0.04, 10500, 30000], ['O', 0.01, 30500, 41400], ['D', 0.03, 6000, 25000]];
  function starOf(r) {
    let u = r(), c = CLASS[0];
    for (const k of CLASS) { if (u < k[1]) { c = k; break; } u -= k[1]; }
    const f = r(), T = Math.round(c[0] === 'B' || c[0] === 'O' ? Math.exp(lerp(Math.log(c[2]), Math.log(c[3]), f)) : lerp(c[2], c[3], f));
    const sub = c[0] === 'D' ? 'DA' + Math.max(1, Math.min(9, Math.round(50400 / T))) : c[0] + Math.round(9 * (1 - f)) + ' V';
    let L, R, M;
    if (c[0] === 'D') { R = 0.008 + 0.006 * r(); M = 0.5 + 0.4 * r(); L = R * R * Math.pow(T / 5772, 4); }
    else { const m = mainSeq(T); L = m.L; R = m.R; M = m.M; }
    return { cls: c[0], sub, T, L, R, M, color: colorOf(T) };
  }

  // ---------------------------------------------------------------- names (our own syllables; a block list)
  const ON = ['A', 'Be', 'Ca', 'Da', 'E', 'Fa', 'Gi', 'Ha', 'I', 'Ka', 'Lo', 'Me', 'Ni', 'O', 'Pe', 'Ra', 'Sa', 'Te', 'U', 'Va',
    'Wi', 'Ze', 'Bra', 'Dre', 'Fla', 'Gro', 'Kre', 'Pla', 'Sto', 'Tri', 'Vro', 'Zu', 'Mo', 'Lu', 'Fe', 'Ti'];
  const MID = ['l', 'r', 'n', 'm', 's', 'v', 'th', 'nd', 'rk', 'ld', 'st', 'lv', 'rm', 'sk', 'nt', 'ss'];
  const VOW = ['a', 'e', 'i', 'o', 'u', 'ia', 'ei', 'au', 'ae', 'e', 'a', 'o'];
  const END = ['n', 'ra', 'th', 'x', 'r', 'l', 'ris', 'nor', 'lan', 'mir', 'dis', 'ven', 'tos', 'rin', 'sa', 'na', 'ka', 'va', 'ion', 'eth', 'mar', 'dun', 'les', 'wen'];
  // fiction (films, series, games, books), brands and the bright stars' own names: never generated (test/names.js)
  const BLOCK = ['tatooine', 'hoth', 'endor', 'naboo', 'coruscant', 'alderaan', 'dagobah', 'bespin', 'mustafar', 'jakku', 'kashyyyk',
    'vulcan', 'romulus', 'kronos', 'bajor', 'cardassia', 'risa', 'ferenginar', 'arrakis', 'caladan', 'giedi', 'trantor', 'terminus',
    'pandora', 'krypton', 'gallifrey', 'skaro', 'cybertron', 'kobol', 'caprica', 'magrathea', 'vogsphere', 'solaris', 'acheron',
    'zebes', 'xen', 'reach', 'harvest', 'sanghelios', 'tuchanka', 'thessia', 'palaven', 'omega', 'eden', 'eternia', 'mongo',
    'klendathu', 'thra', 'mars', 'venus', 'terra', 'gaia', 'luna', 'sol', 'helios', 'vega', 'sirius', 'rigel', 'deneb', 'altair',
    'antares', 'betelgeuse', 'arcturus', 'capella', 'aldebaran', 'pollux', 'castor', 'spica', 'canopus', 'procyon', 'achernar',
    'regulus', 'polaris', 'mira', 'algol', 'proxima', 'centauri', 'trappist', 'kepler', 'nasa', 'esa', 'tesla', 'nova', 'zelda',
    'hyrule', 'mario', 'sega', 'xbox', 'nintendo', 'sony', 'lego', 'minecraft', 'roblox', 'fortnite', 'halo', 'destiny', 'elite',
    'asgard', 'midgard', 'olymp', 'lumina', 'atlantis', 'avalon', 'nirn', 'tamriel', 'azeroth', 'draenor', 'kalimdor', 'thedas',
    'ferelden', 'narnia', 'mordor', 'gondor', 'rohan', 'westeros', 'essos', 'hogwarts', 'pern', 'dune', 'riverworld', 'ringworld',
    'tralfamadore', 'gor', 'barsoom', 'perelandra', 'malacandra', 'solaria', 'aurora', 'helicon', 'anacreon', 'kalgan', 'siwenna',
    'lusitania', 'shakespeare', 'hyperion', 'lv', 'origae', 'paradise', 'abydos', 'chulak', 'dakara', 'tollana', 'atlantis', 'ego',
    'xandar', 'sakaar', 'titan', 'vormir', 'zenn', 'oa', 'apokolips', 'rann', 'thanagar', 'tamaran', 'daxam', 'hala', 'nidavellir'];
  const blocked = (n) => { const l = n.toLowerCase(); for (const b of BLOCK) if (l === b || (b.length >= 5 && l.indexOf(b) >= 0)) return true; return false; };
  function nameOf(r, used) {
    for (let k = 0; k < 40; k++) {
      const p = (a) => a[Math.floor(r() * a.length)];
      const form = r();
      let n = form < 0.45 ? p(ON) + p(MID) + p(VOW) + p(END) : form < 0.8 ? p(ON) + p(MID) + p(END) : p(ON) + p(MID) + p(VOW) + p(MID) + p(END);
      n = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
      if (n.length < 4 || n.length > 11 || blocked(n) || (used && used.has(n))) continue;
      if (used) used.add(n);
      return n;
    }
    return 'S-' + Math.floor(r() * 1e6);
  }
  // the four nebulae's names, hand-picked and looked up (test/names.js: no game, book or brand of that name found)
  const NEB_NAMES = [{ de: 'Rosenschleier', en: 'Rose Veil' }, { de: 'Glutwiege', en: 'Ember Cradle' }, { de: 'Türkisherz', en: 'Turquoise Heart' }, { de: 'Lichtwiege', en: 'Light Cradle' }];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

  // ---------------------------------------------------------------- the neighbourhood
  const CACHE = new Map();
  function build(seed) {
    seed = (seed >>> 0) || 0x5eed;
    if (CACHE.has(seed)) return CACHE.get(seed);
    const list = [], used = new Set(['Helia']);
    const home = { idx: 0, home: true, p: [0, 0, 0], name: 'Helia', cls: 'F', sub: 'F5 V', T: 6550, L: 3.6, R: 1.5, M: 1.33, color: '#dddeff', bin: null, neb: -1, np: 9 };
    list.push(home);
    const nx = Math.ceil(2 * DISC_R / SECTOR), ny = Math.ceil(2 * DISC_H / SECTOR);
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nx; iz++) {
      const r = rng(hash(seed, ix * 977 + iz, iy, 0x51a7)), n = Math.floor(LAMBDA + r());
      for (let k = 0; k < n; k++) {
        const x = -DISC_R + (ix + r()) * SECTOR, y = -DISC_H + (iy + r()) * SECTOR, z = -DISC_R + (iz + r()) * SECTOR;
        const h = r();
        if (x * x + z * z > DISC_R * DISC_R || Math.abs(y) > DISC_H || x * x + y * y + z * z < 9) continue;
        const sr = rng(hash(seed, Math.floor(h * 4294967296), ix * 31 + iy * 7 + iz, 0x57a5)), st = starOf(sr);
        const s = { idx: list.length, home: false, p: [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)], seed: hash(seed, Math.floor(h * 4294967296), k, 0x5157) };
        Object.assign(s, st);
        s.name = nameOf(sr, used);
        // binaries: 30 %, half close pairs (circumbinary planets, two shadows), half wide (a second sun as a brilliant star)
        s.bin = null;
        if (sr() < 0.30) {
          const close = sr() < 0.5, q = 0.2 + 0.7 * sr();
          let T2, L2, R2, M2;
          if (s.cls === 'D') { T2 = Math.round(lerp(2600, 3600, sr())); const m = mainSeq(T2); L2 = m.L; R2 = m.R; M2 = Math.min(m.M, s.M); }
          else { M2 = Math.max(0.085, s.M * q); T2 = tOfMass(M2); const m = mainSeq(T2); L2 = m.L; R2 = m.R; }
          s.bin = { close, a: close ? +(0.05 + 0.25 * sr()).toFixed(4) : +(50 + 350 * sr()).toFixed(1), T: T2, L: L2, R: R2, M: M2, color: colorOf(T2), sub: (T2 >= 3900 ? (T2 >= 5300 ? 'G' : 'K') : 'M') + Math.round(9 * sr()) + ' V' };
        }
        s.neb = -1;
        s.np = 1 + Math.floor(sr() * 8);
        list.push(s);
      }
    }
    // the nebulae: four centres away from home; the 4 % of systems nearest to a centre lie inside
    const nebs = [], nr = rng(hash(seed, 0x4e3b, 1, 2));
    for (let k = 0; k < 400 && nebs.length < 4; k++) {
      const s = list[1 + Math.floor(nr() * (list.length - 1))], dh = Math.hypot(s.p[0], s.p[1], s.p[2]);
      if (dh < 45 || nebs.some(n => Math.hypot(n.c[0] - s.p[0], n.c[1] - s.p[1], n.c[2] - s.p[2]) < 90)) continue;
      nebs.push({ id: nebs.length, c: s.p.slice(), seed: hash(seed, k, 0x4e3b, 7), r: 0, name: NEB_NAMES[nebs.length] });
    }
    const want = Math.round(list.length * 0.04), ds = [];
    for (const s of list) { if (s.home) continue; let best = 1e9, bi = -1; for (const n of nebs) { const d = Math.hypot(n.c[0] - s.p[0], n.c[1] - s.p[1], n.c[2] - s.p[2]); if (d < best) { best = d; bi = n.id; } } ds.push([best, bi, s]); }
    ds.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < want && k < ds.length; k++) { const [d, bi, s] = ds[k]; s.neb = bi; nebs[bi].r = Math.max(nebs[bi].r, d); }
    // a grid for systemsNear (20-ly cells)
    const grid = new Map(), key = (a, b, c) => a + ',' + b + ',' + c;
    for (const s of list) { const k = key(Math.floor(s.p[0] / 20), Math.floor(s.p[1] / 20), Math.floor(s.p[2] / 20)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
    const N = { seed, list, nebs, grid, sys: new Map() };
    CACHE.set(seed, N); if (CACHE.size > 4) CACHE.delete(CACHE.keys().next().value);
    Galaxy.cur = N;
    return N;
  }
  function systemsNear(N, p, ly) {
    const out = [], c = Math.ceil(ly / 20), cx = Math.floor(p[0] / 20), cy = Math.floor(p[1] / 20), cz = Math.floor(p[2] / 20);
    for (let a = cx - c; a <= cx + c; a++) for (let b = cy - c; b <= cy + c; b++) for (let e = cz - c; e <= cz + c; e++) {
      const L = N.grid.get(a + ',' + b + ',' + e); if (!L) continue;
      for (const s of L) { const d = Math.hypot(s.p[0] - p[0], s.p[1] - p[1], s.p[2] - p[2]); if (d <= ly) out.push({ idx: s.idx, d, s }); }
    }
    out.sort((x, y) => x.d - y.d);
    return out;
  }
  const dist = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);

  // ---------------------------------------------------------------- a system (R§7's classes on the world kinds)
  // classes: hot (hot giant), giant, icegiant, super (super-Earth), terra (terrestrial), lava, eye (tidally locked round
  // a red dwarf); the landable ones on a kind of gen_body.js by their equilibrium temperature
  const KINDS = ['basalt', 'opal', 'zinn', 'ocker', 'aqua'];
  const WORLD_KIND = { basalt: 'cratered', opal: 'ice', zinn: 'volcanic', ocker: 'dust', aqua: 'ocean' };
  const G_OF = { basalt: 1.62, opal: 0.49, zinn: 1.8, ocker: 3.72, aqua: 2.01 };
  function landKind(Teq, r) {
    if (Teq > 450) return 'zinn';
    if (Teq > 330) return r() < 0.7 ? 'ocker' : 'zinn';
    if (Teq > 230) return r() < 0.6 ? 'aqua' : 'ocker';
    if (Teq > 150) return r() < 0.5 ? 'basalt' : 'ocker';
    return r() < 0.65 ? 'opal' : 'basalt';
  }
  const dimOf = (sys, p, kind) => 'x.' + sys + '.' + p + '.' + kind;
  function system(N, idx) {
    if (typeof N === 'number') { idx = N; N = Galaxy.cur || build(0); }
    if (idx === 0) return VR.Universe ? VR.Universe.HELIA : null;
    if (N.sys.has(idx)) return N.sys.get(idx);
    const s = N.list[idx]; if (!s) return null;
    const r = rng(hash(N.seed, idx, s.seed, 0x5157e));
    const sid = 'x' + idx, Ltot = s.L + (s.bin && s.bin.close ? s.bin.L : 0), Mtot = s.M + (s.bin && s.bin.close ? s.bin.M : 0);
    const nm = (de, en) => ({ de, en: en || de });
    const bodies = [{ id: sid, kind: 'star', name: nm(s.name), R: s.R * R_SUN, mu: s.M * MU_SUN, T: s.T, color: s.color, spin: { tilt: 0, T: 2.5e5 } }];
    if (s.bin) bodies.push({ id: sid + 'b', kind: 'star', name: nm(s.name + ' B'), parent: sid, R: s.bin.R * R_SUN, mu: s.bin.M * MU_SUN, T: s.bin.T, color: s.bin.color,
      orbit: { a: s.bin.a * AU, e: 0, i: 0, node: 0, peri: 0, M0: Math.round(r() * 360) }, spin: { tilt: 0, T: 2.5e5 } });
    const aHZ = Math.sqrt(Ltot);
    let a = Math.max(0.012, 0.09 * aHZ) * (0.6 + 0.8 * r());
    if (s.bin && s.bin.close) a = Math.max(a, 3.2 * s.bin.a);
    const wideCut = s.bin && !s.bin.close ? s.bin.a / 3 : Infinity;
    for (let k = 0; k < s.np; k++) {
      if (a > wideCut) a = wideCut * (0.3 + 0.1 * k / s.np);
      const Teq = 278 * Math.pow(Ltot, 0.25) / Math.sqrt(a), u = r();
      let cls;
      if (Teq > 1000) cls = u < 0.55 ? 'hot' : 'lava';
      else if (Teq > 700 && u < 0.3) cls = 'lava';
      else if (Teq < 170) cls = u < 0.42 ? 'giant' : u < 0.72 ? 'icegiant' : u < 0.85 ? 'super' : 'terra';
      else if (s.cls === 'M' && a < 0.15 && u < 0.6) cls = 'eye';
      else cls = u < 0.38 ? 'super' : 'terra';
      const p = { id: sid + 'p' + (k + 1), planet: true, cls, name: nm(s.name + ' ' + ROMAN[k]), parent: sid, Teq: Math.round(Teq),
        orbit: { a: a * AU, e: +(0.05 * r()).toFixed(3), i: +(3 * r()).toFixed(2), node: Math.round(r() * 360), peri: Math.round(r() * 360), M0: Math.round(r() * 360) } };
      const giant = cls === 'hot' || cls === 'giant' || cls === 'icegiant';
      if (giant) {
        const Re = cls === 'icegiant' ? 3.6 + 0.8 * r() : 9.5 + 3 * r();
        Object.assign(p, { kind: cls === 'icegiant' ? 'icegiant' : 'giant', R: Re * R_EARTH, g: cls === 'icegiant' ? 9 + 3 * r() : 20 + 10 * r(), air: 'H₂/He', landable: false,
          spin: cls === 'hot' ? { locked: true } : { tilt: Math.round(r() * 30), toward: Math.round(r() * 360), T: (9 + 8 * r()) * 3600 / 8 } });
      } else {
        const base = cls === 'lava' ? 'zinn' : cls === 'eye' ? (Teq > 330 ? 'ocker' : Teq > 200 ? 'aqua' : 'opal') : landKind(Teq, r);
        const Re = cls === 'super' ? 1.4 + 0.6 * r() : cls === 'lava' ? 1.2 + 0.8 * r() : 0.5 + 0.9 * r();
        Object.assign(p, { kind: WORLD_KIND[base], base, R: Re * R_EARTH, g: +(G_OF[base] * (0.85 + 0.3 * r())).toFixed(2), air: base === 'aqua' ? 0.5 : base === 'ocker' ? 0.006 : 0,
          landable: true, dim: dimOf(idx, k + 1, base), locked: cls === 'eye' || cls === 'lava',
          spin: cls === 'eye' || cls === 'lava' || a < 0.08 ? { locked: true } : { tilt: Math.round(r() * 35), toward: Math.round(r() * 360), T: (1200 + 2400 * r()) } });
      }
      bodies.push(p);
      a *= 1.45 + 0.85 * r();
    }
    // at least one world to land on: the planet nearest the habitable zone becomes a terrestrial one
    if (!bodies.some(b => b.landable)) {
      let best = null; for (const b of bodies) if (b.planet && (!best || Math.abs(Math.log(b.orbit.a / AU / aHZ)) < Math.abs(Math.log(best.orbit.a / AU / aHZ)))) best = b;
      const base = landKind(best.Teq, r), k = +best.id.split('p').pop();
      Object.assign(best, { cls: 'terra', kind: WORLD_KIND[base], base, R: (0.6 + 0.6 * r()) * R_EARTH, g: G_OF[base], air: base === 'aqua' ? 0.5 : 0, landable: true, dim: dimOf(idx, k, base), spin: { locked: true } });
    }
    // moons: a giant one or two, a rocky world sometimes one (small, airless, locked) — their shadows cross their worlds
    for (const p of bodies.filter(b => b.planet && b.cls !== 'hot' && b.cls !== 'lava')) {
      const giant = p.kind === 'giant' || p.kind === 'icegiant', nm2 = r() < (giant ? 0.65 : 0.38) ? (giant && r() < 0.5 ? 2 : 1) : 0;
      for (let m = 0; m < nm2; m++) {
        const Rm = (giant ? 0.25 + 0.2 * r() : 0.16 + 0.12 * r()) * (giant ? R_EARTH : p.R);
        bodies.push({ id: p.id + 'm' + (m + 1), moon: true, kind: 'cratered', cls: 'moon', name: nm(p.name.de + ' ' + 'abc'[m]), parent: p.id, R: Rm, g: +(1.2 + 0.6 * r()).toFixed(2), air: 0, landable: false,
          orbit: { a: p.R * ((giant ? 3.2 : 2.6) + (m * 2.5) + 2.5 * r()), e: 0, i: +(4 * r()).toFixed(2), node: 0, peri: 0, M0: Math.round(r() * 360) }, spin: { locked: true } });
      }
    }
    const def = { id: sid, name: nm(s.name), idx, star: { type: s.sub, T: s.T, L: s.L, M: s.M, R: s.R, color: s.color }, star2: s.bin ? Object.assign({ close: s.bin.close, a: s.bin.a, type: s.bin.sub }, s.bin) : null,
      neb: s.neb, p: s.p.slice(), bodies };
    N.sys.set(idx, def);
    if (N.sys.size > 64) N.sys.delete(N.sys.keys().next().value);
    return def;
  }
  // the most interesting body: a landable world with air, else any landable, a ringless giant last
  function showpiece(def) {
    const pl = def.bodies.filter(b => b.planet);
    const score = (b) => (b.landable ? 10 : 0) + (b.base === 'aqua' ? 4 : b.base === 'zinn' ? 3 : b.base === 'ocker' ? 2 : b.base === 'opal' ? 1.5 : 0) + (b.cls === 'eye' ? 2 : 0) + (b.cls === 'giant' ? 3 : 0);
    let best = pl[0]; for (const b of pl) if (score(b) > score(best)) best = b;
    return best;
  }

  // ---------------------------------------------------------------- the dims of the worlds (DimReg resolves them)
  const DIM_RE = /^x\.(\d{1,5})\.([1-9])\.(basalt|opal|zinn|ocker|aqua)$/;
  function resolveDim(id) {
    const D = VR.DimReg, m = typeof id === 'string' ? DIM_RE.exec(id) : null;
    if (!D || !m) return null;
    const kind = m[3], base = D.get(kind); if (!base) return null;
    const sys = +m[1], pl = +m[2];
    return D.add(id, { sky: base.sky, code: base.code, g: base.g, travel: true, mp: 'convoy', body: kind, air: base.air, exo: { sys, p: pl, kind },
      gen: (seed, opts) => new VR.BodyGen((seed ^ Math.imul(sys + 1, 0x9e3779b1) ^ Math.imul(pl + 7, 0x85ebca77)) >>> 0, kind, opts),
      name: ['g.dim.exo', 'Welt eines fernen Sterns', 'World of a distant star'], veil: base.veil });
  }
  if (VR.DimReg) VR.DimReg.resolve = resolveDim;

  const Galaxy = VR.Galaxy = {
    AU, LY_AU, DISC_R, DISC_H, COUNT: 1508, RANGE: 30, KINDS, BLOCK, NEB_NAMES,
    build, systemsNear, system, showpiece, dist, colorOf, skyTint, lin, mainSeq, dimOf, resolveDim, blocked, nameOf, rng, hash,
    cur: null,
  };
})((typeof globalThis !== 'undefined' ? globalThis : self).VR || ((typeof globalThis !== 'undefined' ? globalThis : self).VR = {}));

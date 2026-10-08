// Trailer generation (t-biomes): the endless world made at vgen 6 carries the trailer's landscape beyond the Heartland.
// 1 · over 100 seeds the new terraced hills and the existing realm biomes, sky isles and palm cities are placed with
//     sane frequencies on the far land (920–2400 blocks from the origin); the new biome never appears at vgen 5
// 2 · a mesa has its lava vent (a lava throat, a magma ring, a basalt chimney) and its banded strata
// 3 · an isle floats (air under its rock) and a waterfall pours off its rim down to the land
// 4 · a palm city is placed and furnished: palms, white tech walls and light lines in its 3 × 3 chunks
// 5 · the terraces step onto the 4-block grid; 6 · the corridors cover the rail lines
// 7 · the vgen 6 terrain differs from vgen 5 on the far land (the change applies) while vgen 5 is unchanged by it
//     (test/gen_same.js holds the vgen 5 hash)
// 8 · the generation cost per chunk, vgen 6 against vgen 5 (cold and warm)
//   bash test/wt_run.sh trailer_gen.js 300
const V = require('./load_shared.js');
const B = V.BIOMES, R = V.R, M = V.M, SEA = V.C.SEA;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const nameOf = (id) => { const t = R.types[R.T.type[id]]; return t ? t.name : ''; };
const FLUID_NAMES = /^(water|lava|aether)$/;
function solidTop(blocks, col) {
  let y = 254;
  while (y > 1) { const b = blocks[(y << 8) | col]; if (b && (R.T.flags[b] & V.F.SOLID) && !(R.T.flags[b] & (V.F.PLANT | V.F.FLUID | V.F.REPLACE | V.F.LEAVES))) break; y--; }
  return y;
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };

// ---------------------------------------------------------------- 1 · frequencies over 100 seeds
console.log('1 · the biomes and features over 100 seeds (vgen 6, the far land):');
const SEEDS = 100, LIM = 2400, STEP = 80;
const sh = { terr: [], ember: [], prism: [], isles: [] };
let terrSeeds = 0, oldTerr = 0;
const t0 = Date.now();
for (let seed = 1; seed <= SEEDS; seed++) {
  const g = V.makeGen('overworld', seed, { vgen: 6 });
  let n = 0, t = 0, e = 0, p = 0, isl = 0;
  for (let x = -LIM; x <= LIM; x += STEP) for (let z = -LIM; z <= LIM; z += STEP) {
    if (Math.hypot(x, z) < 920) continue;
    const cl = g.climateAt(x, z);
    const key = B[g.biomeFor(cl, Math.round(cl.H))].key;
    n++;
    if (key === 'terraced_hills') t++;
    else if (key === 'ember_canyons') e++;
    else if (key === 'prism_fields' || key === 'crystal_highlands') p++;
    if (g.islandAt(x, z)) isl++;
  }
  sh.terr.push(100 * t / n); sh.ember.push(100 * e / n); sh.prism.push(100 * p / n); sh.isles.push(100 * isl / n);
  if (t > 0) terrSeeds++;
  const g5 = seed <= 12 ? V.makeGen('overworld', seed, { vgen: 5 }) : null;
  if (g5) for (let x = -LIM; x <= LIM; x += 240) for (let z = -LIM; z <= LIM; z += 240) { if (Math.hypot(x, z) < 920) continue; const cl = g5.climateAt(x, z); if (B[g5.biomeFor(cl, Math.round(cl.H))].key === 'terraced_hills') oldTerr++; }
}
const mt = median(sh.terr), me = median(sh.ember), mp = median(sh.prism), mi = median(sh.isles);
console.log(`  medians of the far land: terraced ${mt.toFixed(1)} % · ember canyons ${me.toFixed(1)} % · prism ${mp.toFixed(1)} % · sky isles ${mi.toFixed(1)} % (${Date.now() - t0} ms)`);
check(mt >= 1 && mt <= 12, `terraced hills cover 1–12 % of the far land (median ${mt.toFixed(1)} %)`);
check(terrSeeds >= 90, `terraced hills appear in ${terrSeeds} of 100 seeds`);
check(me >= 1 && me <= 12, `ember canyons cover 1–12 % (median ${me.toFixed(1)} %)`);
check(mp >= 0.3 && mp <= 12, `prism fields and crystal highlands cover 0.3–12 % (median ${mp.toFixed(1)} %)`);
check(mi >= 2 && mi <= 25, `sky isles float over 2–25 % of the far land (median ${mi.toFixed(1)} %)`);
check(oldTerr === 0, 'the terraced biome never appears in vgen 5 worlds (12 seeds checked)');

// ---------------------------------------------------------------- 2 · a mesa with a lava vent and strata
console.log('2 · a mesa with its lava vent and strata:');
let vent = null;
for (let seed = 1; seed <= 30 && !vent; seed++) {
  const g = V.makeGen('overworld', seed, { vgen: 6 });
  for (let cj = -40; cj <= 40 && !vent; cj++) for (let ci = -40; ci <= 40 && !vent; ci++) {
    const Vt = V.Trail.ventAt(g, ci, cj);
    if (Vt && Math.hypot(Vt.x, Vt.z) > 1000) vent = { g, Vt, seed };
  }
}
check(!!vent, 'a lava vent is placed on a mesa top within 30 seeds');
if (vent) {
  const { g, Vt } = vent, cx = Math.floor(Vt.x / 16), cz = Math.floor(Vt.z / 16);
  const out = g.generate(cx, cz), blocks = out.blocks;
  const lx = Vt.x - cx * 16, lz = Vt.z - cz * 16, col = (lz << 4) | lx;
  const top = solidTop(blocks, col);
  let lava = 0, magma = 0, basalt = 0;
  const bands = new Set();
  const bandNames = /ochre|umber|terracotta|red_sand|ember/;
  // the vent and its mesa: the 3 × 3 chunks around the throat (the ring and the walls may cross a chunk border)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const o = g.generate(cx + dx, cz + dz), bl = o.blocks;
    for (let c = 0; c < 256; c++) for (let y = 40; y < 200; y++) {
      const b = bl[(y << 8) | c]; if (!b) continue;
      const n = nameOf(b);
      if (n === 'lava' && y >= 80) lava++; else if (n === 'magma_block') magma++; else if (n === 'basalt') basalt++;
      if (bandNames.test(n)) bands.add(n);
    }
  }
  check(top >= 80 && top <= 110, `the vent stands on a mesa top at y ${top}`);
  // the throat: lava in the vent's column near the mesa top (the chimney stands above it, so solidTop reads the chimney)
  let throat = -1;
  for (let y = 120; y >= 84; y--) if (nameOf(blocks[(y << 8) | col]) === 'lava') { throat = y; break; }
  check(throat >= 84 && throat <= top + 4 + 3 && nameOf(blocks[((throat + 1) << 8) | col]) !== 'lava', `the throat is lava at y ${throat}, open to the air (the chimney rises from it)`);
  check(lava >= 1 && magma >= 4 && basalt >= 3, `a lava throat (${lava}), a magma ring (${magma}) and basalt (${basalt}) surround it`);
  check(bands.size >= 3, `the walls are banded (${bands.size} strata: ${[...bands].slice(0, 4).join(', ')})`);
}

// ---------------------------------------------------------------- 3 · an isle floats with a waterfall
console.log('3 · a sky isle that floats, with a fall off its rim:');
let isle = null;
for (let seed = 1; seed <= 40 && !isle; seed++) {
  const g = V.makeGen('overworld', seed, { vgen: 6 });
  g.climateAt(0, 0);   // (the climate primes the realm's noises, as the worker's first chunk does)
  for (let cj = -10; cj <= 10 && !isle; cj++) for (let ci = -10; ci <= 10 && !isle; ci++) {
    const I = g.islandCell(ci, cj);
    if (!I || !I.falls || I.r < 16 || I.y < 130 || Math.hypot(I.x, I.z) < 1000) continue;
    isle = { g, I, seed };
  }
}
check(!!isle, 'an isle with falls and a radius of 16+ is found within 40 seeds');
if (isle) {
  const { g, I } = isle;
  let floats = 0, fall = 0;
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const cx = Math.floor(I.x / 16) + dx, cz = Math.floor(I.z / 16) + dz;
    const out = g.generate(cx, cz), blocks = out.blocks;
    for (let c = 0; c < 256; c++) {
      const x = cx * 16 + (c & 15), z = cz * 16 + (c >> 4);
      const sh = g.islandShape(I, x, z);
      if (sh && sh.bottom > 22 && blocks[((sh.bottom - 1) << 8) | c] === 0 && blocks[(sh.top << 8) | c]) floats++;
      // a fall: fluid at the rim's height outside the rock, with air under it down to the land
      if (sh) continue;
      for (let y = I.y - 30; y <= I.y + 30; y++) {
        const b = blocks[(y << 8) | c]; if (!b || !FLUID_NAMES.test(nameOf(b))) continue;
        if (solidTop(blocks, c) < y - 6) { fall++; break; }
      }
    }
  }
  check(floats > 0, `the isle floats: ${floats} island columns have air under their rock`);
  check(fall > 0, `a waterfall pours off its rim: ${fall} fall columns to the land`);
}

// ---------------------------------------------------------------- 4 · a palm city, placed and furnished
console.log('4 · a palm city, placed and furnished:');
let city = null;
for (let seed = 1; seed <= 25 && !city; seed++) {
  const g = V.makeGen('overworld', seed, { vgen: 6 });
  for (let j = -6; j <= 6 && !city; j++) for (let i = -6; i <= 6 && !city; i++) {
    const s = V.VillageGen.site(g, i, j);
    if (s && s.style === 'tech' && !s.home && Math.hypot(s.x, s.z) > 1000) city = { g, s, seed };
  }
}
check(!!city, 'a palm (tech) village site is placed in the far land within 25 seeds');
if (city) {
  const { g, s } = city, cx0 = Math.floor(s.x / 16), cz0 = Math.floor(s.z / 16);
  let palms = 0, walls = 0, lights = 0, beds = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const out = g.generate(cx0 + dx, cz0 + dz), blocks = out.blocks;
    for (let i = 0; i < 65536; i++) {
      const b = blocks[i]; if (!b) continue;
      const n = nameOf(b);
      if (/^vx_palm_/.test(n)) palms++;
      else if (/^vx_(tech_white|tech_hex_white|window_tech|tech_band)$/.test(n)) walls++;
      else if (/light|neon/.test(n)) lights++;
      else if (/bed|stool/.test(n)) beds++;
    }
  }
  check(palms >= 4, `palms stand in the city (${palms} palm blocks)`);
  check(walls >= 40, `white tech villas with turquoise window bands (${walls} blocks)`);
  check(lights >= 1, `light lines and strips light the streets (${lights} blocks)`);
  check(beds + walls > 0, `the houses are furnished (${beds} beds and stools)`);
}

// ---------------------------------------------------------------- 5 · the terraces step onto the grid
console.log('5 · the terraces:');
{
  let on = 0, all = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const g = V.makeGen('overworld', seed, { vgen: 6 });
    for (let cz = 70; cz < 90; cz += 3) for (let cx = 70; cx < 90; cx += 3) {
      const out = g.generate(cx, cz), cls = V.OverworldGen.climateOf(out);
      for (let c = 0; c < 256; c++) {
        if (!cls[c] || !(cls[c].terr > 0.5)) continue;
        const top = solidTop(out.blocks, c);
        if (top <= SEA + 2) continue;
        all++; if (top % 4 === 0) on++;
      }
    }
  }
  const frac = all ? on / all : 0;
  console.log(`  ${on} of ${all} terrace columns stand on the 4-block grid`);
  check(all > 300 && frac >= 0.9, `the terrace tops sit on the 4-block grid (${(100 * frac).toFixed(1)} %)`);
}

// ---------------------------------------------------------------- 6 · the corridors cover the rail lines
console.log('6 · the corridors:');
{
  let checked = 0, covered = 0, lineCount = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const g = V.makeGen('overworld', seed, { vgen: 6 });
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
      const s = V.VillageGen.site(g, i, j);
      if (!s || Math.hypot(s.x, s.z) < 1000) continue;
      const lines = V.Trail.linesNear(g, s.x - 8, s.z - 8, 600);
      lineCount += lines.length;
      for (const L of lines) for (let k = 0; k < L.pts.length; k += 75) {
        const x = L.pts[k], z = L.pts[k + 2];
        const mask = V.Trail.corridorMask(lines, x >> 4, z >> 4);
        checked++; if (mask[((z & 15) << 4) | (x & 15)] === 1) covered++;
      }
    }
  }
  console.log(`  ${lineCount} rail lines near the far villages; ${covered} of ${checked} sampled line points are corridor columns`);
  check(lineCount > 0 && checked > 20 && covered === checked, 'every rail-line column is a corridor column');
}

// ---------------------------------------------------------------- 7 · the change applies beyond the Heartland
console.log('7 · vgen 6 differs from vgen 5 on the far land:');
{
  const hash = (out) => { let h = 2166136261 >>> 0; for (let i = 0; i < out.blocks.length; i += 7) h = Math.imul(h ^ out.blocks[i], 16777619) >>> 0; return h; };
  const g5 = V.makeGen('overworld', 1, { vgen: 5 }), g6 = V.makeGen('overworld', 1, { vgen: 6 });
  let diff = 0, n = 0;
  for (let cz = 60; cz < 90; cz += 6) for (let cx = 60; cx < 90; cx += 6) { n++; if (hash(g5.generate(cx, cz)) !== hash(g6.generate(cx, cz))) diff++; }
  console.log(`  ${diff} of ${n} far chunks differ`);
  check(diff >= 3, `the far land changes at vgen 6 (${diff} of ${n} chunks differ)`);
}

// ---------------------------------------------------------------- 8 · the cost per chunk
console.log('8 · the cost per chunk (far land, seed 1):');
{
  const chunks = []; for (let cz = 62; cz < 70; cz++) for (let cx = 62; cx < 70; cx++) chunks.push([cx, cz]);
  // one generator per run, the order alternated (the first run pays for the JIT and the code's warm-up)
  const run = (vgen) => {
    const g = V.makeGen('overworld', 1, { vgen });
    let t = Date.now(); for (const [cx, cz] of chunks) g.generate(cx, cz); const cold = (Date.now() - t) / chunks.length;
    t = Date.now(); for (const [cx, cz] of chunks) g.generate(cx, cz); const warm = (Date.now() - t) / chunks.length;
    return { cold, warm };
  };
  const a5 = run(5), a6 = run(6), b6 = run(6), b5 = run(5);
  const c5 = { cold: Math.min(a5.cold, b5.cold), warm: Math.min(a5.warm, b5.warm) }, c6 = { cold: Math.min(a6.cold, b6.cold), warm: Math.min(a6.warm, b6.warm) };
  console.log(`  vgen 5: cold ${c5.cold.toFixed(1)} ms, warm ${c5.warm.toFixed(1)} ms · vgen 6: cold ${c6.cold.toFixed(1)} ms, warm ${c6.warm.toFixed(1)} ms per chunk`);
  check(c6.cold <= c5.cold * 1.5 + 2, `cold chunks cost at most 1.5× the vgen 5 chunks (${(c6.cold / c5.cold).toFixed(2)}×)`);
  check(c6.warm <= c5.warm * 1.3 + 1, `warm chunks cost at most 1.3× (${(c6.warm / c5.warm).toFixed(2)}×)`);
}
console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);
process.exit(fails === 0 ? 0 : 1);

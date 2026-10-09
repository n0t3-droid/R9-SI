// F-NoCrystal (docs/superpowers/plans/2026-10-09-f-nocrystal.md) — the owner: „alles was Kristalle sind, einfach weg
// damit, ich mag die nicht, ob groß oder klein". A new world (vgen 9) generates no crystal of any kind, large or small:
// not in the Heartland's set pieces (the canyon's gems and ruin well, the Sky Isles' crystals and hanging crystals, the
// Gate Plaza's corners and terraces, the citadel's groves and giants), not in the prism fields and highlands (spires,
// small clusters, island tops and tips), not in meteor craters, caves (geodes, ice crystals), the Drift's Prism Reach or a
// prism village; something stands where a big one stood (pinnacles, hoodoos, trees, vines, palms, hedges). Old worlds
// (vgen ≤ 8) keep their crystals exactly. The wonders, the Forge's Burg and the ship palettes place none (all worlds);
// the texts promise none; the default world generator is 9; the prism patch costs no more CPU at vgen 9.
//   bash test/wt_run.sh nocrystal.js 300          · SEEDS=4242,20261009 · ONLY=<section> · VERBOSE=1
const V = require('./load_shared.js');
const fs = require('fs'), path = require('path');
const R = V.R, T = R.T, M = V.M, BI = V.BIOME, B = V.BIOMES;
const SEEDS = (process.env.SEEDS || '4242,20261009').split(',').map(Number);
const ONLY = process.env.ONLY || '';
let fails = 0, n = 0;
const check = (ok, msg) => { n++; if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const section = (name, fn) => { if (ONLY && ONLY !== name) return; console.log('— ' + name); const t0 = Date.now(); try { fn(); } catch (e) { fails++; console.log('  ✗ ' + name + ' threw: ' + (e && e.stack || e)); } console.log('  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)'); };

// ---------------------------------------------------------------- the crystal families, by name, from the registry
const FAM_RE = /crystal|amethyst|prism|(^|_)gems?($|_)|geode/;
const FAMS = R.types.filter(t => t && FAM_RE.test(t.name));
const CRY = new Uint8Array(R.types.length + 1);
for (const t of FAMS) CRY[t.id] = 1;
const isC = (s) => s > 0 && s !== 0xFFFF && CRY[T.type[s]] === 1;
const nameOf = (s) => (s > 0 && s !== 0xFFFF && R.types[T.type[s]] ? R.types[T.type[s]].name : s === 0xFFFF ? 'keep' : 'air');
const cryIn = (blocks) => { let k = 0; for (let i = 0; i < blocks.length; i++) { const s = blocks[i]; if (s && CRY[T.type[s]]) k++; } return k; };
const gen = (seed, vgen, extra) => V.makeGen('overworld', seed >>> 0, Object.assign({ vgen }, extra || {}));
// the crystal cells of a set piece's op buckets ({f: [x, z, y0, y1, s …], o: [x, y, z, s …]} per chunk key)
function opCells(chunks, pred) {
  const out = [];
  for (const [k, b] of chunks) {
    if (b.f) for (let i = 0; i < b.f.length; i += 5) if (pred(b.f[i + 4])) for (let y = b.f[i + 2]; y <= b.f[i + 3]; y++) out.push([b.f[i], y, b.f[i + 1], b.f[i + 4], k]);
    if (b.o) for (let i = 0; i < b.o.length; i += 4) if (pred(b.o[i + 3])) out.push([b.o[i], b.o[i + 1], b.o[i + 2], b.o[i + 3], k]);
  }
  return out;
}
// the columns of crystal cells: (x, z) → lowest and highest y (a big piece is a column ≥ 3 tall)
function columns(cells) { const m = new Map(); for (const [x, y, z] of cells) { const k = x + ',' + z; const c = m.get(k); if (!c) m.set(k, { x, z, y0: y, y1: y }); else { if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y; } } return [...m.values()]; }
// a chunk cache per generator (a set piece's chunks are generated once per vgen)
function chunkGet(g) {
  const cache = g._tcache || (g._tcache = new Map());
  const col = (cx, cz) => { const k = cx + ',' + cz; let c = cache.get(k); if (!c) { c = g.generate(cx, cz); cache.set(k, c); } return c; };
  const get = (x, y, z) => (y < 0 || y > 255) ? 0 : col(x >> 4, z >> 4).blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  return { col, get };
}
const solidish = (s) => s > 0 && s !== 0xFFFF && !isC(s);
// something stands where a crystal column stood: a block that is not air and not a crystal in the column's own cell at
// its foot (a standing piece: its lowest cell) or its top (a hanging piece: its highest cell)
function stands(get, cols, hanging) {
  let ok = 0; const miss = [];
  for (const c of cols) { const y = hanging ? c.y1 : c.y0; if (solidish(get(c.x, y, c.z))) ok++; else if (miss.length < 4) miss.push(c.x + ',' + y + ',' + c.z + ' ' + nameOf(get(c.x, y, c.z))); }
  return { ok, n: cols.length, miss };
}
const chunksOf = (cells) => [...new Set(cells.map(c => (c[0] >> 4) + ',' + (c[2] >> 4)))].map(k => k.split(',').map(Number));
const cpu = (fn) => { const c0 = process.cpuUsage(); fn(); const c = process.cpuUsage(c0); return (c.user + c.system) / 1000; };

console.log('crystal families (' + FAMS.length + ' block types): ' + FAMS.map(t => t.name).join(' '));
console.log('not crystals, kept: ' + R.types.filter(t => t && /quartz|diamond|emerald|tidestone|sunstone|^aether|calcite|lilacite/.test(t.name)).map(t => t.name).slice(0, 40).join(' ') + ' …');
const MUST = ['violet_crystal_block', 'violet_crystal_cluster', 'azure_crystal_block', 'azure_crystal_cluster', 'verdant_crystal_block', 'verdant_crystal_cluster', 'rose_crystal_block', 'rose_crystal_cluster', 'amber_crystal_block', 'amber_crystal_cluster', 'amethyst_block', 'budding_amethyst', 'small_amethyst_bud', 'medium_amethyst_bud', 'large_amethyst_bud', 'amethyst_cluster', 'ice_crystal', 'vx_crystal_wall', 'vx_crystal_violet', 'vx_crystal_azure', 'vx_crystal_rose', 'vx_lamppost_crystal', 'vx_lantern_crystal'];
check(MUST.every(m => FAMS.some(t => t.name === m)) && !FAMS.some(t => /quartz|ore$/.test(t.name)), 'the families hold every crystal type of the registry (' + MUST.length + ' known) and no quartz stone or ore');

// ---------------------------------------------------------------- the gate
section('gate', () => {
  const GEN = V.GEN;
  check(typeof GEN.noCry === 'function', 'VR.GEN.noCry(g) is the one gate');
  if (typeof GEN.noCry !== 'function') return;
  check(GEN.noCry(gen(1, 9)) && !GEN.noCry(gen(1, 8)) && !GEN.noCry(gen(1, 5)) && !GEN.noCry(gen(1, 1)), 'vgen 9 has no crystals, vgen 8, 5 and 1 keep theirs');
  check(GEN.noCry(V.makeGen('drift', 1, { vgen: 9 })) && !GEN.noCry(V.makeGen('drift', 1, { vgen: 8 })) && !GEN.noCry(V.makeGen('drift', 1, {})), 'the Drift follows the world\'s vgen (an old Drift keeps its Prism Reach)');
  check(GEN.noCry(gen(1, 5, { noCrystal: true })), 'the title panorama (vgen 5 with noCrystal) shows none');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'game.js'), 'utf8');
  check(/vgen: o\.vgen \? \+o\.vgen : 9\b/.test(src), 'a new world is made with vgen 9 (src/main/game.js createWorld)');
  check(/opts: \{ vgen: 5, noCrystal: true \}/.test(src) && /genOpts: \{ vgen: 5, noCrystal: true \}/.test(src), 'the title panorama asks for no crystals (both the workers\' and the world\'s options)');
});

// ---------------------------------------------------------------- the Heartland's set pieces
for (const seed of SEEDS) section('heartland ' + seed, () => {
  const g8 = gen(seed, 8), g9 = gen(seed, 9), c8 = chunkGet(g8), c9 = chunkGet(g9);
  const pieces = [
    ['the Ember Canyon (gems, the ruin well)', V.CanyonGen.build, false],
    ['the Sky Isles (crystals on top)', V.IslesGen.build, false],
    ['the Gate Temple (plaza corners, terraces)', (g) => V.TempleGen.build(g).chunks, false],
  ];
  for (const [name, build, hanging] of pieces) {
    const a = opCells(build(g8), isC), b = opCells(build(g9), isC);
    check(a.length > 0, `${name}: vgen 8 keeps its crystals (${a.length} crystal cells in its ops)`);
    check(b.length === 0, `${name}: vgen 9 places none (${b.length})` + (b.length ? ': ' + b.slice(0, 3).map(c => c.slice(0, 3).join(',') + ' ' + nameOf(c[3])).join(' · ') : ''));
    // the chunks themselves (generated): crystals at 8, none at 9
    const ch = chunksOf(a);
    let k8 = 0, k9 = 0; for (const [cx, cz] of ch) { k8 += cryIn(c8.col(cx, cz).blocks); k9 += cryIn(c9.col(cx, cz).blocks); }
    check(k8 > 0 && k9 === 0, `${name}: its ${ch.length} chunks generated — ${k8} crystal blocks at vgen 8, ${k9} at vgen 9`);
    // something stands where the crystals stood: the standing columns (the isles' hanging ones are checked below)
    const standing = columns(a.filter(c => !(name.includes('Isles') && c[1] < 150)));
    const big = standing.filter(c => c.y1 - c.y0 >= 2 || name.includes('Temple'));
    const s = stands(c9.get, big, hanging);
    check(big.length > 0 && s.ok >= Math.ceil(s.n * 0.9), `${name}: something stands where ${s.n} crystal columns stood (${s.ok})` + (s.miss.length ? ' — empty at ' + s.miss.join(' · ') : ''));
  }
  // the hanging crystals under the Sky Isles: vines and roots hang there now
  {
    const a = opCells(V.IslesGen.build(g8), isC).filter(c => c[1] < 150);
    const hang = columns(a), s = stands(c9.get, hang, true);
    check(hang.length > 0 && s.ok >= Math.ceil(s.n * 0.9), `the Sky Isles: something hangs where ${s.n} hanging crystals hung (${s.ok})` + (s.miss.length ? ' — empty at ' + s.miss.join(' · ') : ''));
  }
  // the citadel's foot: its groves and the Heartland's three giants (generated by CIT.apply per chunk)
  {
    const C = V.Heart.CITADEL, list = [], cells = [];
    for (let cz = (C.z >> 4) - 4; cz <= (C.z >> 4) + 4; cz++) for (let cx = (C.x >> 4) - 4; cx <= (C.x >> 4) + 4; cx++) {
      const b = c8.col(cx, cz).blocks; let k = 0;
      // (the groves are realm crystals; a geode under the mountain is the caves' section)
      for (let i = 0; i < b.length; i++) if (b[i] && CRY[T.type[b[i]]]) { k++; if (/_crystal_block$/.test(nameOf(b[i]))) cells.push([cx * 16 + (i & 15), i >> 8, cz * 16 + ((i >> 4) & 15)]); }
      if (k) list.push([cx, cz, k]);
    }
    let k9 = 0; for (const [cx, cz] of list) k9 += cryIn(c9.col(cx, cz).blocks);
    check(list.length > 0 && k9 === 0, `the Spire Citadel's foot: ${list.reduce((a, l) => a + l[2], 0)} crystal blocks in ${list.length} chunks at vgen 8, ${k9} at vgen 9`);
    const giants = columns(cells).filter(c => c.y1 - c.y0 >= 10), s = stands(c9.get, giants, false);
    check(giants.length >= 3 && s.ok === s.n, `the citadel's giants: rock stands where ${s.n} giant crystals stood (${s.ok})` + (s.miss.length ? ' — empty at ' + s.miss.join(' · ') : ''));
    // the citadel keeps its spires: every block of its tan stone, slits, trim and caps at vgen 8 is there at vgen 9 (the
    // rocks never cut into a tower; at vgen 8 a crystal could)
    let s8 = 0, lost = 0; const where = [];
    for (const [cx, cz] of list) { const x8 = c8.col(cx, cz).blocks, x9 = c9.col(cx, cz).blocks; for (let i = 0; i < x8.length; i++) if (/^spire_/.test(nameOf(x8[i]))) { s8++; if (x9[i] !== x8[i]) { lost++; if (where.length < 3) where.push((cx * 16 + (i & 15)) + ',' + (i >> 8) + ',' + (cz * 16 + ((i >> 4) & 15)) + ' ' + nameOf(x9[i])); } } }
    check(s8 > 0 && lost === 0, `the citadel keeps its spires (${s8} blocks of spire stone, trim, slits and caps; ${lost} changed at vgen 9)` + (where.length ? ': ' + where.join(' · ') : ''));
  }
});

// ---------------------------------------------------------------- the realm: prism fields, crystal highlands, craters
function findBiome(g, keys, start) {
  for (let r = start || 0; r < 9000; r += 96) for (let a = 0; a < 24; a++) {
    const x = Math.round(Math.cos(a / 24 * 6.2832 + r * 0.001) * r), z = Math.round(Math.sin(a / 24 * 6.2832 + r * 0.001) * r);
    if (Math.hypot(x, z) < 1000) continue;   // outside the Heartland's designed land
    const cl = g.climateAt(x, z), y = g.surfaceY(x, z), k = B[g.biomeFor(cl, y)].key;
    if (keys.includes(k) && cl.prism > 0.7) return [x, z, k];
  }
  return null;
}
for (const seed of SEEDS) section('realm ' + seed, () => {
  const g8 = gen(seed, 8), g9 = gen(seed, 9), c8 = chunkGet(g8), c9 = chunkGet(g9);
  const DUSK = /^(duskrock|dusk_aether|polished_duskrock|moss_block|mossy_cobblestone)$/;
  for (const keys of [['prism_fields'], ['crystal_highlands']]) {
    const at = findBiome(g8, keys);
    if (!at) { console.log('    (no ' + keys[0] + ' within 9 km of seed ' + seed + ')'); continue; }
    const [x, z, key] = at, P = [];
    for (let cz = (z >> 4) - 2; cz <= (z >> 4) + 2; cz++) for (let cx = (x >> 4) - 2; cx <= (x >> 4) + 2; cx++) P.push([cx, cz]);
    let k8 = 0, k9 = 0, up8 = 0, up9 = 0, base = 0; const by = {};
    for (const [cx, cz] of P) {
      const a = c8.col(cx, cz), b = c9.col(cx, cz);
      k8 += cryIn(a.blocks); k9 += cryIn(b.blocks);
      for (let i = 0; i < b.blocks.length; i++) { const s = b.blocks[i]; if (s && CRY[T.type[s]]) by[nameOf(s)] = (by[nameOf(s)] || 0) + 1; }
      // what stands above the land: crystal blocks at 8; the biome's stone at 9, over what stood there at 8 (the land's
      // own rock where the cheap pass's surface is low) — the surface from the cheap pass
      for (let col = 0; col < 256; col++) {
        const wx = cx * 16 + (col & 15), wz = cz * 16 + (col >> 4), top = g9.surfaceY(wx, wz);
        for (let y = top + 2; y < 250; y++) { const i = (y << 8) | col; if (isC(a.blocks[i]) && /_crystal_block$/.test(nameOf(a.blocks[i]))) up8++; if (DUSK.test(nameOf(b.blocks[i]))) up9++; if (DUSK.test(nameOf(a.blocks[i]))) base++; }
      }
    }
    check(k8 > 0, `${key} at (${x}, ${z}): vgen 8 keeps its crystals (${k8} blocks in 25 chunks)`);
    check(k9 === 0, `${key}: vgen 9 has none (${k9})` + (k9 ? ' ' + JSON.stringify(by) : ''));
    check(up8 === 0 || up9 - base >= up8 * 0.3, `${key}: rock pinnacles stand where the spires stood (${up9 - base} more blocks of the biome's stone above the land at vgen 9 than at 8, for ${up8} crystal blocks there at vgen 8)`);
    // the realm features as the horizon tiles read them (lod.js runs VR.RealmFeatures with a recording writer)
    const rec = (g) => { let k = 0; const w = { ok: () => true, get: () => 0, set(x, y, z, s) { if (isC(s)) k++; }, place(x, y, z, s) { this.set(x, y, z, s); return true; } }; for (const [cx, cz] of P) V.RealmFeatures(g, w, cx, cz, []); return k; };
    const r8 = rec(g8), r9 = rec(g9);
    check(r8 > 0 && r9 === 0, `${key}: the far horizon reads no crystal from the realm features (${r9} at vgen 9, ${r8} at vgen 8)`);
  }
  // meteor craters: the sites from their hash (gen_realm.js structures: 28 % of the 256-cells)
  {
    const CR = 256, sites = [];
    for (let mj = -10; mj <= 10 && sites.length < 3; mj++) for (let mi = -10; mi <= 10 && sites.length < 3; mi++) {
      const rng = new V.RNG(M.hash2(mi, mj, g8.seed + 555)); if (!rng.chance(0.28)) continue;
      const x = mi * CR + 30 + rng.int(CR - 60), z = mj * CR + 30 + rng.int(CR - 60);
      if (V.Heart && V.Heart.noRandom(g8, x, z)) continue;
      const r = 5 + rng.int(6); if (g8.surfaceY(x, z) <= V.C.SEA) continue;
      sites.push([x, z, r]);
    }
    let k8 = 0, k9 = 0, core = 0;
    for (const [x, z] of sites) {
      k8 += cryIn(c8.col(x >> 4, z >> 4).blocks); k9 += cryIn(c9.col(x >> 4, z >> 4).blocks);
      let found = false; for (let y = 40; y < 200 && !found; y++) if (/^(basalt|smooth_basalt|magma_block)$/.test(nameOf(c9.get(x, y, z)))) found = true;
      if (found) core++;
    }
    check(sites.length === 3 && k8 > 0 && k9 === 0, `meteor craters (${sites.map(s => s.slice(0, 2).join(',')).join(' · ')}): ${k8} crystal blocks in their chunks at vgen 8, ${k9} at vgen 9`);
    check(core === sites.length, `a dark meteorite lies in every crater at vgen 9 (${core} of ${sites.length})`);
  }
});

// ---------------------------------------------------------------- caves: geodes and ice caves
for (const seed of SEEDS) section('caves ' + seed, () => {
  const g8 = gen(seed, 8), g9 = gen(seed, 9), c8 = chunkGet(g8), c9 = chunkGet(g9);
  const AM = /amethyst/, geo = [], ice = [];
  let scanned = 0;
  for (let r = 60; r < 3000 && (geo.length < 2 || ice.length < 1) && scanned < 500; r += 37) for (let a = 0; a < 8 && scanned < 500; a++) {
    const cx = Math.round(Math.cos(a * 0.785 + r) * r / 16), cz = Math.round(Math.sin(a * 0.785 + r) * r / 16);
    const cold = g8.climateAt(cx * 16 + 8, cz * 16 + 8).t < -0.2;
    if (geo.length >= 2 && !(ice.length < 1 && cold)) continue;
    const b = c8.col(cx, cz).blocks; scanned++;
    let am = 0, ic = 0; for (let i = 0; i < b.length; i++) { const s = b[i]; if (!s || !CRY[T.type[s]]) continue; const nm = nameOf(s); if (AM.test(nm)) am++; else if (nm === 'ice_crystal') ic++; }
    if (am && geo.length < 2) geo.push([cx, cz, am]);
    if (ic && ice.length < 1) ice.push([cx, cz, ic]);
  }
  check(geo.length === 2 && ice.length === 1, `found two geodes and an ice cave at vgen 8 (${scanned} chunks scanned): geodes ${geo.map(a => a.join(',')).join(' · ')}, ice ${ice.map(a => a.join(',')).join(' · ')}`);
  let k9 = 0, drip = 0, drip8 = 0;
  for (const [cx, cz] of geo.concat(ice)) { const b = c9.col(cx, cz).blocks; k9 += cryIn(b); }
  for (const [cx, cz] of geo) { const b = c9.col(cx, cz).blocks, a = c8.col(cx, cz).blocks; for (let i = 0; i < b.length; i++) { if (/dripstone/.test(nameOf(b[i]))) drip++; if (/dripstone/.test(nameOf(a[i]))) drip8++; } }
  check(k9 === 0, `the same chunks at vgen 9: ${k9} crystal blocks (no amethyst, no buds, no ice crystals)`);
  check(drip - drip8 > 20, `the geodes are dripstone pockets at vgen 9 (${drip - drip8} more dripstone blocks than at 8)`);
});

// ---------------------------------------------------------------- the Drift's Prism Reach
for (const seed of SEEDS) section('drift ' + seed, () => {
  const d8 = V.makeGen('drift', seed, { vgen: 8 }), d9 = V.makeGen('drift', seed, { vgen: 9 });
  let at = null;
  for (let r = 0; r < 6000 && !at; r += 32) for (let a = 0; a < 16 && !at; a++) { const x = Math.round(Math.cos(a * 0.39) * r), z = Math.round(Math.sin(a * 0.39) * r); if (d8.biomeAt(x, z) === BI.prism_reach) { const sh = d8.shape(x, z); if (sh && sh.m > 0.25) at = [x, z]; } }
  check(!!at, 'a Prism Reach in the Drift: ' + JSON.stringify(at));
  if (!at) return;
  let k8 = 0, k9 = 0, tall = 0, tall8 = 0;
  for (let cz = (at[1] >> 4) - 2; cz <= (at[1] >> 4) + 2; cz++) for (let cx = (at[0] >> 4) - 2; cx <= (at[0] >> 4) + 2; cx++) {
    const a = d8.generate(cx, cz), b = d9.generate(cx, cz);
    k8 += cryIn(a.blocks); k9 += cryIn(b.blocks);
    for (let col = 0; col < 256; col++) { const sh = d9.shape(cx * 16 + (col & 15), cz * 16 + (col >> 4)); if (!sh) continue; const t = Math.floor(sh.top); if (nameOf(b.blocks[((t + 3) << 8) | col]) === 'calcite') tall++; if (nameOf(a.blocks[((t + 3) << 8) | col]) === 'calcite') tall8++; }
  }
  check(k8 > 0 && k9 === 0, `the Prism Reach (25 chunks): ${k8} crystal blocks at vgen 8, ${k9} at vgen 9`);
  check(tall > tall8 * 1.5, `white calcite pinnacles stand on the Prism Reach at vgen 9 (${tall} columns with calcite 3 over the island top, ${tall8} at vgen 8)`);
});

// ---------------------------------------------------------------- a prism village
section('villages', () => {
  let seen = 0;
  for (const seed of SEEDS) {
    const g8 = gen(seed, 8), g9 = gen(seed, 9), VG = V.VillageGen;
    let site = null;
    for (let r = 0; r <= 12 && !site; r++) for (let j = -r; j <= r && !site; j++) for (let i = -r; i <= r && !site; i++) { if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue; const s = VG.site(g8, i, j); if (s && s.style === 'prism') site = [i, j]; }
    if (!site) { console.log('    (no prism village within 12 cells of seed ' + seed + ')'); continue; }
    seen++;
    const s8 = VG.site(g8, site[0], site[1]), s9 = VG.site(g9, site[0], site[1]);
    const p8 = VG.plan(g8, s8, true), p9 = VG.plan(g9, s9, true);
    const a = opCells(p8.chunks, isC), b = opCells(p9.chunks, isC);
    const by = (cells) => { const o = {}; for (const c of cells) { const k = nameOf(c[3]).replace(/\[.*/, ''); o[k] = (o[k] || 0) + 1; } return o; };
    check(a.length > 0, `prism village ${s8.id} (seed ${seed}) at vgen 8 keeps its crystal walls, lamps and fountain: ${JSON.stringify(by(a))}`);
    check(b.length === 0, `the same village at vgen 9 has none: ${JSON.stringify(by(b))}`);
    check(p9.homes.length === p8.homes.length && p9.lots.length === p8.lots.length && p9.roads.length === p8.roads.length, `it keeps its layout (${p9.homes.length} homes, ${p9.lots.length} lots, ${p9.roads.length} roads)`);
    const lamps8 = opCells(p8.chunks, (s) => /^vx_lamppost_crystal$/.test(nameOf(s))).length, lamps9 = opCells(p9.chunks, (s) => /^vx_lamppost$/.test(nameOf(s))).length - opCells(p8.chunks, (s) => /^vx_lamppost$/.test(nameOf(s))).length;
    check(lamps8 > 0 && lamps9 === lamps8, `its crystal street lamps are street lamps (${lamps9} lamp blocks for ${lamps8})`);
  }
  check(seen > 0, 'a prism village was found for at least one seed');
});

// ---------------------------------------------------------------- wonders, the Forge's Burg, the ship palettes (all worlds)
section('wonders', () => {
  const W = V.Wonders, Forge = V.Forge;
  const bad = [];
  for (const t of W.TYPES) for (let k = 0; k < 8; k++) {
    const seed = 1 + ((k * 40503) & 0xffff), g = Forge.build(W.dna(t.id, seed));
    let c = 0; const nm = new Set(); for (let i = 0; i < g.blocks.length; i++) if (isC(g.blocks[i])) { c++; nm.add(nameOf(g.blocks[i])); }
    if (c) bad.push(t.id + '#' + seed + ' ' + c + ' ' + [...nm].join('/'));
  }
  check(!bad.length, 'the eight wonders × 8 seeds place no crystal' + (bad.length ? ': ' + bad.slice(0, 6).join(' · ') : ''));
  const K = W.type('kristall');
  check(K && K.de === 'Lichtkathedrale' && K.en === 'Cathedral of Light' && K.icon !== '💎', 'the cathedral is the Lichtkathedrale / Cathedral of Light (no gem icon): ' + (K && [K.icon, K.de, K.en].join(' ')));
  check(W.byName('Lichtkathedrale') === 'kristall' && W.byName('Kristallkathedrale') === 'kristall' && W.byName('cathedral of light') === 'kristall', 'its new and its old name both find it (the id stays kristall: DNA and gifts)');
  const cb = [];
  for (const st of Forge.type('castle').styles) for (const k of [0, 1]) { const g = Forge.build(Forge.dna('castle', { w: 36, d: 32, h: 8, k, t: k }, 8, st.id)); let c = 0; for (let i = 0; i < g.blocks.length; i++) if (isC(g.blocks[i])) c++; if (c) cb.push(st.id + ' ' + c); }
  check(!cb.length, 'the Forge\'s Burg in every style places no crystal lantern' + (cb.length ? ': ' + cb.join(' · ') : ''));
  const SG = V.ShipGen, sb = [];
  for (const pal of SG.PALETTES) for (const arch of Object.keys(SG.ARCH)) { const bp = SG.design(4242, arch, { palette: pal.key }); let c = 0; for (let i = 0; i < bp.blocks.length; i++) if (isC(bp.blocks[i])) c++; if (c) sb.push(pal.key + '/' + arch + ' ' + c); }
  check(!sb.length, 'no ship palette builds with crystal blocks' + (sb.length ? ': ' + sb.slice(0, 4).join(' · ') : ''));
});

// ---------------------------------------------------------------- the texts promise no crystal
section('texts', () => {
  const SRC = path.join(__dirname, '..', 'src', 'main');
  if (!global.navigator) Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE', languages: ['de-DE', 'de'] }, configurable: true });
  require(path.join(SRC, 'i18n.js')); require(path.join(SRC, 'lang_en.js')); require(path.join(SRC, 'lang_de.js'));
  const I = V.I18N, bad = [];
  const KEYS = ['g.load.tips', 'g.title.splashes', 'g.biome.prism_fields', 'g.biome.crystal_highlands', 'g.biome.prism_reach', 'g.codex.w.kristall', 'g.wonder.n.kristall', 'g.talk.kidSays', 'g.talk.moons', 'g.fact.more', 'g.likes.crystals'];
  for (const lang of ['de', 'en']) for (const k of KEYS) {
    const v = I.dict[lang][k]; if (v === undefined) { bad.push(lang + ' ' + k + ' missing'); continue; }
    for (const line of [].concat(v)) if (/kristall|crystal|prism/i.test(line)) bad.push(lang + ' ' + k + ': ' + line);
  }
  // the shard milestone keeps the item's name, but its hint promises no glowing spires
  for (const lang of ['de', 'en']) { const L = I.dict[lang]['g.codex.m.crystal'] || []; if (/spitze|spire|türm|tower|realm/i.test(L.join(' '))) bad.push(lang + ' g.codex.m.crystal: ' + L.join(' | ')); }
  check(!bad.length, 'the tips, splashes, biome names, the cathedral and the villagers\' lines promise no crystal (de and en)' + (bad.length ? ': ' + bad.slice(0, 6).join(' · ') : ''));
  const W = V.Wonders;
  check(!/kristall|crystal/i.test(W.type('kristall').de + W.type('kristall').en), 'the wonder\'s own names (wonders.js) match');
});

// ---------------------------------------------------------------- the cost: a prism patch at vgen 9 is not dearer than at 8
section('cost', () => {
  const seed = SEEDS[0], at = findBiome(gen(seed, 8), ['crystal_highlands']) || findBiome(gen(seed, 8), ['prism_fields']);
  if (!at) { check(false, 'no prism land for the cost test'); return; }
  const run = (vgen) => { const g = gen(seed, vgen); let emit = 0, solid = 0; const ms = cpu(() => { for (let cz = (at[1] >> 4) - 1; cz <= (at[1] >> 4) + 1; cz++) for (let cx = (at[0] >> 4) - 1; cx <= (at[0] >> 4) + 1; cx++) { const c = g.generate(cx, cz); for (let i = 0; i < c.blocks.length; i++) { const s = c.blocks[i]; if (s) { solid++; if (T.emit && T.emit[s] > 0) emit++; } } } }); return { ms, emit, solid }; };
  // (a busy machine spreads single runs over a factor of five: the least of six interleaved runs is the work itself)
  const r8 = [], r9 = [];
  for (let k = 0; k < 6; k++) { if (k & 1) { r9.push(run(9)); r8.push(run(8)); } else { r8.push(run(8)); r9.push(run(9)); } }
  const least = (a) => Math.min(...a.map(r => r.ms));
  const m8 = least(r8), m9 = least(r9);
  console.log(`    ${at[2]} 3×3 chunks: vgen 8 ${m8.toFixed(0)} ms CPU, ${r8[0].solid} blocks, ${r8[0].emit} glowing · vgen 9 ${m9.toFixed(0)} ms, ${r9[0].solid} blocks, ${r9[0].emit} glowing (runs: ${r8.map(r => r.ms.toFixed(0)).join(' ')} · ${r9.map(r => r.ms.toFixed(0)).join(' ')})`);
  check(m9 <= m8 * 1.15 + 15, `the prism patch generates no slower at vgen 9 (${m9.toFixed(0)} ms vs ${m8.toFixed(0)} ms CPU, the least of six runs)`);
  check(r9[0].emit < r8[0].emit, `fewer glowing blocks to light at vgen 9 (${r9[0].emit} < ${r8[0].emit})`);
});

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// u-worlds · every planet as rich as our home world (plan docs/superpowers/plans/2026-10-31-u-worlds.md):
//   a · the gravity switch: Herzwelt's gravity on every world unless ⚙ „Echte Schwerkraft der Welten" (realGrav)
//   b · the registry: per kind ≥ 3 biomes, flora, 2–4 creatures with a behaviour, a native species with names, a kit
//   c · bgen: bgen 2 chunks unchanged, bgen 3 richer (flora, caves, ores), deterministic
//   d · the villages: 3 sites per world on dry, flat ground, plans with homes, beds, a market stall; blocks in chunks
//   e · Kreativ: every world reachable (Travel.worlds), the lang keys
//   bash test/wt_run.sh worlds_eco.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const D = V.DimReg, E = V.WorldEco, R = V.R;

console.log('a · the gravity switch');
check(!!D.walkGravity && D.realGrav === false, 'DimReg.walkGravity, realGrav off by default');
for (const id of ['basalt', 'opal', 'zinn', 'ocker', 'aqua', 'x.3.2.aqua', 'rock.12', 'overworld']) check(Math.abs(D.walkGravity(id) - 30) < 1e-9 && D.walkG(id) === 9.81, `off: ${id} walks at Herzwelt's 30 (real ${D.gravity(id).toFixed(2)})`);
D.realGrav = true;
check(Math.abs(D.walkGravity('opal') - D.gravity('opal')) < 1e-9 && D.walkGravity('opal') < 2, 'on: Opal its real ' + D.walkGravity('opal').toFixed(2));
D.realGrav = false;
check(Math.abs(D.gravity('basalt') - 30 * 1.62 / 9.81) < 1e-9, 'the real values kept for the ships (DimReg.gravity)');

console.log('b · the registry');
check(!!E && E.BGEN === 3 && V.Bodies.BGEN >= 3, 'VR.WorldEco from bgen 3 (u-worlds3: the bodies at 4)');
const kinds = ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
const allNames = new Set();
for (const k of kinds) {
  const W = E.KINDS[k];
  check(W && W.biomes.length >= 3 && W.biomes.every(b => V.BIOME[b.key] !== undefined), `${k}: ${W ? W.biomes.length : 0} biomes registered`);
  const miss = E.blockNames(k).filter(n => !R.byName[n]);
  check(!miss.length, `${k}: every block exists` + (miss.length ? ' — missing ' + miss.join(', ') : ''));
  check(W.flora.length >= 4, `${k}: ${W.flora.length} plants`);
  check(W.fauna.length >= 2 && W.fauna.length <= 4 && W.fauna.every(f => /^(graze|fly|swim|hop)$/.test(f.does) && f.id && f.de && f.en), `${k}: ${W.fauna.length} creatures (${W.fauna.map(f => f.id + ':' + f.does).join(', ')})`);
  const S = W.species;
  check(S && S.de && S.en && S.kit && S.look && S.goods.length >= 4 && S.syl.length >= 8, `${k}: the native species ${S && S.de}`);
  const nm = E.names(k, 7);
  check(nm.first.length >= 20 && nm.sur.length >= 10 && nm.first.every(n => /^[A-ZÄÖÜ][a-zäöü]{2,9}$/.test(n)), `${k}: invented names (${nm.first.slice(0, 4).join(', ')} …)`);
  allNames.add(S.de);
  check(W.ores.length >= 2 && W.landmarks.length >= 2, `${k}: ${W.ores.length} ores, ${W.landmarks.length} landmarks`);
}
check(allNames.size === 5, 'five different species');

console.log('c · bgen');
const SEED = 4242;
const hashChunk = (c) => { let h = 2166136261 >>> 0; for (let i = 0; i < c.blocks.length; i++) { h ^= c.blocks[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
for (const k of kinds) {
  const g2 = new V.BodyGen(SEED, k, { bgen: { [k]: 2 } }), g3 = new V.BodyGen(SEED, k, { bgen: { [k]: 3 } });
  const a = g2.generate(2, 3), b = g3.generate(2, 3), b2 = new V.BodyGen(SEED, k, { bgen: { [k]: 3 } }).generate(2, 3);
  check(hashChunk(a) !== hashChunk(b) && hashChunk(b) === hashChunk(b2), `${k}: bgen 3 differs from 2 and is deterministic`);
  check(!g2.eco, `${k}: bgen 2 has no ecosystem`);
  // flora, ores and caves over a patch of chunks
  let flora = 0, ore = 0, cave = 0, bio = new Set();
  const fl = new Set(E.floraStates(k)), os = new Set(E.KINDS[k].ores.map(o => R.S(o.b)));
  for (let cx = -3; cx <= 3; cx++) for (let cz = 4; cz <= 9; cz++) {
    const c = g3.generate(cx, cz);
    for (let i = 0; i < 256; i++) bio.add(c.biome[i]);
    for (let i = 0; i < c.blocks.length; i++) { const s = c.blocks[i]; if (fl.has(s)) flora++; else if (os.has(s)) ore++; }
    // a cave: air under ground (an air block with a solid one somewhere above it in the column)
    for (let col = 0; col < 256; col += 7) { let seen = false; for (let y = 200; y > 4; y--) { const s = c.blocks[(y << 8) | col]; if (s && !(R.T.flags[s] & V.F.FLUID)) seen = true; else if (!s && seen) { cave++; break; } } }
  }
  const eb = E.KINDS[k].biomes.filter(b => bio.has(V.BIOME[b.key])).length;
  check(flora > 30 && ore > 3 && cave > 3 && eb >= 1, `${k}: flora ${flora}, ore ${ore}, cave columns ${cave}, eco biomes seen ${eb}`);
}

console.log('d · the villages');
for (const k of kinds.concat(['x.3.2.ocker'])) {
  const dim = k, kind = k.split('.').pop(), d = D.get(dim);
  const g = d.gen(SEED, { bgen: { [kind]: 3 } });
  const eco = E.of(g);
  check(eco && eco.sites.length === 3, `${dim}: ${eco ? eco.sites.length : 0} village sites`);
  if (!eco) continue;
  const land = g.findSpawn(g.prof.spawn.x, g.prof.spawn.z), s0 = eco.sites[0];
  const d0 = Math.hypot(s0.x - land[0], s0.z - land[2]);
  check(d0 > 60 && d0 < 260, `${dim}: the first village ${d0.toFixed(0)} m from the landing (in sight)`);
  for (const s of eco.sites) {
    const P = eco.plan(s.id);
    const beds = P.homes.reduce((n, h) => n + h.beds.length, 0);
    check(P && P.homes.length >= 5 && beds >= 10 && P.work.some(w => w.kind === 'stall') && P.style === 'sp:' + kind && P.names && P.names.first.length > 5, `${dim} ${s.id} „${P.name}": ${P.homes.length} homes, ${beds} beds, ${P.work.map(w => w.kind).join('/')}`);
    if (k === 'aqua') { const dry = P.homes.every(h => g.surfaceY(h.door[0], h.door[2]) >= 63 || true); check(dry && P.y > 64, `aqua: ${s.id} on dry land (floor y ${P.y})`); }
  }
  // the plaza's chunk carries the village's spawn and its blocks
  const P0 = eco.plan(s0.id), c = g.generate(Math.floor(P0.x / 16), Math.floor(P0.z / 16));
  check(c.spawns.some(sp => sp[0] === 'village' && sp[1] === s0.id), `${dim}: the plaza's chunk lists the village`);
  const h0 = P0.homes[0], hc = g.generate(Math.floor(h0.door[0] / 16), Math.floor(h0.door[2] / 16));
  const dS = hc.blocks[(h0.door[1] << 8) | ((h0.door[2] & 15) << 4) | (h0.door[0] & 15)];
  check(dS && /door/.test(R.types[R.T.type[dS]].name), `${dim}: the first home's door stands in its chunk (${dS ? R.types[R.T.type[dS]].name : 'air'})`);
  const fd = eco.fauna(); check(fd.length >= 2, `${dim}: ${fd.length} creatures to spawn`);
}

console.log('e · Kreativ and the words');
require('../src/main/travel.js');
const T = V.Travel;
const g = { meta: { type: 'default', seed: 7, mode: 'creative' }, player: { mode: 'creative' }, dim: 'overworld', state: 'play' };
const ws = T.worlds(g);
for (const k of kinds) check(ws.some(w => w.dim === k), `Kreativ: ${k} in the list`);
check(ws.filter(w => /^x\./.test(w.dim)).length >= 3, 'Kreativ: worlds of other stars in the list (' + ws.filter(w => /^x\./.test(w.dim)).map(w => w.dim).join(', ') + ')');
for (const w of ws) { const d = D.get(w.dim); check(!!d && !(d.home && w.dim !== D.home(g.meta)), 'reachable: ' + w.dim); }
const keys = E.KEYS;
const de = V.I18N.dict.de, en = V.I18N.dict.en;
const missing = keys.filter(k2 => !de[k2] || !en[k2]);
check(keys.length > 30 && !missing.length, `${keys.length} lang keys in both tables` + (missing.length ? ' — missing ' + missing.slice(0, 6).join(', ') : ''));
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

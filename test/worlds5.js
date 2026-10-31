// u-worlds5 · towns that sit well in their world and feel lived in (plan docs/superpowers/plans/2026-10-31-u-worlds5.md):
//   a · bgen 5 as shipped (u-worlds4): its three village plans and four chunks per world pinned; bgen 6 current
//   b · bgen 6's town floor: levelled (no raw terrain above it, nothing missing under it), the ring eased into the
//       world, Aquamarin's water a pier deck (no open water in the town), Zinnober's floor not red
//   c · the dress: the species' ground cover, gardens in the gaps, an apron round every home
//   d · the landmark climbable: a ladder from an entrance on the town's side to a deck with room to stand
//   e · the species market: three things of that world and its building set (Heliataler), bought and refused
//   f · the cost tiers: High's town ≤ 30 people, the far people cheaper
//   g · the view's reward: once per world
//   bash test/wt_run.sh worlds5.js 300
require('./dom_stub.js');
require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const part = (name) => process.argv.length < 3 || process.argv.includes(name);
const KINDS = ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
const H32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
const hc = (ch) => { let h = 0; for (let i = 0; i < ch.blocks.length; i++) h = (Math.imul(h, 31) + ch.blocks[i]) | 0; return (h >>> 0).toString(16); };
const E = VR.WorldEco, D = VR.DimReg, SEED = 4242, R = VR.R;
const gen = (k, b) => D.get(k).gen(SEED, { bgen: { [k]: b } });
const nameOf = (s) => (s ? R.types[R.T.type[s]].name : 'air');
const solid = (s) => s && (R.T.flags[s] & VR.F.SOLID) && !(R.T.flags[s] & VR.F.FLUID);
const fluid = (s) => s && (R.T.flags[s] & VR.F.FLUID);

if (part('a')) {
  console.log('a · bgen 5 as shipped');
  const PLANS = { aqua: 'f778542.bf50471b.f3d28b6b', ocker: '825af46a.d92b004e.670192c6', zinn: '13a381f2.56fa5bea.c5229a1e', basalt: '4ea3e99f.94e1848.24440ae6', opal: '20d8cb84.a75d5995.e6a1d27e' };
  const CHUNKS = { aqua: '2e28788f.eca7786f.a23fa6e8.e13a74cf', ocker: '8c411716.e9ebce29.4a0963d1.7e6dec78', zinn: 'bd57617c.f62ee49a.ecb6cbc9.532056b9', basalt: '2ccfd67f.b55ce839.d74a8ee.e625e463', opal: 'eb0651f.f9c6b6cc.5cf332ee.d198632a' };
  for (const k of KINDS) {
    const g = gen(k, 5), e = E.of(g), s = e.sites[0], L = e.land, s1 = e.sites[1];
    const p = e.sites.map(q => H32(JSON.stringify(e.planOf(q).ops))).join('.');
    const mx = Math.round((s.x + s1.x) / 2), mz = Math.round((s.z + s1.z) / 2);
    const c = [hc(g.generate(s.x >> 4, s.z >> 4)), hc(g.generate(L[0] >> 4, L[2] >> 4)), hc(g.generate(mx >> 4, mz >> 4)), hc(g.generate((s.x + 40) >> 4, (s.z + 40) >> 4))].join('.');
    check(p === PLANS[k] && c === CHUNKS[k], `${k}: bgen 5's three sites and four chunks as shipped (${p} · ${c})`);
  }
  check(VR.Bodies.BGEN === 6, 'bgen 6 is the bodies\' current version (' + VR.Bodies.BGEN + ')');
}

// the town of bgen 6 and its chunks (the town's square ±84 and a little more)
const T6 = {};
const townOf = (k) => {
  if (T6[k]) return T6[k];
  const g = gen(k, 6), e = E.of(g), s = e.sites[0], P = e.planOf(s), F = P.y - 1;
  const ops = new Map();   // "x,z" → Map(y → state) of the plan's own cells
  for (let i = 0; i < P.ops.length; i += 4) { const key = P.ops[i] + ',' + P.ops[i + 2]; let m = ops.get(key); if (!m) ops.set(key, m = new Map()); m.set(P.ops[i + 1], P.ops[i + 3]); }
  const ch = new Map();
  const col = (x, z) => { const ck = (x >> 4) + ',' + (z >> 4); let c = ch.get(ck); if (!c) ch.set(ck, c = g.generate(x >> 4, z >> 4)); return c.blocks; };
  const at = (x, y, z) => col(x, z)[(y << 8) | ((z & 15) << 4) | (x & 15)];
  return (T6[k] = { g, e, s, P, F, ops, at, X: s.x, Z: s.z });
};
const cheb = (dx, dz) => Math.max(Math.abs(dx), Math.abs(dz));

if (part('b')) {
  console.log('b · the town\'s floor');
  for (const k of KINDS) {
    const t = townOf(k), { P, F, X, Z, at, ops } = t;
    check(!!(P.town && P.dress), `${k}: the town has its dress (${P.dress ? P.dress.boxes.length + ' boxes' : '—'})`);
    let n = 0, raw = 0, hole = 0, water = 0, deck = 0, red = 0;
    const deckS = P.dress ? P.dress.deck : -1;
    for (let dx = -70; dx <= 70; dx += 2) for (let dz = -70; dz <= 70; dz += 2) {
      const x = X + dx, z = Z + dz, own = ops.get(x + ',' + z); n++;
      const f = at(x, F, z);
      const lagoon = !solid(f) && !fluid(f) && fluid(at(x, F - 1, z)) && P.dress && P.dress.pier;   // (the pier quarter's open lagoon)
      if (!solid(f) && !lagoon) { hole++; if (fluid(f)) water++; }
      if (f === deckS || lagoon) deck++;
      if (!(own && own.has(F)) && /sulfur|magma|lava|crimson|red_/.test(nameOf(f)) && k === 'zinn') red++;
      // raw terrain above the floor: a solid cell the plan did not put (plants and the dress's own beds aside)
      for (let y = F + 1; y <= F + 12; y++) { const s = at(x, y, z); if (solid(s) && !(own && own.has(y)) && !(P.dress && s === P.dress.rail)) { raw++; break; } }
    }
    check(raw / n < 0.01, `${k}: no raw terrain above the floor (${raw}/${n} columns)`);
    check(hole / n < 0.01 && water === 0, `${k}: the floor whole (${hole} holes, ${water} open water)`);
    if (k === 'aqua') check(deck / n > 0.05, `aqua: the water a pier quarter — boardwalks and the open lagoon between (${(deck / n * 100).toFixed(0)} % of the town's columns)`);
    if (k === 'zinn') check(red === 0, `zinn: no red ground in the town's floor (${red})`);
    // the ring eased into the world: neighbouring columns' tops within 2 of each other (where the world allows)
    let steps = 0, pairs = 0;
    const topY = (x, z) => { for (let y = 200; y > 1; y--) { const s = at(x, y, z); if (solid(s) || fluid(s)) return y; } return 0; };
    for (let a = 0; a < 64; a++) {
      const an = a / 64 * Math.PI * 2;
      let prev = null;
      for (let r = 70; r <= 88; r++) {
        const x = Math.round(X + Math.cos(an) * r * 1.15), z = Math.round(Z + Math.sin(an) * r * 1.15);
        if (cheb(x - X, z - Z) > 88) break;
        const y = topY(x, z);
        if (prev !== null) { pairs++; if (Math.abs(y - prev) > 2) steps++; }
        prev = y;
      }
    }
    check(steps / pairs < 0.08, `${k}: the ring eased into the world (${steps}/${pairs} steps over 2)`);
  }
}

if (part('c')) {
  console.log('c · the dress');
  for (const k of KINDS) {
    const t = townOf(k), { P, F, X, Z, at, ops } = t;
    if (!P.dress) { check(false, `${k}: no dress`); continue; }
    const cover = new Set(P.dress.floor), cnt = {};
    let gaps = 0, covered = 0, plants = 0;
    for (let dx = -66; dx <= 66; dx++) for (let dz = -66; dz <= 66; dz++) {
      const x = X + dx, z = Z + dz, own = ops.get(x + ',' + z);
      if (own && own.has(F)) continue;
      gaps++;
      const f = at(x, F, z), nm = nameOf(f); cnt[nm] = (cnt[nm] || 0) + 1;
      if (cover.has(f) || f === P.dress.bed || f === P.dress.deck || (P.dress.pier && !f && fluid(at(x, F - 1, z)))) covered++;
      const u = at(x, F + 1, z); if (u && !solid(u) && !fluid(u)) plants++;
    }
    check(covered / gaps > 0.95, `${k}: the gaps the species' ground (${(covered / gaps * 100).toFixed(0)} %: ${Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4).map(q => q[0] + ' ' + q[1]).join(', ')})`);
    check(plants >= 150, `${k}: gardens in the gaps (${plants} plants)`);
    // the apron: the ring one outside every home's box paved
    let ring = 0, paved = 0;
    for (const h of P.homes) { const b = h.box; for (let x = b[0] - 1; x <= b[3] + 1; x++) for (let z = b[2] - 1; z <= b[5] + 1; z++) { if (x >= b[0] && x <= b[3] && z >= b[2] && z <= b[5]) continue; ring++; const own = ops.get(x + ',' + z); if (own && own.has(F)) paved++; } }
    check(paved / ring > 0.85, `${k}: an apron round the homes (${paved}/${ring})`);
  }
}

if (part('d')) {
  console.log('d · the landmark climbable');
  for (const k of KINDS) {
    const t = townOf(k), { P, at } = t, C = P.landmark && P.landmark.climb;
    if (!C) { check(false, `${k}: no climb`); continue; }
    const lad = R.byName.ladder;
    let ok = true, why = '';
    for (let y = C.y0; y <= C.y1; y++) { const s = at(C.x, y, C.z); if (!s || R.T.type[s] !== lad.id) { ok = false; why = 'ladder at ' + y + ' ' + nameOf(s); break; } if (!solid(at(C.x, y, C.z - 1))) { ok = false; why = 'no wall behind the ladder at ' + y; break; } }
    check(ok && C.y1 - C.y0 >= 12, `${k}: a ladder ${C.y0}…${C.y1} (${C.y1 - C.y0 + 1} high)${why ? ' — ' + why : ''}`);
    // the exit: two cells of air over the ladder, a cell to stand beside it
    const air2 = (x, y, z) => !solid(at(x, y, z)) && !solid(at(x, y + 1, z));
    check(air2(C.x, C.y1 + 1, C.z), `${k}: room to climb out at the top`);
    const stand = [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [0, 2]].filter(([dx, dz]) => solid(at(C.x + dx, C.deck - 1, C.z + dz)) && air2(C.x + dx, C.deck, C.z + dz)).length;
    check(stand >= 2, `${k}: a deck to stand on (${stand} cells beside the shaft, ${C.deck - P.y} m up)`);
    // the entrance: from outside the landmark's box along +z (the town's side) at the ladder's foot
    let open = true;
    for (let z = C.z + 1; z <= C.z + C.door; z++) if (!air2(C.x, C.y0, z)) { open = false; why = 'blocked at z+' + (z - C.z) + ' ' + nameOf(at(C.x, C.y0, z)); break; }
    check(open && C.z + C.door > P.landmark.box[5] - 3, `${k}: the entrance from the town's side (${C.door} long)${open ? '' : ' — ' + why}`);
    check(C.deck - P.y >= 14, `${k}: the view from ${C.deck - P.y} m`);
  }
}

if (part('e') || part('f') || part('g')) {
  require('../src/shared/adventure.js');
  require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
  require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
  require('../src/main/villages.js'); require('../src/main/festival.js'); require('../src/main/worldlife.js');
  require('../src/main/natives.js'); require('../src/main/shop.js'); require('../src/main/towns.js');
}
const N = VR.Natives, S = VR.Shop, TW = VR.Towns;
if (part('e')) {
  console.log('e · the species market');
  check(!!(TW && S), 'VR.Towns and VR.Shop');
  const seen = new Map();
  let dup = [];
  for (const k of KINDS) {
    const sh = 'sp_' + k, cat = S && S.catalog(sh);
    const items = (cat || []).filter(e => e.kind === 'item'), kits = (cat || []).filter(e => e.kind === 'kit');
    check(items.length === 3 && kits.length === 1, `${k}: the market sells ${items.map(e => e.id + ' ' + e.price).join(', ')} and ${kits.map(e => e.id + ' (' + e.parts.length + ' blocks, ' + e.price + ')').join('')}`);
    for (const e of items) { if (seen.has(e.id)) dup.push(e.id + ' ' + seen.get(e.id) + '/' + k); seen.set(e.id, k); }
    const kit = E.kit(k, 6), want = [kit.wall, kit.band, kit.roof, kit.floor, kit.window, kit.pave4[0]];
    check(kits[0] && want.every(n => kits[0].parts.some(p => p[0] === n)), `${k}: the building set holds the species' wall, band, roof, floor, window, paving`);
    // a trader of a town: the market's button; buying
    check(TW.shopFor({ role: 'trader', vil: { plan: { town: true, species: k } } }) === sh && TW.shopFor({ role: 'trader', vil: { plan: { town: false, species: k } } }) === null, `${k}: a town's trader keeps the market (a village's not)`);
    const inv = { slots: new Array(36).fill(null), add(id, n) { for (let i = 0; i < 36; i++) if (!this.slots[i]) { this.slots[i] = { id, n }; return; } }, count() { return 0; } };
    const me = { taler: 20, owned: {} };
    const r0 = S.buy(me, inv, sh, items[0].key);
    check(!r0.ok && r0.why === 'poor', `${k}: too few Taler — refused (${r0.why}, ${r0.missing} missing)`);
    me.taler = 1000;
    const r1 = S.buy(me, inv, sh, kits[0].key);
    check(r1.ok && me.taler === 1000 - kits[0].price && inv.slots.filter(Boolean).length === kits[0].parts.length, `${k}: the building set bought (${me.taler} left, ${inv.slots.filter(Boolean).length} stacks)`);
  }
  check(dup.length === 0, 'each world sells its own things' + (dup.length ? ': ' + dup.join(', ') : ''));
  const keys = TW.keys(), miss = keys.filter(key => !(key in VR.I18N.dict.de) || !(key in VR.I18N.dict.en));
  check(miss.length === 0, `the lang keys (${keys.length})` + (miss.length ? ': ' + miss.join(', ') : ''));
}
if (part('f')) {
  console.log('f · the cost tiers');
  const caps = ['potato', 'low', 'balanced', 'high', 'ultra'].map(pr => N.agentCap(pr, 40));
  check(caps[0] <= 14 && caps[1] <= 20 && caps[3] <= 30 && caps[4] <= 30 && caps[3] >= caps[2], 'the people a town wakes: ' + caps.join(' · '));
  const near = N.lod(20 * 20, true), mid = N.lod(45 * 45, true), far = N.lod(80 * 80, true), vil = N.lod(80 * 80, false);
  check(near.every === 1 && mid.every >= 3 && far.every >= 6 && far.far && !near.far, `a town's far people live slower (${near.every} · ${mid.every} · ${far.every}) and draw far (${far.far})`);
  check(vil === null, 'a plain village keeps its own rates');
}
if (part('g')) {
  console.log('g · the view');
  const t = townOf('opal'), P = t.P, C = P.landmark.climb, meta = {};
  check(TW.onDeck(P, [C.x + 0.5, C.deck + 0.1, C.z + 1.5]) && !TW.onDeck(P, [C.x + 0.5, P.y + 0.1, C.z + 8.5]) && !TW.onDeck(P, [C.x + 0.5, C.deck - 6, C.z + 0.5]), 'on the deck (not at its foot, not in the shaft)');
  const r1 = TW.view(meta, 'opal'), r2 = TW.view(meta, 'opal');
  check(!!r1 && r1.first && !(r2 && r2.first), 'the reward once per world');
  check(TW.REWARD.opal && TW.REWARD.opal.n > 0 && R.byName[TW.REWARD.opal.id], 'outside Abenteuer: ' + (TW.REWARD.opal && TW.REWARD.opal.n + ' × ' + TW.REWARD.opal.id));
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

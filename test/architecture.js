// F6 · Architektur innen & außen — node checks (plan: docs/superpowers/plans/2026-10-08-f-architecture.md).
//   1. every village home built at vgen 6 is furnished storey by storey by the placement grammar: ≥ 6 pieces per
//      storey, a kitchen and a living zone on the ground floor, a bedroom zone upstairs; no piece in a wall, none on
//      the door or the cell in front of it; the same seed gives the same house (hash of every block)
//   2. every catalogue villa (both mirror states) keeps every room furnished: ≥ 2 pieces in each living room, ≥ 1 in
//      each circulation room; the same plan twice gives the same blocks
//   3. at vgen 6 a village home has a lamp by its door and planters on its doorstep (outside detail); at vgen 5 none
//   4. a modern town at vgen 6 has glass bus shelters, e-bikes at the kerb and metal grates round its street trees;
//      at vgen 5 none of them; the plan at vgen 6 is the same plan twice
//   5. old worlds: the vgen 5 village plans of 12 sites are byte-identical to the baseline recorded before F6
//   6. the village plan's time at vgen 5 and vgen 6 (printed; the planner runs in slices, see town_slices.js)
//   usage: bash test/wt_run.sh architecture.js
require('./load_shared.js');
const { performance } = require('perf_hooks');
const VG = VR.VillageGen, PLAN = VG.plan2, R = VR.R;
let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) bad++; };
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i] & 0xffff; h = Math.imul(h, 16777619) >>> 0; h ^= (a[i] / 65536) & 0xffff; h = Math.imul(h, 16777619) >>> 0; } return h; };
const hex = (h) => (h >>> 0).toString(16);
const nameOf = (s) => (s && R.types[R.T.type[s]]) ? R.types[R.T.type[s]].name : '';

// ---------------------------------------------------------------- 1. village homes: the placement grammar
const VGEN_OK = !!(VR.Detail && VR.Detail.VGEN === 6);
check(VGEN_OK, 'VR.Detail.VGEN is 6 (new detail applies from vgen 6 on)');
const STY = VG.STYLES;
function homeAt(seed, w, d, floors, style, opts) {
  const rec = new Map();
  const L = VG.makeLot((x, y, z, s) => { if (s) rec.set(x + ',' + y + ',' + z, s); else rec.delete(x + ',' + y + ',' + z); }, 0, 0, 0);
  const S = STY[style];
  const F = 90, o = Object.assign({
    w, d, floors, F, style, rng: new VR.RNG(seed * 7919 + 17), kind: 'home', beds: 2 + (seed % 3), ground: () => F - 1,
    walls: S.walls[seed % S.walls.length], window: S.windows[seed % S.windows.length], roof: S.roofs[seed % S.roofs.length], wood: S.wood,
    chimney: seed % 2 === 0, seed: seed & 255, pitched: false, detail: true, vgen: 6,
  }, opts || {});
  const info = VG.building(L, o);
  let h = 2166136261 >>> 0; const ks = [...rec.keys()].sort();
  for (const k of ks) { h = fnv(h, [...k].map(c => c.charCodeAt(0))); h = fnv(h, [rec.get(k)]); }
  return { info, rec, F, w, d, floors, hash: h >>> 0, o };
}
let homeFail = [], homeN = 0, storeyMin = 99, kitchenN = 0, livingN = 0, bedN = 0, outOK = 0, detHome = 0;
const SIZES = [[6, 6], [6, 7], [7, 6], [7, 7], [8, 7], [7, 8], [8, 8], [6, 8]];
for (const style of ['meadow', 'taiga', 'desert', 'cherry', 'jungle', 'prism']) for (let seed = 1; seed <= 4; seed++) for (const [w, d] of SIZES) for (const floors of [1, 2]) {
  const H = homeAt(seed * 31 + w * 7 + d, w, d, floors, style);
  homeN++;
  const furn = (H.info.furn || []);
  const du = w >> 1;
  const bad1 = [];
  for (const p of furn) {
    if (!(p.u >= 1 && p.u <= w - 2 && p.v >= 1 && p.v <= d - 2)) bad1.push('wall ' + p.n + '@' + p.u + ',' + p.v);
    if (p.y === H.F + 1 && p.u === du && (p.v === 1 || p.v === 2)) bad1.push('door ' + p.n + '@' + p.u + ',' + p.v);   // the door is on the ground storey
    const got = H.rec.get(p.u + ',' + p.y + ',' + p.v);
    if (!got || nameOf(got) !== p.n) bad1.push('missing ' + p.n + '@' + p.u + ',' + p.y + ',' + p.v);
  }
  for (let s = 0; s < floors; s++) {
    const real = furn.filter(p => (p.y - H.F - 1) === 4 * s).length;   // standing level of storey s
    storeyMin = Math.min(storeyMin, real);
    if (real < 6) bad1.push('storey ' + s + ' has ' + real + ' pieces');
  }
  const zones = (z, f) => furn.filter(p => p.z === z && (p.y - H.F - 1) === (f ? 4 : 0)).length;
  if (zones('kitchen', false) < 2) bad1.push('no kitchen zone');
  if (zones('living', false) < 3) bad1.push('living zone ' + zones('living', false));
  if (floors === 2 && zones('bedroom', true) < 2) bad1.push('no bedroom upstairs');
  if (floors === 1 && zones('bedroom', false) < 1) bad1.push('no bedroom on the one floor');
  kitchenN += zones('kitchen', false); livingN += zones('living', false); bedN += zones('bedroom', floors === 2);
  // outside: a lamp by the door, planters on the doorstep
  const out = H.info.outDetail || [];
  if (out.some(p => /lamp/.test(p.n)) && out.filter(p => /planter|urn/.test(p.n)).length >= 2) outOK++;
  else bad1.push('outside: ' + out.map(p => p.n + '@' + p.u + ',' + p.v).join(' '));
  // the same seed, the same house
  const H2 = homeAt(seed * 31 + w * 7 + d, w, d, floors, style);
  if (H2.hash === H.hash) detHome++;
  if (bad1.length) homeFail.push(`${style} ${w}x${d} f${floors} seed ${seed}: ${bad1.slice(0, 4).join(', ')}`);
}
check(homeFail.length === 0, `village homes furnished at vgen 6 (${homeN} houses: ≥ 6 pieces a storey, zones, no piece in a wall or on a door${homeFail.length ? ' — ' + homeFail.length + ' fail, e.g. ' + homeFail.slice(0, 3).join(' | ') : ''})`);
check(detHome === homeN, `village homes are deterministic (${detHome}/${homeN} the same twice)`);
check(outOK === homeN, `village homes have a lamp by the door and two planters (${outOK}/${homeN})`);
console.log(`     zone pieces: kitchen ${kitchenN}, living ${livingN}, bedroom ${bedN}; fewest pieces on a storey ${storeyMin}`);

// no outside detail at vgen 5: the same house as before F6 (the grammar and the lamp are switched off)
{
  const H5 = homeAt(9, 7, 7, 2, 'meadow', { detail: false, vgen: 5 });
  check(!H5.info.furn && !(H5.info.outDetail && H5.info.outDetail.length), 'vgen 5 homes get no grammar and no outside detail');
}

// ---------------------------------------------------------------- 2. catalogue villas: every room furnished
{
  let rooms = 0, thin = [], detV = 0, nV = 0;
  const SH = PLAN.SH || 5, F = 90;
  for (const cat of PLAN.CATALOGUE) for (const mirror of [false, true]) {
    const [w, d] = cat.lot;
    const skin = cat.skins[0];
    const build = () => {
      const rec = new Map();
      const L = VG.makeLot((x, y, z, s) => { if (s) rec.set(x + ',' + y + ',' + z, s); }, 0, 0, 0);
      const info = PLAN.build(L, { w, d, F, r: 0, ox: 0, oz: 0, kind: 'home' }, { rng: new VR.RNG(1234 + (mirror ? 7 : 0)), ground: () => F - 2, beds: 3, mirror, skin });
      return { rec, info };
    };
    const A = build(), B = build();
    nV++;
    let h1 = 2166136261 >>> 0, h2 = 2166136261 >>> 0;
    for (const k of [...A.rec.keys()].sort()) { h1 = fnv(h1, [...k].map(c => c.charCodeAt(0))); h1 = fnv(h1, [A.rec.get(k)]); }
    for (const k of [...B.rec.keys()].sort()) { h2 = fnv(h2, [...k].map(c => c.charCodeAt(0))); h2 = fnv(h2, [B.rec.get(k)]); }
    if (h1 === h2) detV++;
    const H = A.info.plan;
    for (const [fi, fl] of H.floors.entries()) {
      const y0 = F + fi * SH;
      for (const r of fl.rooms) {
        let n = 0;
        for (let v = r.v0; v <= r.v1; v++) for (let u = r.u0; u <= r.u1; u++) if (A.rec.get((H.u0 + u) + ',' + (y0 + 1) + ',' + (H.v0 + v))) n++;
        rooms++;
        const circ = /foyer|hall|gallery|stair|corridor/.test(r.type);
        const need = circ ? 1 : (r.u1 - r.u0 + 1) * (r.v1 - r.v0 + 1) >= 12 ? 2 : 0;
        if (n < need) thin.push(`${cat.lot.join('x')} ${mirror ? 'M' : ''} ${r.type} ${n}<${need}`);
      }
    }
  }
  check(thin.length === 0, `catalogue villas: every room has its furniture (${rooms} rooms${thin.length ? ' — thin: ' + thin.slice(0, 4).join(', ') : ''})`);
  check(detV === nV, `catalogue villas are deterministic (${detV}/${nV} the same twice)`);
}

// ---------------------------------------------------------------- 5. old worlds: the plans of vgen 5 are unchanged
const OLD = { '-5,-4': '62bfd954', '-5,-2': 'ee11f573', '-5,-1': '67b384d0', '-5,0': '34a521e', '-5,2': 'c0e601f4', '-4,-5': 'aa74af3e', '-4,-4': 'd2a3aed5', '-4,-1': 'e2e4e6a1', '-4,1': 'ce9dab52', '-4,2': '240e5d0d', '-4,3': 'f23c10f5', '-4,5': '926a0100' };
const SEED = 424242;
function planHash(p) { let h = 2166136261 >>> 0; for (const k of [...p.chunks.keys()].sort()) { const b = p.chunks.get(k); h = fnv(h, b.f); h = fnv(h, b.o); } return hex(h); }
{
  const g = new VR.OverworldGen(SEED >>> 0, { vgen: 5 });
  const seen = {}; let mism = [];
  let n = 0;
  for (let i = -5; i <= 5 && n < 12; i++) for (let j = -5; j <= 5 && n < 12; j++) {
    const s = VG.site(g, i, j); if (!s) continue; n++;
    const p = VG.plan(new VR.OverworldGen(SEED >>> 0, { vgen: 5 }), s);
    const key = i + ',' + j;
    if (OLD[key] !== undefined && OLD[key] !== planHash(p)) mism.push(key);
    seen[key] = planHash(p);
  }
  check(n === 12 && mism.length === 0, `vgen 5 village plans unchanged (12 sites${mism.length ? ', differ at ' + mism.join(' ') : ''})`);
}

// ---------------------------------------------------------------- 4. modern towns: street pieces at vgen 6 only
{
  const SHELTER = 'vm_mobility_busshelter_glass', BIKE = 'vm_mobility_ebike_city', GRATE = 'metal_grate';
  const count = (plan) => { const c = { shelter: 0, bike: 0, grate: 0, bin: 0 }; for (const [, b] of plan.chunks) for (let i = 0; i < b.o.length; i += 4) { const nm = nameOf(b.o[i + 3]); if (nm === SHELTER) c.shelter++; else if (nm === BIKE) c.bike++; else if (nm === GRATE) c.grate++; } return c; };
  const g6 = new VR.OverworldGen(SEED >>> 0, { vgen: 6 });
  const g5 = new VR.OverworldGen(SEED >>> 0, { vgen: 5 });
  let modern = 0, ok6 = 0, ok5 = 0, same6 = 0;
  const lines = [];
  for (let i = -6; i <= 6 && modern < 2; i++) for (let j = -6; j <= 6 && modern < 2; j++) {
    const s = VG.site(g6, i, j);
    if (!s || s.style !== 'modern') continue;
    modern++;
    const p6 = VG.plan(new VR.OverworldGen(SEED >>> 0, { vgen: 6 }), s), p6b = VG.plan(new VR.OverworldGen(SEED >>> 0, { vgen: 6 }), s);
    const c6 = count(p6), p5 = VG.plan(g5, s), c5 = count(p5);
    if (c6.shelter >= 1 && c6.bike >= 2 && c6.grate >= 4) ok6++;
    if (c5.shelter === 0 && c5.bike === 0 && c5.grate === 0) ok5++;
    if (planHash(p6) === planHash(p6b)) same6++;
    lines.push(`site ${i},${j}: vgen 6 shelters ${c6.shelter} e-bikes ${c6.bike} grates ${c6.grate} · vgen 5 ${c5.shelter}/${c5.bike}/${c5.grate}`);
  }
  console.log('     ' + lines.join('\n     '));
  check(modern >= 1, 'a modern town exists near the spawn (' + modern + ')');
  check(ok6 === modern && modern > 0, `modern towns at vgen 6 have bus shelters, e-bikes and tree grates (${ok6}/${modern})`);
  check(ok5 === modern && modern > 0, `modern towns at vgen 5 have none of them (${ok5}/${modern})`);
  check(same6 === modern && modern > 0, `modern towns at vgen 6 are deterministic (${same6}/${modern})`);
}

// ---------------------------------------------------------------- 6. timings (printed)
{
  const sites = []; const g = new VR.OverworldGen(SEED >>> 0, { vgen: 5 });
  for (let i = -5; i <= 5 && sites.length < 4; i++) for (let j = -5; j <= 5 && sites.length < 4; j++) { const s = VG.site(g, i, j); if (s) sites.push([i, j, s]); }
  for (const vgen of [5, 6]) {
    let tot = 0, mx = 0, ops = 0;
    for (const [, , s] of sites) { const g2 = new VR.OverworldGen(SEED >>> 0, { vgen }); const t0 = performance.now(); const p = VG.plan(g2, s); const dt = performance.now() - t0; tot += dt; mx = Math.max(mx, dt); for (const [, b] of p.chunks) for (let i = 0; i < b.o.length; i += 4) if (b.o[i + 3]) ops++; }
    console.log(`     plan vgen ${vgen}: ${sites.length} villages, ${tot.toFixed(0)} ms in all (the slowest ${mx.toFixed(0)} ms, one call), ${ops} block ops that place a block (the cost on the renderer's side)`);
  }
}

console.log(bad ? 'FAILED ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);

// Design format v2: a Crafter grid (built like the Studio worker does) → edits → VR.Custom.makeTemplate →
// the game's villa builder with the design, in all four lot rotations: every template cell lands exactly
// (rotated), keep cells stay untouched, nothing the builder generates leaks into the box, the villagers'
// spots follow the design (a removed bed is gone). Also: v1 → v2 upgrade gives the same house, and the
// template survives a changed villa builder (simulated by a different rng / beds in the town call).
require('./load_shared.js');
const VG = VR.VillageGen, PLAN = VG.plan2, R = VR.R, C = VR.Custom;
const st = (n, p) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); return p ? t.state(Object.assign(t.decode(t.defaultState), p)) : t.defaultState; };
const nameOf = (s) => s ? R.types[R.T.type[s]].name : 'air';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } };

function studioGrid(index, skin, mirror) {
  const cat = PLAN.CATALOGUE[index], lotW = cat.lot[0], lotD = cat.lot[1], F = 8, pad = 5;   // like the Studio worker (v0.33: 5)
  const ops = [];
  const L = VG.makeLot((x, y, z, s) => ops.push(x, y, z, s), pad, pad, 0);
  const info = PLAN.build(L, { w: lotW, d: lotD, F, r: 0, ox: pad, oz: pad, kind: 'home' }, { rng: new VR.RNG(7), ground: () => F - 1, beds: 3, mirror, skin, noCustom: true });
  let maxY = 0; for (let k = 1; k < ops.length; k += 4) maxY = Math.max(maxY, ops[k]);
  const sx = lotW + pad * 2, sz = lotD + pad * 2, sy = Math.ceil((maxY + 1 + 24) / 16) * 16;
  const blocks = new Uint16Array(sx * sy * sz), wrote = new Uint8Array(sx * sy * sz), idx = (x, y, z) => (y * sz + z) * sx + x;
  for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) { for (let y = 0; y < F - 1; y++) blocks[idx(x, y, z)] = st('dirt'); blocks[idx(x, F - 1, z)] = st('grass_block'); }
  for (let k = 0; k < ops.length; k += 4) { const x = ops[k], y = ops[k + 1], z = ops[k + 2]; if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) continue; blocks[idx(x, y, z)] = ops[k + 3]; wrote[idx(x, y, z)] = 1; }
  return { cat, lotW, lotD, F, pad, sx, sy, sz, blocks, base: blocks.slice(), wrote, info, idx, skin: info.skin, mirror };
}

for (const [index, skin, mirror] of [[0, 'signus', false], [4, 'lake', true], [7, 'classic', false], [10, 'bauhaus', true]]) {
  const g = studioGrid(index, skin, mirror), { F, pad, idx } = g;
  console.log(`house ${index} (${skin}${mirror ? ', mirrored' : ''}): grid ${g.sx}×${g.sy}×${g.sz}, beds ${g.info.beds.length}`);
  // ---- edits like a player makes them: a Vollton tower, a wall painted, a hole dug below the floor, a bed taken out
  const ed = [];
  const set = (x, y, z, s) => { ed.push([x, y, z, g.blocks[idx(x, y, z)]]); g.blocks[idx(x, y, z)] = s; };
  for (let y = 0; y < 30; y++) set(pad + 1, F + y, pad + g.lotD - 2, st(y % 2 ? 'vollton_cobalt_gloss' : 'vollton_white'));
  for (let y = F + 1; y < F + 4; y++) for (let z = pad + 2; z < pad + 6; z++) if (g.blocks[idx(pad + g.lotW - 1, y, z)] !== 0) set(pad + g.lotW - 1, y, z, st('vollton_coral'));
  for (let y = F - 5; y < F; y++) set(pad + 2, y, pad + 2, 0);                                    // a shaft below the floor
  set(pad + 3, F + 1, pad + g.lotD - 3, st('door_pivot_anthracite', { facing: 1, half: 0 }));
  set(pad + 3, F + 2, pad + g.lotD - 3, st('door_pivot_anthracite', { facing: 1, half: 1 }));
  const bed = g.info.beds[0];                                                                   // [u, y, v, f] lot-local
  const bx = pad + bed[0], by = bed[1], bz = pad + bed[2];
  const bedType = R.T.type[g.blocks[idx(bx, by, bz)]];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (R.T.type[g.blocks[idx(bx + dx, by, bz + dz)]] === bedType) set(bx + dx, by, bz + dz, 0);
  // the in-lot edits alone: the v1 → v2 upgrade path must give exactly this template
  const rIn = C.makeTemplate({ sx: g.sx, sy: g.sy, sz: g.sz, pad, F, lot: [g.lotW, g.lotD], blocks: g.blocks, base: g.base, wrote: g.wrote });
  // ---- v0.33: edits around the lot (the ring the Crafter lets you change): a Vollton post in front, a planter behind,
  // and whatever the house put outside its lot (bay window glass, steps) taken away
  set(pad - 2, F, pad - 3, st('vollton_mint')); set(pad - 2, F + 1, pad - 3, st('vollton_mint'));
  set(pad + g.lotW + 1, F, pad + 2, st('vollton_plum'));
  let outside = 0;
  for (let y = F; y < g.sy; y++) for (let z = 1; z < g.sz - 1; z++) for (let x = 1; x < g.sx - 1; x++) {
    if (x >= pad && z >= pad && x < pad + g.lotW && z < pad + g.lotD) continue;
    const i = idx(x, y, z); if (g.wrote[i] && g.blocks[i] && outside < 6) { set(x, y, z, 0); outside++; }
  }
  // ---- the template
  const T0 = performance.now();
  const r = C.makeTemplate({ sx: g.sx, sy: g.sy, sz: g.sz, pad, F, lot: [g.lotW, g.lotD], blocks: g.blocks, base: g.base, wrote: g.wrote });
  console.log(`  ring edits: 3 placed, ${outside} of the house's own outside cells removed · box ${r.tpl.box.join('×')} from ${(r.tpl.off || [0, 0]).join(',')}`);
  check(r.tpl.off && r.tpl.off[0] <= -2 && r.tpl.off[1] <= -3, 'template box does not reach the ring edits');
  const json = JSON.stringify({ v: 2, tpl: r.tpl, n: r.changed, top: r.top });
  console.log(`  template ${r.tpl.box.join('×')} · ${r.tpl.pal.length} states · ${r.changed} changed · top ${r.top} · ${(json.length / 1024).toFixed(1)} KB JSON · ${(performance.now() - T0).toFixed(0)} ms`);
  const design = { v: 2, name: 'T', index, seed: 7, beds: 3, skin: g.skin, mirror, tpl: r.tpl, n: r.changed, top: r.top, t: 1 };
  C.apply({ houses: { [index]: design }, models: {} });
  // ---- the game's town call (any rng / beds), all four rotations
  const T = C.tplData(design);
  for (let rot = 0; rot < 4; rot++) {
    const ops = new Map();
    const ox = 100, oz = 200, GF = 70;
    const L = VG.makeLot((x, y, z, s) => ops.set(x + ',' + y + ',' + z, s), ox, oz, rot);
    const info = PLAN.build(L, { w: g.lotW, d: g.lotD, F: GF, r: rot, ox, oz, kind: 'home' }, { rng: new VR.RNG(99 + rot), ground: () => GF - 1, beds: 2 });
    let bad = 0, keepBad = 0, n = 0;
    for (let yy = 0; yy < T.H; yy++) for (let v = 0; v < T.D; v++) for (let u = 0; u < T.W; u++) {
      const k = T.idx[(yy * T.D + v) * T.W + u], q = VG.rot(rot, T.u0 + u, T.v0 + v), key = (ox + q[0]) + ',' + (GF + T.y0 + yy) + ',' + (oz + q[1]);
      const want = g.blocks[idx(pad + T.u0 + u, F + T.y0 + yy, pad + T.v0 + v)];
      if (!k) { if (ops.has(key)) keepBad++; continue; }
      n++;
      const got = ops.get(key), exp = C.rotState(want, rot);
      if (got !== exp) { if (bad < 3) console.log(`    rot ${rot} (${u},${T.y0 + yy},${v}) want ${nameOf(exp)} got ${got === undefined ? '—' : nameOf(got)}`); bad++; }
    }
    const bedsGone = !info.beds.some(b => b[0] === bed[0] && b[1] === bed[1] - F + GF && b[2] === bed[2]);
    console.log(`  rot ${rot}: ${n} template cells, ${bad} wrong, ${keepBad} keep cells written · beds ${info.beds.length} (removed bed gone: ${bedsGone}) · roofTop +${info.roofTop - GF} · custom ${!!info.custom}`);
    check(bad === 0 && keepBad === 0, `rotation ${rot} not exact`);
    check(bedsGone, 'removed bed still a spot');
    check(info.roofTop - GF >= r.top + 1, 'roofTop below the tower');
  }
  // ---- v1 of the same edits → upgrade path gives the same template cells
  const cells = [], pal = [null], pi = new Map();
  for (let y = 0; y < g.sy; y++) for (let z = pad; z < pad + g.lotD; z++) for (let x = pad; x < pad + g.lotW; x++) { const i = idx(x, y, z), s = g.blocks[i]; if (s === g.base[i]) continue; let k = pi.get(s); if (k === undefined) { k = s ? pal.length : 0; if (s) pal.push(C.portable(s)); pi.set(s, k); } cells.push([x - pad, y - F, z - pad, k]); }
  const v1 = { v: 1, index, seed: 7, beds: 3, skin: g.skin, mirror, cells, pal, top: r.top, t: 1 };
  const g2 = studioGrid(index, skin, mirror);
  const p1 = v1.pal.map(C.fromPortable);
  for (const c of v1.cells) g2.blocks[g2.idx(c[0] + pad, F + c[1], c[2] + pad)] = p1[c[3]];
  const r2 = C.makeTemplate({ sx: g2.sx, sy: g2.sy, sz: g2.sz, pad, F, lot: [g2.lotW, g2.lotD], blocks: g2.blocks, base: g2.base, wrote: g2.wrote });
  check(r2.tpl.rle === rIn.tpl.rle && JSON.stringify(r2.tpl.pal) === JSON.stringify(rIn.tpl.pal), 'v1 upgrade differs from the direct template');
  console.log(`  v1 (${cells.length} cells) → v2 upgrade identical: ${r2.tpl.rle === rIn.tpl.rle}`);
}
C.apply(null);
console.log(fails ? 'FAIL ' + fails : 'OK');

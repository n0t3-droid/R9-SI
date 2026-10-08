// the trailer's voxel plants (src/shared/voxplants.js): every piece exists and compiles, every piece stays under its quad
// budget (near mesh, all parts), the sway levels are right (the crown and the leaves move, the trunk's base stays) and
// they reach the emitted quads' w5 sway bits, the shared palm places its ringed trunk and its crown on top.
require('./load_shared.js');
const R = VR.R, VX = VR.VX, VM = VR.VM, P = VR.Plants;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// quad budgets of the whole piece (every part at facing 0, the greedy mesh of the 16-res grid); a far box is one box per part
const BUDGET = { vm_palm_crown: 6000, vm_tree_round_s: 1800, vm_tree_round_l: 5000, vm_tuft_grass: 300, vm_flower_cluster: 600, vm_bush_blossom: 1200, vm_crop_rows: 300 };
const SWAY = { vm_palm_crown: (p) => 3, vm_tree_round_s: (p) => (p.py >= 1 ? 2 : 0), vm_tree_round_l: (p) => (p.py >= 1 ? 2 : 0), vm_tuft_grass: () => 2, vm_flower_cluster: () => 2, vm_bush_blossom: () => 1, vm_crop_rows: () => 1 };

check(P.NAMES.length === Object.keys(BUDGET).length, 'the seven plant pieces are registered (' + P.NAMES.length + ')');
for (const name of P.NAMES) {
  const t = R.byName[name];
  check(!!t, name + ' exists as a block');
  const m = VM.MODELS[name];
  if (!m || !m.parts.length) { check(false, name + ' compiles to parts'); continue; }
  const names = m.parts.map(p => 'p' + p.px + p.py + p.pz);
  let quads = 0, maxQ = 0;
  for (let i = 0; i < m.parts.length; i++) {
    const s = R.S(name, { part: names[i], facing: 0 });
    const sp = VX.spec(s); VM.paint(sp, { part: i, facing: 0 });
    const q = VX.meshGridN(VX.gridFor(sp.res), sp.res, 0, 0), nq = q.length / 27;
    quads += nq; if (nq > maxQ) maxQ = nq;
  }
  const bud = BUDGET[name];
  check(quads <= bud, `${name}: ${m.parts.length} parts, ${quads} quads in all (budget ${bud}), the largest part ${maxQ}`);
  check(Array.isArray(m.partSway) && m.partSway.length === m.parts.length, name + ' has a sway level for every part');
  const want = SWAY[name];
  check(m.parts.every((p, i) => m.partSway[i] === want(p)), name + ' sways as designed (' + [...new Set(m.partSway)].join('/') + ')');
}

// the sway reaches the emitted quads: a palm crown part and a trunk block, meshed as the chunk mesher does
{
  const name = 'vm_palm_crown', t = R.byName[name], m = VM.MODELS[name];
  const top = m.parts.findIndex(p => p.py === 1), bot = m.parts.findIndex(p => p.py === 0);
  const DOFF = [1, -1, 3, -3, 9, -9];      // a 3×3×3 neighbourhood: x stride 1, y stride 3, z stride 9
  const emitW5 = (i) => {
    const B = new Uint16Array(27), L = new Uint16Array(27).fill(0xF000);
    const bi = 13; B[bi] = R.S(name, { part: 'p' + m.parts[i].px + m.parts[i].py + m.parts[i].pz, facing: 0 });
    const out = []; const buf = { ensure() {}, v(x, y, z, layer, u, v2, w5) { out.push(w5); } };
    const M = { B, L, DOFF, ox: 0, oy: 0, oz: 0, bufs: [buf, buf, buf], far: null, detail: true, layerTile: 1, layerGloss: 1, layerGlass: 1, layerHolo: 1, layerSmooth: 1, layerSmoothGloss: 1, layerMat: [0, 1, 1, 1, 1, 1, 1, 1] };
    VX.meshBlock(M, 1, 1, 1, bi, B[bi]);
    return out;
  };
  if (top >= 0 && bot >= 0) {
    const sw = (w5) => (w5 >> 5) & 3;
    const a = emitW5(top), b = emitW5(bot);
    check(a.length > 0 && a.every(w => sw(w) === 3), 'crown quads carry the full sway (w5 bits 5-6 = 3)');
    check(b.length > 0 && b.every(w => sw(w) === 3), 'a crown part on the lower row sways as well (no seam within the crown)');
  } else check(false, 'the crown has a top and a bottom row');
}

// the shared palm: a ringed trunk of h blocks, then the crown's parts on top (5 by 5 blocks around the trunk)
{
  const calls = []; const put = (x, y, z, s) => calls.push([x, y, z, s]);
  const h = 8, x0 = 100, y0 = 80, z0 = 50;
  P.palm(put, x0, y0, z0, h);
  const trunk = calls.filter(c => c[1] < y0 + h), crown = calls.filter(c => c[1] >= y0 + h);
  check(trunk.length === h && trunk.every(c => c[0] === x0 && c[2] === z0), 'the palm trunk is h blocks in one column');
  check(crown.length === VR.VM.MODELS.vm_palm_crown.parts.length, 'the crown places every part (' + crown.length + ')');
  check(crown.every(c => c[0] >= x0 - 3 && c[0] <= x0 + 3 && c[2] >= z0 - 3 && c[2] <= z0 + 3 && c[1] <= y0 + h + 1), 'the crown stays within 7×2×7 blocks on the trunk top');
  const keys = new Set(calls.map(c => c[0] + ',' + c[1] + ',' + c[2]));
  check(keys.size === calls.length, 'no block is placed twice');
}

// the plot of Nova Haven (the Palm City: a vgen 7 town of seed 4242, centre (0, −140), radius 100): the middle of it is
// planted, every shared palm's crown is whole (no house wall overwrote a crown part), no plant stands on a street or a plaza
{
  const g = new VR.OverworldGen(4242, { vgen: 7 });
  const typeOf = new Int16Array(R.stateCount + 1).fill(-1), names = [];
  for (const t of R.types) { const k = names.length; names.push(t.name); for (let s2 = t.base; s2 < t.base + t.nstates; s2++) typeOf[s2] = k; }
  const PLANT = /^(vm_palm_crown|vm_tree_round_[sl]|vm_tuft_grass|vm_flower_cluster|vm_bush_blossom|vm_crop_rows|vx_palm_trunk|vx_palm_crown|vx_palm_frond|vx_bush|vx_hedge|vx_fern)/;
  const PATH = /asphalt|plaza|pavement|paver|cobble|road|curb|street|floor_pad/;
  // the plants that stand on the ground (a crown or a leaf ball is above its trunk, so it is not tested against the ground)
  const GROUND = /^(vm_tuft_grass|vm_flower_cluster|vm_bush_blossom|vm_crop_rows|vx_bush|vx_fern|vx_hedge|vx_palm_trunk|vm_tree_round_[sl])/;
  const blocks = new Map(); let nPlant = 0, nOnPath = 0; const cx0 = -4, cx1 = 4, cz0 = -12, cz1 = -4;   // 81 chunks: x −64..79, z −192..−49
  const isPlant = new Uint8Array(R.stateCount + 1), isPath = new Uint8Array(R.stateCount + 1);
  for (let k = 0; k < names.length; k++) { if (PLANT.test(names[k])) for (const t of R.types) if (t.name === names[k]) for (let s2 = t.base; s2 < t.base + t.nstates; s2++) isPlant[s2] = 1; if (PATH.test(names[k]) && !PLANT.test(names[k])) for (const t of R.types) if (t.name === names[k]) for (let s2 = t.base; s2 < t.base + t.nstates; s2++) isPath[s2] = 1; }
  const t0 = Date.now(); const onPathKind = {};
  for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
    const c = g.generate(cx, cz);
    for (let i = 0; i < c.blocks.length; i++) {
      const st = c.blocks[i]; if (!st) continue;
      const y = i >> 8, lz = (i >> 4) & 15, lx = i & 15, X = cx * 16 + lx, Z = cz * 16 + lz;
      blocks.set(X + ',' + y + ',' + Z, st);
    }
  }
  const at = (x, y, z) => blocks.get(x + ',' + y + ',' + z) || 0;
  const plantCells = [];
  for (const [key, st] of blocks) if (isPlant[st]) { nPlant++; const [x, y, z] = key.split(',').map(Number); const n = names[typeOf[st]]; plantCells.push([x, y, z, n]); if (GROUND.test(n) && y - g.surfaceY(x, z) <= 3 && isPath[at(x, y - 1, z)]) { nOnPath++; onPathKind[names[typeOf[st]]] = (onPathKind[names[typeOf[st]]] || 0) + 1; } }
  console.log('  Nova Haven (vgen 7, seed 4242, ' + ((cx1 - cx0 + 1) * (cz1 - cz0 + 1)) + ' chunks, ' + (Date.now() - t0) + ' ms): ' + nPlant + ' plant blocks');
  check(nPlant >= 150, 'the plot of Nova Haven has plants (' + nPlant + ' blocks, want at least 150)');
  console.log('    on a path, by kind:', JSON.stringify(onPathKind));
  check(nOnPath === 0, 'no plant stands on a street or a plaza (' + nOnPath + ' do)');
  // every shared palm: each part of its crown stands at its place on the trunk top, or the palm has none of its parts (a house
  // wall never overwrote a part); another palm's crown may stand in the box's empty corners, so the parts are tested one by one
  const crownN = VM.MODELS.vm_palm_crown.parts.length;
  let palms = 0, broken = 0;
  for (const [x, y, z, n] of plantCells) {
    const inside = x >= cx0 * 16 + 3 && x <= (cx1 + 1) * 16 - 4 && z >= cz0 * 16 + 3 && z <= (cz1 + 1) * 16 - 4;   // the whole crown is in the plot
    if (!inside || n !== 'vx_palm_trunk' || isPlant[at(x, y + 1, z)] && names[typeOf[at(x, y + 1, z)]] === 'vx_palm_trunk') continue;   // a trunk top
    let have = 0;
    for (const pp of VM.MODELS.vm_palm_crown.parts) if (names[typeOf[at(x - 3 + pp.px, y + 1 + pp.py, z - 3 + pp.pz)]] === 'vm_palm_crown') have++;
    if (!have) continue;
    palms++; if (have !== crownN) { broken++; const miss = []; for (const pp of VM.MODELS.vm_palm_crown.parts) { const bx = x - 3 + pp.px, by = y + 1 + pp.py, bz = z - 3 + pp.pz; if (names[typeOf[at(bx, by, bz)]] !== 'vm_palm_crown') miss.push(names[typeOf[at(bx, by, bz)]]); } console.log('    crown', have, 'of', crownN, 'at', x, y, z, 'overwritten by', [...new Set(miss)].join(',')); }
  }
  check(palms >= 4, 'Nova Haven has shared palms in the plot (' + palms + ', at least the four of its plaza)');
  check(broken === 0, 'every shared palm has its whole crown (' + broken + ' broken of ' + palms + ')');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

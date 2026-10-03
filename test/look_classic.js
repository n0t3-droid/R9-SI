// Block look (v0.39): "Klassisch" (the default — every block a cube with its own edges, glass and patterns per block,
// like Minecraft) and "Nahtlos" (smooth ground slopes, joined panorama frames, seamless materials, joined VX pieces).
//  (a) the texture rim: texel columns 0 and 31 darker than the inside on stucco, Vollton and stone in Klassisch
//  (b) a 4×3 stucco wall meshed and sampled through the mesher's UVs: a dip at every block border (Klassisch only)
//  (c) a hill: every opaque vertex on a whole block height, no slope flag (Klassisch) — slopes in Nahtlos
//  (d) 3×3 panorama glass: the full-frame layer everywhere (Klassisch) — the centre joined on all sides in Nahtlos
//  (e) VX: two timber walls at odd / even x give the same quads; stacked windows each get a closed frame; rugs end per block
const VR = require('./load_shared.js');
VR.TEXREC = VR.TEXREC || {}; VR.TEXPRE = VR.TEXPRE || {};
for (const f of ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_build']) require('../src/main/' + f + '.js');
const R = VR.R, T = R.T, F = VR.F;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
if (typeof VR.setLook !== 'function' || !VR.LOOK) { console.log('  ✗ VR.setLook / VR.LOOK missing'); console.log('FAIL 1'); process.exit(1); }
check(VR.LOOK.mode === 'classic', 'the default look is Klassisch (' + VR.LOOK.mode + ')');
const st = (n, pr) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); return pr ? t.state(Object.assign({}, t.decode(t.defaultState), pr)) : t.defaultState; };
const PAD = VR.MESH_PAD, PS = VR.MESH_PS, PSS = PS * PS;
const DEC = (v) => v / 2048 - 4;
// mesh one section (sy 0, origin ox/oz) from a block function over the padded cube, open sky everywhere
function mesh(fn, ox, oz, sy) {
  ox = ox || 0; oz = oz || 0; sy = sy || 0;
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000), tint = new Uint16Array(PSS).fill(0xffff);
  for (let py = 0; py < PS; py++) for (let pz = 0; pz < PS; pz++) for (let px = 0; px < PS; px++) blocks[py * PSS + pz * PS + px] = fn(ox + px - PAD, sy * 16 + py - PAD, oz + pz - PAD) || 0;
  return VR.meshSection({ blocks, light, grass: tint, foliage: tint, water: tint, sy, ox, oz, fancyLeaves: true, smooth: true, vxLod: true });
}
// quads of a vertex stream: {d, v: [{x, y, z, u, v, w3, w5, col}]}, world positions
function quads(a, ox, oz, sy) {
  const out = [];
  for (let q = 0; q < a.length; q += 32) {
    const v = [];
    for (let k = 0; k < 4; k++) { const o = q + k * 8; v.push({ x: DEC(a[o]) + (ox || 0), y: DEC(a[o + 1]) + (sy || 0) * 16, z: DEC(a[o + 2]) + (oz || 0), u: a[o + 4] & 255, v: a[o + 4] >> 8, w3: a[o + 3], w5: a[o + 5], col: a[o + 7] }); }
    out.push({ d: a[q + 5] & 7, v });
  }
  return out;
}
const looks = ['classic', 'seamless'];

// ---------------------------------------------------------------- (a) texture rim
console.log('(a) texture rim');
const TEXN = ['stucco_white', 'vollton_matte', 'stone'];
const texFor = {};
for (const lk of looks) {
  VR.setLook(lk);
  const mk = VR.textureMasks();
  const idx = TEXN.map(n => R.texIndex[n]);
  const out = VR.buildTextureArrays({ names: TEXN, cubeMask: Uint8Array.from(idx.map(i => mk.cube[i])), cutoutMask: Uint8Array.from(idx.map(i => mk.cut[i])), bevel: 1, bevelAll: VR.LOOK.rim });
  texFor[lk] = out;
  const N = out.size, A = out.albedo[0];
  TEXN.forEach((n, l) => {
    check(mk.cube[R.texIndex[n]] === 1, `${n} is a cube texture`);
    // the recipe's own texels (no rim) for comparison: stone's fbm makes its edge columns brighter or darker by
    // chance, so the rim is measured against the same texels without it
    const raw = new Uint8Array(N * N * 4), rawM = new Uint8Array(N * N * 4); VR.TX.toArrays(VR.resolveTexture(n), raw, rawM, 0);
    const br = (x, y) => { const o = (l * N * N + y * N + x) * 4; return (A[o] + A[o + 1] + A[o + 2]) / 3; };
    const brRaw = (x, y) => { const o = (y * N + x) * 4; return (raw[o] + raw[o + 1] + raw[o + 2]) / 3; };
    const col = (f, x) => { let s = 0; for (let y = 0; y < N; y++) s += f(x, y); return s / N; };
    let inner = 0, innerRaw = 0; for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) { inner += br(x, y); innerRaw += brRaw(x, y); }
    const r0 = col(br, 0) / col(brRaw, 0), r31 = col(br, N - 1) / col(brRaw, N - 1), ri = inner / innerRaw;
    const info = `columns 0 / 31 at ${r0.toFixed(3)} / ${r31.toFixed(3)} of the texture without rim, inside ${ri.toFixed(3)}; of the inside's brightness ${(col(br, 0) / (inner / (N - 4) ** 2)).toFixed(3)}`;
    if (lk === 'classic' || n === 'stone') check(r0 <= 0.95 && r31 <= 0.95 && ri > 0.995, `${lk}: ${n} has its rim — ${info}`);
    else check(r0 > 0.995 && r31 > 0.995, `${lk}: ${n} stays seamless — ${info}`);
  });
}

// ---------------------------------------------------------------- (b) a stucco wall through the mesher's UVs
console.log('(b) stucco wall, sampled through the UVs');
const STUCCO = st('stucco_white');
check(!(T.flags[STUCCO] & F.RANDROT), 'stucco has no random rotation (the sampling below follows the shader without it)');
for (const lk of looks) {
  VR.setLook(lk);
  // a free-standing wall 4 wide (x 4..7) and 3 high (y 4..6) at z 8
  const r = mesh((x, y, z) => (z === 8 && x >= 4 && x <= 7 && y >= 4 && y <= 6) ? STUCCO : 0);
  const fq = quads(r.opaque).filter(q => q.d === 5);
  check(fq.length > 0, `${lk}: the wall's north face is meshed (${fq.length} quads)`);
  const out = texFor[lk], N = out.size, A = out.albedo[0];
  // the texel the shader reads at world point (x, y) on the face z = 8: uv from the quad's vertices, fract, rotation
  const sample = (x, y) => {
    const q = fq.find(q => { const xs = q.v.map(v => v.x), ys = q.v.map(v => v.y); return x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys); });
    if (!q) return null;
    const a = q.v[0], b = q.v.find(v => Math.abs(v.x - a.x) > 1e-6), c = q.v.find(v => Math.abs(v.y - a.y) > 1e-6);
    const u = (a.u + (b.u - a.u) * (x - a.x) / (b.x - a.x)) / 16, vv = (a.v + (c.v - a.v) * (y - a.y) / (c.y - a.y)) / 16;
    let fu = [u - Math.floor(u), vv - Math.floor(vv)];
    const rot = (a.w3 >> 12) & 3;
    if (rot === 1) fu = [fu[1], 1 - fu[0]]; else if (rot === 2) fu = [1 - fu[0], 1 - fu[1]]; else if (rot === 3) fu = [1 - fu[1], fu[0]];
    const name = R.texNames[a.w3 & 0xfff], l = TEXN.indexOf(name);
    if (l < 0) return null;
    const tx = Math.min(N - 1, Math.floor(fu[0] * N)), ty = Math.min(N - 1, Math.floor(fu[1] * N));
    const o = (l * N * N + ty * N + tx) * 4;
    return (A[o] + A[o + 1] + A[o + 2]) / 3;
  };
  // the brightness profile along x, every column averaged over the wall's height (texture noise averages out; the
  // rows next to the horizontal block borders, which have the rim too, are left out)
  const prof = [];
  for (let i = 0; i < 128; i++) { const x = 4 + (i + 0.5) / 32; let s = 0, n = 0; for (let j = 0; j < 96; j++) { if ((j & 31) < 2 || (j & 31) > 29) continue; const b = sample(x, 4 + (j + 0.5) / 32); if (b !== null) { s += b; n++; } } prof.push(n ? s / n : NaN); }
  const sorted = prof.slice().sort((p, q) => p - q), med = sorted[64];
  const dips = [5, 6, 7].map(bx => { const i = (bx - 4) * 32; return Math.min(prof[i - 1], prof[i]) / med; });
  if (lk === 'classic') check(dips.every(d => d <= 0.95), `${lk}: a dip at every block border x = 5, 6, 7 (${dips.map(d => d.toFixed(3)).join(' / ')} of the median)`);
  else check(dips.every(d => d > 0.97), `${lk}: no dip at the block borders (${dips.map(d => d.toFixed(3)).join(' / ')})`);
}

// ---------------------------------------------------------------- (c) a hill: steps or slopes
console.log('(c) hill');
{
  const G = st('grass_block'), D = st('dirt'), S = st('stone'), Y0 = 64;
  const hillH = (x, z) => Math.round(6 * Math.exp(-((x - 22) ** 2 + (z - 22) ** 2) / 90) + 2 * Math.exp(-((x - 10) ** 2) / 12));
  const world = (x, y, z) => {
    if (y < 0 || y > 255) return 0;
    if (x >= 0 && x < 44 && z >= 0 && z < 44) { const h = hillH(x, z), yy = y - Y0; if (yy < -1) return y < Y0 - 4 ? S : D; if (yy < h) return D; if (yy === h) return G; return 0; }
    if (y === Y0) return G; if (y < Y0) return y < Y0 - 4 ? S : D; return 0;
  };
  for (const lk of looks) {
    VR.setLook(lk);
    let verts = 0, frac = 0, slope = 0;
    for (let cx = 0; cx < 3; cx++) for (let cz = 0; cz < 3; cz++) for (const sy of [4]) {
      const r = mesh(world, cx * 16, cz * 16, sy);
      for (const q of quads(r.opaque, cx * 16, cz * 16, sy)) for (const v of q.v) { verts++; if (Math.abs(v.y - Math.round(v.y)) > 1e-4) frac++; if ((v.w5 >> 13) & 1) slope++; }
    }
    if (lk === 'classic') check(verts > 0 && frac === 0 && slope === 0, `${lk}: ${verts} opaque vertices, ${frac} off a whole block height, ${slope} with the slope flag (both must be 0)`);
    else check(frac > 100 && slope > 100, `${lk}: smooth slopes (${frac} of ${verts} vertices between block heights, ${slope} with the slope flag)`);
  }
  // physics follows the look: the ground under points all over the hill
  const get = (x, y, z) => world(x, y, z);
  for (const lk of looks) {
    VR.setLook(lk);
    let smooth = 0, between = 0, n = 0;
    for (let x = 4; x < 40; x++) for (let z = 4; z < 40; z++) {
      const top = Y0 + hillH(x, z) + 1, h = VR.PHYS.groundAt(get, x + 0.3, top, z + 0.7);
      n++; if (h >= 0) { smooth++; if (Math.abs(h - Math.round(h)) > 0.05) between++; }
    }
    if (lk === 'classic') check(smooth === 0, `${lk}: bodies stand on block tops (smooth ground under ${smooth} of ${n} points)`);
    else check(between > 50, `${lk}: bodies walk on the slopes (${between} of ${n} points between block heights)`);
  }
}

// ---------------------------------------------------------------- (d) 3×3 panorama glass
console.log('(d) panorama glass');
{
  const P = st('panorama_black'), base = R.types[T.type[P]].o.ctm;
  for (const lk of looks) {
    VR.setLook(lk);
    const r = mesh((x, y, z) => (z === 8 && x >= 4 && x <= 6 && y >= 4 && y <= 6) ? P : 0);
    const qs = quads(r.trans).filter(q => (q.v[0].w3 & 0xfff) >= base && (q.v[0].w3 & 0xfff) < base + 16);
    const masks = qs.map(q => (q.v[0].w3 & 0xfff) - base);
    const centre = qs.find(q => q.d === 5 && q.v.every(v => v.x >= 5 - 1e-6 && v.x <= 6 + 1e-6 && v.y >= 5 - 1e-6 && v.y <= 6 + 1e-6));
    const cm = centre ? (centre.v[0].w3 & 0xfff) - base : -1;
    if (lk === 'classic') check(qs.length >= 18 && masks.every(m => m === 0) && cm === 0, `${lk}: all ${qs.length} glass faces use the full frame (masks ${[...new Set(masks)].join(',')})`);
    else check(cm === 15, `${lk}: the centre block's front joins on all four sides (mask ${cm})`);
  }
}

// ---------------------------------------------------------------- (e) VX pieces per block
console.log('(e) VX pieces');
{
  const TW = st('vx_timber_white'), GRS = st('stone');
  // one timber wall block standing on the ground at (x, 4, 8) — at even and odd x and z
  const wallQuads = (x0, z0) => {
    const r = mesh((x, y, z) => (y < 4 ? GRS : (x === x0 && y === 4 && z === z0) ? TW : 0));
    return quads(r.vx).map(q => JSON.stringify([q.d, q.v.map(v => [+(v.x - x0).toFixed(4), +(v.y - 4).toFixed(4), +(v.z - z0).toFixed(4), v.u, v.v, v.col, v.w5 & 0x18])])).sort().join('|');
  };
  for (const lk of looks) {
    VR.setLook(lk);
    const a = wallQuads(4, 8), b = wallQuads(5, 8), c = wallQuads(4, 9);
    if (lk === 'classic') check(a.length > 0 && a === b && a === c, `${lk}: timber walls at even / odd x and z give identical quads`);
    else check(a !== b, `${lk}: the timber braces run across blocks (the quads differ by position)`);
  }
  // two windows stacked in a plaster wall: the colour seen from the front (north) per voxel cell of each window
  const WIN = st('vx_window', { facing: 'north' }), PL = st('vx_plaster_white');
  const frontMap = (r, bx, by, bz) => {
    const m = [];
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      const x = bx + (u + 0.5) / 8, y = by + (v + 0.5) / 8;
      let best = null;
      for (const q of quads(r.vx).concat(quads(r.trans))) {
        if (q.d !== 5) continue;
        const xs = q.v.map(p => p.x), ys = q.v.map(p => p.y), z = q.v[0].z;
        if (z < bz - 1e-6 || z > bz + 1 + 1e-6 || x < Math.min(...xs) || x > Math.max(...xs) || y < Math.min(...ys) || y > Math.max(...ys)) continue;
        if (!best || z < best.z) best = { z, col: q.v[0].col };
      }
      m.push(best ? best.col.toString(16) + '@' + best.z.toFixed(3) : '-');   // colour and depth of the front-most voxel
    }
    return m;
  };
  for (const lk of looks) {
    VR.setLook(lk);
    const r = mesh((x, y, z) => {
      if (y < 4) return GRS;
      if (z !== 8 || x < 3 || x > 7 || y > 8) return 0;
      if (x === 5 && (y === 5 || y === 6)) return WIN;
      return PL;
    });
    const lo = frontMap(r, 5, 5, 8), hi = frontMap(r, 5, 6, 8);
    const at = (m, u, v) => m[v * 8 + u];
    // a closed frame: the frame (colour and depth) on the opening's bottom row (v 1), top row (v 7) and both sides
    // (u 1, u 7), and the sill in front under it (v 0)
    const frameCol = at(lo, 4, 1);
    const closed = (m) => at(m, 4, 1) === frameCol && at(m, 4, 7) === frameCol && at(m, 1, 4) === frameCol && at(m, 7, 4) === frameCol && at(m, 4, 0) !== frameCol && at(m, 4, 0) !== '-';
    if (lk === 'classic') check(closed(lo) && closed(hi) && lo.join() === hi.join(), `${lk}: both stacked windows have their own closed frame and look the same`);
    else check(lo.join() !== hi.join(), `${lk}: stacked windows join (the upper one has no wall strip under its frame)`);
  }
  // two rugs side by side: a border on all four sides of each (Klassisch) — one rug in Nahtlos
  const RUG = st('vx_rug_red');
  for (const lk of looks) {
    VR.setLook(lk);
    const r = mesh((x, y, z) => (y < 4 ? GRS : (y === 4 && z === 8 && (x === 4 || x === 5)) ? RUG : 0));
    const top = quads(r.vx).filter(q => q.d === 2);
    const colAt = (x, z) => { const q = top.find(q => { const xs = q.v.map(p => p.x), zs = q.v.map(p => p.z); return x >= Math.min(...xs) && x <= Math.max(...xs) && z >= Math.min(...zs) && z <= Math.max(...zs); }); return q ? q.v[0].col : -1; };
    const edge = colAt(4 + 0.5 / 8, 8.5), inner = colAt(4.5, 8.5), seamL = colAt(4 + 7.5 / 8, 8.5), seamR = colAt(5 + 0.5 / 8, 8.5);
    if (lk === 'classic') check(edge !== inner && seamL === edge && seamR === edge, `${lk}: each rug has its border at the shared edge`);
    else check(seamL !== edge && seamR !== edge, `${lk}: the two rugs join into one`);
  }
}
VR.setLook('classic');
console.log(fails ? 'FAIL ' + fails : 'OK');
process.exit(fails ? 1 : 0);

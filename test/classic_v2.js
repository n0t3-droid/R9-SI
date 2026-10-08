// Klassisch v2 (v0.39.1): every block visibly its own cube, like the original game.
//  (a) Nahtlos is untouched: the texture arrays built for the Nahtlos look hash exactly as in v0.39
//  (b) every opaque cube texture in Klassisch has a border — its edge texels darker than the inside by ≥ 8 % in
//      mip 0 AND in mip 2 (a border that averages away in the mips is useless at 20 blocks distance); a texture whose
//      recipe bevels its edges (bright top-left, dark bottom-right: metal blocks, polished stone …) counts when every
//      edge differs from the inside by ≥ 8 % — the bevel is its block edge
//  (c) leaves (cut-out cubes) have the border on their solid edge texels, mip 0 and mip 2
//  (d) the natural recipes are "chunky" in Klassisch: 16×16-style texels (every 2×2 cell one colour) — never in Nahtlos
//  (e) the mesher marks the faces of natural blocks and leaves for the shader's per-block shade in Klassisch (w3 bit 15,
//      the macro-mottling bit of Nahtlos, which Klassisch never sets); a stucco wall or planks stay unmarked
//  (f) the shaders carry the per-block shade, turn the normal map with the random tile rotation in Klassisch (never
//      mirror a tile: mirrored neighbours read as one symmetric patch) and the look uniform; the mip sampling stays
//      nearest
//  (g) a chunky texture's relief is one flat facet per 2×2 cell and has no groove at the tile's edge (the low sun would
//      light a groove on one side and hide the outline there)
const VR = require('./load_shared.js');
VR.TEXREC = VR.TEXREC || {}; VR.TEXPRE = VR.TEXPRE || {};
for (const f of ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_layout', 'tex_build']) require('../src/main/' + f + '.js');
const R = VR.R, T = R.T, F = VR.F;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const lum = (A, o) => 0.2126 * A[o] + 0.7152 * A[o + 1] + 0.0722 * A[o + 2];
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const buildAll = (lk) => { VR.setLook(lk); const mk = VR.textureMasks(); return { mk, tex: VR.buildTextureArrays({ names: R.texNames, cubeMask: mk.cube, cutoutMask: mk.cut, bevel: 1, bevelAll: VR.LOOK.rim }) }; };

// ---------------------------------------------------------------- (a) Nahtlos unchanged
console.log('(a) Nahtlos textures unchanged');
// test/tex_ref.json: per texture name, FNV-1a over the layer in every albedo level, then every material level, of the
// v0.39 Nahtlos build (written from v0.41 by the same code). New textures may come (they are laid out among the old
// ones, so the layer indices move); every v0.39 texture must still be there and unchanged.
{
  const { tex } = buildAll('seamless');
  const ref = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'test', 'tex_ref.json'), 'utf8'));
  const idx = new Map(R.texNames.map((n, i) => [n, i]));
  const changed = [], missing = [];
  for (const name of Object.keys(ref)) {
    const l = idx.get(name); if (l === undefined) { missing.push(name); continue; }
    let h = 2166136261 >>> 0;
    tex.albedo.forEach((a, lv) => { const n = tex.size >> lv; h = fnv(h, a.subarray(l * n * n * 4, (l + 1) * n * n * 4)); });
    tex.material.forEach((a, lv) => { const n = tex.size >> lv; h = fnv(h, a.subarray(l * n * n * 4, (l + 1) * n * n * 4)); });
    if (h.toString(16) !== ref[name]) changed.push(name);
  }
  check(missing.length === 0 && changed.length === 0, `the Nahtlos textures of v0.39 are all there and unchanged (${tex.layers} layers, ${Object.keys(ref).length} pinned${missing.length ? ', missing: ' + missing.slice(0, 8).join(' ') : ''}${changed.length ? ', changed: ' + changed.slice(0, 12).join(' ') + (changed.length > 12 ? ' +' + (changed.length - 12) : '') : ''})`);
}

// ---------------------------------------------------------------- (b) the border on every opaque cube texture
console.log('(b) Klassisch: a border on every opaque cube texture, in mip 0 and mip 2');
const { mk, tex } = buildAll('classic');
const N = tex.size;
// the border of layer l at mip lv — ring: the edge texels' mean luminance over the mean of every texel inside;
// edges: for each of the four edges the edge line (without its corners) over the two lines inside it (top, bottom,
// left, right), the weakest one (the largest ratio) decides. cut: only solid texels count.
function border(l, lv, cut) {
  const n = N >> lv, A = tex.albedo[lv], base = l * n * n * 4;
  const at = [(t, d) => d * n + t, (t, d) => (n - 1 - d) * n + t, (t, d) => t * n + d, (t, d) => t * n + (n - 1 - d)];
  const line = (e, d) => { let s = 0, w = 0; for (let t = 1; t < n - 1; t++) { const o = base + at[e](t, d) * 4; if (cut && A[o + 3] < 128) continue; s += lum(A, o); w++; } return w ? s / w : NaN; };
  const edges = [];
  for (let e = 0; e < 4; e++) { const l0 = line(e, 0), inner = (line(e, 1) + line(e, 2)) / 2; edges.push(l0 / inner); }
  let rl = 0, rw = 0, il = 0, iw = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = base + (y * n + x) * 4; if (cut && A[o + 3] < 128) continue; const L = lum(A, o); if (x === 0 || y === 0 || x === n - 1 || y === n - 1) { rl += L; rw++; } else { il += L; iw++; } }
  return { edges, weakest: Math.max(...edges), ring: rw && iw ? (rl / rw) / (il / iw) : NaN };
}
{
  const cubeLayers = [];
  for (let l = 0; l < R.texNames.length; l++) if (mk.cube[l]) cubeLayers.push(l);
  check(cubeLayers.length > 300, `${cubeLayers.length} opaque cube textures`);
  const bad = [], bevelled = [];
  for (const l of cubeLayers) {
    let dark = true, distinct = true;
    for (const lv of [0, 2]) {
      const b = border(l, lv, false);
      if (!(b.ring <= 0.92)) dark = false;
      for (const r of b.edges) if (!(Math.abs(r - 1) >= 0.08)) distinct = false;
    }
    if (dark) continue;
    if (distinct) { bevelled.push(R.texNames[l]); continue; }
    const b0 = border(l, 0, false), b2 = border(l, 2, false);
    bad.push(`${R.texNames[l]} (mip0 ${b0.ring.toFixed(3)}, mip2 ${b2.ring.toFixed(3)})`);
  }
  check(bad.length === 0, `every opaque cube texture has its edge texels ≥ 8 % darker than its inside in mip 0 and mip 2 — ${bad.length} without: ${bad.slice(0, 12).join(', ')}${bad.length > 12 ? ' …' : ''}`);
  check(bevelled.length < cubeLayers.length * 0.25, `${bevelled.length} of them count by their bevel (every edge distinct from the inside): ${bevelled.slice(0, 8).join(', ')}${bevelled.length > 8 ? ' …' : ''}`);
  // the natural terrain reads the border as a dark line on every edge — against the lines right inside it, so a grass
  // side (bright fringe above dark dirt) shows its edges too — in mips 0, 1 and 2
  // (and the natural block-like models: the dirt path and the farmland, outlined like the ground around them)
  for (const n of ['grass_top', 'grass_side', 'dirt', 'stone', 'sand', 'gravel', 'snow', 'log:oak', 'planks:oak', 'andesite', 'ore:coal:stone', 'cobblestone', 'deepstone', 'mycelium_side', 'podzol_side', 'dirt_path_top', 'farmland']) {
    const l = R.texIndex[n]; const b0 = border(l, 0, false), b1 = border(l, 1, false), b2 = border(l, 2, false);
    check(b0.weakest <= 0.92 && b1.weakest <= 0.92 && b2.weakest <= 0.92, `${n}: the weakest edge ${((1 - b0.weakest) * 100).toFixed(1)} % darker than the lines inside it in mip 0, ${((1 - b1.weakest) * 100).toFixed(1)} % in mip 1, ${((1 - b2.weakest) * 100).toFixed(1)} % in mip 2 (ring ${((1 - b0.ring) * 100).toFixed(1)} / ${((1 - b1.ring) * 100).toFixed(1)} / ${((1 - b2.ring) * 100).toFixed(1)} %)`);
  }
  // the mips keep their brightness: the dark ring is paid for by the inside, a block does not get darker with distance
  for (const n of ['grass_top', 'dirt', 'stone', 'sand']) {
    const l = R.texIndex[n], m = [];
    for (const lv of [0, 1, 2, 3]) { const k = N >> lv, A = tex.albedo[lv]; let s = 0; for (let i = 0; i < k * k; i++) s += lum(A, (l * k * k + i) * 4); m.push(s / (k * k)); }
    const spread = (Math.max(...m) - Math.min(...m)) / m[0];
    check(spread < 0.03, `${n}: the mean brightness of mips 0–3 stays within 3 % (${m.map(v => v.toFixed(1)).join(' / ')})`);
  }
}

// ---------------------------------------------------------------- (c) leaves
console.log('(c) leaves');
{
  const names = ['leaves:oak', 'leaves:spruce', 'leaves:birch', 'leaves:dark_oak', 'leaves:cherry'];
  for (const n of names) {
    const l = R.texIndex[n];
    check(mk.cut[l] === 1 && !mk.cube[l], `${n} is a cut-out, not an opaque cube`);
    const b0 = border(l, 0, true), b2 = border(l, 2, true);
    check(b0.weakest <= 0.92 && b2.weakest <= 0.92, `${n}: the weakest solid edge ${((1 - b0.weakest) * 100).toFixed(1)} % darker than the lines inside it in mip 0, ${((1 - b2.weakest) * 100).toFixed(1)} % in mip 2`);
  }
  // holes stay holes: the leaf's coverage at mip 0 is unchanged by the border (alpha is never touched)
  const l = R.texIndex['leaves:oak'], A = tex.albedo[0]; let holes = 0; for (let i = 0; i < N * N; i++) if (A[(l * N * N + i) * 4 + 3] < 128) holes++;
  check(holes > N * N * 0.02 && holes < N * N * 0.6, `oak leaves keep their holes (${(holes / (N * N) * 100).toFixed(0)} % of the texels)`);
}

// ---------------------------------------------------------------- (d) chunky natural recipes
console.log('(d) chunky texels');
{
  const chunky = (l, lv) => { const n = N >> lv, A = tex.albedo[lv], base = l * n * n * 4; let same = 0, tot = 0; for (let y = 2; y < n - 2; y += 2) for (let x = 2; x < n - 2; x += 2) { const o = base + (y * n + x) * 4; tot++; let eq = true; for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) { const q = base + ((y + dy) * n + x + dx) * 4; for (let c = 0; c < 4; c++) if (A[o + c] !== A[q + c]) eq = false; } if (eq) same++; } return same / tot; };
  for (const n of ['grass_top', 'grass_side', 'dirt', 'stone', 'sand', 'gravel', 'snow', 'leaves:oak', 'log:oak', 'andesite', 'cobblestone', 'deepstone', 'dirt_path_top', 'farmland']) {
    const k = chunky(R.texIndex[n], 0);
    check(k >= 0.98, `${n} is chunky in Klassisch: ${(k * 100).toFixed(0)} % of its inner 2×2 cells are one colour`);
  }
  // not the built materials: planks keep their fine seams, stucco its even surface
  for (const n of ['planks:oak', 'stucco_white', 'stone_bricks', 'bricks']) check(chunky(R.texIndex[n], 0) < 0.9, `${n} is not pixelated (${(chunky(R.texIndex[n], 0) * 100).toFixed(0)} %)`);
  const { tex: seam } = buildAll('seamless');
  const chunkyS = (name) => { const l = R.texIndex[name], A = seam.albedo[0], base = l * N * N * 4; let same = 0, tot = 0; for (let y = 2; y < N - 2; y += 2) for (let x = 2; x < N - 2; x += 2) { const o = base + (y * N + x) * 4, q = base + ((y + 1) * N + x + 1) * 4; tot++; if (A[o] === A[q] && A[o + 1] === A[q + 1] && A[o + 2] === A[q + 2]) same++; } return same / tot; };
  for (const n of ['grass_top', 'dirt', 'stone']) check(chunkyS(n) < 0.6, `${n} keeps its 32×32 detail in Nahtlos (${(chunkyS(n) * 100).toFixed(0)} % of the cells one colour)`);
}

// ---------------------------------------------------------------- (g) the chunky relief
console.log('(g) chunky relief: flat facets, no edge groove');
{
  const M = tex.material[0];
  for (const n of ['grass_top', 'dirt', 'stone', 'sand', 'leaves:oak', 'ore:coal:stone']) {
    const l = R.texIndex[n], base = l * N * N * 4;
    let facets = 0, cells = 0, edge = 0, ew = 0, inner = 0, iw = 0;
    for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) {
      cells++; const o = base + (y * N + x) * 4; let eq = true;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) { const q = base + ((y + dy) * N + x + dx) * 4; if (M[q] !== M[o] || M[q + 1] !== M[o + 1]) eq = false; }
      if (eq) facets++;
    }
    // the normal's tilt toward the tile's outside on the two outer texel lines vs. the tilt anywhere inside
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const o = base + (y * N + x) * 4, nx = M[o] / 127.5 - 1, ny = M[o + 1] / 127.5 - 1, e = Math.min(x, y, N - 1 - x, N - 1 - y);
      const out = (x <= 1 ? -nx : 0) + (x >= N - 2 ? nx : 0) + (y <= 1 ? -ny : 0) + (y >= N - 2 ? ny : 0);
      if (e <= 1) { edge += out; ew++; } else { inner += Math.abs(nx) + Math.abs(ny); iw++; }
    }
    check(facets === cells && edge / ew < 0.5 * inner / iw + 0.02, `${n}: ${facets}/${cells} cells one flat facet; tilt outward at the edge ${(edge / ew).toFixed(3)} (inside |n| ${(inner / iw).toFixed(3)})`);
  }
}

// ---------------------------------------------------------------- (e) the mesher's per-block shade bit
console.log('(e) mesher: per-block shade bit');
{
  const PAD = VR.MESH_PAD, PS = VR.MESH_PS, PSS = PS * PS;
  const st = (n) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); return t.defaultState; };
  const mesh = (fn) => { const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000), tint = new Uint16Array(PSS).fill(0xffff); for (let py = 0; py < PS; py++) for (let pz = 0; pz < PS; pz++) for (let px = 0; px < PS; px++) blocks[py * PSS + pz * PS + px] = fn(px - PAD, py - PAD, pz - PAD) || 0; return VR.meshSection({ blocks, light, grass: tint, foliage: tint, water: tint, sy: 0, ox: 0, oz: 0, fancyLeaves: true, smooth: true, vxLod: true }); };
  const bits = (a) => { const out = { set: 0, clear: 0 }; for (let q = 0; q < a.length; q += 32) { if ((a[q + 3] >> 15) & 1) out.set++; else out.clear++; } return out; };
  const scenes = { grass: ['grass_block', 0], dirt: ['dirt', 0], stone: ['stone', 0], sand: ['sand', 0], leaves: ['oak_leaves', 1], snow: ['snow_block', 0], ore: ['coal_ore', 0], cobble: ['cobblestone', 0], stucco: ['stucco_white', 0], planks: ['oak_planks', 0], bricks: ['stone_bricks', 0] };
  for (const lk of ['classic', 'seamless']) {
    VR.setLook(lk);
    const got = {};
    for (const k in scenes) { const s = st(scenes[k][0]); const r = mesh((x, y, z) => (y === 4 && x >= 4 && x <= 6 && z >= 4 && z <= 6) ? s : 0); got[k] = bits(scenes[k][1] ? r.cutout : r.opaque); }
    const allSet = (k) => got[k].set > 0 && got[k].clear === 0, noneSet = (k) => got[k].set === 0 && got[k].clear > 0;
    if (lk === 'classic') {
      const nat = ['grass', 'dirt', 'stone', 'sand', 'leaves', 'snow', 'ore', 'cobble'], built = ['stucco', 'planks', 'bricks'];
      check(nat.every(allSet), `classic: every face of the natural blocks carries the per-block shade bit (${nat.map(k => k + ' ' + got[k].set + '/' + got[k].clear).join(', ')})`);
      check(built.every(noneSet), `classic: the built materials do not (${built.map(k => k + ' ' + got[k].set + '/' + got[k].clear).join(', ')})`);
    } else {
      // Nahtlos: the bit is the macro mottling of F.MACRO blocks, as in v0.39 — leaves and stucco never
      check(allSet('grass') && allSet('stone') && allSet('sand') && noneSet('leaves') && noneSet('stucco') && noneSet('planks'), `seamless: the bit stays the macro mottling (grass ${got.grass.set}/${got.grass.clear}, leaves ${got.leaves.set}/${got.leaves.clear}, stucco ${got.stucco.set}/${got.stucco.clear})`);
    }
  }
  VR.setLook('classic');
}

// ---------------------------------------------------------------- (f) shader and renderer sources
console.log('(f) shaders');
{
  const fs = require('fs');
  const sh = fs.readFileSync(__dirname + '/../src/main/shaders.js', 'utf8'), rd = fs.readFileSync(__dirname + '/../src/main/renderer.js', 'utf8');
  const terrain = sh.slice(sh.indexOf('S.TERRAIN_FS'), sh.indexOf('S.TRANS_FS'));
  check(/uniform float u_blockVar;/.test(terrain) && /u_blockVar > 0\.5/.test(terrain) && /hash13\(cellF/.test(terrain), 'the block fragment path shades every natural block by a hash of its world cell when u_blockVar is on');
  check(/if \(u_blockVar > 0\.5\) \{ if \(rot == 1u\) nxy = vec2\(-nxy\.y, nxy\.x\); else if \(rot == 2u\) nxy = -nxy; else if \(rot == 3u\) nxy = vec2\(nxy\.y, -nxy\.x\); \}/.test(terrain), 'Klassisch turns the normal map with the tile rotation');
  check(!/flip/.test(terrain), 'no tile is mirrored (mirrored neighbours read as one symmetric patch)');
  // crisp texels: the sample snaps to the texel centre up close (whatever the sampler's anisotropy does), with a
  // one-pixel blend at the texel edge; a texel smaller than a pixel passes unchanged
  {
    const snapSrc = /if \(u_blockVar > 0\.5\) \{\s*vec2 tx = fu \* 32\.0, seam = floor\(tx \+ 0\.5\), tw = max\(\(abs\(dx\) \+ abs\(dy\)\) \* 32\.0, vec2\(1e-3\)\);\s*fu = \(seam \+ clamp\(\(tx - seam\) \/ tw, -0\.5, 0\.5\)\) \/ 32\.0;/;
    check(snapSrc.test(terrain), 'Klassisch snaps the block texture sample to its texel centre up close');
    // the shader's formula in JS: t = fu·32, seam = the nearest texel edge, t' = seam + clamp((t − seam) / w, ±½)
    const snap = (f, w) => { const t = f * 32, seam = Math.floor(t + 0.5); return (seam + Math.max(-0.5, Math.min(0.5, (t - seam) / w))) / 32; };
    // a texel 10 pixels wide: inside it (more than half a pixel from its edges) the sample sits on its centre …
    const centre = [0.1, 0.37, 0.5, 0.93, 0.3123].every(f => { const t = f * 32, d = Math.min(t % 1, 1 - t % 1); return d < 0.05 || Math.abs(snap(f, 0.1) * 32 - (Math.floor(t) + 0.5)) < 1e-9; });
    // … within half a pixel of an edge it ramps across it (here 0.02 texels before the edge of texel 9: 30 % into texel 10's blend)
    const ramp = Math.abs(snap(9.98 / 32, 0.1) * 32 - 9.8) < 1e-9;
    // a texel one pixel wide: the coordinate passes unchanged
    const same = [0.1, 0.37, 0.5, 0.93].every(f => Math.abs(snap(f, 1) - f) < 1e-9);
    check(centre && ramp && same, `the snap: texel centres when a texel spans 10 pixels (${centre}), a half-pixel ramp at its edge (${ramp}), the coordinate unchanged at a texel a pixel (${same})`);
    check(/vec2 tx = fu \* 32\.0, seam = floor\(tx \+ 0\.5\), tw = max\(\(abs\(gdx\) \+ abs\(gdy\)\) \* 32\.0/.test(sh.slice(sh.indexOf('S.TRANS_FS'), sh.indexOf('S.SHADOW_VS'))), 'the glass is snapped the same way');
  }
  // the normal turn is the inverse of the uv turn: a height field sampled through the turned uv has its gradient turned back
  {
    const turn = (r, f) => r === 1 ? [f[1], 1 - f[0]] : r === 2 ? [1 - f[0], 1 - f[1]] : r === 3 ? [1 - f[1], f[0]] : f;
    const back = (r, n) => r === 1 ? [-n[1], n[0]] : r === 2 ? [-n[0], -n[1]] : r === 3 ? [n[1], -n[0]] : n;
    const h = (u, v) => 0.7 * u + 0.2 * v, gradTex = [-0.7, -0.2];   // normal ∝ −∇h in texture space
    let ok = true;
    for (let r = 0; r < 4; r++) {
      const e = 1e-4, f = [0.3, 0.6], hf = (a, b) => { const t = turn(r, [a, b]); return h(t[0], t[1]); };
      const gf = [-(hf(f[0] + e, f[1]) - hf(f[0] - e, f[1])) / (2 * e), -(hf(f[0], f[1] + e) - hf(f[0], f[1] - e)) / (2 * e)];
      const b = back(r, gradTex);
      if (Math.abs(b[0] - gf[0]) > 1e-6 || Math.abs(b[1] - gf[1]) > 1e-6) ok = false;
    }
    check(ok, 'the shader\'s normal turn matches the uv turn for all four rotations');
  }
  const lod = sh.slice(sh.indexOf('S.LOD_FS'), sh.indexOf('S.VOX_VS'));
  check(/u_blockVar/.test(lod), 'the far terrain (LOD) follows the look too');
  check(/u_blockVar/.test(rd) && /LOOK\.vary/.test(rd), 'the renderer sets u_blockVar from VR.LOOK.vary');
  check(VR.LOOK.vary === true && (VR.setLook('seamless'), VR.LOOK.vary === false) && (VR.setLook('classic'), VR.LOOK.vary === true), 'VR.LOOK.vary is on in Klassisch, off in Nahtlos');
  check(/TEXTURE_MAG_FILTER, gl\.NEAREST\)/.test(rd) && /TEXTURE_MIN_FILTER, gl\.NEAREST_MIPMAP_LINEAR\)/.test(rd), 'the block textures sample nearest (mag) and nearest within a mip level (min)');
}
VR.setLook('classic');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

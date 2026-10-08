// F2 · Texturen & Materialien (node). Every opaque cube texture has a non-flat normal (the rms of its normal xy over
// the interior texels 4…27 is at least 0.05; a recipe with its own relief keeps it). The material channels are sane
// (opaque albedo, roughness in range, normals not saturated). The relief moves the normal map and nothing else: the
// albedo, the roughness and the glow are the same with and without it, so the Klassisch outline and the colours stay.
// The family table covers every layer with the expected families. The relief pass's own time is measured inside the
// forge (the machine is shared, so the whole forge's time is only printed): it stays a small part of the forge.
const V = require('./load_shared.js');
for (const f of ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_layout', 'tex_mat', 'tex_build']) require('../src/main/' + f + '.js');
const R = V.R, L = R.texNames.length, MAT = V.MAT, N = V.TX.N, LV = V.TEX_LEVELS;
const mk = V.textureMasks();
let bad = 0;
const fail = (msg) => { bad++; console.log('  ✗ ' + msg); };
const ok = (c, msg) => { if (!c) fail(msg); else console.log('  ✓ ' + msg); };
const build = (relief) => V.buildTextureArrays({ names: R.texNames, cubeMask: mk.cube, cutoutMask: mk.cut, leafMask: mk.leaf, blockMask: mk.block, bevel: 1, bevelAll: true, classic: true, relief });

// forge: the relief's own time is the sum of its calls inside one build; the whole build is timed too (printed only)
let reliefMs = 0; const realRelief = VR.matRelief;
VR.matRelief = function (img, fam, seed) { const t = performance.now(); const r = realRelief(img, fam, seed); reliefMs += performance.now() - t; return r; };
build(false);
let t0 = Date.now(); const off = build(false); const msOff = Date.now() - t0;
reliefMs = 0; t0 = Date.now(); const on = build(true); const msOn = Date.now() - t0; const relMs = reliefMs;
VR.matRelief = realRelief;
console.log(`forge of ${L} layers: ${msOn} ms with the relief (${relMs.toFixed(0)} ms of it the relief), ${msOff} ms without`);

// the normal's rms over the interior of level 0 (the bevel's groove sits in texels 0…3 and 28…31)
const normRms = (out, l) => {
  const m = out.material[0], base = l * N * N * 4; let s2 = 0, n = 0;
  for (let y = 4; y < N - 4; y++) for (let x = 4; x < N - 4; x++) { const o = base + (y * N + x) * 4; const nx = m[o] / 127.5 - 1, ny = m[o + 1] / 127.5 - 1; s2 += nx * nx + ny * ny; n++; }
  return Math.sqrt(s2 / n);
};
const cubes = []; for (let l = 0; l < L; l++) if (mk.cube[l]) cubes.push(l);
const flat = cubes.filter(l => normRms(on, l) < 0.05).map(l => R.texNames[l]);
ok(cubes.length > 100 && flat.length === 0, `every opaque cube texture has a non-flat normal (${cubes.length} cubes)` + (flat.length ? `: ${flat.length} flat, e.g. ${flat.slice(0, 12).join(', ')}` : ''));

// the relief changes the normal map only: albedo (all levels), roughness and glow (level 0 and every level) are the same
const differs = (a, b, chans) => { let c = 0; for (let i = 0; i < a.length; i++) if (chans === null || chans.includes(i & 3)) { if (a[i] !== b[i]) c++; } return c; };
let dAlb = 0, dRough = 0, dGlow = 0;
for (let lv = 0; lv < LV; lv++) {
  dAlb += differs(on.albedo[lv], off.albedo[lv], null);
  dRough += differs(on.material[lv], off.material[lv], [2]);
  dGlow += differs(on.material[lv], off.material[lv], [3]);
}
ok(dAlb === 0 && dRough === 0 && dGlow === 0, `the relief changes only the normal (albedo ${dAlb}, roughness ${dRough}, glow ${dGlow} texels differ)`);
let dNorm = 0; for (let lv = 0; lv < LV; lv++) dNorm += differs(on.material[lv], off.material[lv], [0, 1]);
ok(dNorm > 0, `the relief does change the normal map (${dNorm} normal bytes differ)`);

// material statistics of the opaque cubes: an opaque albedo, roughness in range, normals not saturated
let badAlpha = [], badRough = [], badSat = [];
for (const l of cubes) {
  const a = on.albedo[0], m = on.material[0], base = l * N * N * 4;
  let al = 0, ro = 0, sat = 0, n = 0;
  for (let i = 0; i < N * N; i++) {
    const o = base + i * 4;
    al += a[o + 3]; ro += m[o + 2] / 255; n++;
    if (Math.abs(m[o] / 127.5 - 1) > 0.98 || Math.abs(m[o + 1] / 127.5 - 1) > 0.98) sat++;
  }
  const name = R.texNames[l];
  if (al / n < 240 && name !== 'grass_side') badAlpha.push(name);   // grass sides carry the tint as an alpha mask
  const r = ro / n; if (!(r >= 0.03 && r <= 0.99)) badRough.push(name + '=' + r.toFixed(2));
  if (sat / n >= 0.1) badSat.push(name);
}
ok(badAlpha.length === 0, `opaque cubes have an opaque albedo${badAlpha.length ? ': ' + badAlpha.slice(0, 8).join(', ') : ''}`);
ok(badRough.length === 0, `cube roughness in 0.03…0.99${badRough.length ? ': ' + badRough.slice(0, 8).join(', ') : ''}`);
ok(badSat.length === 0, `cube normals not saturated${badSat.length ? ': ' + badSat.slice(0, 8).join(', ') : ''}`);

// the family table: one byte per layer, the expected family of the known names, every family in use
const fam = V.matFamilies(R.texNames);
ok(fam.length === L && Array.from(fam).every(f => f >= 0 && f <= 5), `family table: one byte per layer (${L}), values 0…5`);
const want = [['stone', MAT.STONE], ['gravel', MAT.STONE], ['stone_bricks', MAT.STONE], ['ore:iron:stone', MAT.STONE], ['planks:oak', MAT.WOOD], ['log_top:oak', MAT.WOOD],
  ['wool:white', MAT.FABRIC], ['copper:block:0', MAT.METAL], ['block:iron', MAT.METAL], ['stucco_white', MAT.PLASTER], ['glass', MAT.NONE], ['grass_top', MAT.NONE], ['sandstone', MAT.STONE]];
for (const [n, f] of want) {
  const l = R.texIndex[n];
  if (l === undefined) { fail(`no texture named ${n}`); continue; }
  ok(fam[l] === f, `${n} is family ${f} (${fam[l]})`);
}
const count = [0, 0, 0, 0, 0, 0]; for (const f of fam) count[f]++;
ok(count[MAT.STONE] > 20 && count[MAT.WOOD] > 10 && count[MAT.FABRIC] > 3 && count[MAT.METAL] > 5 && count[MAT.PLASTER] > 5, `every family in use: ${count.join(' ')}`);

// the time: a loose bound (the relief pass is a few hundred thousand noise taps on a 2-core machine)
ok(relMs <= Math.max(400, msOn * 0.2), `the relief pass stays a small part of the forge (${relMs.toFixed(0)} ms of ${msOn} ms)`);

console.log(bad ? 'FAILED ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);

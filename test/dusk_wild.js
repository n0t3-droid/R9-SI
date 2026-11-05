// v-dusk part A · the last animal nits from f-wild3's self-review (src/main/wildheart.js), node:
//  (a) the fox's eye: a lighter amber iris (luminance 0.30–0.45, red > green > blue), no darkened fur over its eyes
//      (the cell over an eye's top row not darker than the fur beside it)
//  (b) the fawn's face has its body's ground colour (the lower quartile of the head's luminance within 0.05 of the body's),
//      only the spots are at half
//  (c) kittens read on grass at 8 m: the lower flanks and the chest are light (≥ 45 % of the side silhouette's cells
//      luminance ≥ 0.5) — a cream chest reaching up the flanks
//   bash test/wt_run.sh dusk_wild.js 300
const VR = require('./load_shared.js');
VR.SHADERS = VR.SHADERS || {};
require(__dirname + '/../src/shared/wildbond.js');
require(__dirname + '/../src/main/voxmodels.js');
require(__dirname + '/../src/main/wildheart.js');
const M = VR.VOXMODELS, W = VR.WildHeart;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const lum = (c) => { const [r, g, b] = rgb(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const each = (g, fn) => { for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const v = g.get(x, y, z); if (v) fn(x, y, z, v); } };
const med = (a) => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };

console.log('(a) the fox\'s eye');
for (const baby of [false, true]) {
  const def = M[W.vkey('glimmer_fox', 1, baby)](), head = def.parts.head.grid, E = def.eyes || [];
  const ir = E.length ? E[0].iris : 0, [r, g, b] = rgb(ir);
  check(lum(ir) >= 0.30 && lum(ir) <= 0.45 && r > g && g > b, `${baby ? 'kit' : 'fox'}: amber iris (L ${lum(ir).toFixed(2)}, #${ir.toString(16)})`);
  const eyeSet = new Set(); for (const e of E) for (const [x, y, z] of e.cells) eyeSet.add(x + ',' + y + ',' + z);
  let worst = 0;
  for (const e of E) for (const [x, y, z] of e.cells) {
    if (y !== e.top) continue;
    // the fur over it: one or two rows up, up to three cells back (what you see over the eye from the front)
    for (let k = 1; k <= 2; k++) for (let dz = 0; dz <= 3; dz++) {
      const v = head.get(x, y + k, z + dz); if (!v || eyeSet.has(x + ',' + (y + k) + ',' + (z + dz))) continue;
      const nb = []; for (let zz = 0; zz < head.sz; zz++) for (let xx = 0; xx < head.sx; xx++) { const q = head.get(xx, y, zz); if (q && !eyeSet.has(xx + ',' + y + ',' + zz)) nb.push(lum(q & 0xffffff)); }
      if (nb.length) worst = Math.max(worst, med(nb) - lum(v & 0xffffff));   // (against the fur of the eye's own row)
    }
  }
  check(worst <= 0.04, `${baby ? 'kit' : 'fox'}: no dark brow over the eyes (darkest step ${worst.toFixed(3)})`);
}

console.log('(b) the fawn\'s face');
for (const baby of [true, false]) {
  const def = M[W.vkey('glimmer_deer', 1, baby)](), P = def.parts;
  const L = (g) => { const a = []; each(g, (x, y, z, v) => { if (!((v >> 24) & 1)) a.push(lum(v & 0xffffff)); }); a.sort((p, q) => p - q); return a[Math.floor(a.length * 0.25)]; };   // (the ground: the lower quartile — the spots are the light half)
  const hb = L(P.head.grid), bb = L(P.body.grid);
  check(Math.abs(hb - bb) <= 0.05, `${baby ? 'fawn' : 'doe'}: head ground like the body (head ${hb.toFixed(3)}, body ${bb.toFixed(3)})`);
}

console.log('(c) kittens on grass');
for (const baby of [true, false]) {
  const def = M[W.vkey('moss_cat', 1, baby)](), g = def.parts.body.grid;
  // the side silhouette: per (y, z) the outermost cell toward -x
  let n = 0, light = 0;
  for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const v = g.get(x, y, z); if (v) { n++; if (lum(v & 0xffffff) >= 0.5) light++; break; } }
  check(n && light / n >= 0.45, `${baby ? 'kitten' : 'cat'}: light chest and flanks (${light}/${n} side cells L ≥ 0.5)`);
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

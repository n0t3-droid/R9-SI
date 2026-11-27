// ============================================================================
// R9-SI Lab · Karte von oben: ein Ausschnitt der Welt aus der Vogelperspektive, jeder Block als Kachel seiner Textur.
// Map from above: a box of the world seen straight down, every block a tile of its own texture (zebra stripes, dashes
// and planks show), a little darker where the ground lies lower.
//   map({ g, x0, x1, z0, z1, px: 6, yCap: 120 }) → image   (yCap: blocks above it are left out — the sky isles)
//   node lab/lab.js map --seed 3616214791 --vgen 21 --at 294,-1044 --r 40 --out lab/out/map.png
// ============================================================================
'use strict';
const W = require('../lib/world.js'), C = require('../lib/colors.js');
const SEE = (s) => W.solid(s) || W.fluid(s) || W.leaves(s);
module.exports = function map(o) {
  const { g, x0, x1, z0, z1 } = o, px = o.px || 6, yCap = o.yCap === undefined ? 255 : o.yCap;
  const w = x1 - x0 + 1, h = z1 - z0 + 1, img = { w: w * px, h: h * px, data: new Uint8Array(w * px * h * px * 4) };
  // the reference height: the median ground of the box (relief shading round it)
  const ys = [];
  for (let z = z0; z <= z1; z += 4) for (let x = x0; x <= x1; x += 4) ys.push(W.top(g, x, z, yCap, SEE).y);
  ys.sort((a, b) => a - b); const yRef = ys[ys.length >> 1] || 64;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const t = W.top(g, x, z, yCap, SEE); if (!t.s) continue;
    const tile = C.tile(t.s, 'top', px), k = Math.max(0.68, Math.min(1.18, 1 + (t.y - yRef) * 0.014));
    // a see-through top (water, glass) over what lies under it
    let under = null;
    if (tile[3] < 250 || W.fluid(t.s)) { const u = W.top(g, x, z, t.y - 1, (s) => W.solid(s)); if (u.s) under = C.tile(u.s, 'top', px); }
    for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
      const si = (j * px + i) * 4, di = (((z - z0) * px + j) * img.w + (x - x0) * px + i) * 4, a = tile[si + 3] / 255;
      for (let c = 0; c < 3; c++) { const b = under ? under[si + c] * 0.6 : 0; img.data[di + c] = Math.min(255, (tile[si + c] * a + b * (1 - a)) * k); }
      img.data[di + 3] = 255;
    }
  }
  return img;
};

// f-stipple2 · the texture energy of a picture's region (review R52-05: "the ground 2–15 m ahead flat slabs without
// texture"): the mean |Laplacian| of the luma, |4c − n − s − e − w|, over the region's inner pixels. A block texture seen
// from 2–15 m (16 texels a block, several texels a pixel or more) reads well above FLAT; a flat stand-in tile — one albedo
// per cell, a few block shades, a soft gradient — reads under it (calibrated in test/stipple2.js). The walking test
// (test/walk_stipple.mjs) applies it to the screen tiles whose centre ray meets the ground 2–15 m ahead (a render probe).
//   require('./tex_energy.js').energy(L, w, h, x0, y0, x1, y1) → mean |Laplacian| (luma units)
const FLAT = 4.0;
function energy(L, w, h, x0, y0, x1, y1) {
  x0 = Math.max(1, x0 | 0); y0 = Math.max(1, y0 | 0); x1 = Math.min(w - 1, x1 | 0); y1 = Math.min(h - 1, y1 | 0);
  let s = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x; s += Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]); n++;
  }
  return n ? s / n : 0;
}
module.exports = { energy, FLAT };

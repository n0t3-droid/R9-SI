// node helper (W2 tests): the average colour of every texture layer, built from the game's own recipes the way the
// texture worker does (alpha-weighted, 0…1, 4 per layer) — and a one-texel "texture array" from it, so the Studio's
// VR.BlockColors (src/studio/colors.js) and VR.IsoPic.texColors work in node with the real block colours.
// require('./tex_avg.js') → { avg: Float32Array, texInfo: {albedo: [Uint8Array], size: 1, layers, avgColor} }
// (needs load_shared.js first). About three seconds: every recipe is drawn once.
const ROOT = require('path').join(__dirname, '..');
for (const m of ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox']) require(ROOT + '/src/main/' + m + '.js');
const R = VR.R, REC = VR.TEXREC, PRE = VR.TEXPRE, L = R.texNames.length;
const avg = new Float32Array(L * 4), alb = new Uint8Array(L * 4);
R.texNames.forEach((n, l) => {
  let fn = null;
  if (REC[n]) fn = () => REC[n]();
  else { const base = n.split('#')[0], fr = n.includes('#') ? +n.split('#')[1] : 0; if (REC[base]) fn = () => REC[base](fr); else { const p = base.split(':'); if (PRE[p[0]]) fn = () => PRE[p[0]](...p.slice(1), fr); } }
  let img = null; try { img = fn && fn(); } catch (e) { img = null; }
  if (!img || !img.c) { avg.set([0.5, 0.5, 0.5, 1], l * 4); return; }
  const c = img.c, NN = c.length / 4; let r = 0, g = 0, b = 0, wa = 0;
  const cl = (v) => Math.max(0, Math.min(1, v));
  for (let i = 0; i < NN; i++) { const a = cl(c[i * 4 + 3]); r += cl(c[i * 4]) * a; g += cl(c[i * 4 + 1]) * a; b += cl(c[i * 4 + 2]) * a; wa += a; }
  avg[l * 4] = wa ? r / wa : 0; avg[l * 4 + 1] = wa ? g / wa : 0; avg[l * 4 + 2] = wa ? b / wa : 0; avg[l * 4 + 3] = wa / NN;
});
for (let i = 0; i < L * 4; i++) alb[i] = Math.round(avg[i] * 255);
module.exports = { avg, texInfo: { albedo: [alb], size: 1, layers: L, avgColor: avg } };

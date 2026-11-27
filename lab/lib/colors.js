// ============================================================================
// R9-SI Lab · Blockfarben aus den echten Texturen des Spiels (die Rezepte von src/main, in node gezeichnet).
// Block colours from the game's real textures (test/tex_avg.js draws every recipe once, about a second), for the maps and
// the iso pictures: colourOf(state, face) → [r, g, b, a] (face: 'top' · 'front' · 'right'), shaded like IsoPic's faces.
// ============================================================================
'use strict';
require('./world.js');
require('../../src/shared/isopic.js');
const TA = require('../../test/tex_avg.js');
const C = module.exports = {};
const base = VR.IsoPic.texColors(TA.avg);
C.face = (s, face) => base(s, face);
// the map colour of a block seen from straight above, a little darker where the ground lies lower (relief)
C.top = function (s, y, yRef) {
  const c = base(s, 'top'), k = yRef === undefined ? 1 : Math.max(0.7, Math.min(1.15, 1 + (y - yRef) * 0.012));
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k), 255];
};
// a block face as an n × n tile from its texture (the pattern kept: zebra stripes, dashes, planks), its tint applied by
// matching the tile's mean to the face colour above → Uint8Array n·n·4
const R = VR.R, REC = VR.TEXREC, PRE = VR.TEXPRE, FACE = { top: 2, front: 5, right: 0 };
const imgCache = new Map(), tileCache = new Map();
function texImage(layer) {
  if (imgCache.has(layer)) return imgCache.get(layer);
  const n = R.texNames[layer]; let fn = null;
  if (REC[n]) fn = () => REC[n]();
  else { const b = n.split('#')[0], fr = n.includes('#') ? +n.split('#')[1] : 0; if (REC[b]) fn = () => REC[b](fr); else { const p = b.split(':'); if (PRE[p[0]]) fn = () => PRE[p[0]](...p.slice(1), fr); } }
  let img = null; try { img = fn && fn(); } catch (e) { img = null; }
  imgCache.set(layer, img && img.c ? img : null);
  return imgCache.get(layer);
}
C.tile = function (s, face, n) {
  const f = FACE[face] === undefined ? 2 : FACE[face], key = s * 64 + f * 8 + n;
  let t = tileCache.get(key); if (t) return t;
  t = new Uint8Array(n * n * 4);
  const layer = R.T.tex[s * 6 + f] & 0xfff, img = texImage(layer), col = base(s, face);
  if (!img) { for (let i = 0; i < n * n; i++) t.set([col[0], col[1], col[2], col[3]], i * 4); tileCache.set(key, t); return t; }
  const N = Math.round(Math.sqrt(img.c.length / 4)), k = N / n, g = (v) => Math.pow(Math.max(0, Math.min(1, v)), 1 / 1.6) * 255;
  const acc = new Float32Array(n * n * 4); let mr = 0, mg = 0, mb = 0, ma = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4, a = Math.max(0, Math.min(1, img.c[i + 3])), j = ((Math.floor(y / k)) * n + Math.floor(x / k)) * 4;
    acc[j] += g(img.c[i]) * a; acc[j + 1] += g(img.c[i + 1]) * a; acc[j + 2] += g(img.c[i + 2]) * a; acc[j + 3] += a;
  }
  for (let j = 0; j < n * n; j++) { const a = acc[j * 4 + 3]; if (a > 0) { acc[j * 4] /= a; acc[j * 4 + 1] /= a; acc[j * 4 + 2] /= a; mr += acc[j * 4] * a; mg += acc[j * 4 + 1] * a; mb += acc[j * 4 + 2] * a; ma += a; } }
  const sr = ma && mr ? col[0] / (mr / ma) : 1, sg = ma && mg ? col[1] / (mg / ma) : 1, sb = ma && mb ? col[2] / (mb / ma) : 1;
  for (let j = 0; j < n * n; j++) { const a = acc[j * 4 + 3] / (k * k); t[j * 4] = Math.min(255, acc[j * 4] * sr); t[j * 4 + 1] = Math.min(255, acc[j * 4 + 1] * sg); t[j * 4 + 2] = Math.min(255, acc[j * 4 + 2] * sb); t[j * 4 + 3] = Math.round(Math.min(1, a) * 255); }
  tileCache.set(key, t);
  return t;
};

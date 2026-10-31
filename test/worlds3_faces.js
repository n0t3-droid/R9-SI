// u-worlds3 · the natives' smooth faces seen from the front (node; a picture for the eyes, not a check):
// the fine head's front voxels per species, with simple light from the depth → test/shots/worlds3_faces.ppm
// regress: skip
require('./dom_stub.js');
require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/villages.js'); require('../src/main/festival.js'); require('../src/main/worldlife.js');
const fs = require('fs'), path = require('path');
const KINDS = ['aqua', 'ocker', 'zinn', 'basalt', 'opal', null], S = 8, W = 48, Hh = 56;
const img = Buffer.alloc(W * S * KINDS.length * Hh * S * 3, 30);
const IW = W * S * KINDS.length;
KINDS.forEach((k, n) => {
  const L = VR.Folk.look(77, 'farmer', 'adult', null, k ? 'sp:' + k : 'v'), G = VR.Folk.buildFine(L).fine.head;
  for (let Y = 0; Y < G.sy; Y++) for (let X = 0; X < G.sx; X++) {
    let c = 0, z = 0; for (let Z = 0; Z < G.sz; Z++) { const v = G.c[G.i(X, Y, Z)]; if (v) { c = v; z = Z; break; } }
    if (!c) continue;
    const sh = Math.max(0.45, 1 - z * 0.035);
    // (the grid's x runs to the head's left: mirror so the picture shows the face as seen)
    const px = n * W + Math.floor((W - G.sx) / 2) + (G.sx - 1 - X), py = Hh - 4 - Y;
    if (px < n * W || px >= (n + 1) * W || py < 0) continue;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const o = ((py * S + dy) * IW + px * S + dx) * 3; img[o] = ((c >> 16) & 255) * sh; img[o + 1] = ((c >> 8) & 255) * sh; img[o + 2] = (c & 255) * sh; }
  }
});
const out = path.join(__dirname, 'shots', 'worlds3_faces.ppm');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([Buffer.from(`P6 ${IW} ${Hh * S} 255\n`), img]));
console.log(out);

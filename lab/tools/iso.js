// ============================================================================
// R9-SI Lab · Schrägbild: ein Ausschnitt der Welt als kleine Würfel in Isometrie, in den echten Blockfarben.
// Iso picture: a box of the world as little cubes (VR.IsoPic, the same drawer as the wizard's and the Bauhand's pictures),
// coloured from the game's textures. view: which side faces you — 'south' (default: the picture's front is +z, so a
// building whose door faces south shows its door), 'north', 'east', 'west'.
//   iso({ g, x0, x1, y0, y1, z0, z1, view: 'south', W: 1200, H: 900 }) → image (transparent ground)
// ============================================================================
'use strict';
const W = require('../lib/world.js'), C = require('../lib/colors.js');
module.exports = function iso(o) {
  const { g, x0, x1, y0, y1, z0, z1 } = o, view = o.view || 'south';
  // IsoPic draws −z toward the eye and +x to the right: turn the box so the wanted side is in front
  const ops = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const ch = W.chunk(g, x >> 4, z >> 4), lx = x & 15, lz = z & 15;
    for (let y = y0; y <= y1; y++) {
      const s = ch.blocks[(y << 8) | (lz << 4) | lx]; if (!s) continue;
      if (/^(short_grass|tall_grass|fern|large_fern)$/.test(W.name(s))) continue;
      let X, Z;
      if (view === 'south') { X = x - x0; Z = z1 - z; }        // (looking north from the south: east on the right)
      else if (view === 'north') { X = x1 - x; Z = z - z0; }   // (looking south: west on the right)
      else if (view === 'east') { X = z1 - z; Z = x1 - x; }   // (looking west from the east: north is on the right)
      else { X = z - z0; Z = x - x0; }                         // (west: looking east, south on the right)
      ops.push(X, y - y0, Z, s);
    }
  }
  const pic = VR.IsoPic.render({ ops }, o.W || 1200, o.H || 900, (s, face) => C.face(s, face), { pad: 6 });
  return { w: pic.w, h: pic.h, data: new Uint8Array(pic.data.buffer) };
};

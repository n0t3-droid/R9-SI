// ============================================================================
// f-spawn · VR.PlaceSense — one sense of place for everything that appears in the world by itself (the owner, 2026-11-15:
// "stuff spawns where it should not really be, or at least where it is logically wrong"). Animals stood on roofs, on
// tree crowns and on the lawns between a city's pavements, because every spawner asked only "is the top block solid?".
// Here is the one answer they all ask for now:
//   ground(w, x, z)        the y of the block one stands on: the top solid block under the leaves and the plants
//   sense(w, x, z)         what that spot is: natural or built ground, wet, under a roof, room to stand, level,
//                          how built-up the ring round it is
//   wild(w, x, z, o)       → y | null: a place for a wild animal — dry natural ground under the open sky (or leaves),
//                          level, with room to stand, away from pavements, floors and roofs
//   lawn(w, x, z, o)       → y | null: the same on grass (families, picnics, the Wanderbaum's kind of meadow)
//   near(w, x, z, y0, tol) the ground at a walker's own height (the yard or the floor, never the roof above)
// Pure given a world accessor (isLoaded, topAt, getBlock): test/placesense.js runs it on a made-up world.
// (Not VR.Place: that is the block placement of place.js.)
// ============================================================================
(function (VR) {
  'use strict';
  const PL = VR.PlaceSense = VR.PlaceSense || {};
  let SOFT = null, SOFTN = -1, GRASS = null;
  // the natural ground (Weiche Natur's table: grass, earth, sand, gravel, snow, clay, moss, mud, the natural rock)
  PL.natural = function (b) {
    const R = VR.R;
    if (SOFTN !== R.stateCount) {
      SOFT = VR.SoftNat && VR.SoftNat.tables ? VR.SoftNat.tables().soft : null; SOFTN = R.stateCount;
      GRASS = new Uint8Array(R.stateCount);
      for (const n of ['grass_block', 'podzol', 'moss_block']) { const t = R.byName[n]; if (t) for (let s = 1; s < R.stateCount; s++) if (R.T.type[s] === t.id) GRASS[s] = 1; }
    }
    return SOFT ? SOFT[b] === 1 : !!GRASS[b];
  };
  PL.grassy = function (b) { PL.natural(b); return !!GRASS[b]; };
  // the block one stands on: down from the column's top through leaves, plants and anything without a body
  PL.ground = function (w, x, z) {
    const X = Math.floor(x), Z = Math.floor(z);
    if (!w.isLoaded(X, Z)) return null;
    const fl = VR.R.T.flags, F = VR.F;
    let y = w.topAt(X, Z);
    for (let k = 0; k < 48 && y > 0; k++, y--) { const f = fl[w.getBlock(X, y, Z)]; if ((f & F.SOLID) && !(f & F.LEAVES) && !(f & F.FLUID)) return y; }
    return null;
  };
  PL.RING = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];
  PL.sense = function (w, x, z, r) {
    const X = Math.floor(x), Z = Math.floor(z), y = PL.ground(w, X, Z);
    if (y === null) return null;
    const fl = VR.R.T.flags, F = VR.F, b = w.getBlock(X, y, Z), top = w.topAt(X, Z);
    const s = { y, b, nat: PL.natural(b), grass: PL.grassy(b), wet: false, roofed: false, room: true, level: true, built: 0 };
    // wet: water (any fluid) in the two blocks over the ground; room: nothing solid there
    for (let k = 1; k <= 2; k++) { const f = fl[w.getBlock(X, y + k, Z)]; if (f & F.FLUID) s.wet = true; else if (f & F.SOLID) s.room = false; }
    // under a roof: something solid that is not leaves between the ground and the column's top
    for (let yy = y + 3; yy <= top; yy++) { const f = fl[w.getBlock(X, yy, Z)]; if ((f & F.SOLID) && !(f & F.LEAVES)) { s.roofed = true; break; } }
    // level, and how built-up the place is: the ground of eight spots on a ring of r and eight on half of it
    const R0 = r || 6; let n = 0, bu = 0;
    for (let ring = 0; ring < 2; ring++) for (const d of PL.RING) {
      const q = ring ? R0 : R0 / 2, gx = Math.floor(X + 0.5 + d[0] * q), gz = Math.floor(Z + 0.5 + d[1] * q), gy = PL.ground(w, gx, gz);
      if (gy === null) continue;
      n++;
      if (!PL.natural(w.getBlock(gx, gy, gz))) bu++;
    }
    s.built = n ? bu / n : 0;
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const gy = PL.ground(w, X + d[0], Z + d[1]); if (gy === null || Math.abs(gy - y) > 1) { s.level = false; break; } }
    return s;
  };
  // the ground at a walker's own height: of the blocks one can stand on within tol of the block under feet at y0, the
  // nearest (a visitor at the door stands in the yard or on the floor — never on the roof three blocks up, which is
  // what the column's top would answer). → { y, b, nat, grass, wet, roofed, room } or null
  PL.near = function (w, x, z, y0, tol) {
    const X = Math.floor(x), Z = Math.floor(z);
    if (!w.isLoaded(X, Z)) return null;
    const fl = VR.R.T.flags, F = VR.F, at = Math.floor(y0) - 1, T = tol === undefined ? 3 : tol;
    const stand = (y) => { const f = fl[w.getBlock(X, y, Z)]; return !!((f & F.SOLID) && !(f & F.LEAVES) && !(f & F.FLUID)) && !(fl[w.getBlock(X, y + 1, Z)] & F.SOLID); };
    let y = -1;
    for (let k = 0; k <= T && y < 0; k++) { if (stand(at - k)) y = at - k; else if (k && stand(at + k)) y = at + k; }
    if (y < 0) return null;
    const b = w.getBlock(X, y, Z), top = w.topAt(X, Z);
    const s = { y, b, nat: PL.natural(b), grass: PL.grassy(b), wet: false, roofed: false, room: true };
    for (let k = 1; k <= 2; k++) { const f = fl[w.getBlock(X, y + k, Z)]; if (f & F.FLUID) s.wet = true; else if (f & F.SOLID) s.room = false; }
    for (let yy = y + 3; yy <= top; yy++) { const f = fl[w.getBlock(X, yy, Z)]; if ((f & F.SOLID) && !(f & F.LEAVES)) { s.roofed = true; break; } }
    return s;
  };
  // a place for a wild animal → the y to stand on (the ground's), or null
  PL.wild = function (w, x, z, o) {
    const s = PL.sense(w, x, z, o && o.r);
    if (!s || !s.nat || s.wet || s.roofed || !s.room || !s.level) return null;
    if (s.built > (o && o.built !== undefined ? o.built : 0.2)) return null;
    if (o && o.grass && !s.grass) return null;
    return s.y;
  };
  PL.lawn = (w, x, z, o) => PL.wild(w, x, z, Object.assign({ grass: true }, o || {}));
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

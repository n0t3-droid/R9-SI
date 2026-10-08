// ============================================================================
// Ship cabins (shared — built with the starship in a worker): the shuttle's
// walkable inside behind the cockpit. carve() hollows the fuselage into one
// deck — a cabin (six seats facing each other along the walls, lockers with
// light strips, a holo map table) and a long cargo bay (crate stacks, a
// hoverbike in its rack) — leaving a two-voxel hull (its inner layer lined in
// the interior's colours, window recesses punched through), cuts the doorway
// into the cockpit with three steps up to it, the side door on the port side
// with a folding stair, and the opening for the hydraulic rear ramp. The ramp
// (part 3), the side door's plug (part 4) and the stair (part 5) are meshed on
// their own so they can move; the coarse furniture is part 2 (the stand-in
// drawn whenever the furnished cabin isn't). meta.cabin holds the layout for
// the furnished cabin (cockpitkit.js) and the walker (cabin.js); walkGrid()
// is the 25 cm occupancy you walk in (hull + furniture, no moving parts).
// Frame: ship metres, nose −z, x starboard, y up, ground y = 0.
// ============================================================================
(function (VR) {
  'use strict';
  const ShipCabin = VR.ShipCabin = {};
  const P_RAMP = 3, P_DOOR = 4, P_STAIR = 5, P_FURN = 6;
  ShipCabin.PART = { ramp: P_RAMP, door: P_DOOR, stair: P_STAIR, furniture: P_FURN };

  // H: { pack, mul, GLASSF } from the starship generator · o: { zb (the cockpit's rear wall), cfloor (cockpit deck),
  // zT (the tail's back face), W, Hh (half height), cy, side (−1 port) }
  ShipCabin.carve = function (G, S, o, H) {
    const { pack, mul, GLASSF } = H, R = G.R, v1 = 1 / R;
    // (the tail's back face, exactly on the voxel grid: the ramp hinges there)
    const yF = 1.5, zb = o.zb, zT = G.cz(G.iz(o.zT - 1e-6)) + 0.5 * v1, side = o.side || -1;
    const zIn = zb + 0.5;                                  // the cabin's front wall (the bulkhead is two voxels thick)
    const nx = G.nx, ny = G.ny, nz = G.nz, N = nx * ny * nz, d = G.d, part = G.part;
    const at = (i, j, k) => (j * nz + k) * nx + i;
    // what is cut out stays solid for the world (the 1 m occupancy: collisions, blocks stuck in the hull) — only the
    // walker inside (walkGrid) sees the rooms
    const hol = G.hollow || (G.hollow = new Uint8Array(N)), cut = (n) => { if (d[n]) hol[n] = 1; d[n] = 0; part[n] = 0; };
    const i0 = 1, i1 = nx - 2, j0 = Math.max(1, G.iy(yF + v1 * 0.5)), j1 = ny - 2, k0 = Math.max(1, G.iz(zb + v1 * 1.5)), k1 = Math.min(nz - 2, G.iz(zT - v1 * 0.5));
    // ---- erode twice: d1 = all six neighbours solid, d2 = all six neighbours d1 (≥ 2 voxels from any air)
    const sol = new Uint8Array(N); for (let n = 0; n < N; n++) sol[n] = d[n] ? 1 : 0;
    const d1 = new Uint8Array(N), d2 = new Uint8Array(N);
    const sx = 1, sz = nx, sy = nx * nz;
    for (let j = Math.max(1, j0 - 1); j <= Math.min(ny - 2, j1 + 1); j++) for (let k = Math.max(1, k0 - 1); k <= Math.min(nz - 2, k1 + 1); k++) for (let i = i0; i <= i1; i++) {
      const n = at(i, j, k); if (sol[n] && sol[n + sx] && sol[n - sx] && sol[n + sy] && sol[n - sy] && sol[n + sz] && sol[n - sz]) d1[n] = 1;
    }
    for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const n = at(i, j, k); if (d1[n] && d1[n + sx] && d1[n - sx] && d1[n + sy] && d1[n - sy] && d1[n + sz] && d1[n - sz]) d2[n] = 1;
    }
    // ---- interior colours (light padded panels, seams every metre, a darker band at waist height)
    const hc = o.hull2 || [195, 201, 211];
    // (a shade darker than outside: the cabin is lit by its own lamps, the hull's lining is drawn in daylight)
    const IN = 0.66;
    const wallC = (y, z) => { const seam = Math.abs(((z - zIn + 100) % 1) - 0.5) > 0.5 - v1 * 0.6; return pack(mul(hc, IN * (seam ? 0.55 : y < 2.5 ? 0.72 : y > 3.9 ? 0.9 : 0.82))); };
    const deckC = (x, z) => pack(mul(((Math.floor(z - zIn + 100) + Math.floor(Math.abs(x) * 2)) & 1) ? [52, 56, 63] : [45, 49, 55], IN));
    for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const n = at(i, j, k);
      if (part[n] === 1) continue;                            // landing gear wells stay as they are
      if (d2[n]) { cut(n); continue; }
      if (d1[n]) d[n] = wallC(G.cy(j), G.cz(k));
    }
    // the deck: the top layer under the cabin floor
    { const jd = G.iy(yF - v1 * 0.5); for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) { const n = at(i, jd, k); if (d[n] && !d[n + sy] && part[n] === 0) d[n] = deckC(G.cx(i), G.cz(k)); } }
    // window recesses: a lining voxel right behind window glass opens up so you see out
    for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const n = at(i, j, k); if (!d[n] || (d[n] & GLASSF) || part[n] !== 0) continue;
      if (((d[n + sx] & GLASSF) && !d[n - sx]) || ((d[n - sx] & GLASSF) && !d[n + sx])) cut(n);
    }
    const setM = (x, y, z, c, p) => { const i = G.ix(x), j = G.iy(y), k = G.iz(z); if (G.ok(i, j, k)) { const n = at(i, j, k); d[n] = c; part[n] = p || 0; } };
    const each = (x0, x1, y0, y1, z0, z1, fn) => G.each(x0 + 1e-4, x1 - 1e-4, y0 + 1e-4, y1 - 1e-4, z0 + 1e-4, z1 - 1e-4, fn);
    // ---- the doorway into the cockpit and three steps down into the cabin
    const cf = o.cfloor;
    each(-0.5, 0.5, cf, cf + 2.0, zb, zIn, (x, y, z, i, j, k) => cut(at(i, j, k)));
    const stepC = pack([70, 75, 84]), noseC = pack([232, 180, 40]);
    each(-0.75, 0.75, yF, cf, zb, zIn, (x, y, z, i, j, k) => { const n = at(i, j, k); if (!d[n]) { d[n] = stepC; part[n] = 0; } });   // the doorway's sill
    for (let s = 0; s < 3; s++) {
      const top = cf - 0.25 * (s + 1); if (top <= yF + 1e-3) break;
      each(-0.75, 0.75, yF, top, zIn + s * 0.25, zIn + (s + 1) * 0.25, (x, y, z, i, j, k) => { const n = at(i, j, k); d[n] = y > top - v1 && z < zIn + s * 0.25 + v1 ? noseC : stepC; part[n] = 0; });
    }
    // ---- the side door (a plug that steps out and slides aft) and its stair
    const zD = zIn + 1.4, dW = 1.0, dH = 2.0;
    let sill = 0;
    each(side < 0 ? -9 : 0.75, side < 0 ? -0.75 : 9, yF, yF + dH, zD - dW / 2, zD + dW / 2, (x, y, z, i, j, k) => {
      const n = at(i, j, k); if (!d[n] || part[n] === 1) return;
      const outer = !d1[n];
      if (outer) { part[n] = P_DOOR; sill = Math.max(sill, Math.abs(x) + v1 * 0.5); }
      else cut(n);
    });
    // the door's frame: a yellow-black hazard band round the opening on the outside
    const hz = pack([232, 180, 40]), hz2 = pack([30, 30, 34]);
    for (let j = G.iy(yF - v1 * 0.5); j <= G.iy(yF + dH + v1 * 0.5); j++) for (let k = G.iz(zD - dW / 2 - v1 * 0.5); k <= G.iz(zD + dW / 2 + v1 * 0.5); k++) {
      const y = G.cy(j), z = G.cz(k), edge = y < yF || y > yF + dH || z < zD - dW / 2 || z > zD + dW / 2; if (!edge) continue;
      for (let i = side < 0 ? 0 : nx - 1; side < 0 ? i < nx / 2 : i > nx / 2; i -= side) { const n = at(i, j, k); if (d[n]) { if (part[n] === 0 && !(d[n] & GLASSF)) d[n] = ((j + k) & 1) ? hz : hz2; break; } }
    }
    // the sill: the deck runs on to the door's outside (the hull's bottom curves in under the doorway)
    const sillC = pack([232, 180, 40]);
    each(side < 0 ? -sill : 0.5, side < 0 ? -0.5 : sill, yF - 0.25, yF, zD - dW / 2, zD + dW / 2, (x, y, z, i, j, k) => { const n = at(i, j, k); if (!d[n]) { d[n] = sillC; part[n] = 0; } });
    const stair = { n: 6, rise: yF / 6, run: 0.3, x0: side * sill, z0: zD - 0.45, z1: zD + 0.45 };
    const stC = pack(mul(o.trim || [58, 63, 75], 1.25)), stE = pack([232, 180, 40]);
    for (let s = 0; s < stair.n; s++) {
      const top = yF - stair.rise * (s + 1), xa = side * (sill + stair.run * s), xb = side * (sill + stair.run * (s + 1));
      each(Math.min(xa, xb), Math.max(xa, xb), top - v1, top, stair.z0, stair.z1, (x, y, z, i, j, k) => { const n = at(i, j, k); if (d[n] && part[n] !== P_STAIR) return; d[n] = Math.abs(z - zD) > 0.32 ? stE : stC; part[n] = P_STAIR; });
    }
    // ---- the rear opening and the ramp (a slab just behind the tail, hinged at its inner foot)
    const rW = 1.0, rH = 2.0;
    each(-rW, rW, yF, yF + rH, zT - 0.5, zT, (x, y, z, i, j, k) => { const n = at(i, j, k); if (part[n] === 1) return; cut(n); });
    const rampC = pack(mul(hc, 0.78)), rampR = pack(mul(hc, 0.6)), rampE = pack([232, 180, 40]);
    each(-rW, rW, yF, yF + rH, zT, zT + 0.25, (x, y, z, i, j, k) => { const n = at(i, j, k); d[n] = Math.abs(x) > rW - v1 ? rampE : (j & 1) ? rampR : rampC; part[n] = P_RAMP; });
    // ---- the coarse furniture (part 2): what you see through the windows from afar, and what you bump into
    const fur = (x0, x1, y0, y1, z0, z1, rgb) => each(x0, x1, y0, y1, z0, z1, (x, y, z, i, j, k) => { const n = at(i, j, k); if (d[n] && part[n] === 0 && d1[n] && !d2[n]) return; d[n] = pack(rgb); part[n] = P_FURN; });
    // half width of the walkable floor at a height (the hull's inside, minus its two-voxel skin)
    const innerX = (y) => { const ry = Math.abs(y - o.cy) / o.Hh; return ry >= 1 ? 0 : o.W * Math.pow(1 - Math.pow(ry, 3.2), 1 / 3.2) - 0.5; };
    const wx = Math.min(innerX(yF + 0.3), innerX(yF + 1.2));
    const items = [];
    const zC = zIn + 3.75;                                       // cabin | cargo bay
    // cabin: lockers starboard-forward, three seats starboard, two seats port aft of the door, the holo table
    const sgn = -side;                                          // the far wall from the door
    items.push({ kind: 'locker', x: sgn * (wx - 0.25), z0: zIn + 0.25, z1: zIn + 1.45, w: 0.5, y0: yF, y1: yF + 2.0 });
    items.push({ kind: 'locker', x: side * (wx - 0.25), z0: zIn + 0.25, z1: zD - dW / 2 - 0.1, w: 0.5, y0: yF, y1: yF + 2.0 });
    for (const z of [zIn + 1.75, zIn + 2.4, zIn + 3.05]) items.push({ kind: 'seat', x: sgn * (wx - 0.3), z, face: -sgn });
    for (const z of [zD + dW / 2 + 0.45, zD + dW / 2 + 1.1]) items.push({ kind: 'seat', x: side * (wx - 0.3), z, face: -side });
    // (the table stands in front of the far wall's seats, a dinette: the aisle along the door side stays clear)
    items.push({ kind: 'table', x: sgn * 0.55, z: zIn + 2.4, r: 0.45, h: 0.75 });
    // cargo bay: the hoverbike in its rack, crate stacks
    const zEnd = zT - 0.5;
    items.push({ kind: 'bike', x: sgn * (wx - 0.55), z0: zC + 0.5, z1: zC + 2.5 });
    let cz = zC + 0.4;
    while (cz + 0.8 < zEnd - 1.6) { const tall = items.filter(q => q.kind === 'crate').length % 3 === 0; items.push({ kind: 'crate', x: side * (wx - 0.45), z: cz + 0.4, w: 0.8, h: tall ? 1.5 : 0.75 }); cz += 1.0; }
    cz = zC + 3.0;
    while (cz + 0.8 < zEnd - 1.6) { items.push({ kind: 'crate', x: sgn * (wx - 0.45), z: cz + 0.4, w: 0.8, h: 0.75 }); cz += 1.25; }
    for (const it of items) {
      if (it.kind === 'locker') fur(it.x - it.w / 2, it.x + it.w / 2, it.y0, it.y1, it.z0, it.z1, [150, 158, 170]);
      else if (it.kind === 'seat') { fur(it.x - 0.25, it.x + 0.25, yF, yF + 0.5, it.z - 0.25, it.z + 0.25, [62, 66, 74]); fur(it.x - it.face * 0.3 - 0.1, it.x - it.face * 0.3 + 0.15, yF, yF + 1.25, it.z - 0.25, it.z + 0.25, [62, 66, 74]); }
      else if (it.kind === 'table') fur(it.x - 0.5, it.x + 0.5, yF, yF + it.h, it.z - 0.5, it.z + 0.5, [70, 76, 86]);
      else if (it.kind === 'bike') fur(it.x - 0.5, it.x + 0.5, yF, yF + 1.0, it.z0, it.z1, [180, 90, 40]);
      else if (it.kind === 'crate') fur(it.x - it.w / 2, it.x + it.w / 2, yF, yF + it.h, it.z - it.w / 2, it.z + it.w / 2, [150, 120, 70]);
    }
    S.meta.cabin = {
      floor: yF, zb, zIn, zC, zEnd, zT, cfloor: cf, side, wx, innerW: o.W - 0.5, cy: o.cy, Hh: o.Hh, W: o.W,
      cockpitDoor: { x: 0, w: 1.0, y0: cf, h: 2.0, z: zb, z1: zIn },
      door: { side, z: zD, w: dW, h: dH, y0: yF, x: side * sill },
      stair,
      ramp: { w: rW, len: rH, hinge: [0, yF, zT], open: 2 * Math.PI / 3 },
      items,
    };
  };

  // the 25 cm occupancy you walk in: hull (incl. glass) and furniture; the gear, ramp, door and stair are not in it.
  // hull: the same without the furniture (the furnished cabin's ribs follow it)
  ShipCabin.walkGrid = function (G) {
    const nx = G.nx, ny = G.ny, nz = G.nz, L = Math.ceil(nx * ny * nz / 8), bits = new Uint8Array(L), hull = new Uint8Array(L);
    for (let n = 0; n < nx * ny * nz; n++) { if (!G.d[n]) continue; const p = G.part[n]; if (p === 0 || p === 2 || p === P_FURN) bits[n >> 3] |= 1 << (n & 7); if (p === 0) hull[n >> 3] |= 1 << (n & 7); }
    return { res: G.R, origin: [G.x0, G.y0, G.z0], dims: [nx, ny, nz], bits, hull };
  };
  // is the cell at ship metres (x, y, z) solid? (walk: the grid above)
  ShipCabin.solid = function (walk, x, y, z) {
    const R = walk.res, i = Math.floor((x - walk.origin[0]) * R), j = Math.floor((y - walk.origin[1]) * R), k = Math.floor((z - walk.origin[2]) * R), D = walk.dims;
    if (i < 0 || j < 0 || k < 0 || i >= D[0] || j >= D[1] || k >= D[2]) return false;
    const n = (j * D[2] + k) * D[0] + i;
    return !!(walk.bits[n >> 3] & (1 << (n & 7)));
  };
})(VR);

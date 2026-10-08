// ============================================================================
// Collision & selection shapes per block state, AABB sweeps and voxel raycasts
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, SH = VR.SHAPE;
  const P = VR.PHYS = {};
  const FULL = [[0, 0, 0, 1, 1, 1]];
  const EMPTY = [];
  const colCache = new Map(), selCache = new Map();

  function modelAABB(state) {
    const m = R.models[state];
    if (!m || !m.length) return null;
    let x0 = 1, y0 = 1, z0 = 1, x1 = 0, y1 = 0, z1 = 0;
    for (const f of m) for (let i = 0; i < 12; i += 3) {
      const x = f.p[i], y = f.p[i + 1], z = f.p[i + 2];
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
      if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
    }
    const c = (v) => Math.max(0, Math.min(1, v));
    x0 = c(x0); y0 = c(y0); z0 = c(z0); x1 = c(x1); y1 = c(y1); z1 = c(z1);
    // ensure a minimum thickness for selection
    if (x1 - x0 < 0.12) { const m2 = (x0 + x1) / 2; x0 = Math.max(0, m2 - 0.06); x1 = Math.min(1, m2 + 0.06); }
    if (y1 - y0 < 0.06) { y1 = Math.min(1, y0 + 0.06); }
    if (z1 - z0 < 0.12) { const m2 = (z0 + z1) / 2; z0 = Math.max(0, m2 - 0.06); z1 = Math.min(1, m2 + 0.06); }
    return [x0, y0, z0, x1, y1, z1];
  }
  function rotBoxY(b, q) {
    let [x0, y0, z0, x1, y1, z1] = b;
    for (let r = 0; r < q; r++) { const nx0 = 1 - z1, nx1 = 1 - z0, nz0 = x0, nz1 = x1; x0 = nx0; x1 = nx1; z0 = nz0; z1 = nz1; }
    return [x0, y0, z0, x1, y1, z1];
  }
  function stairsBoxes(state) {
    const t = R.types[R.T.type[state]];
    const facing = t.get(state, 'facing'), half = t.get(state, 'half');
    const base = half ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
    const step = half ? [0, 0, 0, 1, 0.5, 0.5] : [0, 0.5, 0, 1, 1, 0.5];
    return [base, rotBoxY(step, facing)];
  }
  const CONN = { fence: 1, wall: 1, pane: 1 };
  function connects(kind, nstate) {
    if (!nstate) return false;
    const fl = R.T.flags[nstate];
    if ((fl & F.OPAQUE) && (fl & F.FULL)) return true;
    const t = R.types[R.T.type[nstate]];
    if (!t) return false;
    const k = t.o.kind;
    if (kind === 'pane') return R.paneJoin(nstate);
    if (kind === 'fence') return k === 'fence' || k === 'gate';
    if (kind === 'wall') return k === 'wall' || k === 'gate';
    return false;
  }
  // nb(dirIndex 0..3 N,E,S,W) → neighbor state
  function connBoxes(state, kind, nb, forCollision) {
    const h = forCollision && kind !== 'pane' ? 1.5 : 1;
    const w = kind === 'wall' ? 0.25 : kind === 'pane' ? 0.0625 : 0.125;
    const post = [0.5 - w, 0, 0.5 - w, 0.5 + w, h, 0.5 + w];
    const out = [post];
    if (nb) {
      const aw = kind === 'wall' ? 0.1875 : kind === 'pane' ? 0.0625 : 0.0625;
      if (connects(kind, nb(0))) out.push([0.5 - aw, 0, 0, 0.5 + aw, h, 0.5]);
      if (connects(kind, nb(1))) out.push([0.5, 0, 0.5 - aw, 1, h, 0.5 + aw]);
      if (connects(kind, nb(2))) out.push([0.5 - aw, 0, 0.5, 0.5 + aw, h, 1]);
      if (connects(kind, nb(3))) out.push([0, 0, 0.5 - aw, 0.5, h, 0.5 + aw]);
    }
    return out;
  }

  // a variant slot filled or emptied (looks.js): its states' boxes are worked out again
  P.forget = function (s0, n) { for (let s = s0; s < s0 + n; s++) { colCache.delete(s); selCache.delete(s); } };
  // Collision boxes (block-local units). nb optional neighbor accessor for connected shapes.
  P.collision = function (state, nb) {
    if (!state) return EMPTY;
    const T = R.T, fl = T.flags[state];
    if (!(fl & F.SOLID)) return EMPTY;
    const shape = T.shape[state];
    if (shape === SH.FENCE || shape === SH.WALL || shape === SH.PANE) return connBoxes(state, shape === SH.FENCE ? 'fence' : shape === SH.WALL ? 'wall' : 'pane', nb, true);
    let c = colCache.get(state);
    if (c) return c;
    if (shape === SH.CUBE) c = (fl & F.FULL) ? FULL : [[0, 0, 0, 1, T.height[state] / 16 || 1, 1]];
    else if (shape === SH.STAIRS) c = stairsBoxes(state);
    else if (shape === SH.MODEL) {
      const t = R.types[T.type[state]];
      const k = t.o.kind;
      if (k === 'gate') { c = t.get(state, 'open') ? EMPTY : (() => { const bb = modelAABB(state); return bb ? [[bb[0], 0, bb[2], bb[3], 1.5, bb[5]]] : EMPTY; })(); }
      else {
        const bb = modelAABB(state);
        if (!bb) c = FULL;
        else {
          const hh = T.height[state];
          if (hh && hh < 16 && !(t.o.kind === 'door' || t.o.kind === 'trapdoor' || t.o.kind === 'slab')) bb[4] = Math.max(bb[4], hh / 16);
          c = [bb];
        }
      }
    } else if (shape === SH.VOXEL && VR.VX) c = VR.VX.boxes(state, false);
    else c = FULL;
    colCache.set(state, c);
    return c;
  };
  // Selection / raycast boxes
  P.selection = function (state, nb) {
    if (!state) return EMPTY;
    const T = R.T, fl = T.flags[state];
    if (fl & F.INVISIBLE) return EMPTY;
    const shape = T.shape[state];
    if (shape === SH.FENCE || shape === SH.WALL || shape === SH.PANE) return connBoxes(state, shape === SH.FENCE ? 'fence' : shape === SH.WALL ? 'wall' : 'pane', nb, false);
    let c = selCache.get(state);
    if (c) return c;
    if (shape === SH.NONE) c = EMPTY;
    else if (shape === SH.FLUID) c = EMPTY;
    else if (shape === SH.CUBE) c = FULL;
    else if (shape === SH.STAIRS) c = stairsBoxes(state);
    else if (shape === SH.CROSS || shape === SH.TALLCROSS) c = [[0.15, 0, 0.15, 0.85, 0.85, 0.85]];
    else if (shape === SH.CROP) c = [[0, 0, 0, 1, 0.3 + 0.1 * ((state % 7)), 1]];
    else if (shape === SH.WIRE) c = [[0, 0, 0, 1, 0.0625, 1]];
    else if (shape === SH.DRIP) c = [[0.3, 0, 0.3, 0.7, 1, 0.7]];
    else if (shape === SH.MODEL) { const bb = modelAABB(state); c = bb ? [bb] : FULL; }
    else if (shape === SH.CHORUS) c = [[0.2, 0, 0.2, 0.8, 1, 0.8]];
    else if (shape === SH.VOXEL && VR.VX) c = VR.VX.boxes(state, true);
    else c = FULL;
    selCache.set(state, c);
    return c;
  };

  // Ray vs AABB (slab test). returns [tmin, face] or null
  function rayBox(ox, oy, oz, dx, dy, dz, b, bx, by, bz) {
    let tmin = -Infinity, tmax = Infinity, face = -1;
    const mn = [bx + b[0], by + b[1], bz + b[2]], mx = [bx + b[3], by + b[4], bz + b[5]];
    const o = [ox, oy, oz], d = [dx, dy, dz];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return null; continue; }
      let t0 = (mn[a] - o[a]) / d[a], t1 = (mx[a] - o[a]) / d[a];
      let f0 = a * 2 + 1, f1 = a * 2; // entering min side → face pointing negative
      if (t0 > t1) { const tt = t0; t0 = t1; t1 = tt; const ff = f0; f0 = f1; f1 = ff; }
      if (t0 > tmin) { tmin = t0; face = f0; }
      if (t1 < tmax) tmax = t1;
      if (tmin > tmax) return null;
    }
    if (tmax < 0) return null;
    // face index conversion: axis 0 → E(0)/W(1), axis 1 → U(2)/D(3), axis 2 → S(4)/N(5)
    return [Math.max(0, tmin), face];
  }
  P.rayBox = rayBox;

  // Voxel raycast. getState(x,y,z). opts: {fluids:bool, maxDist, nb:(x,y,z,dir)→state}
  P.raycast = function (getState, ox, oy, oz, dx, dy, dz, maxDist, opts) {
    opts = opts || {};
    const len = Math.hypot(dx, dy, dz);
    // no direction, or a number gone bad: nothing is hit (the walk below would otherwise step 400 cells into nowhere)
    if (!(len > 0) || !isFinite(len) || !isFinite(ox + oy + oz)) return null;
    dx /= len; dy /= len; dz /= len;
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (dx > 0 ? (x + 1 - ox) : (ox - x)) * tdx, ty = (dy > 0 ? (y + 1 - oy) : (oy - y)) * tdy, tz = (dz > 0 ? (z + 1 - oz) : (oz - z)) * tdz;
    const T = R.T;
    for (let i = 0; i < 400; i++) {
      if (y >= 0 && y < VR.MAXY) {
        const s = getState(x, y, z);
        if (s) {
          if (opts.fluids && (T.flags[s] & F.FLUID)) {
            const r = rayBox(ox, oy, oz, dx, dy, dz, [0, 0, 0, 1, 0.9, 1], x, y, z);
            if (r && r[0] <= maxDist) return { x, y, z, face: r[1], dist: r[0], state: s, px: ox + dx * r[0], py: oy + dy * r[0], pz: oz + dz * r[0], fluid: true };
          }
          const nb = opts.nb ? (d) => opts.nb(x, y, z, d) : null;
          const boxes = P.selection(s, nb);
          let best = null;
          for (const b of boxes) {
            const r = rayBox(ox, oy, oz, dx, dy, dz, b, x, y, z);
            if (r && (!best || r[0] < best[0])) best = r;
          }
          if (best && best[0] <= maxDist) return { x, y, z, face: best[1], dist: best[0], state: s, px: ox + dx * best[0], py: oy + dy * best[0], pz: oz + dz * best[0], boxes };
        }
      }
      if (tx < ty && tx < tz) { if (tx > maxDist) break; x += sx; tx += tdx; }
      else if (ty < tz) { if (ty > maxDist) break; y += sy; ty += tdy; }
      else { if (tz > maxDist) break; z += sz; tz += tdz; }
    }
    return null;
  };

  // ---------------------------------------------------------------- R9 Smooth Ground
  // The natural surface is a height field: a SMOOTH block's top corners sit at the average surface height of the
  // four columns meeting there. Columns whose surface is more than one block away, water, buildings and cliffs are
  // "hard" and hold their own height. The mesher draws the slopes, movement walks on them (gather + snapSmooth).
  const SM_Y = [0, 1, -1];
  // raw surface height of the column at (x, z) near level y — the top of its SMOOTH block with nothing opaque
  // above — or -1 when there is none within one block. blockAt returns -1 for unknown blocks (treated as open air above).
  P.rawTop = function (blockAt, x, y, z) {
    const TF = R.T.flags;
    for (let k = 0; k < 3; k++) {
      const yy = y + SM_Y[k], b = blockAt(x, yy, z);
      if (b <= 0 || !(TF[b] & F.SMOOTH)) continue;
      const a = blockAt(x, yy + 1, z);
      if (a > 0 && (TF[a] & F.OPAQUE)) continue;
      return yy + 1;
    }
    return -1;
  };
  // the surface height that takes part in the smooth height field, or -1 when the column is "hard" and keeps its
  // block shape: no smooth ground there — or a lone pit / bump. A column that sits a step below all four of its
  // neighbours is a hole (a dimple would hide it); one above all four is a lone block (it stays a cube). Slopes,
  // ridges, terraces and every bigger shape stay smooth. (Player edits are crisp anyway: dug and placed natural
  // blocks become their "cut" twins; the shovel smooths them back — see sim.toggleCut.)
  const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  P.surfaceTop = function (blockAt, x, y, z) {
    const h = P.rawTop(blockAt, x, y, z);
    if (h < 0) return -1;
    const TF = R.T.flags;
    let higher = 0, lower = 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + NB4[k][0], nz = z + NB4[k][1];
      const nh = P.rawTop(blockAt, nx, h - 1, nz);
      if (nh >= 0) { if (nh > h + 0.5) higher++; else if (nh < h - 0.5) lower++; continue; }
      // no smooth surface next door: something solid at our top level counts as higher, open air below it as lower
      const at = blockAt(nx, h, nz), below = blockAt(nx, h - 1, nz);
      if (at > 0 && (TF[at] & F.OPAQUE)) higher++;
      else if (below === 0) lower++;
    }
    if (higher >= 4 || lower >= 4) return -1;
    return h;
  };
  // the four corner heights (absolute) of the SMOOTH block at (x, y, z) in the order (x0,z0) (x0,z1) (x1,z1) (x1,z0);
  // returns false when the top is flat
  P.smoothCorners = function (blockAt, x, y, z, out) {
    let flat = true;
    for (let k = 0; k < 4; k++) {
      const cx = (k === 2 || k === 3) ? 1 : 0, cz = (k === 1 || k === 2) ? 1 : 0;
      // a corner touching a hard column (a cliff, water, a building, a path block that is not ground) keeps the
      // block's own height, so no face is ever left open against it
      let sum = 0, hard = false, lo = 1e9, hi = -1e9;
      for (let dz = 0; dz < 2 && !hard; dz++) for (let dx = 0; dx < 2; dx++) { const h = P.surfaceTop(blockAt, x + cx - 1 + dx, y, z + cz - 1 + dz); if (h < 0) { hard = true; break; } sum += h; if (h < lo) lo = h; if (h > hi) hi = h; }
      // the four columns must lie within one step of each other, whichever of them asks: a corner between a
      // two-step cliff and a one-step shoulder would otherwise get two different heights (and a gap in the mesh)
      if (!hard && hi - lo > 1.001) hard = true;
      out[k] = hard ? y + 1 : sum * 0.25;
      if (Math.abs(out[k] - (y + 1)) > 1e-6) flat = false;
    }
    return !flat;
  };
  const cTmp = [0, 0, 0, 0], smBox = [[0, 0, 0, 1, 1, 1]];
  const bilin = (c, fx, fz) => c[0] * (1 - fx) * (1 - fz) + c[1] * (1 - fx) * fz + c[2] * fx * fz + c[3] * fx * (1 - fz);
  // the ground height under a point (the sloped surface of a SMOOTH block, else the block top); -1 when not on smooth ground
  P.smoothHeight = function (getState, px, py, pz) {
    const x = Math.floor(px), z = Math.floor(pz), y = Math.floor(py - 0.02);
    const s = getState(x, y, z); if (!s || !(R.T.flags[s] & F.SMOOTH)) return -1;
    const a = getState(x, y + 1, z); if (a && (R.T.flags[a] & F.OPAQUE)) return -1;
    if (!P.smoothCorners(getState, x, y, z, cTmp)) return y + 1;
    return bilin(cTmp, px - x, pz - z);
  };
  // the height of the smooth ground surface at (px, pz) whose block top lies within a block of py, or -1
  P.groundAt = function (getState, px, py, pz) {
    const x = Math.floor(px), z = Math.floor(pz), y0 = Math.floor(py - 0.02);
    for (let k = 0; k < 3; k++) {
      const y = y0 + SM_Y[k]; if (y < 0 || y >= VR.MAXY) continue;
      const s = getState(x, y, z); if (!s || !(R.T.flags[s] & F.SMOOTH)) continue;
      const a = getState(x, y + 1, z); if (a && (R.T.flags[a] & F.OPAQUE)) continue;
      if (!P.smoothCorners(getState, x, y, z, cTmp)) return y + 1;
      return bilin(cTmp, px - x, pz - z);
    }
    return -1;
  };
  // Ground following: a body that stands on smooth ground and moves by (mx, mz) is carried along the surface —
  // no falling-and-snapping, no jitter on the triangles, no "flying" down a slope. Returns the vertical move to
  // make this step, or null when the body is not on smooth ground (or the surface ahead is a step or a drop).
  P.walkSmooth = function (getState, pos, mx, mz) {
    const h0 = P.groundAt(getState, pos[0], pos[1], pos[2]);
    if (h0 < 0 || Math.abs(h0 - pos[1]) > 0.35) return null;
    const h1 = P.groundAt(getState, pos[0] + mx, pos[1] + 0.25, pos[2] + mz);
    if (h1 < 0) return null;
    const d = h1 - pos[1];
    if (d > 0.72 || d < -1.1) return null;
    return d;
  };
  // after a move on the ground: lift a body standing below the sloped surface onto it; true when it stands on smooth ground
  P.snapSmooth = function (getState, pos) {
    for (const dy of [0, -0.35]) {
      const h = P.smoothHeight(getState, pos[0], pos[1] + dy, pos[2]);
      if (h < 0) continue;
      if (h > pos[1] - 1e-4 && h < pos[1] + 0.9) { pos[1] = h; return true; }
      return h >= pos[1] - 0.3;
    }
    return false;
  };
  // Gather world-space collision boxes intersecting region; feetY: the body's bottom (smooth ground under it uses its lowest corner as the box top)
  P.gather = function (getState, x0, y0, z0, x1, y1, z1, out, nbFn, feetY) {
    out.length = 0;
    if (!isFinite(x0 + y0 + z0 + x1 + y1 + z1)) return out;   // a region gone NaN holds nothing
    const ix0 = Math.floor(x0), iy0 = Math.max(0, Math.floor(y0) - 1), iz0 = Math.floor(z0);
    const ix1 = Math.floor(x1), iy1 = Math.min(VR.MAXY - 1, Math.floor(y1)), iz1 = Math.floor(z1);
    const TF = R.T.flags, TSH = R.T.shape;
    for (let y = iy0; y <= iy1; y++) for (let z = iz0; z <= iz1; z++) for (let x = ix0; x <= ix1; x++) {
      const s = getState(x, y, z);
      if (!s) continue;
      if (!(TF[s] & F.SOLID)) continue;
      let boxes = null;
      if ((TF[s] & F.SMOOTH) && feetY !== undefined && y + 1 >= feetY - 0.05 && y + 1 <= feetY + 1.05) {
        const a = getState(x, y + 1, z);
        if (!(a && (TF[a] & F.OPAQUE)) && P.smoothCorners(getState, x, y, z, cTmp)) { smBox[0][4] = Math.min(cTmp[0], cTmp[1], cTmp[2], cTmp[3]) - y; boxes = smBox; }
      }
      // only the connected shapes ask their neighbours: the closure is made for them alone (it was made for every
      // solid block a body touches — a few hundred per frame with the villagers about)
      if (!boxes) { const sh = TSH[s]; boxes = P.collision(s, nbFn && (sh === SH.FENCE || sh === SH.WALL || sh === SH.PANE) ? (d) => nbFn(x, y, z, d) : null); }
      for (const b of boxes) {
        const bx0 = x + b[0], by0 = y + b[1], bz0 = z + b[2], bx1 = x + b[3], by1 = y + b[4], bz1 = z + b[5];
        if (bx1 <= x0 || bx0 >= x1 || by1 <= y0 || by0 >= y1 || bz1 <= z0 || bz0 >= z1) continue;
        out.push(bx0, by0, bz0, bx1, by1, bz1);
      }
    }
    return out;
  };

  // Klassisch terraces: natural ground is drawn in one-block steps there instead of slopes (VR.LOOK.ground off). A
  // grounded body that walks into such a step goes up the whole block, as it walks up the slope in Nahtlos — hills
  // stay walkable. Only when everything solid ahead at the feet is natural ground (R.terrace: grass, dirt, sand …
  // and their cut twins); stone, placed blocks and walls of two blocks still take a jump.
  const terraceAhead = (getState, pos, w, vx, vz) => {
    const TR = R.terrace; if (!TR) return false;
    const y = Math.floor(pos[1] + 1e-3);
    const x0 = Math.floor(pos[0] - w + vx), x1 = Math.floor(pos[0] + w + vx - 1e-7), z0 = Math.floor(pos[2] - w + vz), z1 = Math.floor(pos[2] + w + vz - 1e-7);
    let any = false;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const s = getState(x, y, z);
      if (!s || !(R.T.flags[s] & F.SOLID)) continue;
      if (!TR[s]) return false;
      any = true;
    }
    return any;
  };
  // Move AABB (center-bottom pos, half width w, height h) by (vx,vy,vz); returns collision flags
  const tmp = [];
  // the furthest a body may move in one step: no real velocity comes near it (a fall is 78 blocks/s, a frame is at
  // most 0.1 s) — a number gone bad counts as no move, so nobody ever lands in nowhere or sweeps a million cells
  const MAX_STEP = 64;
  const stepOf = (v) => (v !== v || v === Infinity || v === -Infinity) ? 0 : v > MAX_STEP ? MAX_STEP : v < -MAX_STEP ? -MAX_STEP : v;
  P.move = function (getState, pos, w, h, vx, vy, vz, stepH, nbFn, groundedHint) {
    const res = { hitX: false, hitY: false, hitZ: false, onGround: false, stepped: 0 };
    vx = stepOf(vx); vy = stepOf(vy); vz = stepOf(vz);
    if (!isFinite(pos[0] + pos[1] + pos[2])) return res;   // a body nowhere cannot be moved (its owner restores it)
    const x0 = pos[0] - w, x1 = pos[0] + w, y0 = pos[1], y1 = pos[1] + h, z0 = pos[2] - w, z1 = pos[2] + w;
    const boxes = P.gather(getState, Math.min(x0, x0 + vx) - 1, Math.min(y0, y0 + vy) - 1, Math.min(z0, z0 + vz) - 1, Math.max(x1, x1 + vx) + 1, Math.max(y1, y1 + vy) + 1 + (stepH || 0), Math.max(z1, z1 + vz) + 1, tmp, nbFn, pos[1]);
    const sweep = (bx0, by0, bz0, bx1, by1, bz1, axis, v) => {
      for (let i = 0; i < boxes.length; i += 6) {
        const a0 = boxes[i], b0 = boxes[i + 1], c0 = boxes[i + 2], a1 = boxes[i + 3], b1 = boxes[i + 4], c1 = boxes[i + 5];
        if (axis === 1) {
          if (a1 <= bx0 || a0 >= bx1 || c1 <= bz0 || c0 >= bz1) continue;
          if (v > 0 && b0 >= by1 - 1e-7) v = Math.min(v, b0 - by1);
          else if (v < 0 && b1 <= by0 + 1e-7) v = Math.max(v, b1 - by0);
        } else if (axis === 0) {
          if (b1 <= by0 || b0 >= by1 || c1 <= bz0 || c0 >= bz1) continue;
          if (v > 0 && a0 >= bx1 - 1e-7) v = Math.min(v, a0 - bx1);
          else if (v < 0 && a1 <= bx0 + 1e-7) v = Math.max(v, a1 - bx0);
        } else {
          if (a1 <= bx0 || a0 >= bx1 || b1 <= by0 || b0 >= by1) continue;
          if (v > 0 && c0 >= bz1 - 1e-7) v = Math.min(v, c0 - bz1);
          else if (v < 0 && c1 <= bz0 + 1e-7) v = Math.max(v, c1 - bz0);
        }
      }
      return v;
    };
    const attempt = (px, py, pz, mvx, mvy, mvz) => {
      let ax0 = px - w, ax1 = px + w, ay0 = py, ay1 = py + h, az0 = pz - w, az1 = pz + w;
      const ny = sweep(ax0, ay0, az0, ax1, ay1, az1, 1, mvy); ay0 += ny; ay1 += ny;
      const nx = sweep(ax0, ay0, az0, ax1, ay1, az1, 0, mvx); ax0 += nx; ax1 += nx;
      const nz = sweep(ax0, ay0, az0, ax1, ay1, az1, 2, mvz);
      return [nx, ny, nz];
    };
    let [nx, ny, nz] = attempt(pos[0], pos[1], pos[2], vx, vy, vz);
    const blockedH = Math.abs(nx - vx) > 1e-6 || Math.abs(nz - vz) > 1e-6;
    const grounded = vy <= 0 && (ny > vy + 1e-6 || !!groundedHint);   // the hint: standing on smooth ground above its collision box
    if (stepH > 0 && blockedH && (grounded || stepH > 0.6)) {
      // try step up (a whole block onto a natural terrace in the Klassisch look)
      const LK = VR.LOOK, sh = stepH < 1 && grounded && LK && !LK.ground && terraceAhead(getState, pos, w, vx, vz) ? 1.01 : stepH;
      const up = sweep(pos[0] - w, pos[1], pos[2] - w, pos[0] + w, pos[1] + h, pos[2] + w, 1, sh);
      if (up > 0.01) {
        const r2 = attempt(pos[0], pos[1] + up, pos[2], vx, 0, vz);
        const down = sweep(pos[0] + r2[0] - w, pos[1] + up, pos[2] + r2[2] - w, pos[0] + r2[0] + w, pos[1] + up + h, pos[2] + r2[2] + w, 1, -up);
        if (Math.hypot(r2[0], r2[2]) > Math.hypot(nx, nz) + 1e-4) { nx = r2[0]; nz = r2[2]; ny = up + down; res.stepped = ny; }
      }
    }
    pos[0] += nx; pos[1] += ny; pos[2] += nz;
    res.hitX = Math.abs(nx - vx) > 1e-6; res.hitZ = Math.abs(nz - vz) > 1e-6;
    res.hitY = Math.abs(ny - vy) > 1e-6 && !res.stepped;
    res.onGround = (vy < 0 && res.hitY) || (res.stepped > 0);
    return res;
  };
  // Does AABB intersect any solid box?
  P.overlaps = function (getState, x0, y0, z0, x1, y1, z1, nbFn) {
    P.gather(getState, x0, y0, z0, x1, y1, z1, tmp, nbFn);
    for (let i = 0; i < tmp.length; i += 6) if (tmp[i + 3] > x0 && tmp[i] < x1 && tmp[i + 4] > y0 && tmp[i + 1] < y1 && tmp[i + 5] > z0 && tmp[i + 2] < z1) return true;
    return false;
  };
})(VR);

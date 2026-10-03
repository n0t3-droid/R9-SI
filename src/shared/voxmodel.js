// ============================================================================
// VM — the model language for VX32 pieces. A model is a W×H×D-block volume at
// 32 voxels per block (VM.RES), built from primitives (boxes, rounded boxes,
// cylinders, spheres, lathes, extruded profiles, cuts, mirrors) in materials
// that carry a surface texture (fabric, leather, wood, marble, metal, plant,
// stone) plus plain matte / gloss / chrome / glass / light. The volume compiles
// once into 32³ parts; every part is a block state (facing × part) painted into
// the VX32 grid, meshed and cached like any VX block, drawn as one averaged box
// in the distance. Placing a model places all its parts, breaking any part
// removes the whole model and drops one item.
// Coordinates in model source: x across, y up, z toward the viewer (−z is the
// model's front, facing 0 = north); 16 units = one block (half units are fine,
// the builder resolves them on the finer grid).
// ============================================================================
(function (VR) {
  'use strict';
  const VX = VR.VX;
  if (!VX) return;
  const VM = VR.VM = {};
  const PRESENT = VX.PRESENT, EMIS = VX.EMIS, GLASS = VX.GLASS, GLOSS = VX.GLOSS;
  const sh = VX.sh, hh = VX.hash;
  const MAT = VX.MAT, mb = VX.matBit;
  const RES = VM.RES = 32;                       // voxels per block for models
  const MODELS = VM.MODELS = {};
  const pack = (c, f) => ((c & 0xffffff) | PRESENT | (f || 0)) >>> 0;
  const noise = (x, y, z, s) => (hh(x, y, z, s) & 255) / 255 - 0.5;   // −0.5 … 0.5
  VM.pack = pack; VM.noise = noise;

  // ---------------------------------------------------------------- materials → packed voxel (uniform colour + surface texture bits)
  // the surface detail (weave, grain, veins, pebbling) comes from the material textures the mesher
  // maps world-aligned onto every quad, so colours stay uniform and the greedy mesher merges big faces
  const M = VM.M = {
    matte: (c) => pack(c),
    gloss: (c) => pack(c, GLOSS),
    light: (c) => pack(c, EMIS),
    glass: (c) => pack(c === undefined ? 0xBFE6FF : c, GLASS),
    chrome: (c) => pack(c === undefined ? 0xD8DEE4 : c, GLOSS),
    metal: (c) => pack(c, GLOSS | mb(MAT.metal)),
    fabric: (c) => pack(c, mb(MAT.fabric)),
    velvet: (c) => pack(sh(c, 0.97), mb(MAT.fabric)),
    leather: (c) => pack(c, GLOSS | mb(MAT.leather)),
    wood: (c) => pack(c, GLOSS | mb(MAT.wood)),
    marble: (c) => pack(c, GLOSS | mb(MAT.marble)),
    stone: (c) => pack(c, mb(MAT.stone)),
    concrete: (c) => pack(c, mb(MAT.stone)),
    plant: (c) => pack(c, mb(MAT.plant)),
    fn: (f) => f,
  };

  // ---------------------------------------------------------------- the builder
  // every public primitive takes model units (16 per block) and scales them by S = res / 16 onto the grid
  class Builder {
    constructor(W, H, D, res) {
      this.res = res || RES; this.S = this.res / 16;
      this.bw = W; this.bh = H; this.bd = D; this.W = W * this.res; this.H = H * this.res; this.D = D * this.res;
      this.V = new Uint32Array(this.W * this.H * this.D);
    }
    idx(x, y, z) { return (y * this.D + z) * this.W + x; }
    get(x, y, z) { if (x < 0 || y < 0 || z < 0 || x >= this.W || y >= this.H || z >= this.D) return 0; return this.V[this.idx(x, y, z)]; }
    set(x, y, z, m) { if (x < 0 || y < 0 || z < 0 || x >= this.W || y >= this.H || z >= this.D) return; const v = typeof m === 'function' ? m(x, y, z) : m; this.V[this.idx(x, y, z)] = v === null || v === undefined ? 0 : v; }
    // half-open boxes: x0 ≤ x < x1
    box(x0, y0, z0, x1, y1, z1, m) {
      const S = this.S;
      for (let y = Math.max(0, Math.round(y0 * S)); y < Math.min(this.H, Math.round(y1 * S)); y++) for (let z = Math.max(0, Math.round(z0 * S)); z < Math.min(this.D, Math.round(z1 * S)); z++) for (let x = Math.max(0, Math.round(x0 * S)); x < Math.min(this.W, Math.round(x1 * S)); x++) this.set(x, y, z, m);
      return this;
    }
    cut(x0, y0, z0, x1, y1, z1) { return this.box(x0, y0, z0, x1, y1, z1, 0); }
    // rounded box: all edges rounded with radius r (a cushion, a pillow, a soft seat)
    rbox(x0, y0, z0, x1, y1, z1, r, m) {
      const S = this.S; x0 *= S; y0 *= S; z0 *= S; x1 *= S; y1 *= S; z1 *= S; r *= S;
      const r2 = r * r;
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.H, Math.ceil(y1)); y++) for (let z = Math.max(0, Math.floor(z0)); z < Math.min(this.D, Math.ceil(z1)); z++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.W, Math.ceil(x1)); x++) {
        const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5;
        if (cx < x0 || cx > x1 || cy < y0 || cy > y1 || cz < z0 || cz > z1) continue;
        const dx = Math.max(0, x0 + r - cx, cx - (x1 - r)), dy = Math.max(0, y0 + r - cy, cy - (y1 - r)), dz = Math.max(0, z0 + r - cz, cz - (z1 - r));
        if (dx * dx + dy * dy + dz * dz <= r2) this.set(x, y, z, m);
      }
      return this;
    }
    // rounded only in plan (vertical edges), square top and bottom: table tops, bath tubs, counters
    pbox(x0, y0, z0, x1, y1, z1, r, m) {
      const S = this.S; x0 *= S; y0 *= S; z0 *= S; x1 *= S; y1 *= S; z1 *= S; r *= S;
      const r2 = r * r;
      for (let y = Math.max(0, Math.round(y0)); y < Math.min(this.H, Math.round(y1)); y++) for (let z = Math.max(0, Math.floor(z0)); z < Math.min(this.D, Math.ceil(z1)); z++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.W, Math.ceil(x1)); x++) {
        const cx = x + 0.5, cz = z + 0.5;
        if (cx < x0 || cx > x1 || cz < z0 || cz > z1) continue;
        const dx = Math.max(0, x0 + r - cx, cx - (x1 - r)), dz = Math.max(0, z0 + r - cz, cz - (z1 - r));
        if (dx * dx + dz * dz <= r2) this.set(x, y, z, m);
      }
      return this;
    }
    // cylinder along axis 'y' (centre cx, cz; from y0 to y1), 'x' (centre cy, cz; x0..x1) or 'z' (centre cx, cy; z0..z1)
    cyl(axis, a, b, r, c0, c1, m) {
      const S = this.S; a *= S; b *= S; r *= S; c0 = Math.round(c0 * S); c1 = Math.round(c1 * S);
      const r2 = r * r;
      for (let t = Math.max(0, c0); t < c1; t++) for (let q = Math.floor(b - r); q <= Math.ceil(b + r); q++) for (let p = Math.floor(a - r); p <= Math.ceil(a + r); p++) {
        const dp = p + 0.5 - a, dq = q + 0.5 - b;
        if (dp * dp + dq * dq > r2) continue;
        if (axis === 'y') this.set(p, t, q, m); else if (axis === 'x') this.set(t, p, q, m); else this.set(p, q, t, m);
      }
      return this;
    }
    // a hollow tube along an axis (wall thickness w): lamp shades, vases, pipes
    tube(axis, a, b, r, w, c0, c1, m) {
      const S = this.S; a *= S; b *= S; r *= S; w *= S; c0 = Math.round(c0 * S); c1 = Math.round(c1 * S);
      const r2 = r * r, ri2 = Math.max(0, r - w) ** 2;
      for (let t = Math.max(0, c0); t < c1; t++) for (let q = Math.floor(b - r); q <= Math.ceil(b + r); q++) for (let p = Math.floor(a - r); p <= Math.ceil(a + r); p++) {
        const dp = p + 0.5 - a, dq = q + 0.5 - b, d2 = dp * dp + dq * dq;
        if (d2 > r2 || d2 < ri2) continue;
        if (axis === 'y') this.set(p, t, q, m); else if (axis === 'x') this.set(t, p, q, m); else this.set(p, q, t, m);
      }
      return this;
    }
    sphere(cx, cy, cz, r, m) { return this.ellipsoid(cx, cy, cz, r, r, r, m); }
    ellipsoid(cx, cy, cz, rx, ry, rz, m) {
      const S = this.S; cx *= S; cy *= S; cz *= S; rx *= S; ry *= S; rz *= S;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, dz = (z + 0.5 - cz) / rz;
        if (dx * dx + dy * dy + dz * dz <= 1) this.set(x, y, z, m);
      }
      return this;
    }
    // revolve a profile [[y, radius], …] (y ascending) around the vertical axis through (cx, cz); hollow = wall thickness
    lathe(cx, cz, profile, m, hollow) {
      const S = this.S; cx *= S; cz *= S; const hw = hollow ? hollow * S : 0;
      for (let k = 0; k + 1 < profile.length; k++) {
        const ya = profile[k][0] * S, ra = profile[k][1] * S, yb = profile[k + 1][0] * S, rb = profile[k + 1][1] * S;
        for (let y = Math.max(0, Math.floor(ya)); y < Math.min(this.H, Math.ceil(yb)); y++) {
          const t = yb === ya ? 0 : (y + 0.5 - ya) / (yb - ya), r = ra + (rb - ra) * Math.max(0, Math.min(1, t)), r2 = r * r, ri2 = hw ? Math.max(0, r - hw) ** 2 : -1;
          for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { const dx = x + 0.5 - cx, dz = z + 0.5 - cz, d2 = dx * dx + dz * dz; if (d2 <= r2 && d2 >= ri2) this.set(x, y, z, m); }
        }
      }
      return this;
    }
    // extrude a 2-D polygon [[a, b], …] along axis: 'z' → poly in (x, y) from z0..z1; 'x' → poly in (z, y); 'y' → poly in (x, z)
    extrude(poly, axis, c0, c1, m) {
      const S = this.S; poly = poly.map(p => [p[0] * S, p[1] * S]); c0 = Math.round(c0 * S); c1 = Math.round(c1 * S);
      let minA = 1e9, maxA = -1e9, minB = 1e9, maxB = -1e9;
      for (const [a, b] of poly) { minA = Math.min(minA, a); maxA = Math.max(maxA, a); minB = Math.min(minB, b); maxB = Math.max(maxB, b); }
      const inside = (a, b) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ai, bi] = poly[i], [aj, bj] = poly[j]; if ((bi > b) !== (bj > b) && a < (aj - ai) * (b - bi) / (bj - bi) + ai) c = !c; } return c; };
      for (let t = Math.max(0, c0); t < c1; t++) for (let b = Math.floor(minB); b < Math.ceil(maxB); b++) for (let a = Math.floor(minA); a < Math.ceil(maxA); a++) {
        if (!inside(a + 0.5, b + 0.5)) continue;
        if (axis === 'z') this.set(a, b, t, m); else if (axis === 'x') this.set(t, b, a, m); else this.set(a, t, b, m);
      }
      return this;
    }
    // a thin slanted plank between two points in the x-y plane (backrests, lamp arms): width along z
    beam(x0, y0, x1, y1, z0, z1, thick, m) {
      const S = this.S; x0 *= S; y0 *= S; x1 *= S; y1 *= S; z0 = Math.round(z0 * S); z1 = Math.round(z1 * S); thick *= S;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        for (let yy = Math.max(0, Math.floor(y - thick / 2)); yy < Math.min(this.H, Math.ceil(y + thick / 2)); yy++) for (let zz = Math.max(0, z0); zz < Math.min(this.D, z1); zz++) for (let xx = Math.max(0, Math.floor(x - thick / 2)); xx < Math.min(this.W, Math.ceil(x + thick / 2)); xx++) this.set(xx, yy, zz, m);
      }
      return this;
    }
    // a rod between two arbitrary points (lamp arms, chair struts): radius r
    rod(x0, y0, z0, x1, y1, z1, r, m) {
      const S = this.S; x0 *= S; y0 *= S; z0 *= S; x1 *= S; y1 *= S; z1 *= S; r *= S;
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) * 2) + 1;
      for (let i = 0; i <= n; i++) {
        const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t, cz = z0 + (z1 - z0) * t;
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dz = z + 0.5 - cz;
          if (dx * dx + dy * dy + dz * dz <= r * r) this.set(x, y, z, m);
        }
      }
      return this;
    }
    mirrorX() { for (let y = 0; y < this.H; y++) for (let z = 0; z < this.D; z++) for (let x = 0; x < this.W >> 1; x++) this.V[this.idx(this.W - 1 - x, y, z)] = this.V[this.idx(x, y, z)]; return this; }
    mirrorZ() { for (let y = 0; y < this.H; y++) for (let z = 0; z < this.D >> 1; z++) for (let x = 0; x < this.W; x++) this.V[this.idx(x, y, this.D - 1 - z)] = this.V[this.idx(x, y, z)]; return this; }
    // repeat a build function n times with an offset (model units; the callback adds them to its coordinates)
    repeat(n, dx, dy, dz, fn) { for (let k = 0; k < n; k++) fn(k * dx, k * dy, k * dz, k); return this; }
    // a legged frame helper: four legs of size s at the corners of the footprint, from y0 to y1
    legs(x0, z0, x1, z1, s, y0, y1, m) { this.box(x0, y0, z0, x0 + s, y1, z0 + s, m); this.box(x1 - s, y0, z0, x1, y1, z0 + s, m); this.box(x0, y0, z1 - s, x0 + s, y1, z1, m); this.box(x1 - s, y0, z1 - s, x1, y1, z1, m); return this; }
    // tapered round legs (dining chairs, sofas): radius r0 at the floor, r1 at the top
    roundLegs(x0, z0, x1, z1, inset, r0, r1, y0, y1, m) {
      for (const [cx, cz] of [[x0 + inset, z0 + inset], [x1 - inset, z0 + inset], [x0 + inset, z1 - inset], [x1 - inset, z1 - inset]]) this.lathe(cx, cz, [[y0, r0], [y1, r1]], m);
      return this;
    }
    // recolour only the voxels already present inside a box (seams, stripes, stains on curved parts)
    recolor(x0, y0, z0, x1, y1, z1, m) {
      const S = this.S;
      for (let y = Math.max(0, Math.round(y0 * S)); y < Math.min(this.H, Math.round(y1 * S)); y++) for (let z = Math.max(0, Math.round(z0 * S)); z < Math.min(this.D, Math.round(z1 * S)); z++) for (let x = Math.max(0, Math.round(x0 * S)); x < Math.min(this.W, Math.round(x1 * S)); x++) { const i = this.idx(x, y, z); if (this.V[i]) this.V[i] = typeof m === 'function' ? m(x, y, z) : m; }
      return this;
    }
    // a soft cushion: a rounded box with piping seams where the rounding starts (top edge, and the bottom edge when tall enough)
    cushion(x0, y0, z0, x1, y1, z1, r, m, seam) {
      this.rbox(x0, y0, z0, x1, y1, z1, r, m);
      if (seam && typeof m === 'number') {
        const d = 0.5, dark = ((m & ~0xffffff) | (sh(m & 0xffffff, 0.8) & 0xffffff)) >>> 0;
        const ring = (ys) => { this.recolor(x0, ys, z0, x1, ys + d, z0 + d, dark); this.recolor(x0, ys, z1 - d, x1, ys + d, z1, dark); this.recolor(x0, ys, z0, x0 + d, ys + d, z1, dark); this.recolor(x1 - d, ys, z0, x1, ys + d, z1, dark); };
        ring(y1 - r - d); if (y1 - y0 > 2 * r + 2) ring(y0 + r);
      }
      return this;
    }
  }
  VM.Builder = Builder;

  // ---------------------------------------------------------------- compile: volume → parts
  // the volume is kept once per model as palette indices (one byte per voxel) + a palette of packed voxels
  function compile(name, o) {
    const [W, H, D] = o.size, R = o.res || RES;
    const b = new Builder(W, H, D, R);
    o.build(b, M);
    const parts = [], at = new Map();
    for (let py = 0; py < H; py++) for (let pz = 0; pz < D; pz++) for (let px = 0; px < W; px++) {
      let any = false, x0 = R, y0 = R, z0 = R, x1 = -1, y1 = -1, z1 = -1;
      for (let y = 0; y < R; y++) for (let z = 0; z < R; z++) for (let x = 0; x < R; x++) {
        const v = b.V[b.idx(px * R + x, py * R + y, pz * R + z)];
        if (!v) continue;
        any = true;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      if (!any) continue;
      at.set(px + ',' + py + ',' + pz, parts.length);
      parts.push({ px, py, pz, bounds: [x0, y0, z0, x1 + 1, y1 + 1, z1 + 1] });
    }
    // palette-compress the volume; average colour for the far box / block tint
    const palMap = new Map([[0, 0]]), pal = [0];
    let r = 0, g = 0, bb = 0, n = 0, vox = 0;
    for (let i = 0; i < b.V.length; i++) { const v = b.V[i]; if (!v) continue; vox++; if (!palMap.has(v)) { palMap.set(v, pal.length); pal.push(v); } if (v & GLASS) continue; r += (v >> 16) & 255; g += (v >> 8) & 255; bb += v & 255; n++; }
    const vol = pal.length <= 256 ? new Uint8Array(b.V.length) : new Uint16Array(b.V.length);
    for (let i = 0; i < b.V.length; i++) { const v = b.V[i]; if (v) vol[i] = palMap.get(v); }
    const col = n ? ((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(bb / n)) : 0x999999;
    const VW = b.W, VD = b.D;
    const P = Uint32Array.from(pal);
    const model = { name, W, H, D, res: R, parts, at, col, vox, vol, pal: P, VW, VH: b.H, VD, get: (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= VW || y >= b.H || z >= VD) ? 0 : P[vol[(y * VD + z) * VW + x]] };
    return model;
  }
  VM.compile = compile;

  // rotate part offsets around the model's vertical axis, q quarter-turns (same sense as VX.rotateGrid)
  function rotOffset(px, pz, W, D, q) { let x = px, z = pz, w = W, d = D; for (let r = 0; r < q; r++) { const t = x; x = d - 1 - z; z = t; const tw = w; w = d; d = tw; } return [x, z]; }
  VM.rotOffset = rotOffset;
  // the block offsets of every part relative to part 0 for a facing
  VM.footprint = function (model, facing) {
    const q = ((facing % 4) + 4) % 4, a = model.parts[0], [ax, az] = rotOffset(a.px, a.pz, model.W, model.D, q);
    return model.parts.map((p, i) => { const [x, z] = rotOffset(p.px, p.pz, model.W, model.D, q); return [x - ax, p.py - a.py, z - az, i]; });
  };

  // ---------------------------------------------------------------- painting (the VX hook)
  // paint one part of a model, rotated q quarter-turns, into the VX grid of the model's resolution
  VM.paintPart = function (model, p, q) {
    const R = model.res, G = VX.gridFor(R), IX = R === 32 ? VX.I32 : R === 16 ? VX.I16 : VX.I;
    G.fill(0);
    if (!p) return;
    q = ((q % 4) + 4) % 4;
    const [x0, y0, z0, x1, y1, z1] = p.bounds, vol = model.vol, pal = model.pal, VW = model.VW, VD = model.VD;
    const ox = p.px * R, oy = p.py * R, oz = p.pz * R;
    for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      const row = ((oy + y) * VD + oz + z) * VW + ox;
      for (let x = x0; x < x1; x++) {
        const v = vol[row + x];
        if (!v) continue;
        let nx = x, nz = z;
        for (let r = 0; r < q; r++) { const t = nx; nx = R - 1 - nz; nz = t; }
        G[IX(nx, y, nz)] = pal[v];
      }
    }
  };
  // which part sits across each world face of a part for a facing (−1: none) — so touching faces between the
  // parts of one model are culled and shaded as a continuous surface
  const SIBD = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  VM.siblings = function (model, f) {
    f = ((f % 4) + 4) % 4;
    model.sib = model.sib || [];
    if (model.sib[f]) return model.sib[f];
    const fp = VM.footprint(model, f), map = new Map();
    for (const [dx, dy, dz, i] of fp) map.set(dx + ',' + dy + ',' + dz, i);
    const t = new Int16Array(model.parts.length * 6).fill(-1);
    for (const [dx, dy, dz, i] of fp) for (let d = 0; d < 6; d++) { const j = map.get((dx + SIBD[d][0]) + ',' + (dy + SIBD[d][1]) + ',' + (dz + SIBD[d][2])); if (j !== undefined) t[i * 6 + d] = j; }
    model.sib[f] = t;
    return t;
  };
  // fill VX.NB[d] with the boundary layer of the sibling part across face d (0 empty, 1 opaque, 2 glass)
  const scratch = {};
  VM.fillNeighbour = function (model, p, q, d) {
    const R = model.res, S = scratch[R] || (scratch[R] = new Uint32Array(R * R * R));
    paintInto(S, model, p, q);
    const IX = R === 32 ? VX.I32 : R === 16 ? VX.I16 : VX.I, m = new Uint8Array(R * R);
    for (let a = 0; a < R; a++) for (let b = 0; b < R; b++) {
      // the sibling's layer that touches our face: d even → the sibling is at +axis, its low layer faces us
      const lo = (d & 1) === 0 ? 0 : R - 1;
      const v = d < 2 ? S[IX(lo, a, b)] : d < 4 ? S[IX(a, lo, b)] : S[IX(a, b, lo)];
      m[a * R + b] = (v & PRESENT) ? ((v & GLASS) ? 2 : 1) : 0;
    }
    VX.NB[d] = m;
  };
  function paintInto(G, model, p, q) {
    const R = model.res, IX = R === 32 ? VX.I32 : R === 16 ? VX.I16 : VX.I;
    G.fill(0);
    if (!p) return;
    q = ((q % 4) + 4) % 4;
    const [x0, y0, z0, x1, y1, z1] = p.bounds, vol = model.vol, pal = model.pal, VW = model.VW, VD = model.VD;
    const ox = p.px * R, oy = p.py * R, oz = p.pz * R;
    for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      const row = ((oy + y) * VD + oz + z) * VW + ox;
      for (let x = x0; x < x1; x++) { const v = vol[row + x]; if (!v) continue; let nx = x, nz = z; for (let r = 0; r < q; r++) { const t = nx; nx = R - 1 - nz; nz = t; } G[IX(nx, y, nz)] = pal[v]; }
    }
  }
  // the game's paint: the part itself, plus neighbour masks for the sibling parts the context says are really there (c.x bits)
  VM.paint = function (sp, c) {
    const model = sp.model;
    VM.paintPart(model, model.parts[c.part], c.facing);
    const bits = c.x | 0;
    if (bits) { const t = VM.siblings(model, c.facing), single = model.parts.length === 1; for (let d = 0; d < 6; d++) if ((bits >> d) & 1) { const j = t[c.part * 6 + d] >= 0 ? t[c.part * 6 + d] : single ? 0 : -1; if (j >= 0) VM.fillNeighbour(model, model.parts[j], c.facing, d); } }
  };
  // paint with every existing sibling masked (the studio: the whole model as placed)
  VM.paintFull = function (model, i, f) {
    VM.paintPart(model, model.parts[i], f);
    for (let d = 0; d < 6; d++) VX.NB[d] = null;
    const t = VM.siblings(model, f);
    for (let d = 0; d < 6; d++) { const j = t[i * 6 + d]; if (j >= 0) VM.fillNeighbour(model, model.parts[j], f, d); }
  };
  // icon: the whole model downsampled into the 8³ icon grid
  VM.icon = function (sp) {
    const m = sp.model, out = new Uint32Array(512), R = m.res;
    const span = Math.max(m.W, m.H, m.D) * R, k = span / 8;
    const ox = (span - m.W * R) / 2, oz = (span - m.D * R) / 2;
    for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      let r = 0, g = 0, b = 0, n = 0, fl = 0;
      for (let dy = 0; dy < k; dy++) for (let dz = 0; dz < k; dz++) for (let dx = 0; dx < k; dx++) {
        const vx = Math.floor(x * k + dx - ox), vy = Math.floor(y * k + dy), vz = Math.floor(z * k + dz - oz);
        const v = m.get(vx, vy, vz);
        if (!v) continue;
        r += (v >> 16) & 255; g += (v >> 8) & 255; b += v & 255; n++; fl |= v & (EMIS | GLASS | GLOSS);
      }
      if (n >= Math.max(1, (k * k * k) * 0.18)) out[(y * 8 + z) * 8 + x] = pack((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n), fl);
    }
    return out;
  };
  VX.icon16 = (sp) => sp.kind === 'model' ? VM.icon(sp) : null;

  // ---------------------------------------------------------------- definitions
  const DEFS = VM.DEFS = [];
  // VM.define(name, display, { size: [W, H, D], res, build(b, M), light, sound, hard, bed, seat })
  VM.define = function (name, display, o) { DEFS.push({ name, display, o }); return name; };
  // registration hook: runs inside VX.define (blocks4.js) with the VX adder
  VX.defineExtra.push(function (K) {
    const { add, FACING4 } = K;
    const G_ = K.G;
    for (const d of DEFS) {
      let model;
      try { model = compile(d.name, d.o); } catch (e) { console.warn('VM compile failed', d.name, e); continue; }
      if (!model.parts.length) { console.warn('VM empty model', d.name); continue; }
      MODELS[d.name] = model;
      const partNames = model.parts.map(p => 'p' + p.px + p.py + p.pz);
      const spec = { kind: 'model', res: model.res, model, col: model.col };
      add(d.name, d.display, spec, Object.assign({ props: [FACING4, ['part', partNames]], filter: 0, solid: true, group: G_.HOME || G_.ARCH, cat: 'vtech', sound: d.o.sound || 'wood', hard: d.o.hard || 1, vxModel: true }, d.o.light ? { light: d.o.light } : {}, d.o.bed ? { bed: true } : {}, d.o.seat ? { seat: true } : {}));
    }
  });
  // paint / box / icon hooks for kind 'model' (installed once voxarch has its tables)
  VM.install = function (PAINT_FN, KIND, boxHook, iconHook, OTHER) {
    PAINT_FN.model = VM.paint;
    KIND.model = { cls: OTHER };
    boxHook.model = (s, sel, t, f, sp) => {
      const p = sp.model.parts[t.has('part') ? t.get(s, 'part') : 0];
      if (!p) return [[0, 0, 0, 1, 1, 1]];
      const R = sp.model.res;
      let [x0, y0, z0, x1, y1, z1] = p.bounds.map(v => v / R);
      for (let r = 0; r < (((f % 4) + 4) % 4); r++) { const nx0 = 1 - z1, nx1 = 1 - z0, nz0 = x0, nz1 = x1; x0 = nx0; x1 = nx1; z0 = nz0; z1 = nz1; }
      return [[x0, y0, z0, x1, y1, z1]];
    };
    iconHook.model = (c) => { c.facing = 0; c.part = 0; };
    // context bits: which faces have the sibling part of the same model (same facing) really placed next door
    VX.ctxHook.model = (c, sp, s, nbS) => {
      const model = sp.model, f = c.facing, t = VM.siblings(model, f), single = model.parts.length === 1;
      const R = VR.R, T = R.T;
      let x = 0;
      for (let d = 0; d < 6; d++) {
        // a run of one-part models (gutters, downpipes, rails) continues into the next cell like a sibling part
        const j = t[c.part * 6 + d] >= 0 ? t[c.part * 6 + d] : single ? 0 : -1; if (j < 0) continue;
        const ns = nbS[d]; if (!ns) continue;
        const nsp = VX.spec(ns); if (!nsp || nsp.model !== model) continue;
        const nt = R.types[T.type[ns]];
        if (nt.get(ns, 'facing') === f && nt.get(ns, 'part') === j) x |= 1 << d;
      }
      return x;
    };
  };

  // ---------------------------------------------------------------- placement helpers for generators
  // P(u, y, v, name, props): place every part of `name` with its anchor part at (u, y, v), facing f (lot-local)
  VM.put = function (P, u, y, v, name, f, extra) {
    const m = MODELS[name]; if (!m) { P(u, y, v, name, Object.assign({ facing: f || 0 }, extra || {})); return; }
    for (const [dx, dy, dz, i] of VM.footprint(m, f || 0)) P(u + dx, y + dy, v + dz, name, Object.assign({ facing: f || 0, part: i }, extra || {}));
  };
  // the cells (dx, dz) a model covers on its floor level for a facing (for free-space checks)
  VM.cells = function (name, f) { const m = MODELS[name]; if (!m) return [[0, 0]]; const out = [], seen = new Set(); for (const [dx, dy, dz] of VM.footprint(m, f || 0)) { const k = dx + ',' + dz; if (!seen.has(k)) { seen.add(k); out.push([dx, dz]); } } return out; };
  VM.size = function (name, f) { const m = MODELS[name]; if (!m) return [1, 1, 1]; return (f & 1) ? [m.D, m.H, m.W] : [m.W, m.H, m.D]; };
  VM.install(VX._.PAINT_FN, VX.KIND, VX.boxHook, VX.iconHook, VX.CLS.OTHER);
})(VR);

// ============================================================================
// Smooth props (t-smooth, TRAILER.md §3.2 and the palms of trailer frames t3_05–t3_08; the owner's „die Items sollen
// schon echte Möbel sein"): procedural triangle meshes for the blocks the mesher hands over as anchors (mesher.js: the
// palm blocks with a `prop`, the furniture blocks of VR.PROP_FURN). Everything is built in JS once per model, from a few
// numbers — no asset, no texture file.
//   palm      a 10-sided trunk that curves with its seed (the lean) and shows bark rings, a crown of 13 frond slots on the
//             golden angle in tiers (V-folded, wide, sagging toward the tip), two dead fronds, two spear leaves, the
//             crownshaft and three coconuts. A frond mask per instance picks 9–13 green fronds (and 1–2 dead).
//   palm far  a cross of two cutout quads with the palm's silhouette (the same fronds, painted flat), for the distance.
//   furniture the furniture pack's pieces and the villages' own (sofas, armchairs, dining sets, beds, lamps, kitchens,
//             the bookcase, planters, the TV lowboard and the wall TV, coffee tables, nightstands, the cosy beds, tables,
//             chairs and modular sofas): a model builder and the models in the furniture section below.
// Vertex layout (14 floats): palm — pos, normal, uv, colour, bend, sway, frond slot; furniture — pos, normal, uv,
// colour, material, tint slot, ambient occlusion. Instance (12 floats): palm — [x y z yaw] [scale lean phase mask]
// [sky r g b]; furniture — [x y z yaw] [first colour rgb, second colour as an sRGB number] [sky r g b].
// renderer.js owns the GL side (drawProps). A new prop is one model here and one entry in the mesher's lists.
// ============================================================================
(function (VR) {
  'use strict';
  const PR = VR.Props = VR.Props || {};
  const TAU = Math.PI * 2;
  PR.VSTRIDE = 14;          // floats per vertex
  PR.INST = 12;             // floats per instance
  PR.TRUNK_D = 20;          // the trunk hangs this far below the crown: the part under the ground is hidden by the ground
  PR.FROND_N = 13;          // green fronds (slots 0..12)
  PR.DEAD_FIRST = 13;       // dead fronds (slots 13, 14)
  PR.BIT_FIXED = 15;        // mask bit: the trunk and the crownshaft (always drawn)
  PR.BIT_COCO = 16;         // mask bit: the coconuts
  // the palm's colours (sRGB), linearised by lin() like the terrain's tints
  const PAL = { bark: 0xB0946E, shaft: 0x7E9A50, nut: 0x6A4A2A, leafA: 0x4FAA40, leafB: 0x8AD456, tip: 0xD6EA74, dead: 0xA88050, spear: 0xB4DE6A };
  const lin = (c, k) => [Math.pow(((c >> 16) & 255) / 255, 2.2) * k, Math.pow(((c >> 8) & 255) / 255, 2.2) * k, Math.pow((c & 255) / 255, 2.2) * k];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  // a hash of an integer cell (x, y, z) and a salt, in [0, 1): the same on every machine, the seed of every instance
  const hash = PR.hash = function (x, y, z, s) {
    let h = Math.imul((x | 0) ^ Math.imul(s | 0, 0x9E3779B1), 0x85EBCA6B);
    h ^= Math.imul((y | 0) + 0x27D4EB2D, 0xC2B2AE35);
    h ^= Math.imul((z | 0) + 0x165667B1, 0x27D4EB2F);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };

  // ---------------------------------------------------------------- the frond curves (the mesh and the silhouette use them)
  // the axis of a frond slot: the green fronds fan out round the crown (the golden angle) in tiers — the young ones leave
  // it steeply (el up to 0.95 rad), the old ones nearly level and longer — and droop under their weight; the dead ones hang
  PR.frondAxis = function (k) {
    if (k < PR.DEAD_FIRST) { const tier = (k * 0.6180339887) % 1; return { az: k * 2.39996 + 0.35 * (hash(k, 0, 0, 101) - 0.5), el: 0.95 * (1 - tier), len: 3.4 + 0.9 * tier + 0.35 * hash(k, 0, 0, 102), dead: false }; }
    return { az: hash(k, 0, 0, 103) * TAU, el: -1.2, len: 2.6, dead: true };
  };
  // a point on frond slot k at t (0 = the crown's centre, 1 = the tip): it leaves the crown at its elevation and sags
  // toward the tip (a parabola: the lower the frond, the more it hangs)
  PR.frondPoint = function (k, t, out) {
    const a = PR.frondAxis(k), o = out || [0, 0, 0];
    if (!a.dead) {
      const q = 1 - a.el / 0.95, g = (0.5 + 0.26 * q * q) * a.len, r = 0.25 + a.len * Math.cos(a.el) * t;
      o[0] = r * Math.cos(a.az); o[1] = 0.3 + a.len * Math.sin(a.el) * t - g * t * t; o[2] = r * Math.sin(a.az);
    } else {
      const r = 0.25 + 0.35 * a.len * t;
      o[0] = r * Math.cos(a.az); o[1] = 0.1 - 1.9 * t * t; o[2] = r * Math.sin(a.az);
    }
    return o;
  };

  // ---------------------------------------------------------------- mesh building helpers
  function Builder() {
    const v = [], idx = [];
    let n = 0;
    const vert = (p, nrm, uv, col, bend, sway, frond) => {
      v.push(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], uv[0], uv[1], col[0], col[1], col[2], bend, sway, frond);
      return n++;
    };
    // a UV-sphere around (cx, cy, cz) with radii (rx, ry, rz); its rows are returned for the caller's own use
    const sphere = (cx, cy, cz, rx, ry, rz, col, sway, frond, LAT, LON) => {
      const rows = [];
      for (let i = 0; i <= LAT; i++) {
        const th = Math.PI * i / LAT, row = [];
        for (let j = 0; j < LON; j++) {
          const ph = TAU * j / LON, nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
          row.push(vert([cx + rx * nx, cy + ry * ny, cz + rz * nz], [nx, ny, nz], [2.75, 0.5], col, 0, sway, frond));
        }
        rows.push(row);
      }
      for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) {
        const a = rows[i][j], b = rows[i][(j + 1) % LON], c = rows[i + 1][(j + 1) % LON], d = rows[i + 1][j];
        idx.push(a, d, c, a, c, b);
      }
    };
    return { v, idx, vert, sphere, count: () => n };
  }
  // the mesh record: interleaved vertices (Float32Array), indices (Uint16Array), counts and the box it fills
  function finish(B) {
    const verts = new Float32Array(B.v), idx = new Uint16Array(B.idx);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < verts.length; i += PR.VSTRIDE) for (let k = 0; k < 3; k++) { const q = verts[i + k]; if (q < min[k]) min[k] = q; if (q > max[k]) max[k] = q; }
    return { verts, idx, nv: verts.length / PR.VSTRIDE, nt: idx.length / 3, min, max };
  }

  // ---------------------------------------------------------------- the palm (a unit palm: crown at the origin, trunk below)
  let PALM = null;
  PR.palm = function () {
    if (PALM) return PALM;
    const B = Builder(), D = PR.TRUNK_D, SIDES = 10, RINGS = 14;
    // the trunk: rings down to −D, slim at the crown (0.27) and wider below, a slight collar under the crown; it curves with
    // the instance's lean (the bend reaches its full lean nine blocks under the crown); uv.x 2.25 marks a solid part (no
    // atlas lookup: the trunk, the bulb and the nuts are u >= 2) and uv.y counts the bark rings (2.5 a block, the shader
    // bands them)
    const trunk = [];
    for (let j = 0; j <= RINGS; j++) {
      const s = D * Math.pow(j / RINGS, 1.6), bend = Math.pow(Math.min(1, s / 9), 1.6), r = 0.27 + 0.013 * s + (s < 0.7 ? 0.05 * (1 - s / 0.7) : 0), ring = [];
      for (let k = 0; k <= SIDES; k++) {
        const f = (k / SIDES) * TAU, c = Math.cos(f), sn = Math.sin(f);
        ring.push(B.vert([r * c, -s, r * sn], [c, 0, sn], [2.25, s * 2.5], lin(PAL.bark, 0.92 + 0.12 * hash(k, j, 0, 5)), bend, 0.12 * (1 - bend), PR.BIT_FIXED));
      }
      trunk.push(ring);
    }
    for (let j = 0; j < RINGS; j++) for (let k = 0; k < SIDES; k++) {
      const a = trunk[j][k], b = trunk[j][k + 1], c = trunk[j + 1][k + 1], d = trunk[j + 1][k];
      B.idx.push(a, d, c, a, c, b);
    }
    // the crownshaft: a green bulb on the trunk top, the crown's floor
    B.sphere(0, 0.16, 0, 0.42, 0.55, 0.42, lin(PAL.shaft, 1), 0.12, PR.BIT_FIXED, 5, 8);
    // a frond: eight segments along its curve, three vertices across (a V-fold: the leaflets rise from the midrib), wide
    // in the middle and narrow at the stalk and the tip; the atlas's frond (u 0…0.5) cuts the leaflets out
    const P = [0, 0, 0], Q = [0, 0, 0], ROWS = 8;
    const frond = (k, pt, axisAz, Wmax, fold, colOf, swayOf, slot) => {
      const sx = -Math.sin(axisAz), sz = Math.cos(axisAz), rows = [];
      for (let i = 0; i <= ROWS; i++) {
        const t = i / ROWS, p = pt(Math.min(t, 0.98), P).slice(), q = pt(Math.min(1, t + 0.02), Q), tg = norm3([q[0] - p[0], q[1] - p[1], q[2] - p[2]]);
        if (t > 0.98) pt(1, p);
        // the frond's up: perpendicular to its tangent and its side
        const side = [sx, 0, sz], u = norm3([side[1] * tg[2] - side[2] * tg[1], side[2] * tg[0] - side[0] * tg[2], side[0] * tg[1] - side[1] * tg[0]]);
        const W = Wmax * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.6) * (1 - 0.3 * t), lift = fold * W;
        const col = colOf(t), sw = swayOf(t);
        const nl = norm3([u[0] - sx * fold, u[1], u[2] - sz * fold]), nr = norm3([u[0] + sx * fold, u[1], u[2] + sz * fold]);
        const l = B.vert([p[0] + sx * W + u[0] * lift, p[1] + u[1] * lift, p[2] + sz * W + u[2] * lift], nl, [0, t], col, 0, sw, slot);
        const m = B.vert([p[0], p[1], p[2]], u, [0.25, t], col.map(c => c * 1.08), 0, sw, slot);
        const r = B.vert([p[0] - sx * W + u[0] * lift, p[1] + u[1] * lift, p[2] - sz * W + u[2] * lift], nr, [0.5, t], col, 0, sw, slot);
        rows.push([l, m, r]);
      }
      for (let i = 0; i < ROWS; i++) { const [a0, b0, c0] = rows[i], [a1, b1, c1] = rows[i + 1]; B.idx.push(a0, b0, b1, a0, b1, a1, b0, c0, c1, b0, c1, b1); }
    };
    for (let k = 0; k < PR.FROND_N + 2; k++) {
      const a = PR.frondAxis(k), dead = a.dead, h = hash(k, 0, 0, 8);
      const leaf = lerp3(lin(PAL.leafA, 1), lin(PAL.leafB, 1), h), tip = lin(PAL.tip, 1);
      frond(k, (t, o) => PR.frondPoint(k, t, o), a.az, dead ? 0.3 : 0.84, dead ? 0.15 : 0.42,
        (t) => dead ? lin(PAL.dead, 0.82 + 0.22 * hash(k, Math.round(t * 8), 0, 7)) : leaf.map((c, q) => c * (1 - 0.32 * t) + tip[q] * 0.32 * t),
        (t) => dead ? 0.25 * t : 0.35 + 0.65 * t, k);
    }
    // two spear leaves: the young fronds still folded, standing up out of the crown's middle (always on)
    for (const [az, el] of [[0.6, 1.35], [3.4, 1.22]]) {
      frond(99, (t, o) => { const r = 0.08 + 1.9 * Math.cos(el) * t; o[0] = r * Math.cos(az); o[1] = 0.35 + 1.9 * Math.sin(el) * t - 0.2 * t * t; o[2] = r * Math.sin(az); return o; }, az, 0.15, 0.9,
        () => lin(PAL.spear, 1), (t) => 0.2 + 0.4 * t, PR.BIT_FIXED);
    }
    // three coconuts under the crown (always on with the crown: mask bit 16)
    for (const [x, y, z] of [[0.24, -0.32, 0.12], [-0.2, -0.36, -0.1], [0.04, -0.42, -0.26]]) B.sphere(x, y, z, 0.2, 0.22, 0.2, lin(PAL.nut, 1), 0.8, PR.BIT_COCO, 4, 6);
    PALM = finish(B);
    return PALM;
  };

  // ---------------------------------------------------------------- the far palm: two crossed cutout quads (x and z planes)
  let CROSS = null;
  PR.cross = function () {
    if (CROSS) return CROSS;
    const B = Builder();
    // a quad from (x0, z0) to (x1, z1), from y = −16 (the ground's depth) to y = 6 (above the fronds)
    const quad = (x0, z0, x1, z1, nrm) => {
      const sw = (y) => Math.min(1, Math.max(0, (y + 2) / 8)) * 0.8;
      const a = B.vert([x0, -16, z0], nrm, [0, 1], [1, 1, 1], 0, sw(-16), PR.BIT_FIXED);
      const b = B.vert([x1, -16, z1], nrm, [1, 1], [1, 1, 1], 0, sw(-16), PR.BIT_FIXED);
      const c = B.vert([x1, 6, z1], nrm, [1, 0], [1, 1, 1], 0, sw(6), PR.BIT_FIXED);
      const d = B.vert([x0, 6, z0], nrm, [0, 0], [1, 1, 1], 0, sw(6), PR.BIT_FIXED);
      B.idx.push(a, b, c, a, c, d);
    };
    quad(-6, 0, 6, 0, [0, 0, 1]);
    quad(0, -6, 0, 6, [1, 0, 0]);
    CROSS = finish(B);
    return CROSS;
  };

  // ---------------------------------------------------------------- the textures (RGBA8, row 0 = the top)
  // the palm atlas: the left half (u 0–0.5) is the frond — a midrib and slanted leaflets, narrower to the tip, alpha 0 or
  // 255 (cutout); the right half (u 0.5–1) is solid white (the trunk, the bulb and the nuts take their colour from it)
  PR.atlas = function (W = 128, H = 256) {
    const d = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      if (x >= W / 2) { d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 255; continue; }
      const v = (y + 0.5) / H, u = (x + 0.5) / (W / 2), e = Math.abs(u - 0.5) * 2;
      let on = false, shade = 1;
      if (e < 0.045) { on = true; shade = 1.0; }
      else {
        // the leaflets: slanting to the tip, broad (about two thirds leaf, a third gap), their ends ragged at the edge
        const s = (v * 16 + e * 1.6) % 1, rag = 0.9 + 0.1 * Math.sin((v * 16 + e * 1.6) * 9.0 + x);
        on = e < 0.98 * rag && s < 0.68 + 0.17 * (1 - e) && hash(x, y, 0, 41) > 0.03;
        shade = 0.7 + 0.3 * (1 - s) - 0.12 * e;
      }
      const c = on ? Math.round(255 * Math.min(1, shade)) : 0;
      d[o] = d[o + 1] = d[o + 2] = c; d[o + 3] = on ? 255 : 0;
    }
    return { w: W, h: H, data: d };
  };
  // the far silhouette: x from −6 to 6 blocks across, y from 6 (top) down to −16; the trunk, the fronds and the crown
  // painted as discs along their curves, with a few holes so the leaves do not read as cards
  PR.silhouette = function (W = 128, H = 192) {
    const d = new Uint8Array(W * H * 4);
    const disc = (cx, cy, rad, rgb, holes, salt) => {
      const x0 = Math.max(0, Math.floor((cx - rad + 6) / 12 * W)), x1 = Math.min(W - 1, Math.ceil((cx + rad + 6) / 12 * W));
      const y0 = Math.max(0, Math.floor((6 - (cy + rad)) / 22 * H)), y1 = Math.min(H - 1, Math.ceil((6 - (cy - rad)) / 22 * H));
      for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) {
        const px = -6 + 12 * (ix + 0.5) / W, py = 6 - 22 * (iy + 0.5) / H;
        if ((px - cx) * (px - cx) + (py - cy) * (py - cy) > rad * rad) continue;
        if (holes && hash(ix, iy, 0, salt) < holes) continue;
        const o = (iy * W + ix) * 4, sh = 0.85 + 0.3 * hash(ix, iy, 0, salt + 1);
        d[o] = Math.min(255, rgb[0] * sh); d[o + 1] = Math.min(255, rgb[1] * sh); d[o + 2] = Math.min(255, rgb[2] * sh); d[o + 3] = 255;
      }
    };
    const rgbOf = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    for (let y = -16; y <= 0.5; y += 0.25) disc(0, y, 0.3, rgbOf(PAL.bark), 0, 51);        // the trunk (to the crown)
    const P = [0, 0, 0];
    for (let k = 0; k < PR.FROND_N + 2; k++) {
      const dead = k >= PR.DEAD_FIRST, col = dead ? PAL.dead : (k & 1 ? PAL.leafB : PAL.leafA);
      for (let i = 0; i <= 30; i++) { const t = i / 30; PR.frondPoint(k, t, P); disc(P[0], P[1], dead ? 0.26 : 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.6) * (1 - 0.3 * t) + 0.08, rgbOf(col), 0.12, 61 + k); }
    }
    disc(0, 0.3, 0.9, rgbOf(PAL.leafA), 0, 81);
    for (const [x, y] of [[0.22, -0.3], [-0.18, -0.34], [0.04, -0.4]]) disc(x, y, 0.22, rgbOf(PAL.nut), 0, 91);
    return { w: W, h: H, data: d };
  };


  // ================================================================ furniture (the owner: „die Items sollen schon echte Möbel sein")
  // The furniture pack's pieces (voxfurn.js) as smooth meshes: rounded cushions with piped seams and soft domes,
  // tapered legs, thin table tops, lamp shades that glow from inside, real leaves. Every model is built here from the
  // same numbers as its voxel piece (16 units a block, from the model's corner: x across, y up, z to the back, the front
  // at −z) and centred on its footprint (x −W/2…W/2, z −D/2…D/2, y from the floor). The vertex layout is the palm's
  // (14 floats) with other meanings: pos, normal, uv (the furniture atlas), colour (linear), material, tint slot (0 its
  // own colour, 1 × the piece's first colour, 2 × its second), ambient occlusion. A mesh keeps its opaque triangles
  // first and its translucent ones (glass, the contact shadow) after them (nOpaque), and a far mesh of plain boxes.
  const MAT = PR.MAT = { fabric: 0, wood: 1, metal: 2, glass: 3, light: 4, matte: 5, gloss: 6, leaf: 7, marble: 8, leather: 9, shade: 10, shadow: 11 };
  const UV0 = [0.875, 0.875];                       // the atlas's white quarter: a part without a picture
  const shd = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) * k) | 0, g = Math.min(255, ((c >> 8) & 255) * k) | 0, b = Math.min(255, (c & 255) * k) | 0; return (r << 16) | (g << 8) | b; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // rotations for the transform of a few parts (a pillow leaning back, a book leaning on its neighbour)
  const rotM = (axis, a) => { const c = Math.cos(a), s = Math.sin(a); return axis === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c] : axis === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const mulM = (A, B) => { const o = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return o; };
  const apM = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];

  // ---------------------------------------------------------------- the model builder (units: 16 a block)
  function FB(W, H, D) {
    const v = [], idx = [], tidx = [], fv = [], fidx = [];
    let n = 0, fn = 0, xf = null;
    const cur = { m: MAT.matte, c: [0.5, 0.5, 0.5], t: 0, ao: 1 };
    const cx = W * 8, cz = D * 8;
    const F = { W, H, D };
    // the material for the next parts: id, colour (sRGB), tint slot, ambient occlusion
    F.m = (m, col, tint, ao) => { cur.m = m; cur.c = lin(col === undefined ? 0xFFFFFF : col, 1); cur.t = tint | 0; cur.ao = ao === undefined ? 1 : ao; return F; };
    // a turn for the next parts: an axis ('x', 'y', 'z') or a list of [axis, angle] turns, about a pivot; null ends it
    F.turn = (turns, pivot) => { if (!turns) { xf = null; return F; } let M = [1, 0, 0, 0, 1, 0, 0, 0, 1]; for (const [ax, a] of turns) M = mulM(rotM(ax, a), M); xf = { M, p: pivot }; return F; };
    const emit = (x, y, z, nx, ny, nz, u, vv, k, ao) => {
      let p = [x, y, z], q = [nx, ny, nz];
      if (xf) { p = apM(xf.M, sub(p, xf.p)); p = [p[0] + xf.p[0], p[1] + xf.p[1], p[2] + xf.p[2]]; q = apM(xf.M, q); }
      const c = cur.c, kk = k === undefined ? 1 : k, under = q[1] < -0.6 ? 0.78 : 1;
      v.push((p[0] - cx) / 16, p[1] / 16, (p[2] - cz) / 16, q[0], q[1], q[2], u, vv, c[0] * kk, c[1] * kk, c[2] * kk, cur.m, cur.t, cur.ao * (ao === undefined ? 1 : ao) * under);
      return n++;
    };
    const tri = (a, b, c) => { (cur.m === MAT.glass || cur.m === MAT.shadow ? tidx : idx).push(a, b, c); };
    // the low level, for hand-made parts: a vertex (units, a normal), a triangle, the vertex count, a vertex's position
    F.tri = tri; F.count = () => n;
    F.emit = (x, y, z, nx, ny, nz, k) => emit(x, y, z, nx, ny, nz, UV0[0], UV0[1], k);
    F.pos = (i) => { const o = i * PR.VSTRIDE; return [v[o] * 16 + cx, v[o + 1] * 16, v[o + 2] * 16 + cz]; };
    // a rounded box: every edge and corner rounded with radius r (0 = sharp), the faces optionally domed (bulge by face:
    // 0 −x 1 +x 2 −y 3 +y 4 −z 5 +z, in units) and the edges darkened into a seam; skip: a mask of faces left out
    F.rbox = (x0, y0, z0, x1, y1, z1, r, o) => {
      o = o || {};
      const s = o.seg || (r > 0 ? 2 : 1), mid = o.mid || (o.bulge ? 3 : 1), skip = o.skip || 0, bul = o.bulge || null;
      const seam = o.seam === undefined ? 0.84 : o.seam;
      r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2));
      const lo = [x0, y0, z0], hi = [x1, y1, z1], ilo = [x0 + r, y0 + r, z0 + r], ihi = [x1 - r, y1 - r, z1 - r];
      const samp = (a0, a1) => {
        const out = [], push = (q) => { if (!out.length || q - out[out.length - 1] > 1e-6) out.push(q); };
        if (r > 0) for (let k = s; k >= 0; k--) push(a0 + r * (1 - Math.tan(Math.PI / 4 * k / s))); else push(a0);
        for (let k = 1; k < mid; k++) push(a0 + r + (a1 - a0 - 2 * r) * k / mid);
        if (r > 0) for (let k = 0; k <= s; k++) push(a1 - r * (1 - Math.tan(Math.PI / 4 * k / s))); else push(a1);
        return out;
      };
      const S = [samp(x0, x1), samp(y0, y1), samp(z0, z1)];
      for (let f = 0; f < 6; f++) {
        if (skip & (1 << f)) continue;
        const ax = f >> 1, sg = f & 1 ? 1 : -1, ua = (ax + 1) % 3, va = (ax + 2) % 3, U = S[ua], V = S[va], base = n;
        const B = bul ? (bul[f] || 0) : 0, Lu = hi[ua] - lo[ua], Lv = hi[va] - lo[va];
        for (let j = 0; j < V.length; j++) for (let i = 0; i < U.length; i++) {
          const p = [0, 0, 0]; p[ax] = sg > 0 ? hi[ax] : lo[ax]; p[ua] = U[i]; p[va] = V[j];
          const q = [Math.min(ihi[0], Math.max(ilo[0], p[0])), Math.min(ihi[1], Math.max(ilo[1], p[1])), Math.min(ihi[2], Math.max(ilo[2], p[2]))];
          const d = sub(p, q), dl = Math.hypot(d[0], d[1], d[2]);
          let nr, pos;
          if (dl < 1e-6 || r <= 0) { nr = [0, 0, 0]; nr[ax] = sg; pos = p; } else { nr = [d[0] / dl, d[1] / dl, d[2] / dl]; pos = [q[0] + nr[0] * r, q[1] + nr[1] * r, q[2] + nr[2] * r]; }
          if (B) {
            const a = (U[i] - lo[ua]) / Lu, b = (V[j] - lo[va]) / Lv, ha = 1 - (2 * a - 1) * (2 * a - 1), hb = 1 - (2 * b - 1) * (2 * b - 1);
            pos[ax] += sg * B * ha * hb;
            const g = [0, 0, 0]; g[ua] = B * (-4 * (2 * a - 1) / Lu) * hb; g[va] = B * ha * (-4 * (2 * b - 1) / Lv);
            nr = norm3([nr[0] - g[0], nr[1] - g[1], nr[2] - g[2]]);
          }
          const edge = r > 0 && (i === 0 || j === 0 || i === U.length - 1 || j === V.length - 1);
          emit(pos[0], pos[1], pos[2], nr[0], nr[1], nr[2], UV0[0], UV0[1], edge ? seam : 1);
        }
        const nu = U.length;
        for (let j = 0; j < V.length - 1; j++) for (let i = 0; i < nu - 1; i++) {
          const a = base + j * nu + i, b = a + 1, c = a + nu + 1, d = a + nu;
          if (sg > 0) { tri(a, b, c); tri(a, c, d); } else { tri(a, c, b); tri(a, d, c); }
        }
      }
      return F;
    };
    F.box = (x0, y0, z0, x1, y1, z1, skip) => F.rbox(x0, y0, z0, x1, y1, z1, 0, { skip: skip || 0 });
    // a ring of a surface of revolution (or a tube): seg + 1 vertices around the frame (c = centre, u, w = the frame)
    const ring = (c, u, w, r, nOf, k) => { const base = n; for (let i = 0; i <= k; i++) { const a = i / k * TAU, ca = Math.cos(a), sa = Math.sin(a); const nr = nOf(ca, sa); emit(c[0] + (u[0] * ca + w[0] * sa) * r, c[1] + (u[1] * ca + w[1] * sa) * r, c[2] + (u[2] * ca + w[2] * sa) * r, nr[0], nr[1], nr[2], UV0[0], UV0[1]); } return base; };
    const band = (A, B, k, flip) => { for (let i = 0; i < k; i++) { const a = A + i, b = A + i + 1, c = B + i + 1, d = B + i; if (flip) { tri(a, c, d); tri(a, b, c); } else { tri(a, d, c); tri(a, c, b); } } };
    const capDisc = (c, u, w, r, nrm, k, up) => { const ctr = emit(c[0], c[1], c[2], nrm[0], nrm[1], nrm[2], UV0[0], UV0[1]); const R0 = ring(c, u, w, r, () => nrm, k); for (let i = 0; i < k; i++) { if (up) tri(ctr, R0 + i + 1, R0 + i); else tri(ctr, R0 + i, R0 + i + 1); } };
    // a vertical tapered cylinder (legs, posts): radius r0 at y0, r1 at y1; caps: 1 bottom, 2 top
    F.cyl = (x, z, y0, y1, r0, r1, o) => {
      o = o || {}; const k = o.seg || 10, sl = (r0 - r1) / Math.max(1e-6, y1 - y0), caps = o.caps === undefined ? 2 : o.caps;
      const U = [1, 0, 0], Wv = [0, 0, 1];
      const A = ring([x, y0, z], U, Wv, r0, (ca, sa) => norm3([ca, sl, sa]), k), B = ring([x, y1, z], U, Wv, r1, (ca, sa) => norm3([ca, sl, sa]), k);
      band(A, B, k);
      if (caps & 1) capDisc([x, y0, z], U, Wv, r0, [0, -1, 0], k, false);
      if (caps & 2) capDisc([x, y1, z], U, Wv, r1, [0, 1, 0], k, true);
      return F;
    };
    // a tube along a polyline (rods, an arc, stems): radius r0 → r1 from the first point to the last; caps as cyl
    F.tube = (pts, r0, r1, o) => {
      o = o || {}; const k = o.seg || 8, caps = o.caps === undefined ? 3 : o.caps, N = pts.length;
      let prevU = null, first = -1, last = -1, prev = -1, fu = null, fw = null, lu = null, lw = null;
      for (let i = 0; i < N; i++) {
        const t = norm3(i === 0 ? sub(pts[1], pts[0]) : i === N - 1 ? sub(pts[N - 1], pts[N - 2]) : sub(pts[i + 1], pts[i - 1]));
        let u = prevU ? sub(prevU, t.map(x => x * (prevU[0] * t[0] + prevU[1] * t[1] + prevU[2] * t[2]))) : cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
        u = norm3(u); prevU = u;
        const w = cross(u, t), r = r0 + (r1 - r0) * i / (N - 1);
        const R = ring(pts[i], u, w, r, (ca, sa) => [u[0] * ca + w[0] * sa, u[1] * ca + w[1] * sa, u[2] * ca + w[2] * sa], k);
        if (prev >= 0) band(prev, R, k); else { first = R; fu = u; fw = w; }
        prev = R; last = R; lu = u; lw = w;
      }
      if (caps & 1) { const t = norm3(sub(pts[0], pts[1])); capDisc(pts[0], fu, fw, r0, t, k, false); }
      if (caps & 2) { const t = norm3(sub(pts[N - 1], pts[N - 2])); capDisc(pts[N - 1], lu, lw, r1, t, k, true); }
      return F;
    };
    F.rod = (x0, y0, z0, x1, y1, z1, r, o) => F.tube([[x0, y0, z0], [x1, y1, z1]], r, o && o.r1 !== undefined ? o.r1 : r, o);
    // a surface of revolution about the vertical through (x, z): profile [[y, r], …] from the bottom up; the normal
    // points to the right of the walk (out where the profile rises); flip turns it inside (the glowing inner face of a
    // shade); capBot / capTop close the ends with discs
    F.lathe = (x, z, prof, o) => {
      o = o || {}; const k = o.seg || 16, flip = !!o.flip, U = [1, 0, 0], Wv = [0, 0, 1], N = prof.length, rings = [];
      for (let i = 0; i < N; i++) {
        const pa = prof[Math.max(0, i - 1)], pb = prof[Math.min(N - 1, i + 1)];
        let dr = pb[1] - pa[1], dy = pb[0] - pa[0];
        if (o.sharp && i > 0 && i < N - 1) { dr = prof[i + 1][1] - prof[i][1]; dy = prof[i + 1][0] - prof[i][0]; }
        const L = Math.hypot(dr, dy) || 1, nr = dy / L * (flip ? -1 : 1), ny = -dr / L * (flip ? -1 : 1);
        rings.push(ring([x, prof[i][0], z], U, Wv, Math.max(prof[i][1], 1e-4), (ca, sa) => [ca * nr, ny, sa * nr], k));
      }
      for (let i = 0; i < N - 1; i++) band(rings[i], rings[i + 1], k, flip);
      if (o.capBot) capDisc([x, prof[0][0], z], U, Wv, prof[0][1], [0, -1, 0], k, false);
      if (o.capTop) capDisc([x, prof[N - 1][0], z], U, Wv, prof[N - 1][1], [0, 1, 0], k, true);
      return F;
    };
    // an ellipsoid; lump: a seeded wobble of the radius (a clipped boxwood ball), with a colour shimmer per vertex
    F.sphere = (x, y, z, rx, ry, rz, o) => {
      o = o || {}; const la = o.seg || 8, lo = la * 2, base = n, lump = o.lump || 0, seed = o.seed || 1;
      for (let i = 0; i <= la; i++) for (let j = 0; j <= lo; j++) {
        const th = Math.PI * i / la, ph = TAU * j / lo, sx = Math.sin(th) * Math.cos(ph), sy = Math.cos(th), sz = Math.sin(th) * Math.sin(ph);
        const jj = j === lo ? 0 : j, w = lump ? 1 + lump * (hash(i === 0 ? 0 : i === la ? 999 : i, i === 0 || i === la ? 0 : jj, 0, seed) - 0.5) : 1;
        const k = lump ? 0.82 + 0.3 * hash(i, jj, 1, seed + 7) : 1;
        const nr = norm3([sx / rx, sy / ry, sz / rz]);
        emit(x + sx * rx * w, y + sy * ry * w, z + sz * rz * w, nr[0], nr[1], nr[2], UV0[0], UV0[1], k);
      }
      for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) {
        const a = base + i * (lo + 1) + j, b = a + 1, c = a + lo + 2, d = a + lo + 1;
        tri(d, a, b); tri(d, b, c);
      }
      return F;
    };
    // a flat quad p0 p1 p2 p3 (counter-clockwise from its front), with the atlas rectangle uv [u0, v0, u1, v1]
    F.quad = (p0, p1, p2, p3, uv, two) => {
      const nr = norm3(cross(sub(p1, p0), sub(p3, p0))), r = uv || [UV0[0], UV0[1], UV0[0], UV0[1]];
      const U = [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]], P4 = [p0, p1, p2, p3];
      const a = n; for (let i = 0; i < 4; i++) emit(P4[i][0], P4[i][1], P4[i][2], nr[0], nr[1], nr[2], U[i][0], U[i][1]);
      tri(a, a + 1, a + 2); tri(a, a + 2, a + 3);
      if (two) { const b = n; for (let i = 0; i < 4; i++) emit(P4[i][0], P4[i][1], P4[i][2], -nr[0], -nr[1], -nr[2], U[i][0], U[i][1]); tri(b, b + 2, b + 1); tri(b, b + 3, b + 2); }
      return F;
    };
    // a leaf: a bent card from its base along dir (a unit vector), its width across side, drooping at the tip; the
    // atlas rectangle carries its cutout shape; both faces are drawn
    F.leaf = (base, dir, side, len, wid, droop, uv) => {
      const rows = 4, A = n, up = norm3(cross(side, dir));
      for (let i = 0; i <= rows; i++) {
        const t = i / rows, dd = droop * t * t, c = [base[0] + dir[0] * len * t - up[0] * dd, base[1] + dir[1] * len * t - up[1] * dd, base[2] + dir[2] * len * t - up[2] * dd];
        const vv = uv[3] + (uv[1] - uv[3]) * t, tn = norm3([up[0] + dir[0] * droop * 2 * t / len, up[1] + dir[1] * droop * 2 * t / len, up[2] + dir[2] * droop * 2 * t / len]);
        for (let s = 0; s < 2; s++) { const sg = s ? 0.5 : -0.5; emit(c[0] + side[0] * wid * sg, c[1] + side[1] * wid * sg, c[2] + side[2] * wid * sg, tn[0], tn[1], tn[2], s ? uv[2] : uv[0], vv); }
      }
      for (let i = 0; i < rows; i++) { const a = A + i * 2; tri(a, a + 1, a + 3); tri(a, a + 3, a + 2); }
      const B = n;
      for (let i = 0; i < (rows + 1) * 2; i++) { const o = (A + i) * PR.VSTRIDE; v.push(v[o], v[o + 1], v[o + 2], -v[o + 3], -v[o + 4], -v[o + 5], v[o + 6], v[o + 7], v[o + 8], v[o + 9], v[o + 10], v[o + 11], v[o + 12], v[o + 13]); n++; }
      for (let i = 0; i < rows; i++) { const a = B + i * 2; tri(a, a + 3, a + 1); tri(a, a + 2, a + 3); }
      return F;
    };
    // the far mesh: a plain box in the current material
    F.far = (x0, y0, z0, x1, y1, z1) => {
      const c = cur.c, P = (x, y, z) => [(x - cx) / 16, y / 16, (z - cz) / 16];
      const faces = [[[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]], [[0, 1, 0], [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]],
        [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]], [[1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]],
        [[0, 0, -1], [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]]], [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]]];
      for (const [nr, q] of faces) {
        const a = fn;
        for (const p of q) { const w = P(p[0], p[1], p[2]); fv.push(w[0], w[1], w[2], nr[0], nr[1], nr[2], UV0[0], UV0[1], c[0], c[1], c[2], cur.m, cur.t, cur.ao * (nr[1] < 0 ? 0.78 : 1)); fn++; }
        fidx.push(a, a + 1, a + 2, a, a + 2, a + 3);
      }
      return F;
    };
    // the soft contact shadow on the floor under a piece (a translucent quad; the shader fades its edges)
    F.shadow = (x0, z0, x1, z1) => { const m = cur.m; cur.m = MAT.shadow; F.quad([x0, 0.12, z1], [x1, 0.12, z1], [x1, 0.12, z0], [x0, 0.12, z0], [0, 0, 1, 1]); cur.m = m; return F; };
    F.done = () => {
      const all = idx.concat(tidx), verts = new Float32Array(v), ix = new Uint16Array(all);
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < verts.length; i += PR.VSTRIDE) for (let k = 0; k < 3; k++) { const q = verts[i + k]; if (q < min[k]) min[k] = q; if (q > max[k]) max[k] = q; }
      const near = { verts, idx: ix, nv: verts.length / PR.VSTRIDE, nt: ix.length / 3, nOpaque: idx.length, min, max };
      const far = fn ? { verts: new Float32Array(fv), idx: new Uint16Array(fidx), nv: fn, nt: fidx.length / 3, nOpaque: fidx.length } : null;
      return { near, far };
    };
    return F;
  }
  PR.FB = FB;

  // ---------------------------------------------------------------- the furniture atlas (RGBA8, row 0 = the top, 256²)
  // top left: a monstera leaf (split, with holes along the midrib); top right: an olive spray (a twig with slim
  // silvery leaves, in its own colours); bottom left: the wall TV's picture (a lake under mountains at dusk); the
  // bottom right quarter is white (the parts without a picture). Leaves are cutout (alpha 0 or 255).
  PR.ATL = { monstera: [0, 0, 0.5, 0.5], olive: [0.5, 0, 1, 0.5], tv: [0.0, 0.5, 0.5, 0.78] };
  PR.furnAtlas = function () {
    const S = 256, d = new Uint8Array(S * S * 4);
    const put = (x, y, r, g, b, a) => { const o = (y * S + x) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (x >= 128 && y >= 128) { put(x, y, 255, 255, 255, 255); continue; }
      if (x < 128 && y < 128) {
        // monstera: v from the stalk (bottom, v 0) to the tip (top, v 1), u across (−1…1)
        const u = (x + 0.5) / 64 - 1, v = 1 - (y + 0.5) / 128, au = Math.abs(u);
        const half = 0.96 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.97 + 0.03)), 0.75) * (1 - 0.12 * v);
        let on = au < half && v > 0.02;
        const sl = v * 1.25 + au * 0.75, slit = (sl * 5.2) % 1;
        if (on && au > 0.32 * half && slit < 0.07 + 0.05 * (au / half) && v > 0.12 && v < 0.93) on = false;   // the splits from the edge in
        const hv = (sl * 5.2) % 1; if (on && au > 0.14 && au < 0.27 && Math.abs(hv - 0.5) < 0.11 && v > 0.2 && v < 0.82) on = false;   // the holes along the midrib
        const rib = au < 0.035 ? 1.18 : 1, vein = Math.abs(slit - 0.5) > 0.42 ? 0.86 : 1, sh = (0.78 + 0.22 * (1 - au)) * rib * vein;
        const c = Math.min(255, 255 * sh) | 0;
        put(x, y, c, c, c, on ? 255 : 0);
        continue;
      }
      if (x >= 128 && y < 128) {
        // olive: a twig up the middle, eight pairs of slim leaves leaning up and out
        const px = (x - 128 + 0.5) / 128, py = 1 - (y + 0.5) / 128;
        let on = false, r = 0, g = 0, b = 0;
        if (Math.abs(px - 0.5 - (py - 0.5) * 0.08) < 0.012 && py > 0.02 && py < 0.92) { on = true; r = 120; g = 100; b = 78; }
        for (let k = 0; k < 9 && !on; k++) {
          const by = 0.1 + k * 0.095, side = k & 1 ? 1 : -1, ang = 0.75 + 0.15 * Math.sin(k * 1.7);
          const dx = Math.sin(ang) * side, dy = Math.cos(ang), lx = px - (0.5 + (by - 0.5) * 0.08), ly = py - by;
          const along = lx * dx + ly * dy, acr = -lx * dy + ly * dx, L = 0.3 - 0.012 * k;
          if (along > 0 && along < L && Math.abs(acr) < 0.035 * Math.sin(Math.PI * along / L)) { on = true; const t = 0.75 + 0.25 * (along / L); r = 150 * t; g = 168 * t; b = 128 * t; if (acr < 0) { r *= 0.85; g *= 0.88; b *= 0.85; } }
        }
        if (!on && py > 0.9 && Math.hypot(px - 0.52, py - 0.95) < 0.04) { on = true; r = 150; g = 168; b = 128; }
        put(x, y, r | 0, g | 0, b | 0, on ? 255 : 0);
        continue;
      }
      // the TV picture: rows 128…199 (the rest of the quarter is white): a dusk sky, far mountains, a lake
      if (y >= 200) { put(x, y, 255, 255, 255, 255); continue; }
      const px = (x + 0.5) / 128, py = (y - 128 + 0.5) / 72;
      const ridge = 0.5 + 0.08 * Math.sin(px * 9) + 0.05 * Math.sin(px * 23 + 1) - 0.12 * Math.exp(-((px - 0.62) ** 2) * 40);
      let r, g, b;
      if (py < ridge) { const t = py / ridge; r = 46 + 150 * t; g = 92 + 90 * t; b = 168 + 50 * t; if (Math.hypot(px - 0.72, py - 0.33) < 0.06) { r = 255; g = 226; b = 160; } }
      else if (py < 0.68) { const t = (py - ridge) / 0.18; r = 52 + 20 * t; g = 82 + 18 * t; b = 74 + 10 * t; }
      else { const t = (py - 0.68) / 0.32; r = 74 + 40 * (1 - t); g = 140 + 30 * (1 - t); b = 200 - 20 * t; if (Math.abs(px - 0.72) < 0.03 * (1 - t) + 0.01) { r += 60; g += 50; b += 30; } }
      put(x, y, Math.min(255, r) | 0, Math.min(255, g) | 0, Math.min(255, b) | 0, 255);
    }
    return { w: S, h: S, data: d };
  };

  // ---------------------------------------------------------------- the furniture models (the voxel pieces' numbers)
  const WOOD = { walnut: 0x5C3D26, oak: 0xB89262, ash: 0xD9C6A5, smoked: 0x3E2E24 };
  const COL = { black: 0x1C1E22, brass: 0xC9A24A, white: 0xF2F2EE, marble: 0xEAEAEC, marbleD: 0x25272B, steel: 0xB8BEC6, warm: 0xFFD27A, leaf: 0x3E8A4A, leafL: 0x5AAE5A, stem: 0x4E7A38, soil: 0x4A3626, concrete: 0xB4B0A6, paper: 0xF4F0E8, dark: 0x2A2D33 };
  const B_BOT = 1 << 2;   // rbox: leave the bottom face out (it stands on the floor)
  const FM = PR.FURN = {};   // model key → { size: [W, H, D] in blocks, build(F) }
  const MD = (key, size, build) => { FM[key] = { size, build }; };
  const steelLeg = (F, x, z, y1, col) => F.m(MAT.metal, col || COL.black).cyl(x, z, 0, y1, 0.55, 0.8, { seg: 8, caps: 2 });
  // a throw pillow standing on its edge, leaning back against the cushions (tint slot 2: the piece's second colour)
  const pillow = (F, x, y, z, w, lean, twist) => { F.m(MAT.fabric, 0xFFFFFF, 2); F.turn([['x', lean], ['y', twist || 0]], [x, y, z]); F.rbox(x - w / 2, y, z - 1.1, x + w / 2, y + w, z + 1.1, 1.2, { mid: 3, bulge: { 4: 0.8, 5: 0.8 }, seam: 0.8 }); F.turn(null); };
  // a seat cushion and a back cushion, the piped seams darker (tint slot 1: the fabric)
  const seatCush = (F, x0, y0, z0, x1, y1, z1) => F.m(MAT.fabric, 0xFFFFFF, 1).rbox(x0, y0, z0, x1, y1, z1, 1.5, { mid: 3, bulge: { 3: 0.55, 4: 0.25 }, seam: 0.78 });
  const backCush = (F, x0, y0, z0, x1, y1, z1, lean) => { F.m(MAT.fabric, 0xFFFFFF, 1); F.turn([['x', lean || 0.12]], [(x0 + x1) / 2, y0, z1]); F.rbox(x0, y0, z0, x1, y1, z1, 1.8, { mid: 3, bulge: { 4: 0.6, 3: 0.25 }, seam: 0.78 }); F.turn(null); };

  // the three-seater: six slim steel legs, the upholstered base, arms and back frame, three seat and three back
  // cushions with piped seams, two throw pillows (the second colour) and a folded throw over one arm
  MD('sofa', [3, 1, 1], (F) => {
    for (const [x, z] of [[3, 3], [45, 3], [3, 13], [45, 13], [24, 3], [24, 13]]) steelLeg(F, x, z, 2.6);
    F.m(MAT.fabric, 0xEAEAEA, 1);
    F.rbox(0, 2.5, 0, 48, 7.3, 16, 1.3, { skip: B_BOT, seam: 0.88 });
    F.rbox(0, 6, 0, 3.7, 11.8, 16, 1.7, { bulge: { 3: 0.3 } }); F.rbox(44.3, 6, 0, 48, 11.8, 16, 1.7, { bulge: { 3: 0.3 } });
    F.rbox(0, 6.5, 11.8, 48, 14.4, 16, 1.7, { bulge: { 3: 0.2 } });
    for (let k = 0; k < 3; k++) { const x0 = 3.8 + k * 13.5, x1 = x0 + 13.3; seatCush(F, x0, 7, 0.8, x1, 10.7, 12.2); backCush(F, x0, 9.8, 9.4, x1, 15.6, 13.9); }
    pillow(F, 10.5, 10.6, 8.6, 5.4, 0.32, 0.12); pillow(F, 37.5, 10.6, 8.6, 5.4, 0.3, -0.15);
    F.m(MAT.fabric, 0xD8D8D8, 2).rbox(44.2, 11.6, 2, 48.2, 12.7, 15, 0.5, { seam: 0.9 });
    F.m(MAT.fabric, 0xE6E6E6, 1); F.far(0, 1, 0, 48, 7.2, 16); F.far(0, 7, 11.8, 48, 15.2, 16); F.far(0, 7, 0, 3.7, 11.8, 11.8); F.far(44.3, 7, 0, 48, 11.8, 11.8); F.far(3.7, 7, 0.8, 44.3, 10.6, 11.8);
    F.shadow(-1.5, -1.5, 49.5, 17.5);
  });
  // the chaise return (one block wide, two long): the outer arm along its long side, the back at the far end
  MD('chaise', [1, 1, 2], (F) => {
    for (const [x, z] of [[3, 3], [13, 3], [3, 29], [13, 29], [3, 16], [13, 16]]) steelLeg(F, x, z, 2.6);
    F.m(MAT.fabric, 0xEAEAEA, 1);
    F.rbox(0, 2.5, 0, 16, 7.3, 32, 1.3, { skip: B_BOT, seam: 0.88 });
    F.rbox(12.3, 6, 0, 16, 11.8, 32, 1.7, { bulge: { 3: 0.3 } });
    F.rbox(0, 6.5, 27.8, 16, 14.4, 32, 1.7, { bulge: { 3: 0.2 } });
    seatCush(F, 0.8, 7, 0.8, 12.3, 10.7, 28); backCush(F, 0.8, 9.8, 25.4, 12.3, 15.6, 30.2);
    pillow(F, 6.5, 10.6, 23.6, 5.2, 0.3, 0.1);
    F.m(MAT.fabric, 0xE6E6E6, 1); F.far(0, 1, 0, 16, 7.2, 32); F.far(12.3, 7, 0, 16, 11.8, 32); F.far(0, 7, 27.8, 12.3, 15.2, 32); F.far(0, 7, 0.8, 12.3, 10.6, 27.8);
    F.shadow(-1.5, -1.5, 17.5, 33.5);
  });
  // the lounge armchair: a brushed-steel star base, a round upholstered shell whose back wraps round and falls to low
  // arms at the front, a domed seat cushion and a back cushion
  MD('armchair', [1, 1, 1], (F) => {
    F.m(MAT.metal, COL.steel);
    F.cyl(8, 8, 0.4, 4.4, 1.1, 0.9, { seg: 12 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; F.rod(8, 0.7, 8, 8 + Math.cos(a) * 6.2, 0.45, 8 + Math.sin(a) * 6.2, 0.55, { seg: 6 }); }
    F.m(MAT.fabric, 0xE0E0E0, 1);
    F.lathe(8, 8, [[4, 0.01], [4.05, 6.0], [4.7, 6.75], [5.6, 6.6], [5.8, 5.2]], { seg: 22, capBot: true, capTop: true });   // the seat shell
    // the shell's back: a thick curved wall round the back, high behind, falling to the arms at the front sides
    const seg = 22, a0 = -2.45, a1 = 2.45, rI = 4.7, rO = 6.85, y0 = 5.2, rr = (rO - rI) / 2, rows = [];
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * i / seg, sa = Math.sin(a), ca = Math.cos(a), top = 10.4 + 4.8 * Math.pow(0.5 + 0.5 * ca, 1.4);
      const P = (r, y) => [8 + sa * r, y, 8 + ca * r], prof = [];
      prof.push([P(rO, y0), [sa, 0, ca]]); prof.push([P(rO, top - rr), [sa, 0, ca]]);
      for (let k = 1; k < 4; k++) { const t = Math.PI * k / 4, r = (rI + rO) / 2 + Math.cos(t) * rr; prof.push([P(r, top - rr + Math.sin(t) * rr), norm3([sa * Math.cos(t), Math.sin(t), ca * Math.cos(t)])]); }
      prof.push([P(rI, top - rr), [-sa, 0, -ca]]); prof.push([P(rI, y0 + 1.2), [-sa, 0, -ca]]);
      const base = F.count(); for (const [p, q] of prof) F.emit(p[0], p[1], p[2], q[0], q[1], q[2]); rows.push(base);
    }
    const np = 7;
    for (let i = 0; i < seg; i++) for (let j = 0; j < np - 1; j++) { const a = rows[i] + j, b = rows[i] + j + 1, c = rows[i + 1] + j + 1, d = rows[i + 1] + j; F.tri(a, c, b); F.tri(a, d, c); }
    for (const [ri, sgn] of [[0, -1], [seg, 1]]) {   // the ends of the wall (flat caps facing along the arc)
      const a = a0 + (a1 - a0) * ri / seg, tn = [Math.cos(a) * sgn, 0, -Math.sin(a) * sgn], base = F.count();
      for (let j = 0; j < np; j++) { const p = F.pos(rows[ri] + j); F.emit(p[0], p[1], p[2], tn[0], tn[1], tn[2]); }
      for (let j = 1; j < np - 1; j++) { if (sgn > 0) F.tri(base, base + j + 1, base + j); else F.tri(base, base + j, base + j + 1); }
    }
    F.m(MAT.fabric, 0xFFFFFF, 1).rbox(2.6, 5.6, 2.4, 13.4, 8.8, 13.2, 2.2, { mid: 3, bulge: { 3: 0.6 }, seam: 0.8 });
    F.m(MAT.fabric, 0xFFFFFF, 1).rbox(3.4, 8.4, 9.6, 12.6, 13.6, 12.4, 1.6, { mid: 3, bulge: { 4: 0.5 }, seam: 0.8 });
    F.m(MAT.fabric, 0xE0E0E0, 1); F.far(1.2, 3.6, 1.2, 14.8, 10.5, 14.8); F.far(1.6, 10.5, 9, 14.4, 15.2, 14.8);
    F.m(MAT.metal, COL.steel); F.far(6.8, 0, 6.8, 9.2, 3.6, 9.2);
    F.shadow(0.5, 0.5, 15.5, 15.5);
  });
  // place settings: a white plate with a rim, a glass, two pieces of cutlery
  const setting = (F, x, z, y) => { F.m(MAT.gloss, COL.white).lathe(x, z, [[y, 1.6], [y + 0.25, 2.4], [y + 0.55, 2.7], [y + 0.5, 2.0], [y + 0.32, 1.7], [y + 0.32, 0.01]], { seg: 16, capBot: true }); F.m(MAT.metal, COL.steel).box(x - 3.9, y, z - 2.4, x - 3.4, y + 0.25, z + 2.4).box(x + 3.4, y, z - 2.4, x + 3.9, y + 0.25, z + 2.4); F.m(MAT.glass, 0xDCEFF8).lathe(x + 4.2, z - 2.4, [[y, 0.9], [y + 1.5, 0.95], [y + 3, 1.05]], { seg: 10, capBot: true }); };
  // the dining tables: a three-block top (oak on round tapered legs; walnut on black steel A-frames), place settings
  MD('dtable_oak', [3, 1, 1], (F) => {
    F.m(MAT.wood, WOOD.oak).rbox(0, 11.1, 1, 48, 12.9, 15, 0.45, { seg: 2 });
    F.m(MAT.wood, shd(WOOD.oak, 0.92));
    for (const [x, z] of [[4.6, 4.2], [43.4, 4.2], [4.6, 11.8], [43.4, 11.8]]) F.cyl(x, z, 0, 11.1, 0.75, 1.25, { seg: 12 });
    F.rbox(4.6, 9.4, 3.4, 43.4, 11.1, 4.6, 0.25).rbox(4.6, 9.4, 11.4, 43.4, 11.1, 12.6, 0.25).rbox(3.6, 9.4, 4.2, 5.6, 11.1, 11.8, 0.25).rbox(42.4, 9.4, 4.2, 44.4, 11.1, 11.8, 0.25);
    setting(F, 12, 8, 12.9); setting(F, 36, 8, 12.9);
    F.m(MAT.gloss, 0xE8E2D4).lathe(24, 8, [[12.9, 1.4], [13.3, 2.6], [14.4, 3.6], [14.6, 3.7], [14.5, 3.3], [13.6, 2.4], [13.5, 0.01]], { seg: 18, capBot: true });
    F.m(MAT.gloss, 0x9AC24A).sphere(23, 14.6, 7.4, 1.15, 1.1, 1.15, { seg: 7 }).sphere(25.2, 14.6, 8.2, 1.1, 1.05, 1.1, { seg: 7 });
    F.m(MAT.gloss, 0xE8C43A).sphere(24.2, 14.7, 9.4, 1.0, 0.9, 1.0, { seg: 7 }); F.m(MAT.gloss, 0xC8442A).sphere(24, 15.8, 7.9, 1.05, 1.0, 1.05, { seg: 7 });
    F.m(MAT.wood, WOOD.oak); F.far(0, 11, 1, 48, 13, 15); F.m(MAT.wood, shd(WOOD.oak, 0.9)); for (const [x, z] of [[4.6, 4.2], [43.4, 4.2], [4.6, 11.8], [43.4, 11.8]]) F.far(x - 1, 0, z - 1, x + 1, 11, z + 1);
    F.shadow(-1, 0, 49, 16);
  });
  MD('dtable_walnut', [3, 1, 1], (F) => {
    F.m(MAT.wood, WOOD.walnut).rbox(0, 11.1, 1, 48, 12.9, 15, 0.45, { seg: 2 });
    F.m(MAT.metal, COL.black);
    for (const x of [4.5, 43.5]) for (const z of [3.6, 12.4]) { F.rod(x - 3, 0, z, x, 11.1, z, 0.6, { seg: 6 }); F.rod(x + 3, 0, z, x, 11.1, z, 0.6, { seg: 6 }); }
    for (const x of [4.5, 43.5]) F.rod(x, 10.6, 3.6, x, 10.6, 12.4, 0.5, { seg: 6 });
    F.rbox(4.5, 9.8, 7.4, 43.5, 10.6, 8.6, 0.2);
    setting(F, 10, 8, 12.9); setting(F, 38, 8, 12.9);
    F.m(MAT.gloss, 0xE8E2D4).lathe(24, 8, [[12.9, 1.4], [14, 2.2], [15.6, 1.4], [16.4, 1.7]], { seg: 14, capBot: true });
    F.m(MAT.leaf, COL.stem); for (let k = 0; k < 3; k++) { const a = k * 2.1, dx = Math.cos(a) * 2.4, dz = Math.sin(a) * 1.8; F.rod(24, 16, 8, 24 + dx, 19.6 + k, 8 + dz, 0.25, { seg: 5 }); F.m(MAT.leaf, k & 1 ? COL.leaf : COL.leafL).sphere(24 + dx, 19.9 + k, 8 + dz, 1.4, 0.9, 1.1, { seg: 4 }); F.m(MAT.leaf, COL.stem); }
    F.m(MAT.wood, WOOD.walnut); F.far(0, 11, 1, 48, 13, 15); F.m(MAT.metal, COL.black); F.far(1.5, 0, 3, 7.5, 11, 13); F.far(40.5, 0, 3, 46.5, 11, 13);
    F.shadow(-1, 0, 49, 16);
  });
  // the dining chairs: oak with a linen seat cushion and a spindle back; black steel with a leather shell
  MD('dchair_oak', [1, 1, 1], (F) => {
    F.m(MAT.wood, WOOD.oak);
    F.cyl(3.2, 3.2, 0, 8.2, 0.65, 0.9, { seg: 10 }); F.cyl(12.8, 3.2, 0, 8.2, 0.65, 0.9, { seg: 10 });
    F.cyl(3.2, 12.8, 0, 16, 0.75, 0.62, { seg: 10 }); F.cyl(12.8, 12.8, 0, 16, 0.75, 0.62, { seg: 10 });
    F.rod(3.2, 4, 3.2, 3.2, 4, 12.8, 0.38, { seg: 6 }); F.rod(12.8, 4, 3.2, 12.8, 4, 12.8, 0.38, { seg: 6 });
    F.rbox(2, 8, 2, 14, 9.1, 14, 0.6);
    for (const x of [5.5, 8, 10.5]) F.cyl(x, 12.9, 9, 15.2, 0.42, 0.42, { seg: 8 });
    F.rbox(2.6, 14.8, 12.1, 13.4, 16, 13.7, 0.5);
    F.m(MAT.fabric, 0xECE6D8).rbox(2.5, 9, 2.4, 13.5, 10.7, 12, 1.4, { mid: 3, bulge: { 3: 0.5 }, seam: 0.8 });
    F.m(MAT.wood, WOOD.oak); F.far(2, 0, 2, 14, 9, 14); F.far(2.4, 9, 12, 13.6, 16, 13.8);
    F.shadow(1, 1, 15, 15);
  });
  MD('dchair_black', [1, 1, 1], (F) => {
    for (const [x, z] of [[3, 3], [13, 3], [3, 13], [13, 13]]) steelLeg(F, x, z, 7.6);
    F.m(MAT.metal, COL.black).rod(3, 4, 3, 3, 4, 13, 0.38, { seg: 6 }).rod(13, 4, 3, 13, 4, 13, 0.38, { seg: 6 });
    F.rod(3, 9.4, 12.6, 3.5, 16, 13.6, 0.48, { seg: 6 }).rod(13, 9.4, 12.6, 12.5, 16, 13.6, 0.48, { seg: 6 });
    F.m(MAT.leather, 0x2A2C30).rbox(2, 7.5, 2, 14, 9.6, 14, 1.8, { mid: 3, bulge: { 3: 0.35 }, seam: 0.85 });
    F.turn([['x', 0.14]], [8, 11.5, 13.6]); F.rbox(2, 11.5, 12.4, 14, 16.2, 14.6, 1.5, { mid: 2, bulge: { 4: 0.3 }, seam: 0.85 }); F.turn(null);
    F.m(MAT.leather, 0x2A2C30); F.far(2, 0, 2, 14, 9.6, 14); F.far(2, 9.6, 12.4, 14, 16.2, 14.6);
    F.shadow(1, 1, 15, 15);
  });
  // the double bed: a slim platform frame on short legs (the second colour: the frame's wood), a tall channel-tufted
  // headboard, the mattress with piping, the duvet (the first colour) folded back at the foot, a throw, four pillows
  // and a bolster
  MD('bed', [2, 1, 2], (F) => {
    F.m(MAT.wood, 0xFFFFFF, 2).rbox(0, 2, 0, 32, 5.6, 32, 0.7, { skip: B_BOT });
    F.m(MAT.wood, 0xD0D0D0, 2); for (const [x, z] of [[2, 2], [30, 2], [2, 30], [30, 30]]) F.cyl(x, z, 0, 2.1, 0.9, 1.1, { seg: 8 });
    F.m(MAT.fabric, 0xC8C8C8, 1); for (let c = 0; c < 7; c++) F.rbox(c * 32 / 7 + 0.05, 5.5, 28, (c + 1) * 32 / 7 - 0.05, 19.4, 32, 1.9, { mid: 2, bulge: { 4: 0.35 }, seam: 0.86 });
    F.m(MAT.fabric, 0xF2F2EE).rbox(1, 5.5, 1, 31, 9.7, 28.4, 1.3, { skip: B_BOT, seam: 0.72 });
    F.m(MAT.fabric, 0xFFFFFF, 1).rbox(0.4, 8.9, 0, 31.6, 12.5, 21.2, 2.0, { mid: 4, bulge: { 3: 0.7, 4: 0.3 }, seam: 0.9 });
    F.m(MAT.fabric, 0xE4E4E4, 1).rbox(0.9, 11.2, 0.5, 31.1, 13.5, 7.2, 1.2, { mid: 3, bulge: { 3: 0.3 }, seam: 0.88 });
    F.m(MAT.fabric, 0x34446E).rbox(2, 13.3, 2.4, 30, 14.3, 6.6, 0.5, { seam: 0.9 });
    F.m(MAT.fabric, 0xFAFAF6); for (const x0 of [2.4, 16.4]) F.rbox(x0, 9.5, 21.6, x0 + 13.2, 13.9, 28, 2.2, { mid: 3, bulge: { 3: 0.6, 4: 0.5, 5: 0.5 }, seam: 0.86 });
    F.m(MAT.fabric, 0xD2A84A); for (const x0 of [4, 18]) { F.turn([['x', 0.3]], [x0 + 5, 12.5, 27]); F.rbox(x0, 12.4, 24.2, x0 + 10, 16.6, 27, 1.6, { mid: 3, bulge: { 4: 0.6, 5: 0.6 }, seam: 0.84 }); F.turn(null); }
    F.m(MAT.fabric, 0xF0F0F0, 1).tube([[10, 13.6, 23], [22, 13.6, 23]], 1.6, 1.6, { seg: 12, caps: 0 }).sphere(10, 13.6, 23, 1.6, 1.6, 1.6, { seg: 5 }).sphere(22, 13.6, 23, 1.6, 1.6, 1.6, { seg: 5 });
    F.m(MAT.fabric, 0xF0F0F0, 1); F.far(0, 2, 0, 32, 12.6, 28); F.m(MAT.fabric, 0xC0C0C0, 1); F.far(0, 5.5, 28, 32, 19.4, 32);
    F.shadow(-1.5, -1.5, 33.5, 33.5);
  });
  // a lamp's drum or dome: the outer face in its material, the inner face glowing (flip), the bulb
  const glowShade = (F, x, z, outer, inner, matOut, colOut) => { F.m(matOut, colOut).lathe(x, z, outer, { seg: 22 }); F.m(MAT.light, 0xFFE2B0).lathe(x, z, inner, { seg: 22, flip: true }); };
  // the tripod floor lamp: three walnut legs to a brass hub, a linen drum shade that glows from inside
  MD('tripod', [1, 2, 1], (F) => {
    F.m(MAT.wood, WOOD.walnut); for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.5; F.rod(8 + Math.cos(a) * 5.6, 0, 8 + Math.sin(a) * 5.6, 8, 18, 8, 0.6, { seg: 7, r1: 0.42 }); }
    F.m(MAT.metal, COL.brass).cyl(8, 8, 17, 20.2, 1.2, 1.1, { seg: 12 }).rod(8, 20.2, 8, 8, 23.5, 8, 0.3, { seg: 6 });
    glowShade(F, 8, 8, [[20, 6.7], [30, 6.1]], [[20.1, 6.35], [29.9, 5.8]], MAT.shade, 0xF2E0C0);
    F.m(MAT.metal, COL.brass).lathe(8, 8, [[19.8, 6.75], [20.3, 6.8]], { seg: 22 }).lathe(8, 8, [[29.7, 6.18], [30.2, 6.2]], { seg: 22 });
    F.m(MAT.light, 0xFFF2D0).sphere(8, 24, 8, 1.7, 1.9, 1.7, { seg: 6 });
    F.m(MAT.wood, WOOD.walnut); F.far(5, 0, 5, 11, 18, 11); F.m(MAT.shade, 0xF2E0C0); F.far(1.5, 20, 1.5, 14.5, 30, 14.5);
    F.shadow(1, 1, 15, 15);
  });
  // the arc floor lamp: a domed marble base, a brass arc (a quarter circle), a black dome shade glowing underneath
  MD('arclamp', [2, 2, 1], (F) => {
    F.m(MAT.marble, COL.marbleD).lathe(6, 8, [[0, 5.6], [1.4, 5.5], [2.1, 4.2], [2.5, 1.2], [2.6, 0.01]], { seg: 22 });
    const pts = []; for (let t = 0; t <= 14; t++) { const a = t / 14 * Math.PI / 2; pts.push([6 + 20 * (1 - Math.cos(a)), 2.4 + 26.8 * Math.sin(a), 8]); }
    F.m(MAT.metal, COL.brass).tube(pts, 0.65, 0.5, { seg: 8, caps: 0 }).rod(26, 29.2, 8, 26, 27.4, 8, 0.4, { seg: 6 });
    glowShade(F, 26, 8, [[21, 5.6], [22.6, 5.4], [25.4, 4.4], [27.0, 2.6], [27.8, 0.01]], [[21.1, 5.25], [22.6, 5.05], [25.2, 4.1], [26.7, 2.3], [27.4, 0.01]], MAT.gloss, 0x1C1E22);
    F.m(MAT.light, 0xFFF2D0).sphere(26, 23.6, 8, 1.5, 1.5, 1.5, { seg: 6 });
    F.m(MAT.marble, COL.marbleD); F.far(0.5, 0, 2.5, 11.5, 2.6, 13.5); F.m(MAT.metal, COL.brass); F.far(5.2, 2.5, 7.2, 8.8, 18, 8.8); F.far(8.8, 18, 7.2, 24, 28, 8.8);
    F.m(MAT.gloss, 0x1C1E22); F.far(20.6, 21, 2.6, 31.4, 27.8, 13.4);
    F.shadow(0, 2, 13, 14);
  });
  // the brass pendant: a ceiling rose, the cord, a brass dome glowing underneath, the bulb
  MD('pendant', [1, 1, 1], (F) => {
    F.m(MAT.metal, COL.black).cyl(8, 8, 15.2, 16, 1.7, 1.7, { seg: 12, caps: 1 }).rod(8, 7.2, 8, 8, 15.2, 8, 0.18, { seg: 5 });
    glowShade(F, 8, 8, [[2.2, 6.5], [3.6, 6.0], [5.4, 4.2], [6.8, 2.1], [7.4, 0.9], [7.6, 0.01]], [[2.3, 6.15], [3.6, 5.7], [5.3, 3.9], [6.6, 1.8], [7.2, 0.01]], MAT.metal, COL.brass);
    F.m(MAT.light, 0xFFF2D0).sphere(8, 3.7, 8, 1.4, 1.5, 1.4, { seg: 6 });
    F.m(MAT.metal, COL.brass); F.far(1.6, 2.2, 1.6, 14.4, 7.6, 14.4); F.m(MAT.metal, COL.black); F.far(7.6, 7.6, 7.6, 8.4, 16, 8.4);
  });
  // the kitchen units: a carcass on a dark recessed plinth (the first colour: lacquer, or oak), fronts with shadow gaps
  // and a dark grip rail, a marble worktop; the sink (a steel basin, a mixer tap), the hob (black glass, the rings, a
  // pan), the oven (a dark glass door, the warm inside, the knobs), the tall unit with its built-in oven, the wall cabinet
  // with its light underneath
  const front = (F, wood, y0, y1, grip) => { F.m(wood ? MAT.wood : MAT.gloss, 0xF6F6F6, 1).rbox(0.35, y0 + 0.3, 0.95, 15.65, y1 - 0.3, 2.05, 0.3, { seam: 0.92 }); if (grip) F.m(MAT.matte, COL.dark).box(0.35, y1 - 1.25, 0.8, 15.65, y1 - 0.35, 1.0); };
  const counter = (F) => { F.m(MAT.marble, COL.marble).rbox(0, 13, -0.5, 16, 15, 16, 0.3, { seg: 1 }); };
  const carcass = (F, wood, y1) => { F.m(MAT.matte, COL.dark).box(0.5, 0, 3.5, 15.5, 1.5, 16, B_BOT); F.m(wood ? MAT.wood : MAT.gloss, 0xE8E8E8, 1).rbox(0, 1.5, 2, 16, y1, 16, 0.25, { seg: 1 }); };
  const kitchen = (unit, wood) => (F) => {
    if (unit === 'upper') {
      F.m(wood ? MAT.wood : MAT.gloss, 0xE8E8E8, 1).rbox(0, 4, 8, 16, 16, 16, 0.25, { seg: 1 });
      F.m(wood ? MAT.wood : MAT.gloss, 0xF6F6F6, 1).rbox(0.35, 4.6, 7, 15.65, 15.7, 8.1, 0.3, { seam: 0.92 });
      F.m(MAT.matte, COL.dark).box(0.35, 4.3, 6.9, 15.65, 4.9, 7.6);
      F.m(MAT.light, COL.warm).box(0.8, 3.8, 9, 15.2, 4.05, 14.6);
      F.m(wood ? MAT.wood : MAT.gloss, 0xE8E8E8, 1); F.far(0, 4, 7, 16, 16, 16);
      return;
    }
    const tall = unit === 'tall';
    carcass(F, wood, tall ? 32 : 13);
    if (unit === 'cabinet') { front(F, wood, 1.5, 5.5, true); front(F, wood, 5.5, 9.5, true); front(F, wood, 9.5, 13, true); }
    else if (unit === 'sink') front(F, wood, 1.5, 13, true);
    else if (unit === 'hob') { front(F, wood, 1.5, 7, true); front(F, wood, 7, 13, true); }
    else if (unit === 'oven') {
      front(F, wood, 1.5, 3.6, false);
      F.m(MAT.gloss, 0x1C1E22).rbox(0.5, 3.6, 0.9, 15.5, 13, 2.1, 0.3);
      F.m(MAT.light, 0x4A3018).box(1.6, 4.6, 0.8, 14.4, 10.4, 0.9);
      F.m(MAT.metal, COL.steel).rod(2, 11.8, 0.4, 14, 11.8, 0.4, 0.42, { seg: 6 }).box(2, 11.5, 0.5, 2.6, 12.1, 0.95).box(13.4, 11.5, 0.5, 14, 12.1, 0.95);
      for (const x of [4, 7, 10]) F.m(MAT.metal, COL.steel).cyl(x, 0.7, 12.0, 12.8, 0.5, 0.5, { seg: 8 });
      F.m(MAT.light, 0x3AC8FF).box(11.5, 12.15, 0.8, 14, 12.65, 0.9);
    } else if (tall) {
      front(F, wood, 1.5, 12.5, true);
      F.m(MAT.gloss, 0x1C1E22).rbox(0.5, 12.5, 0.9, 15.5, 22.5, 2.1, 0.3);
      F.m(MAT.light, 0x4A3018).box(1.6, 13.5, 0.8, 14.4, 19.5, 0.9);
      F.m(MAT.metal, COL.steel).rod(2, 21.3, 0.4, 14, 21.3, 0.4, 0.42, { seg: 6 });
      F.m(MAT.light, 0x3AC8FF).box(11.5, 20.3, 0.8, 14, 20.8, 0.9);
      front(F, wood, 22.5, 32, false);
      F.m(MAT.metal, COL.black).rod(13.5, 25, 0.5, 13.5, 30, 0.5, 0.32, { seg: 6 });
    }
    if (!tall) counter(F);
    if (unit === 'sink') {
      F.m(MAT.metal, COL.steel).rbox(2.4, 15, 3.4, 13.6, 15.1, 12.6, 0.5, { seg: 1 });
      F.m(MAT.metal, 0x6A7078).box(3.1, 15.1, 4.1, 12.9, 15.12, 11.9);
      F.m(MAT.metal, COL.steel).cyl(8, 13.6, 15, 19.6, 0.9, 0.8, { seg: 10 }).tube([[8, 19.4, 13.6], [8, 20.4, 12], [8, 20, 9.4], [8, 18.6, 8.6]], 0.55, 0.45, { seg: 7 });
      F.rod(9.6, 15.6, 13.6, 10.9, 17, 13.6, 0.35, { seg: 6 });
      F.m(MAT.gloss, 0x2F7A6A).lathe(1.9, 12, [[15, 0.8], [17.2, 0.75], [17.8, 0.4]], { seg: 8, capTop: true });
    } else if (unit === 'hob') {
      F.m(MAT.gloss, 0x15161A).rbox(1.5, 15, 2.5, 14.5, 15.35, 13.5, 0.6, { seg: 1 });
      for (const [x, z, r] of [[4.8, 5.5, 2.2], [11.2, 5.5, 1.6], [4.8, 10.8, 1.6]]) F.m(MAT.gloss, 0x4A4D54).lathe(x, z, [[15.37, r], [15.37, r - 0.35]], { seg: 16 });
      F.m(MAT.metal, COL.steel).lathe(11.2, 10.8, [[15.35, 2.3], [15.6, 2.6], [17.6, 2.8], [17.7, 2.5], [15.7, 2.3], [15.7, 0.01]], { seg: 16, capBot: true });
      F.m(MAT.metal, COL.black).rod(13.8, 17.2, 10.8, 15.6, 17.5, 10.8, 0.42, { seg: 6 });
      F.m(MAT.light, 0xFF4A2A).box(5, 15.36, 12.5, 6, 15.42, 12.8);
    } else if (unit === 'cabinet') {
      F.m(MAT.wood, WOOD.oak).rbox(2, 15, 3, 8, 15.8, 9, 0.4);
      F.m(MAT.metal, COL.steel).lathe(12, 10, [[15, 1.4], [18, 1.25]], { seg: 10, capBot: true });
      F.m(MAT.wood, WOOD.ash).rod(12, 17.6, 10, 11.2, 21, 9.6, 0.25, { seg: 5 }).rod(12.4, 17.6, 10.2, 12.9, 20.6, 10.6, 0.22, { seg: 5 });
    }
    F.m(wood ? MAT.wood : MAT.gloss, 0xEEEEEE, 1); F.far(0, 1.5, 1, 16, tall ? 32 : 13, 16);
    if (!tall) { F.m(MAT.marble, COL.marble); F.far(0, 13, -0.5, 16, 15, 16); }
    F.shadow(0, -0.5, 16, 16.5);
  };
  for (const u of ['cabinet', 'sink', 'hob', 'oven', 'tall', 'upper']) { MD('kitchen:' + u, [1, u === 'tall' ? 2 : 1, 1], kitchen(u, false)); MD('kitchen:' + u + ':w', [1, u === 'tall' ? 2 : 1, 1], kitchen(u, true)); }
  // the kitchen island: a dark carcass, a marble top with a soft overhang, two drawer fronts with brass bars at the back,
  // a vase with a branch, a board with fruit, two glasses
  MD('island', [2, 1, 1], (F) => {
    F.m(MAT.matte, 0x111214).box(1.5, 0, 3.5, 30.5, 1.5, 12.5, B_BOT);
    F.m(MAT.matte, 0x25272B).rbox(1, 1.5, 3, 31, 13, 13, 0.3, { seg: 1 });
    F.m(MAT.marble, COL.marble).rbox(0, 13, 0, 32, 15, 16, 0.9, { seg: 2 });
    for (const x0 of [1.5, 16.5]) { F.m(MAT.gloss, 0x2E3136).rbox(x0 + 0.3, 2, 12.9, x0 + 13.7, 12.5, 14, 0.3); F.m(MAT.metal, COL.brass).rod(x0 + 3, 10.5, 14.2, x0 + 11, 10.5, 14.2, 0.32, { seg: 6 }).rod(x0 + 3, 5, 14.2, x0 + 11, 5, 14.2, 0.32, { seg: 6 }); }
    F.m(MAT.gloss, 0x2F7A6A).lathe(26, 8, [[15, 1.6], [15.7, 2.4], [16.8, 2.3], [17.8, 1.5], [18.4, 1.8]], { seg: 14, capBot: true });
    F.m(MAT.leaf, COL.stem).rod(26, 17.9, 8, 25.4, 20.6, 8.4, 0.28, { seg: 5 }); F.m(MAT.leaf, COL.leafL).sphere(25.4, 21.1, 8.4, 1.9, 1.0, 1.5, { seg: 5, lump: 0.3, seed: 3 });
    F.m(MAT.wood, WOOD.oak).rbox(5, 15, 5, 13, 15.8, 11, 0.4);
    F.m(MAT.gloss, 0xC8442A).sphere(7, 16.6, 7, 0.95, 0.95, 0.95, { seg: 5 }).sphere(9.4, 16.6, 8.6, 0.95, 0.95, 0.95, { seg: 5 }); F.m(MAT.gloss, 0xE8B83A).sphere(11, 16.5, 6.6, 1.0, 0.7, 0.8, { seg: 5 });
    F.m(MAT.glass, 0xDCEFF8).lathe(18, 4, [[15, 0.9], [18, 0.95], [19.6, 0.6]], { seg: 10, capBot: true }).lathe(20.5, 4, [[15, 0.9], [18, 0.95], [19.6, 0.6]], { seg: 10, capBot: true });
    F.m(MAT.matte, 0x25272B); F.far(1, 0, 3, 31, 13, 13); F.m(MAT.marble, COL.marble); F.far(0, 13, 0, 32, 15, 16);
    F.shadow(-0.5, -0.5, 32.5, 16.5);
  });
  // the oak bookcase: two sides, a back, five shelves; rows of books in many colours, one leaning, a storage box and a
  // small pot with a plant on the top shelf
  MD('bookshelf', [1, 2, 1], (F) => {
    F.m(MAT.wood, WOOD.oak).rbox(0, 0, 11.4, 1, 32, 16, 0.25, { seg: 1 }).rbox(15, 0, 11.4, 16, 32, 16, 0.25, { seg: 1 });
    F.m(MAT.wood, shd(WOOD.oak, 0.82)).box(1, 0, 15.3, 15, 32, 15.9);
    F.m(MAT.wood, WOOD.oak); for (const y of [0, 8, 16, 24, 31.2]) F.rbox(1, y, 11.4, 15, y + 0.8, 16, 0.2, { seg: 1 });
    const cols = [0x2F55C8, 0xC0443A, 0xE8B83A, 0x3E8A4A, 0xF2F2EE, 0x7A4A32, 0x2A2D33, 0x8A5AC8, 0x2F7A6A, 0xD2A84A];
    for (let row = 0; row < 4; row++) {
      const y = row * 8 + 0.8; let x = 1.3, k = row * 7;
      const stop = row === 3 ? 8.6 : row === 1 ? 10 : 14.6;
      while (x < stop) {
        const w = 0.8 + (k % 3) * 0.42, h = 4.6 + ((k * 5) % 4) * 0.62, c = cols[(k * 3 + row) % cols.length];
        if (x + w > stop) break;
        F.m(MAT.matte, c).rbox(x, y, 12.4, x + w - 0.05, y + h, 15.3, 0.12, { seg: 1 });
        F.m(MAT.matte, COL.paper).box(x + 0.15, y + 0.25, 12.35, x + w - 0.2, y + h - 0.25, 12.4);
        x += w; k++; if (k % 5 === 0) x += 0.35;
      }
      if (row === 1) { F.m(MAT.matte, COL.paper); F.turn([['z', 0.25]], [11.4, y, 13.8]); F.m(MAT.matte, 0xC0443A).rbox(10.4, y, 12.4, 11.4, y + 5.6, 15.3, 0.12, { seg: 1 }); F.turn(null); F.m(MAT.matte, 0x8A8E96).rbox(11.6, y, 12.4, 14.7, y + 2.8, 15.3, 0.4, { seg: 1 }); }
      if (row === 3) { F.m(MAT.gloss, 0xE8E2D4).lathe(11.6, 13.6, [[y, 1.6], [y + 2.6, 2.1], [y + 2.8, 1.9]], { seg: 12, capBot: true }); F.m(MAT.leaf, COL.leafL).sphere(11.6, y + 4, 13.6, 2.3, 1.5, 1.9, { seg: 5, lump: 0.35, seed: 9 }); }
    }
    F.m(MAT.wood, WOOD.oak); F.far(0, 0, 11.4, 16, 32, 16); F.m(MAT.matte, 0x6A5A4A); F.far(1, 0.8, 11.3, 15, 30.8, 11.5);
    F.shadow(-0.5, 10.5, 16.5, 16.5);
  });
  // the boxwood planter: a soft concrete box, the soil, a clipped round ball of leaves
  MD('planter', [1, 1, 1], (F) => {
    F.m(MAT.matte, 0x6E7076).rbox(2, 0, 2, 14, 7, 14, 1.4, { skip: B_BOT });
    F.m(MAT.matte, COL.soil).box(3, 6.6, 3, 13, 7.05, 13);
    F.m(MAT.leaf, 0x3E7A3A).sphere(8, 10.8, 8, 4.8, 4.6, 4.8, { seg: 12, lump: 0.12, seed: 11 });
    F.m(MAT.matte, 0x6E7076); F.far(2, 0, 2, 14, 7, 14); F.m(MAT.leaf, 0x3E7A3A); F.far(3.4, 6.2, 3.4, 12.6, 15.4, 12.6);
    F.shadow(1, 1, 15, 15);
  });
  // the monstera: a white pot, the soil, seven stems and seven big split leaves (the atlas's cutout leaf)
  MD('monstera', [1, 2, 1], (F) => {
    F.m(MAT.gloss, 0xE8E6E0).lathe(8, 8, [[0, 4.1], [0.6, 4.6], [7.4, 5.6], [8.2, 5.4], [8.2, 4.9], [7.5, 4.8]], { seg: 18, capBot: true });
    F.m(MAT.matte, COL.soil).lathe(8, 8, [[7.4, 4.85], [7.4, 0.01]], { seg: 18 });
    // the petioles rise from the soil and arch out; each blade hangs from its petiole's tip, its midrib pointing out and
    // down, its face up and out (as a monstera holds its leaves)
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4 + 0.4, r = 1.8 + (k % 3) * 0.8, y = 15 + (k % 5) * 2.6 + (k > 4 ? 1.2 : 0), ca = Math.cos(a), sa = Math.sin(a), bx = 8 + ca * r, bz = 8 + sa * r;
      F.m(MAT.leaf, COL.stem).tube([[8 + ca * 0.5, 7.4, 8 + sa * 0.5], [8 + ca * r * 0.35, 7.4 + (y - 7.4) * 0.6, 8 + sa * r * 0.35], [bx, y, bz]], 0.38, 0.26, { seg: 5, caps: 0 });
      const el = -0.3 - 0.08 * (k % 4), dir = norm3([ca * Math.cos(el), Math.sin(el), sa * Math.cos(el)]), side = norm3([-sa, 0, ca]), big = 1 - 0.06 * (k % 4);
      F.m(MAT.leaf, k & 1 ? COL.leaf : 0x4C9A48).leaf([bx, y, bz], dir, side, 7.6 * big, 7.2 * big, 1.2, PR.ATL.monstera);
    }
    F.m(MAT.gloss, 0xE8E6E0); F.far(2.6, 0, 2.6, 13.4, 8.2, 13.4); F.m(MAT.leaf, COL.leaf); F.far(1.5, 10, 1.5, 14.5, 25.5, 14.5);
    F.shadow(1.5, 1.5, 14.5, 14.5);
  });
  // the olive tree: a concrete pot, a twisting trunk with three branches, a canopy of olive sprays (the atlas's twigs)
  MD('olive', [1, 2, 1], (F) => {
    F.m(MAT.matte, COL.concrete).lathe(8, 8, [[0, 5], [3, 5.6], [8, 6], [9, 5.7], [9, 5.3], [8.4, 5.2]], { seg: 18, capBot: true });
    F.m(MAT.matte, COL.soil).lathe(8, 8, [[8.2, 5.25], [8.2, 0.01]], { seg: 18 });
    F.m(MAT.wood, 0x6A5A48).tube([[8, 8, 8], [7.5, 13, 8.3], [8.4, 17, 7.8], [8, 19.5, 8]], 1.5, 0.9, { seg: 8, caps: 2 });
    const tips = [[5, 25.5, 6.5], [11, 26, 9.6], [7.2, 27.5, 11], [10, 25, 5.2]];
    for (const t of tips) F.tube([[8, 19, 8], [(8 + t[0]) / 2, (19 + t[1]) / 2 + 0.6, (8 + t[2]) / 2], t], 0.7, 0.35, { seg: 6, caps: 2 });
    for (let k = 0; k < 10; k++) { const t = tips[k % 4], a = k * 2.1; F.m(MAT.leaf, k & 1 ? 0x7E9670 : 0x8FA680).sphere(t[0] + Math.cos(a) * 1.6, t[1] + 0.6 + (k % 3) * 0.9, t[2] + Math.sin(a) * 1.6, 2.4, 1.6, 2.2, { seg: 6, lump: 0.35, seed: 40 + k }); }
    for (let k = 0; k < 30; k++) {
      const t = tips[k % 4], a = k * 2.39, el = 0.15 + 0.6 * hash(k, 0, 0, 33), dir = norm3([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)]);
      const side = norm3(cross(dir, [0, 1, 0])), b = [t[0] + Math.cos(a) * 1.4, t[1] + (k % 3) * 0.8, t[2] + Math.sin(a) * 1.4];
      F.m(MAT.leaf, 0xFFFFFF).leaf(b, dir, side, 4.6, 4.2, 0.9, PR.ATL.olive);
    }
    F.m(MAT.matte, COL.concrete); F.far(2, 0, 2, 14, 9, 14); F.m(MAT.leaf, 0x8A9A78); F.far(0.5, 19, 0.5, 15.5, 31, 15.5);
    F.shadow(1, 1, 15, 15);
  });
  // the walnut TV lowboard: the body, three drawer fronts with finger grooves, a black base rail on two feet, a vase with
  // a branch, a sound bar with its light, a stack of books
  MD('lowboard', [3, 1, 1], (F) => {
    F.m(MAT.metal, COL.black).cyl(3, 9, 0, 2, 0.9, 0.7, { seg: 8 }).cyl(45, 9, 0, 2, 0.9, 0.7, { seg: 8 }).box(2.5, 1.5, 5, 45.5, 2, 13);
    F.m(MAT.wood, WOOD.walnut).rbox(0, 2, 2.5, 48, 9, 16, 0.4, { seg: 1 });
    for (let k = 0; k < 3; k++) { F.m(MAT.wood, shd(WOOD.walnut, 0.92)).rbox(k * 16 + 0.35, 2.35, 1.9, k * 16 + 15.65, 8.65, 2.6, 0.25, { seg: 1 }); F.m(MAT.matte, 0x2A2420).box(k * 16 + 2, 7.4, 1.8, k * 16 + 14, 8.1, 1.95); }
    F.m(MAT.gloss, 0xE8E2D4).lathe(6, 9, [[9, 1.8], [10.2, 2.7], [12.2, 2.4], [13.6, 1.5], [14, 1.7]], { seg: 14, capBot: true });
    F.m(MAT.leaf, COL.stem).rod(6, 13.5, 9, 7, 17.4, 9, 0.28, { seg: 5 }); F.m(MAT.leaf, COL.leaf).sphere(7, 17.8, 9, 1.7, 1.0, 1.3, { seg: 5, lump: 0.3, seed: 4 });
    F.m(MAT.gloss, 0x2A2D33).rbox(33, 9, 6, 45, 10.6, 10, 0.6); F.m(MAT.light, 0x3AC8FF).box(36, 10.2, 5.95, 42, 10.5, 6.05);
    F.m(MAT.matte, 0x2F55C8).rbox(16, 9, 6, 24, 10, 12, 0.15, { seg: 1 }); F.m(MAT.matte, 0xE8B83A).rbox(16.6, 10, 6.4, 23.2, 10.8, 11.4, 0.15, { seg: 1 });
    F.m(MAT.wood, WOOD.walnut); F.far(0, 1.5, 1.9, 48, 9, 16);
    F.shadow(-1, 1, 49, 17);
  });
  // the wall TV: a slim black bezel, the screen glowing with its picture (the atlas)
  MD('tv', [2, 1, 1], (F) => {
    F.m(MAT.gloss, 0x111214).rbox(1, 1.4, 14.4, 31, 15.2, 16, 0.35, { seg: 1 });
    F.m(MAT.light, 0xFFFFFF).quad([30.4, 2, 14.38], [1.6, 2, 14.38], [1.6, 14.6, 14.38], [30.4, 14.6, 14.38], PR.ATL.tv);
    F.m(MAT.gloss, 0x111214); F.far(1, 1.4, 14.4, 31, 15.2, 16); F.m(MAT.light, 0x6A9ACF); F.far(1.6, 2, 14.3, 30.4, 14.6, 14.4);
  });
  // the coffee tables: glass on black steel with a smoked-oak shelf; marble on two walnut slabs with a brass tray
  MD('ctable_glass', [2, 1, 1], (F) => {
    F.m(MAT.metal, COL.black); for (const [x, z] of [[3.5, 3.5], [28.5, 3.5], [3.5, 12.5], [28.5, 12.5]]) F.rbox(x - 0.9, 0, z - 0.9, x + 0.9, 7.5, z + 0.9, 0.3, { seg: 1 });
    F.m(MAT.wood, WOOD.smoked).rbox(2.4, 2, 2.4, 29.6, 3, 13.6, 0.3, { seg: 1 });
    F.m(MAT.matte, COL.paper).box(4, 3, 4, 12, 3.5, 11);
    F.m(MAT.gloss, COL.brass).lathe(12.5, 8, [[8.5, 1.4], [9.2, 3.4], [11.2, 3.6], [11.2, 3.2], [9.6, 2.8], [9.6, 0.01]], { seg: 16, capBot: true });
    F.m(MAT.matte, 0x2F55C8).rbox(19, 8.5, 5.5, 26, 9.6, 11.5, 0.15, { seg: 1 }); F.m(MAT.matte, 0xC0443A).rbox(19.4, 9.6, 5.9, 25.4, 10.5, 11, 0.15, { seg: 1 });
    F.m(MAT.glass, 0xD6ECF4).rbox(0.5, 7.5, 0.5, 31.5, 8.5, 15.5, 1.5, { seg: 2 });
    F.m(MAT.metal, COL.black); F.far(1.5, 0, 1.5, 30.5, 7.5, 14.5);
    F.shadow(-0.5, -0.5, 32.5, 16.5);
  });
  MD('ctable_marble', [2, 1, 1], (F) => {
    F.m(MAT.marble, COL.marble).rbox(0.5, 6, 0.5, 31.5, 7.6, 15.5, 1.2, { seg: 2 });
    F.m(MAT.wood, WOOD.walnut).rbox(3, 0, 3, 5.5, 6, 13, 0.3, { seg: 1 }).rbox(26.5, 0, 3, 29, 6, 13, 0.3, { seg: 1 }).rbox(5.5, 1, 7, 26.5, 2.5, 9, 0.2, { seg: 1 });
    F.m(MAT.metal, COL.brass).rbox(11, 7.5, 5, 21, 8.5, 11, 0.8, { seg: 2 }); F.m(MAT.matte, 0xE8E2D4).box(11.6, 8.5, 5.6, 20.4, 8.6, 10.4);
    F.m(MAT.gloss, COL.paper).lathe(14, 8, [[8.6, 1.4], [11.4, 1.4]], { seg: 12, capTop: true }); F.m(MAT.light, 0xFFE2A0).sphere(14, 12, 8, 0.4, 0.7, 0.4, { seg: 4 });
    F.m(MAT.matte, 0x2F7A6A).rbox(22, 7.6, 5, 28, 8.6, 13, 0.15, { seg: 1 }); F.m(MAT.matte, 0xE8B83A).rbox(22.4, 8.6, 5.4, 27.6, 9.4, 12.4, 0.15, { seg: 1 });
    F.m(MAT.marble, COL.marble); F.far(0.5, 6, 0.5, 31.5, 7.6, 15.5); F.m(MAT.wood, WOOD.walnut); F.far(3, 0, 3, 29, 6, 13);
    F.shadow(-0.5, -0.5, 32.5, 16.5);
  });
  // the nightstand: walnut, two drawers with brass bars, four short feet, a table lamp with a glowing drum shade, books
  MD('nightstand', [1, 1, 1], (F) => {
    F.m(MAT.metal, COL.black); for (const [x, z] of [[2.5, 4], [13.5, 4], [2.5, 13.5], [13.5, 13.5]]) F.cyl(x, z, 0, 2.1, 0.75, 0.6, { seg: 8 });
    F.m(MAT.wood, WOOD.walnut).rbox(1, 2, 2.5, 15, 9, 15, 0.4, { seg: 1 });
    for (const [y0, y1] of [[2, 5.5], [5.5, 9]]) { F.m(MAT.wood, WOOD.smoked).rbox(1.35, y0 + 0.3, 1.9, 14.65, y1 - 0.3, 2.6, 0.25, { seg: 1 }); F.m(MAT.metal, COL.brass).rod(5, (y0 + y1) / 2, 1.5, 11, (y0 + y1) / 2, 1.5, 0.3, { seg: 6 }); }
    F.m(MAT.metal, COL.brass).lathe(8, 9, [[9, 2.6], [9.6, 2.2], [10, 0.8]], { seg: 14, capBot: true }).cyl(8, 9, 10, 12.2, 0.5, 0.45, { seg: 8 });
    glowShade(F, 8, 9, [[12, 4.2], [16, 3.9]], [[12.1, 3.9], [15.9, 3.6]], MAT.shade, 0xF2E0C0);
    F.m(MAT.light, 0xFFF2D0).sphere(8, 13.6, 9, 1.2, 1.3, 1.2, { seg: 5 });
    F.m(MAT.matte, 0x8A5AC8).rbox(2, 9, 11, 6, 9.9, 14, 0.15, { seg: 1 }); F.m(MAT.matte, 0x3E8A4A).rbox(2.3, 9.9, 11.3, 5.6, 10.7, 13.6, 0.15, { seg: 1 });
    F.m(MAT.wood, WOOD.walnut); F.far(1, 0, 2.5, 15, 9, 15); F.m(MAT.shade, 0xF2E0C0); F.far(3.8, 12, 4.8, 12.2, 16, 13.2);
    F.shadow(0.5, 1.5, 15.5, 15.5);
  });

  // ---------------------------------------------------------------- the villages' pieces (voxarch / voxtech / voxhome)
  // the cosy bed (two cells: the head north of the foot when it faces north; the foot is its anchor): a wooden frame on
  // short legs, a headboard with a rail, a low footboard, the mattress, the blanket (the piece's colour) over the foot
  // and turned down at the pillow, a soft pillow
  MD('vbed', [1, 1, 2], (F) => {
    F.m(MAT.wood, 0xFFFFFF, 2);
    F.rbox(0.4, 2.6, 0.4, 15.6, 6, 31.6, 0.6, { skip: B_BOT });
    for (const [x, z] of [[1.6, 1.6], [14.4, 1.6], [1.6, 30.4], [14.4, 30.4]]) F.cyl(x, z, 0, 2.7, 0.9, 1.05, { seg: 8 });
    F.rbox(0, 2.6, 0, 16, 14.6, 1.8, 0.7).rbox(-0.2, 14.2, -0.2, 16.2, 15.4, 2.0, 0.55);
    F.m(MAT.wood, 0xE0E0E0, 2).rbox(0, 2.6, 30.2, 16, 9.2, 32, 0.6);
    F.m(MAT.fabric, 0xF4F2EC).rbox(0.9, 5.8, 1.8, 15.1, 9.2, 30.2, 1.2, { skip: B_BOT, seam: 0.74 });
    F.m(MAT.fabric, 0xFFFFFF, 1).rbox(0.5, 8.6, 10.4, 15.5, 10.6, 30.6, 1.3, { mid: 3, bulge: { 3: 0.45 }, seam: 0.88 });
    F.m(MAT.fabric, 0xE4E4E4, 1).rbox(0.7, 9.4, 8.6, 15.3, 11.6, 12.6, 1.1, { mid: 2, bulge: { 3: 0.3 }, seam: 0.86 });
    F.m(MAT.fabric, 0xFAF8F2).rbox(2.4, 9, 2.4, 13.6, 12.2, 7.6, 1.8, { mid: 3, bulge: { 3: 0.5, 4: 0.4, 5: 0.4 }, seam: 0.86 });
    F.m(MAT.wood, 0xFFFFFF, 2); F.far(0, 0, 0, 16, 15, 2); F.far(0, 2.6, 2, 16, 9.2, 32); F.m(MAT.fabric, 0xFFFFFF, 1); F.far(0.5, 9.2, 10.4, 15.5, 10.6, 30.6);
    F.shadow(-1, -1, 17, 33);
  });
  // the wooden table: a top with soft edges on four tapered legs and an apron, a small vase with a flower
  MD('vtable', [1, 1, 1], (F) => {
    F.m(MAT.wood, 0xA87A48).rbox(0.4, 12, 0.4, 15.6, 13.8, 15.6, 0.5, { seg: 2 });
    F.m(MAT.wood, 0x8E6638);
    for (const [x, z] of [[2.4, 2.4], [13.6, 2.4], [2.4, 13.6], [13.6, 13.6]]) F.cyl(x, z, 0, 12, 0.7, 1.0, { seg: 10 });
    F.rbox(2.4, 10.4, 1.9, 13.6, 12, 2.9, 0.2).rbox(2.4, 10.4, 13.1, 13.6, 12, 14.1, 0.2).rbox(1.9, 10.4, 2.4, 2.9, 12, 13.6, 0.2).rbox(13.1, 10.4, 2.4, 14.1, 12, 13.6, 0.2);
    F.m(MAT.gloss, 0xF0EDE4).lathe(10.6, 6, [[13.8, 0.8], [14.4, 1.4], [16.0, 1.2], [17.2, 0.6], [17.6, 0.75]], { seg: 12, capBot: true });
    F.m(MAT.leaf, COL.stem).rod(10.6, 17.2, 6, 10.9, 19.8, 6.2, 0.18, { seg: 4 }); F.m(MAT.gloss, 0xE86A4A).sphere(10.9, 20.2, 6.2, 0.75, 0.6, 0.75, { seg: 5 });
    F.m(MAT.gloss, 0xF0EDE4).lathe(5.6, 9.6, [[13.8, 1.6], [14.1, 2.6], [14.3, 2.7], [14.25, 0.01]], { seg: 14, capBot: true });
    F.m(MAT.wood, 0xA87A48); F.far(0.4, 12, 0.4, 15.6, 13.8, 15.6); F.m(MAT.wood, 0x8E6638); F.far(1.8, 0, 1.8, 3, 12, 3); F.far(13, 0, 1.8, 14.2, 12, 3); F.far(1.8, 0, 13, 3, 12, 14.2); F.far(13, 0, 13, 14.2, 12, 14.2);
    F.shadow(-0.5, -0.5, 16.5, 16.5);
  });
  // the wooden chair: tapered legs, a seat with a red cushion, a back of two posts, three slats and a top rail
  MD('vchair', [1, 1, 1], (F) => {
    F.m(MAT.wood, 0x9A6A3A);
    for (const [x, z] of [[3, 3], [13, 3]]) F.cyl(x, z, 0, 6.6, 0.65, 0.85, { seg: 8 });
    for (const [x, z] of [[3, 13.2], [13, 13.2]]) F.cyl(x, z, 0, 15.6, 0.85, 0.65, { seg: 8 });
    F.rod(3, 3, 3, 3, 3, 13.2, 0.35, { seg: 6 }).rod(13, 3, 3, 13, 3, 13.2, 0.35, { seg: 6 });
    F.rbox(2, 6.4, 2, 14, 7.6, 14, 0.5);
    for (const x of [5.6, 8, 10.4]) F.cyl(x, 13.2, 7.6, 13.8, 0.4, 0.4, { seg: 6 });
    F.rbox(2.4, 13.6, 12.4, 13.6, 15.6, 14, 0.5);
    F.m(MAT.fabric, 0xC0443A).rbox(2.8, 7.6, 2.8, 13.2, 9.2, 12.2, 1.3, { mid: 3, bulge: { 3: 0.45 }, seam: 0.8 });
    F.m(MAT.wood, 0x9A6A3A); F.far(2, 0, 2, 14, 7.6, 14); F.far(2.4, 7.6, 12.4, 13.6, 15.6, 14);
    F.shadow(1, 1, 15, 15);
  });
  // the modular sofa, one seat wide: a base and a back frame that run on into the next seat of a row, a seat cushion and a
  // back cushion, an arm on each end of the row that is open (variant bits: 1 a neighbour on +x, 2 on −x), a pillow
  for (let j = 0; j < 4; j++) MD('vsofa:' + j, [1, 1, 1], (F) => {
    const R = j & 1, L = j & 2, x0 = L ? 0 : 3.4, x1 = R ? 16 : 12.6;
    F.m(MAT.metal, COL.black); for (const [x, z] of [[2.2, 3], [13.8, 3], [2.2, 14.4], [13.8, 14.4]]) F.cyl(x, z, 0, 1.6, 0.6, 0.75, { seg: 6 });
    F.m(MAT.fabric, 0xE2E2E2, 1);
    F.rbox(L ? -0.05 : 0, 1.5, 1.6, R ? 16.05 : 16, 6.6, 16, L || R ? 0.6 : 1.2, { skip: B_BOT, seam: 0.88 });
    F.rbox(L ? -0.05 : 0, 6, 12.6, R ? 16.05 : 16, 14.2, 16, 1.4, { bulge: { 3: 0.2 } });
    if (!L) F.rbox(0, 6, 1.6, 3.6, 11.6, 16, 1.5, { bulge: { 3: 0.3 } });
    if (!R) F.rbox(12.4, 6, 1.6, 16, 11.6, 16, 1.5, { bulge: { 3: 0.3 } });
    F.m(MAT.fabric, 0xFFFFFF, 1).rbox(x0 + 0.2, 6.4, 2, x1 - 0.2, 9.6, 12.8, 1.4, { mid: 3, bulge: { 3: 0.5, 4: 0.25 }, seam: 0.8 });
    F.turn([['x', 0.12]], [(x0 + x1) / 2, 9.2, 15.6]); F.rbox(x0 + 0.2, 9.2, 10.6, x1 - 0.2, 15.2, 14.8, 1.7, { mid: 3, bulge: { 4: 0.55 }, seam: 0.8 }); F.turn(null);
    if (!(L && R)) pillow(F, L ? 11.2 : 4.8, 9.6, 9.6, 4.6, 0.3, L ? -0.2 : 0.2);
    F.m(MAT.fabric, 0xE2E2E2, 1); F.far(0, 1.5, 1.6, 16, 6.6, 16); F.far(0, 6, 12.6, 16, 14.6, 16); F.far(x0, 6.4, 2, x1, 9.6, 12.6);
    if (!L) F.far(0, 6, 1.6, 3.6, 11.6, 12.6); if (!R) F.far(12.4, 6, 1.6, 16, 11.6, 12.6);
    F.shadow(L ? 0 : -1, 0.6, R ? 16 : 17, 17);
  });

  // ---------------------------------------------------------------- the pieces: block type → model and its two colours
  // (the voxel pieces' palette: the fabric, the pillows of a sofa; the duvet and the frame of a bed; a kitchen's front)
  const FAB = { charcoal: 0x3A3D44, cream: 0xECE6D8, taupe: 0xA89482, sage: 0x8FA38E, navy: 0x2F3F60 };
  const PILLOWS = [0xD2A84A, 0x8FA38E, 0x2F3F60, 0xC9A3A0, 0x7E8560];
  const FDEF = PR.FDEF = {};
  Object.keys(FAB).forEach((k, i) => {
    FDEF['vm_sofa_' + k] = { model: 'sofa', a: FAB[k], b: PILLOWS[i % 5] };
    FDEF['vm_chaise_' + k] = { model: 'chaise', a: FAB[k], b: PILLOWS[(i + 2) % 5] };
    FDEF['vm_armchair_' + k] = { model: 'armchair', a: FAB[k], b: FAB[k] };
  });
  Object.assign(FDEF, {
    vm_dining_table_oak: { model: 'dtable_oak' }, vm_dining_table: { model: 'dtable_walnut' }, vm_dining_chair_oak: { model: 'dchair_oak' }, vm_dining_chair: { model: 'dchair_black' },
    vm_bed_grey: { model: 'bed', a: 0x8A8E96, b: WOOD.walnut }, vm_bed_navy: { model: 'bed', a: 0x2F3F60, b: WOOD.oak }, vm_bed_sage: { model: 'bed', a: 0x8FA38E, b: WOOD.oak }, vm_bed_white: { model: 'bed', a: 0xE6E2DA, b: WOOD.walnut }, vm_bed_rose: { model: 'bed', a: 0xC9A3A0, b: WOOD.ash },
    vm_floor_lamp: { model: 'tripod' }, vm_arc_lamp: { model: 'arclamp' }, vm_pendant: { model: 'pendant' }, vm_island: { model: 'island' },
    vm_bookshelf: { model: 'bookshelf' }, vm_planter: { model: 'planter' }, vm_monstera: { model: 'monstera' }, vm_olive: { model: 'olive' },
    vm_lowboard: { model: 'lowboard' }, vm_tv: { model: 'tv' }, vm_coffee_table_glass: { model: 'ctable_glass' }, vm_coffee_table: { model: 'ctable_marble' }, vm_nightstand: { model: 'nightstand' },
  });
  for (const [c, hex, wood] of [['white', 0xF2F2EE, false], ['black', 0x25272B, false], ['oak', 0xC8A878, true]]) for (const u of ['cabinet', 'sink', 'hob', 'oven', 'tall', 'upper']) FDEF['vm_kitchen_' + c + '_' + u] = { model: 'kitchen:' + u + (wood ? ':w' : ''), a: hex };
  // the villages' pieces: the beds' blankets on an oak frame (the foot, part 0, is the anchor: the model's cell 0, 1), the
  // sofas' fabric and pillows (a sofa's variant comes with its row: furnKey)
  const BEDC = { red: 0xC0443A, blue: 0x3F6AC0, green: 0x4E9A56, yellow: 0xE8B83A, purple: 0x8A5AC8, pink: 0xF08FB0, white: 0xECEAE4, teal: 0x2F9C98 };
  for (const k in BEDC) FDEF['vx_bed_' + k] = { model: 'vbed', a: BEDC[k], b: 0x8A5E32, cell: [0, 1] };
  FDEF.vx_table = { model: 'vtable' }; FDEF.vx_chair = { model: 'vchair' };
  for (const [k, col, pil] of [['white', 0xECEEF2, 0xFF7A1A], ['charcoal', 0x3A3D44, 0xE8D8B8], ['cream', 0xEDE6D6, 0x3A3D44], ['taupe', 0xA89482, 0xF2F2EE], ['blue', 0x3A5AB8, 0x3AD8FF], ['orange', 0xE8782A, 0xF2F0EA]]) FDEF['vx_sofa_' + k] = { model: 'vsofa', a: col, b: pil, join: true };
  // a model's meshes, built on first use and kept
  const FCACHE = {};
  PR.furnModel = function (key) {
    if (FCACHE[key]) return FCACHE[key];
    const d = FM[key]; if (!d) return null;
    const F = FB(d.size[0], d.size[1], d.size[2]);
    d.build(F);
    const m = F.done(); m.key = key; m.size = d.size;
    return (FCACHE[key] = m);
  };
  // the furniture kind of a block name, and back (kind = VR.PROP_FURN0 + the name's index in VR.PROP_FURN, mesher.js)
  PR.FURN0 = VR.PROP_FURN0 || 16;
  PR.furnDef = function (kind) { const L = VR.PROP_FURN, nm = L && L[kind - PR.FURN0]; return nm ? FDEF[nm] || null : null; };
  // the model of a piece: its definition's model, a joining sofa's with the row bits of its anchor (facing bits 2, 3)
  PR.furnKey = function (kind, facing) { const d = PR.furnDef(kind); if (!d) return null; return d.join ? d.model + ':' + ((facing >> 2) & 3) : d.model; };
  // the centre of a piece on the floor (world) from its anchor (part 0) and facing, and its turn (yaw): the model's
  // q quarter turns are VM.footprint's (part 0 lands where rotOffset(0, 0) says in the turned box)
  PR.furnPlace = function (size, wx, wy, wz, facing, out, cell) {
    const q = facing & 3, W = size[0], D = size[2];
    let x = cell ? cell[0] : 0, z = cell ? cell[1] : 0, w = W, d = D;
    for (let r = 0; r < q; r++) { const t = x; x = d - 1 - z; z = t; const tw = w; w = d; d = tw; }
    out[0] = wx - x + w / 2; out[1] = wy; out[2] = wz - z + d / 2; out[3] = q * Math.PI / 2;
    return out;
  };

  // ---------------------------------------------------------------- the anchors: one prop instance per anchor
  // the seeded variation of an anchor: the yaw, the scale (0.86–1.16: the crown and the trunk's girth), the lean (the top
  // bends 0.25–1.15 blocks at the trunk's depth), the phase of the sway (the terrain's wind phase), the frond mask (9–13
  // green fronds, 1–2 dead ones on a crown, none for a bare trunk), the light at the anchor (sky and block light, 0–1)
  // writes 12 floats at out[off]: the anchor's origin (world, the bottom of its block), then the instance's variation.
  // A piece of furniture (kind >= FURN0) writes the centre of its footprint and its turn (facing), its first colour
  // (linear) and its second (the sRGB number, the shader unpacks it), then the light.
  PR.KIND = VR.PROP_KIND || { palm: 1, palm_trunk: 2 };   // the kinds the mesher writes (mesher.js)
  const PLACE = [0, 0, 0, 0];
  PR.anchorData = function (kind, wx, wy, wz, light, out, off, facing) {
    const o = off | 0;
    if (kind >= PR.FURN0) {
      const d = PR.furnDef(kind), key = PR.furnKey(kind, facing | 0), md = key && FM[key];
      PR.furnPlace(md ? md.size : [1, 1, 1], wx, wy, wz, facing | 0, PLACE, d && d.cell);
      out[o] = PLACE[0]; out[o + 1] = PLACE[1]; out[o + 2] = PLACE[2]; out[o + 3] = PLACE[3];
      const a = lin(d && d.a !== undefined ? d.a : 0xFFFFFF, 1);
      out[o + 4] = a[0]; out[o + 5] = a[1]; out[o + 6] = a[2]; out[o + 7] = d && d.b !== undefined ? d.b : 0xFFFFFF;
      const sky = (light >> 12) & 15, br = (light >> 8) & 15, bg = (light >> 4) & 15, bb = light & 15;
      out[o + 8] = sky / 15; out[o + 9] = br / 15; out[o + 10] = bg / 15; out[o + 11] = bb / 15;
      return o + PR.INST;
    }
    out[o] = wx + 0.5; out[o + 1] = wy; out[o + 2] = wz + 0.5;
    out[o + 3] = hash(wx, wy, wz, 1) * TAU;
    out[o + 4] = 0.86 + 0.3 * hash(wx, wy, wz, 2);
    out[o + 5] = 0.25 + 0.9 * hash(wx, wy, wz, 3);
    out[o + 6] = wx * 0.37 + wz * 0.29;
    let mask = 1 << PR.BIT_FIXED;
    if (kind === PR.KIND.palm) {
      const N = PR.FROND_N, alive = 9 + Math.floor(hash(wx, wy, wz, 4) * 5), rank = [];
      for (let k = 0; k < N; k++) rank.push([hash(wx, wy, wz, 10 + k), k]);
      rank.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < alive; i++) mask |= 1 << rank[i][1];
      const dead = 1 + Math.floor(hash(wx, wy, wz, 5) * 2);
      for (let j = 0; j < dead; j++) mask |= 1 << (PR.DEAD_FIRST + j);
      mask |= 1 << PR.BIT_COCO;
    }
    out[o + 7] = mask;
    const sky = (light >> 12) & 15, br = (light >> 8) & 15, bg = (light >> 4) & 15, bb = light & 15;
    out[o + 8] = sky / 15; out[o + 9] = br / 15; out[o + 10] = bg / 15; out[o + 11] = bb / 15;
    return o + PR.INST;
  };
  // the models by kind: the near mesh and the far mesh (the trunk-only kind has no far model: it is too small there)
  PR.models = function (kind) {
    if (kind === PR.KIND.palm) return { near: PR.palm(), far: PR.cross() };
    if (kind === PR.KIND.palm_trunk) return { near: PR.palm(), far: null };
    if (kind >= PR.FURN0) { const key = PR.furnKey(kind, 0); return key ? PR.furnModel(key) : null; }
    return null;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

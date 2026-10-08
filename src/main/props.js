// ============================================================================
// Smooth props (t-smooth, TRAILER.md §3.2 and the palms of trailer frames t3_05–t3_08): procedural triangle meshes for
// the blocks whose type carries a `prop` (the mesher hands over one anchor per prop instance, mesher.js). Everything is
// built in JS once per model, from a few numbers — no asset, no texture file.
//   palm      the palm: a tapering 8-sided trunk that bends with its seed (the lean), a crown of 13 green fronds (bent
//             strips of 6 segments that rise a little and droop under their weight), two dead fronds hanging under it,
//             three coconuts and the crownshaft bulb. A frond mask per instance picks 9–13 green fronds (and 0–2 dead).
//   palm far  a cross of two cutout quads with the palm's silhouette (the same fronds, painted flat), for the distance.
// Models are described by their vertex layout (14 floats: pos, normal, uv, colour, bend, sway, frond) and the instance
// layout (12 floats: [x y z yaw] [scale lean phase mask] [sky r g b]); renderer.js owns the GL side (drawProps).
// A prop kind is a number the mesher writes (VR.PROP_KIND in mesher.js) and a model here: a new prop (topiary, hedge,
// furniture) is one model function and one line in KINDS.
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
  const PAL = { bark: 0x7A5A3A, shaft: 0x5E8A4A, nut: 0x5E4026, leafA: 0x2F8A34, leafB: 0x5FC24E, tip: 0xB8D85A, dead: 0x9A7440 };
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
  // the azimuth and the length of a frond slot: green fronds spread evenly with a little jitter, the dead ones hang at random
  PR.frondAxis = function (k) {
    if (k < PR.DEAD_FIRST) return { az: ((k + 0.3 * (hash(k, 0, 0, 101) - 0.5)) / PR.FROND_N) * TAU, len: 4.9 + 0.7 * hash(k, 0, 0, 102), dead: false };
    return { az: hash(k, 0, 0, 103) * TAU, len: 2.6, dead: true };
  };
  // a point on frond slot k at t (0 = the crown's centre, 1 = the tip): out rises a little, then the tip droops under its weight
  PR.frondPoint = function (k, t, out) {
    const a = PR.frondAxis(k), o = out || [0, 0, 0];
    if (!a.dead) {
      const r = 0.2 + a.len * t;
      o[0] = r * Math.cos(a.az); o[1] = 0.35 + 1.2 * t - 4.35 * t * t; o[2] = r * Math.sin(a.az);
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
          row.push(vert([cx + rx * nx, cy + ry * ny, cz + rz * nz], [nx, ny, nz], [0.75, 0.5], col, 0, sway, frond));
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
    const B = Builder(), D = PR.TRUNK_D, SIDES = 8, RINGS = 10;
    // the trunk: eleven rings down to −D, tapering (0.24 at the crown, 0.48 at −D), bark rings banded every two blocks
    const trunk = [];
    for (let j = 0; j <= RINGS; j++) {
      const s = D * j / RINGS, bend = (s / D) * (s / D), r = 0.3 + 0.012 * s, ring = [];
      for (let k = 0; k < SIDES; k++) {
        const f = (k / SIDES) * TAU, c = Math.cos(f), sn = Math.sin(f);
        const sh = (j & 1 ? 0.88 : 1) * (k & 1 ? 0.94 : 1);
        ring.push(B.vert([r * c, -s, r * sn], [c, 0, sn], [0.75, 0.5], lin(PAL.bark, sh), bend, 0.12 * (1 - bend), PR.BIT_FIXED));
      }
      trunk.push(ring);
    }
    for (let j = 0; j < RINGS; j++) for (let k = 0; k < SIDES; k++) {
      const a = trunk[j][k], b = trunk[j][(k + 1) % SIDES], c = trunk[j + 1][(k + 1) % SIDES], d = trunk[j + 1][k];
      B.idx.push(a, d, c, a, c, b);
    }
    // the crownshaft: a green bulb on the trunk top, the crown's floor
    B.sphere(0, 0.12, 0, 0.36, 0.42, 0.36, lin(PAL.shaft, 1), 0.12, PR.BIT_FIXED, 4, 6);
    // the fronds: six segments each, a V-fold (the sides rise a little above the midrib), the width tapering to the tip
    for (let k = 0; k < PR.FROND_N + 2; k++) {
      const a = PR.frondAxis(k), dead = a.dead, ring = [], P = [0, 0, 0];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6, p = PR.frondPoint(k, t, P), sx = -Math.sin(a.az), sz = Math.cos(a.az);
        const W = (dead ? 0.3 : 0.8) * Math.pow(1 - t, 0.5) * Math.min(1, t * 5), up = 0.12 * W;
        const col = dead ? lin(PAL.dead, 0.85 + 0.2 * hash(k, i, 0, 7))
          : lerp3(lin(PAL.leafA, 1), lin(PAL.leafB, 1), hash(k, 0, 0, 8)).map((c, q) => c * (1 - 0.3 * t) + lin(PAL.tip, 1)[q] * 0.3 * t);
        const sway = dead ? 0.25 * t : 0.35 + 0.65 * t;
        const l = B.vert([p[0] + sx * W, p[1] + up, p[2] + sz * W], norm3([sx * 0.3, 0.94, sz * 0.3]), [0, t], col, 0, sway, k);
        const r = B.vert([p[0] - sx * W, p[1] + up, p[2] - sz * W], norm3([-sx * 0.3, 0.94, -sz * 0.3]), [0.5, t], col, 0, sway, k);
        ring.push([l, r]);
      }
      for (let i = 0; i < 6; i++) { const a0 = ring[i][0], b0 = ring[i][1], c0 = ring[i + 1][1], d0 = ring[i + 1][0]; B.idx.push(a0, b0, c0, a0, c0, d0); }
    }
    // three coconuts under the crown (always on with the crown: mask bit 16)
    for (const [x, y, z] of [[0.22, -0.3, 0.12], [-0.18, -0.34, -0.1], [0.04, -0.4, -0.24]]) B.sphere(x, y, z, 0.2, 0.2, 0.2, lin(PAL.nut, 1), 0.8, PR.BIT_COCO, 4, 6);
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
      if (e < 0.05) on = true;
      else {
        const halfW = 0.95 * Math.pow(1 - v, 0.35), s = (v * 30 + e * 2.4) % 1;
        on = e < halfW && s < 0.42 + 0.15 * (1 - e) && hash(x, y, 0, 41) > 0.04;
        shade = 0.72 + 0.28 * (1 - s);
      }
      const c = on ? Math.round(255 * shade) : 0;
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
      for (let i = 0; i <= 30; i++) { const t = i / 30; PR.frondPoint(k, t, P); disc(P[0], P[1], dead ? 0.3 : 0.42 * (1 - 0.5 * t), rgbOf(col), 0.1, 61 + k); }
    }
    disc(0, 0.3, 0.9, rgbOf(PAL.leafA), 0, 81);
    for (const [x, y] of [[0.22, -0.3], [-0.18, -0.34], [0.04, -0.4]]) disc(x, y, 0.22, rgbOf(PAL.nut), 0, 91);
    return { w: W, h: H, data: d };
  };

  // ---------------------------------------------------------------- the anchors: one prop instance per anchor
  // the seeded variation of an anchor: the yaw, the scale (0.86–1.16: the crown and the trunk's girth), the lean (the top
  // bends 0.25–1.15 blocks at the trunk's depth), the phase of the sway (the terrain's wind phase), the frond mask (9–13
  // green fronds, 1–2 dead ones on a crown, none for a bare trunk), the light at the anchor (sky and block light, 0–1)
  // writes 12 floats at out[off]: the anchor's origin (world, the bottom of its block), then the instance's variation
  PR.KIND = VR.PROP_KIND || { palm: 1, palm_trunk: 2 };   // the kinds the mesher writes (mesher.js)
  PR.anchorData = function (kind, wx, wy, wz, light, out, off) {
    const o = off | 0;
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
    return null;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

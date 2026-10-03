// ============================================================================
// Micro-voxel models (1 voxel = 1/16 block): procedural creature / robot /
// vehicle designs, greedy face meshing, GPU upload, articulated parts.
// ============================================================================
(function (VR) {
  'use strict';
  const hexc = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  // ---------------- voxel grid builder ----------------
  class Grid {
    constructor(sx, sy, sz, ox, oy, oz) { this.sx = sx; this.sy = sy; this.sz = sz; this.ox = ox || 0; this.oy = oy || 0; this.oz = oz || 0; this.c = new Uint32Array(sx * sy * sz); }
    i(x, y, z) { return (y * this.sz + z) * this.sx + x; }
    in(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz; }
    set(x, y, z, col, emis) { if (!this.in(x, y, z)) return; this.c[this.i(x, y, z)] = ((col & 0xffffff) | ((emis ? 1 : 0) << 24) | (1 << 25)) >>> 0; }
    get(x, y, z) { return this.in(x, y, z) ? this.c[this.i(x, y, z)] : 0; }
    box(x0, y0, z0, x1, y1, z1, col, o) {
      o = o || {};
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        let c = typeof col === 'function' ? col(x, y, z) : col;
        if (c === null || c === undefined) continue;
        if (o.shade) { const k = 1 + (VR.M.hash3(x, y, z, 7) / 4294967296 - 0.5) * o.shade; c = mulc(c, k); }
        this.set(x, y, z, c, o.emis);
      }
      return this;
    }
    ell(cx, cy, cz, rx, ry, rz, col, o) {
      o = o || {};
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
        if (d > 1) continue;
        let c = typeof col === 'function' ? col(x, y, z, d) : col;
        if (c === null || c === undefined) continue;
        if (o.shade) { const k = 1 + (VR.M.hash3(x, y, z, 9) / 4294967296 - 0.5) * o.shade; c = mulc(c, k); }
        this.set(x, y, z, c, o.emis);
      }
      return this;
    }
  }
  function mulc(c, k) { const r = Math.min(255, ((c >> 16) & 255) * k) | 0, g = Math.min(255, ((c >> 8) & 255) * k) | 0, b = Math.min(255, (c & 255) * k) | 0; return (r << 16) | (g << 8) | b; }
  VR.VoxGrid = Grid;

  // ---------------- mesher → Float32 pos(3) + Int8 normal(3,pad) + Uint8 color(4) ----------------
  const FACES = [
    [1, 0, 0, [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [-1, 0, 0, [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [0, 1, 0, [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [0, -1, 0, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [0, 0, 1, [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [0, 0, -1, [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
  ];
  // greedy face merging + per-vertex ambient occlusion baked into the vertex colours
  const AOK = [1.0, 0.8, 0.66, 0.54];
  const SHADEF = [0.9, 0.9, 1.0, 0.72, 0.95, 0.95];
  // per face: normal axis, u axis, v axis (right-handed so quads face outward)
  const FAX = [[0, 2, 1, 1], [0, 1, 2, -1], [1, 0, 2, 1], [1, 2, 0, -1], [2, 1, 0, 1], [2, 0, 1, -1]];
  const CU = [-1, 1, 1, -1], CV = [-1, -1, 1, 1], UV3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  function meshGrid(g) {
    const out = [];
    const dims = [g.sx, g.sy, g.sz];
    const solid = (x, y, z) => (g.in(x, y, z) && g.c[g.i(x, y, z)]) ? 1 : 0;
    const p = [0, 0, 0];
    for (let f = 0; f < 6; f++) {
      const [na, ua, va, sgn] = FAX[f];
      const nd = [0, 0, 0]; nd[na] = sgn;
      const U = dims[ua], Vd = dims[va];
      const keys = new Float64Array(U * Vd), aos = new Int32Array(U * Vd), cols = new Uint32Array(U * Vd);
      for (let s = 0; s < dims[na]; s++) {
        keys.fill(0);
        for (let v = 0; v < Vd; v++) for (let u = 0; u < U; u++) {
          p[na] = s; p[ua] = u; p[va] = v;
          const c = g.get(p[0], p[1], p[2]);
          if (!c) continue;
          if (solid(p[0] + nd[0], p[1] + nd[1], p[2] + nd[2])) continue;
          // AO for the 4 face corners (in u/v order: (0,0) (1,0) (1,1) (0,1))
          const qx = p[0] + nd[0], qy = p[1] + nd[1], qz = p[2] + nd[2];
          let ao = 0;
          for (let k = 0; k < 4; k++) {
            const du = CU[k], dv = CV[k];
            const ux = UV3[ua][0] * du, uy = UV3[ua][1] * du, uz = UV3[ua][2] * du;
            const vx = UV3[va][0] * dv, vy = UV3[va][1] * dv, vz = UV3[va][2] * dv;
            const s1 = solid(qx + ux, qy + uy, qz + uz), s2 = solid(qx + vx, qy + vy, qz + vz), cc = solid(qx + ux + vx, qy + uy + vy, qz + uz + vz);
            const a = (s1 && s2) ? 3 : s1 + s2 + cc;
            ao |= a << (k * 2);
          }
          const i = v * U + u;
          cols[i] = c; aos[i] = ao;
          const uniform = ao === 0;
          // only faces without occlusion may merge (keeps the AO gradients exact)
          keys[i] = uniform ? (c & 0x1ffffff) + 1 : -(i + 1);
        }
        // greedy rectangles
        for (let v = 0; v < Vd; v++) for (let u = 0; u < U; u++) {
          const i = v * U + u, k = keys[i];
          if (!k) continue;
          let w = 1, h = 1;
          if (k > 0) {
            while (u + w < U && keys[i + w] === k) w++;
            outer: while (v + h < Vd) { for (let t = 0; t < w; t++) if (keys[(v + h) * U + u + t] !== k) break outer; h++; }
          }
          for (let dv = 0; dv < h; dv++) for (let du = 0; du < w; du++) keys[(v + dv) * U + u + du] = 0;
          const c = cols[i], ao = aos[i];
          const em = (c >> 24) & 1;
          const kf = SHADEF[f];
          const base = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
          // corner positions
          const plane = sgn > 0 ? s + 1 : s;
          const P4 = [[u, v], [u + w, v], [u + w, v + h], [u, v + h]].map(([uu, vv]) => { const a = [0, 0, 0]; a[na] = plane; a[ua] = uu; a[va] = vv; return [a[0] - g.ox, a[1] - g.oy, a[2] - g.oz]; });
          const A4 = [0, 1, 2, 3].map(k2 => (ao >> (k2 * 2)) & 3);
          const colAt = (k2) => { const m = kf * (em ? 1 : AOK[A4[k2]]); return [base[0] * m, base[1] * m, base[2] * m]; };
          // winding: +sgn faces use (0,1,2)(0,2,3) when (u × v) points along +normal
          const flipDiag = A4[0] + A4[2] > A4[1] + A4[3];
          let tri = flipDiag ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
          const cross = ((ua + 1) % 3 === va) ? 1 : -1; // is (u,v,n) right-handed?
          if (cross * sgn < 0) tri = [tri[0], tri[2], tri[1], tri[3], tri[5], tri[4]];
          for (const k2 of tri) { const cc = colAt(k2); out.push(P4[k2][0], P4[k2][1], P4[k2][2], nd[0], nd[1], nd[2], cc[0], cc[1], cc[2], em); }
        }
      }
    }
    const n = out.length / 10;
    const buf = new ArrayBuffer(n * 20), f32 = new Float32Array(buf), i8 = new Int8Array(buf), u8 = new Uint8Array(buf);
    for (let i = 0; i < n; i++) {
      const o = i * 10;
      f32[i * 5] = out[o]; f32[i * 5 + 1] = out[o + 1]; f32[i * 5 + 2] = out[o + 2];
      i8[i * 20 + 12] = out[o + 3] * 127; i8[i * 20 + 13] = out[o + 4] * 127; i8[i * 20 + 14] = out[o + 5] * 127;
      u8[i * 20 + 16] = Math.min(255, out[o + 6]); u8[i * 20 + 17] = Math.min(255, out[o + 7]); u8[i * 20 + 18] = Math.min(255, out[o + 8]); u8[i * 20 + 19] = out[o + 9] ? 255 : 0;
    }
    return { data: new Uint8Array(buf), count: n };
  }
  VR.meshVoxGrid = meshGrid;

  // ---------------- GPU cache ----------------
  VR.VoxGPU = {
    upload(gl, mesh) {
      const vao = gl.createVertexArray(), vbo = gl.createBuffer();
      gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 20, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, 16);
      gl.bindVertexArray(null);
      return { vao, vbo, count: mesh.count };
    },
  };

  // ---------------- palette helpers ----------------
  const P = (h) => h;
  // Model = { parts: {name: {grid, pivot:[x,y,z] (voxels, model space), parent}}, scale }
  function part(sx, sy, sz, pivot, build) { const g = new Grid(sx, sy, sz, pivot[0], pivot[1], pivot[2]); build(g); return { grid: g, pivot: [0, 0, 0] }; }
  const M = VR.VOXMODELS = {};

  // Glimmer Deer: tan body, pale belly, glowing crystal antlers
  M.glimmer_deer = () => {
    const body = 0xc8a070, belly = 0xf0e0c8, dark = 0x6a4a30, cry = 0x7af0ff;
    return {
      h: 1.4, w: 0.45, parts: {
        body: part(8, 8, 14, [4, 0, 7], (g) => { g.ell(4, 4, 7, 3.6, 3.2, 6.6, (x, y) => y < 3 ? belly : body, { shade: 0.12 }); g.box(3, 5, 12, 4, 6, 13, 0xffffff); }),
        head: part(6, 7, 8, [3, 1, 2], (g) => { g.box(1, 0, 0, 4, 4, 5, body, { shade: 0.1 }); g.box(2, 0, -2 + 2, 3, 2, 1, belly); g.box(1, 3, 3, 1, 3, 3, 0x101010); g.box(4, 3, 3, 4, 3, 3, 0x101010); g.box(0, 5, 3, 0, 6, 3, cry, { emis: 1 }); g.box(5, 5, 3, 5, 6, 3, cry, { emis: 1 }); g.box(0, 6, 2, 0, 6, 4, cry, { emis: 1 }); g.box(5, 6, 2, 5, 6, 4, cry, { emis: 1 }); }),
        leg_fl: part(2, 9, 2, [1, 9, 1], (g) => g.box(0, 0, 0, 1, 8, 1, (x, y) => y < 1 ? dark : body)),
        leg_fr: part(2, 9, 2, [1, 9, 1], (g) => g.box(0, 0, 0, 1, 8, 1, (x, y) => y < 1 ? dark : body)),
        leg_bl: part(2, 9, 2, [1, 9, 1], (g) => g.box(0, 0, 0, 1, 8, 1, (x, y) => y < 1 ? dark : body)),
        leg_br: part(2, 9, 2, [1, 9, 1], (g) => g.box(0, 0, 0, 1, 8, 1, (x, y) => y < 1 ? dark : body)),
      },
      layout: { body: [0, 9, 0], head: [0, 15, -7], leg_fl: [-2.5, 9, -5], leg_fr: [2.5, 9, -5], leg_bl: [-2.5, 9, 5], leg_br: [2.5, 9, 5] },
      gait: 'quad',
    };
  };
  // Moss Boar: stocky, mossy back, tusks
  M.moss_boar = () => {
    const hide = 0x6a4a30, moss = 0x5a8a2a, snout = 0xd8a08a, tusk = 0xf0ecd8;
    return {
      h: 0.95, w: 0.5, parts: {
        body: part(10, 8, 14, [5, 0, 7], (g) => { g.ell(5, 4, 7, 4.6, 3.8, 6.6, (x, y) => y > 5 ? moss : hide, { shade: 0.2 }); }),
        head: part(8, 7, 7, [4, 1, 5], (g) => { g.box(0, 0, 0, 7, 6, 5, hide, { shade: 0.15 }); g.box(2, 0, -2 + 1, 5, 3, 0, snout); g.box(0, 1, 0, 0, 3, 0, tusk); g.box(7, 1, 0, 7, 3, 0, tusk); g.box(1, 4, 2, 1, 4, 2, 0x101010); g.box(6, 4, 2, 6, 4, 2, 0x101010); g.box(1, 6, 1, 6, 6, 4, moss); }),
        leg_fl: part(3, 5, 3, [1, 5, 1], (g) => g.box(0, 0, 0, 2, 4, 2, hide)), leg_fr: part(3, 5, 3, [1, 5, 1], (g) => g.box(0, 0, 0, 2, 4, 2, hide)),
        leg_bl: part(3, 5, 3, [1, 5, 1], (g) => g.box(0, 0, 0, 2, 4, 2, hide)), leg_br: part(3, 5, 3, [1, 5, 1], (g) => g.box(0, 0, 0, 2, 4, 2, hide)),
      },
      layout: { body: [0, 5, 0], head: [0, 7, -8], leg_fl: [-3, 5, -4], leg_fr: [3, 5, -4], leg_bl: [-3, 5, 4], leg_br: [3, 5, 4] },
      gait: 'quad',
    };
  };
  // Bloom Sheep: fluffy pastel wool with flowers
  M.bloom_sheep = () => {
    const wool = 0xf8eef4, pink = 0xff9ac8, face = 0x3a2a3a, leaf = 0x6ac84a;
    return {
      h: 1.25, w: 0.45, parts: {
        body: part(12, 11, 15, [6, 0, 7], (g) => { g.ell(6, 5.5, 7.5, 5.8, 5.2, 7.2, (x, y, z) => (VR.M.hash3(x >> 1, y >> 1, z >> 1, 3) & 15) === 0 ? pink : (VR.M.hash3(x, y, z, 4) & 31) === 0 ? leaf : wool, { shade: 0.1 }); }),
        head: part(6, 6, 6, [3, 1, 4], (g) => { g.box(0, 0, 0, 5, 5, 4, face); g.box(0, 5, 1, 5, 5, 4, wool); g.box(1, 3, 0, 1, 3, 0, 0xffffff); g.box(4, 3, 0, 4, 3, 0, 0xffffff); g.box(-1 + 1, 4, 2, 0, 4, 3, pink); }),
        leg_fl: part(2, 7, 2, [1, 7, 1], (g) => g.box(0, 0, 0, 1, 6, 1, face)), leg_fr: part(2, 7, 2, [1, 7, 1], (g) => g.box(0, 0, 0, 1, 6, 1, face)),
        leg_bl: part(2, 7, 2, [1, 7, 1], (g) => g.box(0, 0, 0, 1, 6, 1, face)), leg_br: part(2, 7, 2, [1, 7, 1], (g) => g.box(0, 0, 0, 1, 6, 1, face)),
      },
      layout: { body: [0, 6, 0], head: [0, 12, -8], leg_fl: [-3, 7, -4], leg_fr: [3, 7, -4], leg_bl: [-3, 7, 4], leg_br: [3, 7, 4] },
      gait: 'quad',
    };
  };
  // Crystal Crab: violet crystal shell
  M.crystal_crab = () => {
    const shell = 0x8a4ad0, cry = 0xd08aff, leg = 0x5a2a8a;
    return {
      h: 0.45, w: 0.4, parts: {
        body: part(10, 6, 8, [5, 0, 4], (g) => { g.ell(5, 2.5, 4, 4.8, 2.4, 3.8, shell, { shade: 0.2 }); g.box(3, 4, 3, 3, 6, 3, cry, { emis: 1 }); g.box(6, 4, 4, 6, 7, 4, cry, { emis: 1 }); g.box(3, 3, 0, 3, 3, 0, 0x101010); g.box(6, 3, 0, 6, 3, 0, 0x101010); }),
        claw_l: part(4, 3, 4, [2, 1, 3], (g) => g.box(0, 0, 0, 3, 2, 3, cry, { emis: 1 })), claw_r: part(4, 3, 4, [2, 1, 3], (g) => g.box(0, 0, 0, 3, 2, 3, cry, { emis: 1 })),
        leg_fl: part(1, 3, 1, [0, 3, 0], (g) => g.box(0, 0, 0, 0, 2, 0, leg)), leg_fr: part(1, 3, 1, [0, 3, 0], (g) => g.box(0, 0, 0, 0, 2, 0, leg)),
        leg_bl: part(1, 3, 1, [0, 3, 0], (g) => g.box(0, 0, 0, 0, 2, 0, leg)), leg_br: part(1, 3, 1, [0, 3, 0], (g) => g.box(0, 0, 0, 0, 2, 0, leg)),
      },
      layout: { body: [0, 2, 0], claw_l: [-6, 3, -4], claw_r: [6, 3, -4], leg_fl: [-5, 3, -2], leg_fr: [5, 3, -2], leg_bl: [-5, 3, 2], leg_br: [5, 3, 2] },
      gait: 'quad',
    };
  };
  // Sky Ray: huge gliding manta with glowing patterns
  M.sky_ray = () => {
    const top = 0x2a4ab0, under = 0xd8e8ff, glow = 0x5af0ff;
    return {
      h: 0.6, w: 1.2, fly: true, parts: {
        body: part(12, 4, 20, [6, 2, 10], (g) => { g.ell(6, 2, 10, 5.5, 2, 9.5, (x, y) => y < 2 ? under : ((x + 1) % 4 === 0 ? glow : top), { shade: 0.1 }); g.box(5, 2, 18, 6, 2, 19, top); g.box(3, 3, 3, 3, 3, 3, 0xffffff, { emis: 1 }); g.box(8, 3, 3, 8, 3, 3, 0xffffff, { emis: 1 }); }),
        wing_l: part(16, 2, 14, [15, 1, 7], (g) => { for (let x = 0; x < 16; x++) { const w = Math.round(6.5 * (x / 15)); g.box(x, 0, 7 - w, x, 1, 7 + w - 2, (xx, y) => y === 0 ? under : (xx % 5 === 0 ? glow : top)); } }),
        wing_r: part(16, 2, 14, [0, 1, 7], (g) => { for (let x = 0; x < 16; x++) { const w = Math.round(6.5 * (1 - x / 15)); g.box(x, 0, 7 - w, x, 1, 7 + w - 2, (xx, y) => y === 0 ? under : (xx % 5 === 0 ? glow : top)); } }),
        tail: part(2, 2, 18, [1, 1, 0], (g) => { g.box(0, 0, 0, 1, 1, 17, top); g.box(0, 1, 16, 1, 1, 17, glow, { emis: 1 }); }),
      },
      layout: { body: [0, 0, 0], wing_l: [-5, 0, 0], wing_r: [5, 0, 0], tail: [0, 0, 9] },
      gait: 'wings',
    };
  };
  // Shard Wisp: floating glowing crystal orb creature
  M.shard_wisp = () => ({
    h: 0.5, w: 0.25, fly: true, parts: {
      body: part(7, 7, 7, [3.5, 3.5, 3.5], (g) => { g.ell(3.5, 3.5, 3.5, 3.4, 3.4, 3.4, (x, y, z, d) => d < 0.4 ? 0xffffff : 0x8afff0, { emis: 1 }); }),
      ring: part(11, 1, 11, [5.5, 0.5, 5.5], (g) => { for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; g.set(Math.round(5 + Math.cos(t) * 5), 0, Math.round(5 + Math.sin(t) * 5), 0x3af0c8, 1); } }),
    },
    layout: { body: [0, 4, 0], ring: [0, 4, 0] },
    gait: 'float',
  });
  // Ember Husk: charred rock humanoid with lava cracks (hostile)
  M.ember_husk = () => {
    const rock = 0x2a2226, crack = 0xff7a1a, eye = 0xffe07a;
    const cr = (x, y, z) => ((VR.M.hash3(x, y, z, 11) & 7) === 0 ? crack : rock);
    return {
      h: 1.85, w: 0.35, parts: {
        body: part(8, 12, 4, [4, 0, 2], (g) => g.box(0, 0, 0, 7, 11, 3, cr, { shade: 0.2 })),
        head: part(8, 8, 8, [4, 0, 4], (g) => { g.box(0, 0, 0, 7, 7, 7, cr, { shade: 0.2 }); g.box(1, 4, 0, 2, 4, 0, eye, { emis: 1 }); g.box(5, 4, 0, 6, 4, 0, eye, { emis: 1 }); }),
        arm_l: part(4, 12, 4, [2, 11, 2], (g) => g.box(0, 0, 0, 3, 11, 3, cr, { shade: 0.2 })), arm_r: part(4, 12, 4, [2, 11, 2], (g) => g.box(0, 0, 0, 3, 11, 3, cr, { shade: 0.2 })),
        leg_l: part(4, 12, 4, [2, 12, 2], (g) => g.box(0, 0, 0, 3, 11, 3, cr, { shade: 0.2 })), leg_r: part(4, 12, 4, [2, 12, 2], (g) => g.box(0, 0, 0, 3, 11, 3, cr, { shade: 0.2 })),
      },
      layout: { body: [0, 12, 0], head: [0, 24, 0], arm_l: [-6, 23, 0], arm_r: [6, 23, 0], leg_l: [-2, 12, 0], leg_r: [2, 12, 0] },
      gait: 'biped',
    };
  };
  // Void Stalker: tall dark figure, violet eyes
  M.void_stalker = () => {
    const skin = 0x141018, eye = 0xd07aff;
    return {
      h: 2.7, w: 0.3, parts: {
        body: part(8, 12, 4, [4, 0, 2], (g) => g.box(0, 0, 0, 7, 11, 3, skin, { shade: 0.15 })),
        head: part(8, 8, 8, [4, 0, 4], (g) => { g.box(0, 0, 0, 7, 7, 7, skin, { shade: 0.15 }); g.box(1, 3, 0, 2, 3, 0, eye, { emis: 1 }); g.box(5, 3, 0, 6, 3, 0, eye, { emis: 1 }); }),
        arm_l: part(2, 26, 2, [1, 25, 1], (g) => g.box(0, 0, 0, 1, 25, 1, skin)), arm_r: part(2, 26, 2, [1, 25, 1], (g) => g.box(0, 0, 0, 1, 25, 1, skin)),
        leg_l: part(2, 26, 2, [1, 26, 1], (g) => g.box(0, 0, 0, 1, 25, 1, skin)), leg_r: part(2, 26, 2, [1, 26, 1], (g) => g.box(0, 0, 0, 1, 25, 1, skin)),
      },
      layout: { body: [0, 26, 0], head: [0, 38, 0], arm_l: [-5, 37, 0], arm_r: [5, 37, 0], leg_l: [-2, 26, 0], leg_r: [2, 26, 0] },
      gait: 'biped',
    };
  };
  // Raider drone: hovering hostile robot (raids)
  M.raider_drone = () => {
    const hull = 0x3a3e46, red = 0xff3a2a, plate = 0x9aa0a8;
    return {
      h: 0.9, w: 0.45, fly: true, parts: {
        body: part(10, 8, 10, [5, 4, 5], (g) => { g.ell(5, 4, 5, 4.8, 3.6, 4.8, (x, y) => y > 5 ? plate : hull, { shade: 0.15 }); g.box(3, 3, 0, 6, 5, 0, red, { emis: 1 }); }),
        rotor_l: part(8, 1, 8, [4, 0, 4], (g) => { g.box(0, 0, 3, 7, 0, 4, plate); g.box(3, 0, 0, 4, 0, 7, plate); }),
        rotor_r: part(8, 1, 8, [4, 0, 4], (g) => { g.box(0, 0, 3, 7, 0, 4, plate); g.box(3, 0, 0, 4, 0, 7, plate); }),
        gun: part(2, 2, 6, [1, 1, 6], (g) => { g.box(0, 0, 0, 1, 1, 5, hull); g.box(0, 0, 0, 1, 1, 0, red, { emis: 1 }); }),
      },
      layout: { body: [0, 7, 0], rotor_l: [-7, 11, 0], rotor_r: [7, 11, 0], gun: [0, 4, -4] },
      gait: 'hover',
    };
  };
  // Hover drone: friendly helper bot (spawn egg)
  M.hover_drone = () => {
    const w = 0xe8ecf0, o = 0xff6a1a, c = 0x3af0ff;
    return {
      h: 0.6, w: 0.3, fly: true, parts: {
        body: part(8, 6, 8, [4, 3, 4], (g) => { g.ell(4, 3, 4, 3.8, 2.8, 3.8, (x, y) => y < 2 ? o : w, { shade: 0.1 }); g.box(2, 3, 0, 5, 3, 0, c, { emis: 1 }); }),
        rotor_l: part(6, 1, 6, [3, 0, 3], (g) => g.box(0, 0, 2, 5, 0, 3, 0x9aa0a8)), rotor_r: part(6, 1, 6, [3, 0, 3], (g) => g.box(0, 0, 2, 5, 0, 3, 0x9aa0a8)),
      },
      layout: { body: [0, 5, 0], rotor_l: [-5, 8, 0], rotor_r: [5, 8, 0] },
      gait: 'hover',
    };
  };
  // Player / astronaut (third person & hand)
  M.player = () => {
    const suit = 0xe8ecf0, trim = 0xff6a1a, visor = 0x2a6ad0, glove = 0x3a3e46;
    return {
      h: 1.8, w: 0.3, parts: {
        body: part(8, 12, 4, [4, 0, 2], (g) => { g.box(0, 0, 0, 7, 11, 3, suit, { shade: 0.06 }); g.box(0, 5, 0, 7, 5, 0, trim); g.box(2, 7, 0, 5, 9, 0, 0x3af0ff, { emis: 1 }); g.box(1, 2, 4 - 1, 6, 10, 3, 0xc8ccd4); }),
        head: part(8, 8, 8, [4, 0, 4], (g) => { g.box(0, 0, 0, 7, 7, 7, suit, { shade: 0.05 }); g.box(1, 2, 0, 6, 5, 0, visor); g.box(2, 4, 0, 3, 4, 0, 0x9ad8ff, { emis: 1 }); }),
        arm_l: part(4, 12, 4, [2, 11, 2], (g) => { g.box(0, 0, 0, 3, 11, 3, suit, { shade: 0.06 }); g.box(0, 0, 0, 3, 2, 3, glove); g.box(0, 8, 0, 3, 8, 3, trim); }),
        arm_r: part(4, 12, 4, [2, 11, 2], (g) => { g.box(0, 0, 0, 3, 11, 3, suit, { shade: 0.06 }); g.box(0, 0, 0, 3, 2, 3, glove); g.box(0, 8, 0, 3, 8, 3, trim); }),
        leg_l: part(4, 12, 4, [2, 12, 2], (g) => { g.box(0, 0, 0, 3, 11, 3, suit, { shade: 0.06 }); g.box(0, 0, 0, 3, 1, 3, glove); }),
        leg_r: part(4, 12, 4, [2, 12, 2], (g) => { g.box(0, 0, 0, 3, 11, 3, suit, { shade: 0.06 }); g.box(0, 0, 0, 3, 1, 3, glove); }),
      },
      layout: { body: [0, 12, 0], head: [0, 24, 0], arm_l: [-6, 23, 0], arm_r: [6, 23, 0], leg_l: [-2, 12, 0], leg_r: [2, 12, 0] },
      gait: 'biped',
    };
  };
  // First-person arm (1/32 voxels): suit sleeve with panel seam, orange cuff, glowing wrist pad, armoured glove
  M.fp_arm = () => {
    const suit = 0xE8ECF0, trim = 0xFF6A1A, glove = 0x565B64;
    const g = new Grid(9, 25, 9, 4, 24, 4);
    const put = (x, y, z, c, e) => g.set(x + 4, y + 24, z + 4, c, e);
    for (let y = -16; y <= 0; y++) for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) {
      if (Math.abs(x) === 3 && Math.abs(z) === 3) continue;
      let c = mulc(suit, 0.95 + (VR.M.hash3(x, y, z, 31) / 4294967296) * 0.07);
      if (y === -7) c = 0xC4CAD2;
      if (y === -15 || y === -14) c = trim;
      put(x, y, z, c);
    }
    for (let y = -13; y <= -10; y++) for (let x = -2; x <= 2; x++) put(x, y, -4, (y === -13 || y === -10 || Math.abs(x) === 2) ? 0x2A2E36 : 0x3AF0FF, (y === -13 || y === -10 || Math.abs(x) === 2) ? 0 : 1);
    for (let y = -23; y <= -17; y++) for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) {
      if (Math.abs(x) === 3 && Math.abs(z) === 3) continue;
      if (y === -23 && (Math.abs(x) === 3 || Math.abs(z) === 3)) continue;
      put(x, y, z, mulc(glove, 0.94 + (VR.M.hash3(x, y, z, 32) / 4294967296) * 0.1));
    }
    for (let x = -2; x <= 2; x++) { put(x, -21, -4, 0x6A6E76); put(x, -19, -4, 0x55595F); }
    for (let y = -20; y <= -18; y++) for (let z = -2; z <= 0; z++) put(-4, y, z, mulc(glove, 1.1));
    return { unit: 32, h: 0.8, w: 0.2, parts: { arm: { grid: g, pivot: [0, 0, 0] } }, layout: { arm: [0, 0, 0] }, gait: 'none' };
  };
  // Hoverbike vehicle
  M.hoverbike = () => {
    const paint = 0xf05a1a, dark = 0x2a2e36, glass = 0x9ad8ff, glow = 0x3af0ff;
    return {
      h: 0.9, w: 0.6, parts: {
        body: part(10, 8, 26, [5, 0, 13], (g) => {
          g.ell(5, 4, 13, 4.4, 3, 12.5, (x, y, z) => y < 3 ? dark : (z < 6 ? paint : (x === 5 ? dark : paint)), { shade: 0.1 });
          g.box(3, 6, 6, 6, 7, 9, glass); g.box(1, 1, 0, 8, 1, 25, glow, { emis: 1 });
          g.box(2, 7, 14, 7, 7, 20, 0x1a1c22);
        }),
        pod_l: part(4, 4, 10, [2, 2, 5], (g) => { g.box(0, 0, 0, 3, 3, 9, dark); g.box(1, 1, 9, 2, 2, 9, glow, { emis: 1 }); }),
        pod_r: part(4, 4, 10, [2, 2, 5], (g) => { g.box(0, 0, 0, 3, 3, 9, dark); g.box(1, 1, 9, 2, 2, 9, glow, { emis: 1 }); }),
      },
      layout: { body: [0, 2, 0], pod_l: [-6, 3, 7], pod_r: [6, 3, 7] },
      gait: 'hover',
    };
  };
  // Sky tram car (1 voxel = 1/8 block; 2.5 wide, 6 long, 3.2 tall): a rounded nose at the front (−z), a
  // gangway at the back, open window bays with seats inside and a glowing ceiling strip for the night
  function tramCar(o) {
    const SX = 20, SY = 26, SZ = 48;
    return {
      unit: 8, h: 3.2, w: 1.25, parts: {
        body: part(SX, SY, SZ, [SX / 2, 0, SZ / 2], (g) => {
          const noseTop = (z) => 21 - Math.max(0, 7 - z) * 1.25;
          const inShell = (x, y, z) => {
            if (z < 8 && y > noseTop(z)) return false;
            const cut = z < 3 ? 3 - z : z > SZ - 4 ? z - (SZ - 4) : 0;
            if (x < cut || x > SX - 1 - cut) return false;
            if (y === 23 && (x === 0 || x === SX - 1)) return false;
            return true;
          };
          const bay = (z) => { for (const [a, b] of [[6, 12], [15, 21], [26, 32], [35, 41]]) if (z >= a && z <= b) return true; return false; };
          // bogies & underframe
          for (const zc of [11, 37]) { g.box(3, 0, zc - 5, SX - 4, 2, zc + 5, 0x2C3038); g.box(1, 0, zc - 4, 2, 2, zc - 2, 0x1A1C22); g.box(1, 0, zc + 2, 2, 2, zc + 4, 0x1A1C22); g.box(SX - 3, 0, zc - 4, SX - 2, 2, zc - 2, 0x1A1C22); g.box(SX - 3, 0, zc + 2, SX - 2, 2, zc + 4, 0x1A1C22); }
          g.box(1, 3, 2, SX - 2, 4, SZ - 3, 0x3A3E46);
          // shell
          for (let y = 5; y <= 23; y++) for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
            if (!inShell(x, y, z)) continue;
            const inner = x >= 2 && x <= SX - 3 && y >= 6 && y <= 21 && z >= 3 && z <= SZ - 4 && (z >= 8 || y < noseTop(z) - 1.5);
            if (inner) continue;
            const side = x <= 1 || x >= SX - 2;
            // open window bays along both sides
            if (side && y >= 12 && y <= 18 && bay(z)) continue;
            let c = o.body;
            if (y <= 8) c = o.skirt;
            else if (y === 9) c = o.trim;
            else if (y === 10 && side) { g.set(x, y, z, o.glow, 1); continue; }
            else if ((y === 11 || y === 19) && side && bay(z)) c = o.frame;
            else if (y >= 22) c = o.roof;
            // windscreen on the nose slope
            if (z < 9 && y > 12 && y >= noseTop(z) - 1.5 && x >= 3 && x <= SX - 4) c = o.screen;
            g.set(x, y, z, mulc(c, 0.96 + (VR.M.hash3(x, y, z, 41) / 4294967296) * 0.06));
          }
          // gangway door at the back, headlights and a roof unit
          g.box(6, 6, SZ - 1, SX - 7, 19, SZ - 1, o.frame);
          g.box(3, 7, 0, 5, 8, 1, o.lamp, { emis: 1 }); g.box(SX - 6, 7, 0, SX - 4, 8, 1, o.lamp, { emis: 1 });
          g.box(6, 24, 16, SX - 7, 25, 31, o.roof2);
          g.box(8, 25, 20, SX - 9, 25, 27, o.frame);
          // inside: floor, seats facing each other in every bay, a light strip along the ceiling
          g.box(2, 5, 3, SX - 3, 5, SZ - 4, o.floor);
          for (const [a, b] of [[6, 12], [15, 21], [26, 32], [35, 41]]) for (const x0 of [2, SX - 6]) {
            g.box(x0, 6, a + 1, x0 + 3, 7, b - 1, o.seat);
            g.box(x0, 8, a, x0 + 3, 11, a, o.seat); g.box(x0, 8, b, x0 + 3, 11, b, o.seat);
          }
          g.box(8, 21, 4, SX - 9, 21, SZ - 5, o.light, { emis: 1 });
        }),
      },
      layout: { body: [0, 0, 0] },
      gait: 'none',
    };
  }
  M.tram_car = () => tramCar({ body: 0xECEFF3, skirt: 0xC4CAD2, trim: 0xFF6A1A, glow: 0x3AF0FF, frame: 0x2A2E36, roof: 0xDDE2E8, roof2: 0xB8BEC6, screen: 0x1C2C3C, lamp: 0xFFF4D8, floor: 0x5A6068, seat: 0x2F6FB0, light: 0xE8FFFF });
  M.tram_car_classic = () => tramCar({ body: 0xF0E6CC, skirt: 0x7E2630, trim: 0xD8B048, glow: 0xFFC860, frame: 0x3A2A22, roof: 0x5A5E66, roof2: 0x44484E, screen: 0x24303A, lamp: 0xFFE8B0, floor: 0x6A5040, seat: 0x8A2A34, light: 0xFFE2A8 });
  // Turret head (on turret blocks)
  M.turret_head = () => ({
    h: 0.6, w: 0.4, parts: {
      base: part(10, 4, 10, [5, 0, 5], (g) => { g.ell(5, 2, 5, 4.8, 2.5, 4.8, 0x3a3e46, { shade: 0.1 }); g.box(3, 3, 3, 6, 3, 6, 0x3af0ff, { emis: 1 }); }),
      barrel: part(4, 4, 14, [2, 2, 12], (g) => { g.box(0, 0, 0, 3, 3, 11, 0x9aa0a8, { shade: 0.1 }); g.box(1, 1, 0, 2, 2, 0, 0xff3a6a, { emis: 1 }); }),
    },
    layout: { base: [0, 0, 0], barrel: [0, 5, 0] },
    gait: 'turret',
  });

  // build & cache GPU meshes for a model kind
  const cache = new Map();
  VR.getVoxModel = function (gl, kind) {
    let m = cache.get(kind);
    if (m) return m;
    const def = M[kind] && M[kind]();
    if (!def) return null;
    m = { def, parts: {} };
    for (const name in def.parts) m.parts[name] = VR.VoxGPU.upload(gl, meshGrid(def.parts[name].grid));
    cache.set(kind, m);
    return m;
  };
  void P; void hexc;
})(VR);

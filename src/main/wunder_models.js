// ============================================================================
// r-wunder · the Wundertiere's models (plan docs/superpowers/plans/2026-11-07-r-wunder.md) — procedural, our own design.
// Balanced and up: smooth lofted meshes drawn as VR.WildGPU kinds (the creatures' program that exists already: nothing
// new compiled; one instanced draw per kind in view):
//   wwhale  the Himmelswal — a rounded body (an elliptic loft, fuller below), a slate-blue back with pale freckles, a
//           cream belly with soft grooves and a row of lantern spots along each flank (the glow: the instance's glow ×
//           the vertex's emission; hue > 1.5 = the lanterns' warm amber), long rounded pectoral fins and broad flukes
//           that beat slowly on the wing hinge (mode 0: weight 0 at the root … 1 at the tip). Length 1 (nose −z).
//   wtree   the Wanderbaum — a gnarled trunk, a big lumpy soft crown (sage green, pale blossom), lantern seeds hanging
//           under it (warm glow); the crown sways (mode 1: the bend, weighted by height). Height 1.
//   wroot   one of its root feet (a curved tapering root along +x from the trunk's foot): five per tree, each lifted by
//           the instance's bank when the tree walks. Height units as the tree's.
//   wdeer   the Laternenhirsch — a moon-pale body, neck and head, soft branching antlers with lantern bulbs, dapples
//           that glow; in metres. wleg: a slender leg from the hip down (its origin), swung by the instance's pitch.
// Very Low and Low: voxel models drawn by the entities' vox program (nothing new compiled): wu_whale (a coarse
// silhouette — drawn far away, shown nearer and smaller at the same angular size inside the far plane), wu_tree; the
// deer is today's glimmer_deer model.
// VR.WunderModels: mesh(name) (the raw vertices, node-tested) · KINDS
// ============================================================================
(function (VR) {
  'use strict';
  const WM = VR.WunderModels = VR.WunderModels || {};
  const TAU = Math.PI * 2;
  const lin = (c) => c.map(v => Math.pow(v, 2.2));
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hh = (a, b) => { let h = Math.imul(a ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul(b + 0x632be5ab, 0x85ebca6b); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

  // ---------------------------------------------------------------- the builder (wildgpu.js' layout: 11 floats a vertex)
  function B() { this.v = []; }
  B.prototype.vert = function (p, n, c, w, em) { this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], w || 0, em || 0); };
  // a grid surface f(i, j) → {p, c, w, em} for i 0…NI, j 0…NJ (wrapJ: j = NJ is j = 0); smooth area-weighted normals,
  // the winding agrees with them (the program turns the normal of a face seen from behind)
  B.prototype.grid = function (NI, NJ, wrapJ, f) {
    const P = [], Nn = [];
    for (let i = 0; i <= NI; i++) { P.push([]); Nn.push([]); for (let j = 0; j <= NJ; j++) { P[i].push(wrapJ && j === NJ ? P[i][0] : f(i, j)); Nn[i].push(wrapJ && j === NJ ? Nn[i][0] : [0, 0, 0]); } }
    const tris = [];
    const face = (a, b, c) => { const ux = b.p[0] - a.p[0], uy = b.p[1] - a.p[1], uz = b.p[2] - a.p[2], vx = c.p[0] - a.p[0], vy = c.p[1] - a.p[1], vz = c.p[2] - a.p[2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
      for (const T of [[[i, j], [i + 1, j], [i + 1, j + 1]], [[i, j], [i + 1, j + 1], [i, j + 1]]]) {
        const fn = face(P[T[0][0]][T[0][1]], P[T[1][0]][T[1][1]], P[T[2][0]][T[2][1]]);
        for (const [a, b] of T) { const n = Nn[a][b]; n[0] += fn[0]; n[1] += fn[1]; n[2] += fn[2]; }
        tris.push(T);
      }
    }
    for (const T of tris) for (const [a, b] of T) { const q = P[a][b], n = Nn[a][b], l = Math.hypot(n[0], n[1], n[2]) || 1; this.vert(q.p, [n[0] / l, n[1] / l, n[2] / l], q.c, q.w, q.em); }
  };
  // an ellipsoid round c with radii r; col(dx, dy, dz) → [rgb, em]; w (a number or a function of the point)
  B.prototype.ell = function (c, r, col, w, NI, NJ, bump) {
    this.grid(NI || 10, NJ || 14, true, (i, j) => {
      const th = i / (NI || 10) * Math.PI, ph = j / (NJ || 14) * TAU, dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph);
      const k = bump ? bump(dx, dy, dz) : 1, p = [c[0] + dx * r[0] * k, c[1] + dy * r[1] * k, c[2] + dz * r[2] * k], q = col(dx, dy, dz, p);
      return { p, c: q[0], em: q[1] || 0, w: typeof w === 'function' ? w(p) : (w || 0) };
    });
  };
  // a tube along pts [[x, y, z, radius], …]; col(t, a) → [rgb, em]; w(t, p)
  B.prototype.tube = function (pts, col, w, NJ) {
    NJ = NJ || 8;
    const n = pts.length - 1;
    this.grid(n, NJ, true, (i, j) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)], q = pts[i];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // a frame round the tangent
      let ux = 0, uy = 1, uz = 0; if (Math.abs(ty) > 0.9) { ux = 1; uy = 0; }
      let sx = ty * uz - tz * uy, sy = tz * ux - tx * uz, sz = tx * uy - ty * ux; const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      const vx = sy * tz - sz * ty, vy = sz * tx - sx * tz, vz = sx * ty - sy * tx;
      const ang = j / NJ * TAU, ca = Math.cos(ang), sa = Math.sin(ang), r = q[3];
      const p = [q[0] + (sx * ca + vx * sa) * r, q[1] + (sy * ca + vy * sa) * r, q[2] + (sz * ca + vz * sa) * r], cc = col(i / n, ang);
      return { p, c: cc[0], em: cc[1] || 0, w: typeof w === 'function' ? w(i / n, p) : (w || 0) };
    });
  };

  // ---------------------------------------------------------------- the Himmelswal (length 1, nose −z)
  WM.WHALE = { NI: 72, NJ: 40 };
  WM.whaleR = (t) => (t < 0.24 ? 0.115 * Math.pow(Math.sin(t / 0.24 * Math.PI / 2), 0.6) : 0.115 * Math.pow(Math.cos((t - 0.24) / 0.76 * Math.PI / 2), 1.1) + 0.012 * ss(0.6, 1, t));
  function whale() {
    const b = new B(), NI = WM.WHALE.NI, NJ = WM.WHALE.NJ;
    const back = lin([0.2, 0.29, 0.42]), flank = lin([0.42, 0.52, 0.62]), belly = lin([0.88, 0.85, 0.76]), freck = lin([0.62, 0.72, 0.82]), groove = lin([0.7, 0.66, 0.6]), eye = lin([0.04, 0.05, 0.08]);
    b.grid(NI, NJ, true, (i, j) => {
      const t = i / NI, a = j / NJ * TAU, r = WM.whaleR(t), up = Math.sin(a), cs = Math.cos(a);
      const z = -0.5 + t * 0.86, ry = up < 0 ? 1.0 : 0.82 - 0.12 * ss(0.1, 0.0, Math.abs(t - 0.12));
      const p = [cs * r * 1.1, up * r * ry - 0.012 * Math.sin(t * Math.PI), z];
      let c = up > 0.15 ? mix3(flank, back, ss(0.15, 0.6, up)) : mix3(belly, flank, ss(-0.55, 0.15, up)), em = 0;
      if (up > 0.35 && hh(i * 7 + 3, j * 13 + 1) > 0.9 && t > 0.08 && t < 0.8) c = freck;
      // the belly's grooves (pale lines from the chin back) — they glow softly at dusk
      if (up < -0.55 && t > 0.06 && t < 0.46 && (j % 3 === 0)) { c = groove; em = 0.3; }
      // the lantern spots: a row along each lower flank
      // (soft round spots: the glow falls off from each spot's middle — 12 a side, 0.05 apart along the body)
      const k = Math.round((t - 0.16) / 0.05), ds = Math.hypot((t - 0.16 - k * 0.05) * 7, (up + 0.4) * 1.4);
      if (k >= 0 && k < 12 && ds < 0.16) { const q = 1 - ds / 0.16; c = mix3(c, lin([1.0, 0.86, 0.6]), q); em = Math.max(em, q); }
      if (Math.abs(t - 0.13) < 0.012 && Math.abs(cs) > 0.86 && up > -0.05 && up < 0.3) c = eye;
      return { p, c, w: 0, em };
    });
    // the pectoral fins: long rounded paddles from the lower flank, swept back
    const finTop = lin([0.22, 0.31, 0.44]), finBot = lin([0.85, 0.83, 0.76]);
    for (const sd of [1, -1]) for (const top of [true, false]) {
      b.grid(10, 6, false, (i, j) => {
        const u = i / 10, v = j / 6, x0 = 0.085, span = 0.24;
        const le = -0.3 + 0.12 * Math.pow(u, 1.3), te = -0.2 + 0.08 * u, round = Math.sqrt(Math.max(0, 1 - Math.pow(u, 3)));
        const zc = (le + te) / 2, half = (te - le) / 2 * (0.15 + 0.85 * round), z = zc + (v - 0.5) * 2 * half;
        const th = 0.011 * (1 - u * 0.7) * Math.sin(Math.PI * v), y = -0.045 - 0.05 * u + (top ? th : -th);
        return { p: [sd * (x0 + span * u), y, z], c: top ? finTop : finBot, w: u, em: v > 0.85 && u > 0.2 ? 0.45 : 0 };
      });
    }
    // the flukes: broad, swept back, a notch in the middle
    for (const sd of [1, -1]) for (const top of [true, false]) {
      b.grid(10, 5, false, (i, j) => {
        const u = i / 10, v = j / 5;
        const le = 0.34 + 0.1 * Math.pow(u, 1.4), te = 0.43 - 0.03 * u + 0.05 * Math.pow(u, 3) - 0.025 * (1 - u), z = le + (te - le) * v;
        const th = 0.008 * (1 - u) * Math.sin(Math.PI * v), y = -0.002 + (top ? th : -th);
        return { p: [sd * (0.006 + 0.15 * u), y, z], c: top ? finTop : finBot, w: 0.25 + 0.75 * u, em: v > 0.8 ? 0.5 : 0 };
      });
    }
    return b.v;
  }

  // ---------------------------------------------------------------- the Wanderbaum (height 1)
  WM.TREE = { crownY: 0.7, crownR: [0.34, 0.25, 0.34], seeds: 12 };
  function tree() {
    const b = new B(), T = WM.TREE;
    const bark = lin([0.42, 0.34, 0.27]), barkD = lin([0.28, 0.22, 0.18]);
    const pts = [];
    for (let k = 0; k <= 12; k++) { const y = 0.02 + k / 12 * 0.5; pts.push([0.012 * Math.sin(y * 13), y, 0.01 * Math.cos(y * 9), 0.05 - 0.024 * (y / 0.52) + 0.03 * Math.exp(-y * 18)]); }
    b.tube(pts, (t, a) => [(Math.floor(a / TAU * 12) % 3 === 0) ? barkD : bark, 0], (t) => t * 0.3, 12);
    // two low boughs into the crown
    for (const sd of [1, -1]) b.tube([[0, 0.36, 0, 0.022], [sd * 0.1, 0.46, 0.03, 0.016], [sd * 0.18, 0.55, 0.05, 0.01]], () => [bark, 0], (t) => 0.2 + t * 0.4, 6);
    // the crown: a lumpy soft cloud of leaves
    const BUMPS = []; for (let k = 0; k < 16; k++) { const th = Math.acos(1 - 2 * hh(k, 11)), ph = hh(k, 12) * TAU; BUMPS.push([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]); }
    const lump = (dx, dy, dz) => { let s = 0; for (const q of BUMPS) s += Math.pow(Math.max(0, dx * q[0] + dy * q[1] + dz * q[2]), 10); return 0.84 + 0.3 * s - (dy < -0.3 ? 0.14 * (-dy - 0.3) : 0); };
    const leaf = lin([0.38, 0.56, 0.34]), leafT = lin([0.66, 0.78, 0.48]), leafD = lin([0.24, 0.38, 0.26]), bloom = lin([0.96, 0.82, 0.88]);
    b.ell([0, T.crownY, 0], T.crownR, (dx, dy, dz, p) => {
      const h = hh(Math.round(p[0] * 300), Math.round(p[2] * 300) + Math.round(p[1] * 300) * 7);
      return [h > 0.9 ? bloom : dy > 0.2 ? mix3(leaf, leafT, ss(0.2, 0.9, dy)) : mix3(leafD, leaf, ss(-0.7, 0.2, dy)), 0];
    }, (p) => Math.max(0, (p[1] - 0.4) * 1.6), 14, 20, lump);
    // the lantern seeds: little warm lanterns hanging under the crown
    const lc = lin([1.0, 0.85, 0.55]);
    for (let k = 0; k < T.seeds; k++) {
      const a = k / T.seeds * TAU + hh(k, 3), r = 0.17 + 0.12 * hh(k, 4), y = 0.5 - 0.05 * hh(k, 5);
      b.ell([Math.cos(a) * r, y, Math.sin(a) * r], [0.016, 0.022, 0.016], () => [lc, 1], () => 0.25, 4, 6);
    }
    return b.v;
  }
  function root() {
    const b = new B(), bark = lin([0.4, 0.32, 0.26]);
    b.tube([[0, 0.12, 0, 0.03], [0.04, 0.1, 0, 0.024], [0.08, 0.085, 0, 0.019], [0.115, 0.05, 0, 0.015], [0.14, 0.015, 0, 0.012], [0.16, 0.0, 0, 0.009], [0.185, -0.004, 0, 0.005]], (t) => [t > 0.8 ? lin([0.3, 0.26, 0.2]) : bark, 0], 0, 7);
    return b.v;
  }

  // ---------------------------------------------------------------- the Laternenhirsch (metres; nose −z)
  WM.DEER = { hipY: 0.98, hips: [[-0.13, -0.38], [0.13, -0.38], [-0.13, 0.36], [0.13, 0.36]] };
  function deer() {
    const b = new B();
    const coat = lin([0.9, 0.92, 0.96]), coatB = lin([0.78, 0.84, 0.94]), belly = lin([0.97, 0.96, 0.93]), dapple = lin([1.0, 0.9, 0.66]), nose = lin([0.25, 0.22, 0.3]), eye = lin([0.06, 0.06, 0.1]);
    b.ell([0, 1.06, 0], [0.21, 0.25, 0.52], (dx, dy, dz) => {
      const dap = dy > 0.35 && Math.abs(dx) < 0.7 && hh(Math.round(dz * 9) + 40, Math.round(dx * 7) + 9) > 0.8;
      return [dap ? dapple : dy < -0.4 ? belly : mix3(coat, coatB, ss(0.2, 0.9, dy)), dap ? 0.8 : 0];
    }, 0, 12, 16);
    b.tube([[0, 1.18, -0.38, 0.12], [0, 1.36, -0.5, 0.085], [0, 1.54, -0.58, 0.07]], () => [coat, 0], 0, 10);
    b.ell([0, 1.6, -0.66], [0.085, 0.09, 0.17], (dx, dy, dz) => [dz < -0.8 ? nose : (Math.abs(dx) > 0.75 && dy > 0.1 && dy < 0.45 && dz < -0.1 && dz > -0.45) ? eye : coat, 0], 0, 8, 12);
    for (const sd of [1, -1]) b.ell([sd * 0.1, 1.7, -0.6], [0.05, 0.022, 0.03], () => [coatB, 0], 0, 5, 7);
    b.ell([0, 1.18, 0.53], [0.05, 0.07, 0.05], () => [belly, 0], 0, 5, 7);
    // the antlers: soft branching beams, a lantern bulb at each tip
    const ant = lin([0.95, 0.88, 0.72]), bulb = lin([1.0, 0.82, 0.5]);
    for (const sd of [1, -1]) {
      const beam = [[sd * 0.05, 1.68, -0.6, 0.022], [sd * 0.12, 1.84, -0.58, 0.019], [sd * 0.19, 1.98, -0.52, 0.016], [sd * 0.22, 2.12, -0.46, 0.013], [sd * 0.2, 2.24, -0.4, 0.01]];
      b.tube(beam, () => [ant, 0.25], 0, 6);
      const tips = [beam[4], [sd * 0.3, 2.06, -0.62, 0], [sd * 0.29, 2.2, -0.36, 0]];
      b.tube([beam[2], [sd * 0.26, 2.02, -0.58, 0.01], [sd * 0.3, 2.06, -0.62, 0.008]], () => [ant, 0.25], 0, 5);
      b.tube([beam[3], [sd * 0.27, 2.16, -0.4, 0.009], [sd * 0.29, 2.2, -0.36, 0.007]], () => [ant, 0.25], 0, 5);
      for (const q of tips) b.ell([q[0], q[1] + 0.02, q[2]], [0.03, 0.036, 0.03], () => [bulb, 1], 0, 5, 7);
    }
    return b.v;
  }
  function leg() {
    const b = new B(), coat = lin([0.88, 0.9, 0.95]), hoof = lin([0.3, 0.27, 0.34]);
    b.tube([[0, 0.04, 0, 0.07], [0, -0.3, 0.015, 0.045], [0, -0.52, -0.02, 0.03], [0, -0.86, 0.0, 0.024], [0, -0.96, -0.01, 0.028]], (t) => [t > 0.86 ? hoof : coat, t > 0.6 && t < 0.86 ? 0.2 : 0], 0, 7);
    return b.v;
  }

  WM.KINDS = { wwhale: { make: whale, mode: 0, under: 1 }, wtree: { make: tree, mode: 1 }, wroot: { make: root, mode: 1 }, wdeer: { make: deer, mode: 1 }, wleg: { make: leg, mode: 1 } };
  WM.mesh = (name) => WM.KINDS[name].make();
  const WG = VR.WildGPU;
  if (WG && WG.KINDS) for (const k in WM.KINDS) if (!WG.KINDS[k]) WG.KINDS[k] = WM.KINDS[k];

  // ---------------------------------------------------------------- Very Low / Low: voxel models (1/16 block units)
  const M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (M && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const g = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(g); return { grid: g, pivot: [0, 0, 0] }; };
    // the whale's silhouette: 40 long — drawn with opts.scale (a voxel = scale / 16 m)
    M.wu_whale = () => ({
      h: 1, w: 1, radius: 20, parts: {
        body: part(14, 11, 42, [7, 5, 21], (g) => {
          for (let z = 0; z < 36; z++) { const t = z / 36, r = WM.whaleR(t) * 40 * 1.0; g.ell(7, 5, z + 0.5, Math.max(0.6, r * 1.1), Math.max(0.6, r * 0.9), 0.6, (x, y) => (y < 4 ? 0xd6d0be : y < 6 ? 0x6a7c90 : 0x34465e)); }
          for (let z = 34; z < 41; z++) { const s = Math.round((z - 33) * 0.95); g.box(Math.max(0, 7 - s), 5, z, Math.min(13, 6 + s), 5, z, 0x34465e); }
          for (let x = 0; x < 3; x++) { g.box(2 - x, 3, 10 + x, 2 - x, 3, 13 + x, 0x34465e); g.box(11 + x, 3, 10 + x, 11 + x, 3, 13 + x, 0x34465e); }
          for (let z = 8; z < 26; z += 3) { g.set(3, 3, z, 0xffd890, true); g.set(10, 3, z, 0xffd890, true); }
        }),
      },
      layout: { body: [0, 0, 0] }, order: ['body'], gait: 'none',
    });
    // the tree: a trunk, root feet, a big round crown with lantern seeds (a voxel = scale / 16 m; 24 high)
    M.wu_tree = () => ({
      h: 1, w: 1, radius: 8, parts: {
        tree: part(21, 25, 21, [10, 0, 10], (g) => {
          g.box(9, 0, 9, 11, 11, 11, 0x6a5444, { shade: 0.15 });
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; k < 5; k++) g.set(10 + dx * (k + 1), k < 3 ? 1 : 0, 10 + dz * (k + 1), 0x5e4a3c);
          g.ell(10.5, 17, 10.5, 8.5, 6.5, 8.5, (x, y, z, d) => (VR.M.hash3(x, y, z, 5) % 17 === 0 ? 0xf4d2de : y > 18 ? 0x8cae6a : 0x5e8a54), { shade: 0.12 });
          for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.set(Math.round(10.5 + Math.cos(a) * 5), 10, Math.round(10.5 + Math.sin(a) * 5), 0xffd27a, true); }
        }),
      },
      layout: { tree: [0, 0, 0] }, order: ['tree'], gait: 'none',
    });
  }
})(VR);

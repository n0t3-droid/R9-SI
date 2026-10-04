// ============================================================================
// Cockpit kit (shared — built in a worker): the furnished cockpit of a ship,
// voxel by voxel. The room the starship generator carved into the hull
// (meta.cockpit) — or, for block-built ships and the big bridges, a console in
// front of the seat — gets tread plates, an instrument panel that leans back
// toward you with three screens in bezels with soft keys, a glare shield with
// the autopilot panel and two master-caution lamps, side consoles with switch
// panels, a centre pedestal with the throttle quadrant, bucket seats with
// harnesses on rails, padded walls with grab handles, a rear bulkhead with a
// sliding door, a dark coaming where the canopy meets the hull and the canopy's
// slim frame (smooth bars just under the glass). Static detail at 1/32 m
// (1/16 m on Very Low), the moving controls at 1/64 m (1/32 m). The light is
// baked in: corner occlusion and how much sky each face sees through the glass.
// Output: greedy meshes in the game's micro-voxel vertex format plus the
// controls (pick spheres / boxes, poses), the screens and backlit legends for
// cockpit.js.
// Frame: ship metres, nose −z, x starboard, y up (as the starship generator).
// ============================================================================
(function (VR) {
  'use strict';
  const EM = 1 << 24, ON = 1 << 25;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mix = (a, b, t) => { const f = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) & 255; return (f(16) << 16) | (f(8) << 8) | f(0); };
  const shade = (c, k) => { const f = (s) => Math.min(255, Math.round(((c >> s) & 255) * k)); return (f(16) << 16) | (f(8) << 8) | f(0); };

  // ---------------------------------------------------------------- a voxel box (kit units = 1/res m) with a 1-cell air border
  class Grid {
    constructor(res, i0, j0, k0, i1, j1, k1) {
      this.res = res; this.i0 = i0; this.j0 = j0; this.k0 = k0; this.i1 = i1; this.j1 = j1; this.k1 = k1;
      this.nx = i1 - i0 + 2; this.ny = j1 - j0 + 2; this.nz = k1 - k0 + 2;
      this.c = new Uint32Array(this.nx * this.ny * this.nz);
    }
    at(i, j, k) { return ((j - this.j0 + 1) * this.nz + (k - this.k0 + 1)) * this.nx + (i - this.i0 + 1); }
    inb(i, j, k) { return i >= this.i0 && i < this.i1 && j >= this.j0 && j < this.j1 && k >= this.k0 && k < this.k1; }
    set(i, j, k, c) { if (this.inb(i, j, k)) this.c[this.at(i, j, k)] = c ? ((c & 0x1ffffff) | ON) >>> 0 : 0; }
    get(i, j, k) { return this.inb(i, j, k) ? this.c[this.at(i, j, k)] : 0; }
  }
  // a moving part: voxels around its pivot (0, 0, 0), in a map until it is meshed
  class Part {
    constructor() { this.m = new Map(); }
    set(x, y, z, c) { this.m.set(((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512), c); return this; }
    box(x0, y0, z0, x1, y1, z1, c) { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const v = typeof c === 'function' ? c(x, y, z) : c; if (v !== null && v !== undefined) this.set(x, y, z, v); } return this; }
    grid(res) {
      let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; const L = [];
      for (const [k, c] of this.m) { const z = (k % 1024) - 512, y = (Math.floor(k / 1024) % 1024) - 512, x = Math.floor(k / 1048576) - 512; L.push(x, y, z, c); a = [Math.min(a[0], x), Math.min(a[1], y), Math.min(a[2], z)]; b = [Math.max(b[0], x), Math.max(b[1], y), Math.max(b[2], z)]; }
      if (!L.length) return null;
      const G = new Grid(res, a[0], a[1], a[2], b[0] + 1, b[1] + 1, b[2] + 1);
      for (let n = 0; n < L.length; n += 4) G.set(L[n], L[n + 1], L[n + 2], L[n + 3]);
      return G;
    }
  }

  // ---------------------------------------------------------------- greedy mesher (typed, no bounds checks thanks to the border)
  // vertex: float32 x y z (kit units) · int8 normal · uint8 rgb + emissive — the same layout as VR.meshVoxGrid
  const AOK = [1.0, 0.8, 0.66, 0.54], SHADEF = [0.9, 0.9, 1.0, 0.72, 0.95, 0.95];
  const FAX = [[0, 2, 1, 1], [0, 1, 2, -1], [1, 0, 2, 1], [1, 2, 0, -1], [2, 1, 0, 1], [2, 0, 1, -1]];
  const LTK = []; for (let n = 0; n < 16; n++) LTK.push(0.34 + 0.66 * Math.pow(n / 15, 0.8));
  // which: 0 = everything, 1 = only lit voxels (non-emissive), 2 = only emissive; light(i, j, k) → 0..15 sky the air cell sees
  function mesh(G, which, light) {
    const nx = G.nx, ny = G.ny, nz = G.nz, c = G.c, dims = [nx, ny, nz], str = [1, nx * nz, nx], org = [G.i0 - 1, G.j0 - 1, G.k0 - 1];
    let cap = 2048, f32 = new Float32Array(cap * 5), u8 = new Uint8Array(f32.buffer), i8 = new Int8Array(f32.buffer), n = 0;
    const emit = (x, y, z, a, s, r, g, b, e) => {
      if (n >= cap) { cap *= 2; const o = new Float32Array(cap * 5); o.set(f32); f32 = o; u8 = new Uint8Array(f32.buffer); i8 = new Int8Array(f32.buffer); }
      const o = n * 5, ob = n * 20;
      f32[o] = x; f32[o + 1] = y; f32[o + 2] = z;
      i8[ob + 12] = a === 0 ? s * 127 : 0; i8[ob + 13] = a === 1 ? s * 127 : 0; i8[ob + 14] = a === 2 ? s * 127 : 0; i8[ob + 15] = 0;
      u8[ob + 16] = r; u8[ob + 17] = g; u8[ob + 18] = b; u8[ob + 19] = e; n++;
    };
    const P = [0, 0, 0], Cn = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let f = 0; f < 6; f++) {
      const na = FAX[f][0], ua = FAX[f][1], va = FAX[f][2], sg = FAX[f][3];
      const U = dims[ua], V = dims[va], W = dims[na], sN = str[na] * sg, sU = str[ua], sV = str[va], sW = str[na];
      const keys = new Float64Array(U * V), aos = new Uint8Array(U * V), cols = new Uint32Array(U * V), lts = new Uint8Array(U * V);
      const cross = ((ua + 1) % 3 === va) ? 1 : -1, flipW = cross * sg < 0, kf = SHADEF[f];
      for (let w = 1; w < W - 1; w++) {
        let any = false;
        for (let v = 1; v < V - 1; v++) {
          let p = w * sW + v * sV + sU, m = v * U + 1;
          for (let u = 1; u < U - 1; u++, p += sU, m++) {
            keys[m] = 0;
            const cc = c[p]; if (!cc) continue;
            const em = cc & EM;
            if ((which === 1 && em) || (which === 2 && !em)) continue;
            const q = p + sN; if (c[q]) continue;
            let ao = 0, lt = 15;
            if (!em) {
              const um = c[q - sU] ? 1 : 0, up = c[q + sU] ? 1 : 0, vm = c[q - sV] ? 1 : 0, vp = c[q + sV] ? 1 : 0;
              ao = (um && vm ? 3 : um + vm + (c[q - sU - sV] ? 1 : 0)) | ((up && vm ? 3 : up + vm + (c[q + sU - sV] ? 1 : 0)) << 2) |
                ((up && vp ? 3 : up + vp + (c[q + sU + sV] ? 1 : 0)) << 4) | ((um && vp ? 3 : um + vp + (c[q - sU + sV] ? 1 : 0)) << 6);
              if (light) { P[na] = w + sg; P[ua] = u; P[va] = v; lt = light(P[0] + org[0], P[1] + org[1], P[2] + org[2]); }
            }
            keys[m] = ((cc & 0x1ffffff) * 256 + ao) * 16 + lt + 1; aos[m] = ao; cols[m] = cc; lts[m] = lt; any = true;
          }
        }
        if (!any) continue;
        const plane = (sg > 0 ? w + 1 : w) + org[na];
        for (let v = 1; v < V - 1; v++) for (let u = 1; u < U - 1;) {
          const m = v * U + u, k = keys[m];
          if (!k) { u++; continue; }
          let wd = 1, ht = 1;
          while (u + wd < U - 1 && keys[m + wd] === k) wd++;
          outer: while (v + ht < V - 1) { for (let t = 0; t < wd; t++) if (keys[(v + ht) * U + u + t] !== k) break outer; ht++; }
          for (let dv = 0; dv < ht; dv++) for (let du = 0; du < wd; du++) keys[(v + dv) * U + u + du] = 0;
          const cc = cols[m], ao = aos[m], em = (cc & EM) ? 255 : 0, lk = em ? 1 : LTK[lts[m]];
          const r0 = (cc >> 16) & 255, g0 = (cc >> 8) & 255, b0 = cc & 255;
          const u0 = u + org[ua], v0 = v + org[va];
          const cu = [u0, u0 + wd, u0 + wd, u0], cv = [v0, v0, v0 + ht, v0 + ht];
          for (let t = 0; t < 4; t++) { const C = Cn[t]; C[na] = plane; C[ua] = cu[t]; C[va] = cv[t]; }
          const A = [ao & 3, (ao >> 2) & 3, (ao >> 4) & 3, (ao >> 6) & 3];
          let tri = A[0] + A[2] > A[1] + A[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
          if (flipW) tri = [tri[0], tri[2], tri[1], tri[3], tri[5], tri[4]];
          for (const t of tri) { const k2 = kf * (em ? 1 : AOK[A[t]]) * lk, C = Cn[t]; emit(C[0], C[1], C[2], na, sg, Math.min(255, r0 * k2), Math.min(255, g0 * k2), Math.min(255, b0 * k2), em); }
          u += wd;
        }
      }
    }
    return { data: new Uint8Array(f32.buffer, 0, n * 20).slice(), count: n };
  }

  // ---------------------------------------------------------------- baked sky: rays up and at 45° / 63° through a coarse copy
  // of the kit (a coarse cell is solid when any voxel in it is); a ray that leaves the box below the canopy's rim ran into
  // the hull (dark), above it into the glass (sky). → light(i, j, k) for the mesher, 0…15
  // o: { cell (m, default 1/8), levels (default 8) } — coarser for big rooms: fewer light steps, fewer triangles
  function skyField(G, rimY, open, clearY, o) {
    const f = Math.max(1, Math.round(G.res * ((o && o.cell) || 0.125))), R = G.res / f, nl = (o && o.levels) || 8;
    const a0 = Math.floor(G.i0 / f), b0 = Math.floor(G.j0 / f), c0 = Math.floor(G.k0 / f);
    const X = Math.floor((G.i1 - 1) / f) - a0 + 1, Y = Math.floor((G.j1 - 1) / f) - b0 + 1, Z = Math.floor((G.k1 - 1) / f) - c0 + 1;
    const occ = new Uint8Array(X * Y * Z), memo = new Int8Array(X * Y * Z).fill(-1);
    for (let j = G.j0; j < G.j1; j++) for (let k = G.k0; k < G.k1; k++) { let p = G.at(G.i0, j, k); for (let i = G.i0; i < G.i1; i++, p++) if (G.c[p]) occ[((Math.floor(j / f) - b0) * Z + (Math.floor(k / f) - c0)) * X + (Math.floor(i / f) - a0)] = 1; }
    const rimC = rimY * R - b0, clearC = clearY === undefined ? 1e9 : clearY * R - b0;
    const D = [[0, 1, 0, 1]];
    for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; D.push([Math.cos(t), 1, Math.sin(t), 0.7]); }
    for (let a = 0; a < 4; a++) { const t = a * Math.PI / 2 + Math.PI / 4; D.push([Math.cos(t) * 0.5, 1, Math.sin(t) * 0.5, 0.85]); }
    for (const d of D) { const L = Math.hypot(d[0], d[1], d[2]); d[0] /= L; d[1] /= L; d[2] /= L; }
    const tot = D.reduce((s, d) => s + d[3], 0);
    return (i, j, k) => {
      const a = Math.floor(i / f) - a0, b = Math.floor(j / f) - b0, cc = Math.floor(k / f) - c0;
      if (a < 0 || b < 0 || cc < 0 || a >= X || b >= Y || cc >= Z || b > clearC) return 15;
      const n = (b * Z + cc) * X + a; if (memo[n] >= 0) return memo[n];
      let lit = 0;
      for (const d of D) {
        let x = a + 0.5, y = b + 0.5, z = cc + 0.5, hit = false;
        for (let s = 0; s < 30; s++) {
          x += d[0]; y += d[1]; z += d[2];
          const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
          if (xi < 0 || yi < 0 || zi < 0 || xi >= X || yi >= Y || zi >= Z) { hit = !open && y < rimC && yi < Y; break; }
          if (occ[(yi * Z + zi) * X + xi]) { hit = true; break; }
        }
        if (!hit) lit += d[3];
      }
      return (memo[n] = nl === 8 ? Math.round(7 * lit / tot) * 2 + 1 : Math.round(Math.round((nl - 1) * lit / tot) * 14 / (nl - 1)) + 1);
    };
  }

  // ---------------------------------------------------------------- smooth square tubes (the canopy frame)
  // paths: [{ p: [[x, y, z]…] (metres), n: [[x, y, z]…] (the glass's outward normal there), w, h, col }] → mesh in kit units
  function tubes(paths, res) {
    const V = [];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const quad = (A, B, Cc, D, n, col, em) => {
      // wind it so it faces along n (the voxel meshes' front faces)
      const g = cross([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]]);
      const q = g[0] * n[0] + g[1] * n[1] + g[2] * n[2] >= 0 ? [A, B, Cc, A, Cc, D] : [A, Cc, B, A, D, Cc];
      const k = em ? 1 : 0.72 + 0.28 * (n[1] * 0.5 + 0.5), r = Math.min(255, ((col >> 16) & 255) * k), gg = Math.min(255, ((col >> 8) & 255) * k), b = Math.min(255, (col & 255) * k);
      for (const P of q) V.push(P[0] * res, P[1] * res, P[2] * res, n[0], n[1], n[2], r, gg, b, em ? 255 : 0);
    };
    for (const T of paths) {
      const P = T.p, N = T.n, L = P.length, lp = !!T.loop; if (L < 2) continue;
      const ring = [];
      for (let i = 0; i < L; i++) {
        const a = lp ? P[(i + L - 1) % L] : P[Math.max(0, i - 1)], b = lp ? P[(i + 1) % L] : P[Math.min(L - 1, i + 1)], t = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
        const sd = nrm(cross(t, N[i])), up = cross(sd, t), w = T.w / 2, h = T.h / 2, c = P[i];
        const at = (s1, s2) => [c[0] + sd[0] * w * s1 + up[0] * h * s2, c[1] + sd[1] * w * s1 + up[1] * h * s2, c[2] + sd[2] * w * s1 + up[2] * h * s2];
        ring.push({ q: [at(1, 1), at(-1, 1), at(-1, -1), at(1, -1)], up, sd, t });
      }
      for (let i = 0; i < (lp ? L : L - 1); i++) {
        const A = ring[i], B = ring[(i + 1) % L], avg = (u, v) => nrm([u[0] + v[0], u[1] + v[1], u[2] + v[2]]);
        const up = avg(A.up, B.up), sd = avg(A.sd, B.sd);
        const sides = [[0, 1, up], [1, 2, [-sd[0], -sd[1], -sd[2]]], [2, 3, [-up[0], -up[1], -up[2]]], [3, 0, sd]];
        for (const [s0, s1, n] of sides) if (s0 || !T.open) quad(A.q[s0], A.q[s1], B.q[s1], B.q[s0], n, T.col, T.em);
      }
      const e0 = ring[0], e1 = ring[L - 1];
      if (!T.loop) { quad(e0.q[0], e0.q[1], e0.q[2], e0.q[3], [-e0.t[0], -e0.t[1], -e0.t[2]], T.col, T.em); quad(e1.q[0], e1.q[1], e1.q[2], e1.q[3], e1.t, T.col, T.em); }
    }
    const n = V.length / 10, buf = new ArrayBuffer(n * 20), f32 = new Float32Array(buf), i8 = new Int8Array(buf), u8 = new Uint8Array(buf);
    for (let i = 0; i < n; i++) {
      const o = i * 10;
      f32[i * 5] = V[o]; f32[i * 5 + 1] = V[o + 1]; f32[i * 5 + 2] = V[o + 2];
      i8[i * 20 + 12] = Math.round(V[o + 3] * 127); i8[i * 20 + 13] = Math.round(V[o + 4] * 127); i8[i * 20 + 14] = Math.round(V[o + 5] * 127);
      u8[i * 20 + 16] = V[o + 6]; u8[i * 20 + 17] = V[o + 7]; u8[i * 20 + 18] = V[o + 8]; u8[i * 20 + 19] = V[o + 9];
    }
    return { data: new Uint8Array(buf), count: n };
  }
  const joinMesh = (a, b) => { if (!b || !b.count) return a; const d = new Uint8Array(a.data.length + b.data.length); d.set(a.data, 0); d.set(b.data, a.data.length); return { data: d, count: a.count + b.count }; };

  // ---------------------------------------------------------------- the build
  // C: the room (ship metres): hw, floor, rim, zNose, zf, zb, seats [[x, z]…], eye, top, roof {x0, z0, step, nx, nz, h}
  // pal: the ship's palette (hex colours) or null · res: static detail per metre (32, Very Low 16) · o.console: dash only
  function build(C, pal, res, o) {
    o = o || {};
    const solo = !!o.console, pr = res * 2, v = 1 / res, I = (m) => Math.floor(m * res + 1e-6), ctr = (i) => (i + 0.5) / res;
    const two = C.seats.length > 1, px = C.seats[0][0], sz = C.seats[0][1];
    const F0 = C.floor, F = F0 + 0.0625, hw = C.hw, zf = C.zf, zb = C.zb, rim = C.rim, E = C.eye, ey = E[1], ez = E[2];
    const P = pal || {};
    const acc = P.acc !== undefined ? P.acc : 0xf07a1e, glow = P.glow !== undefined ? P.glow : 0x5af4ff, hull2 = P.hull2 !== undefined ? P.hull2 : 0xc3c9d3, trim = P.trim !== undefined ? P.trim : 0x3a3f4b;
    const K = {
      deck: 0x2a2e34, deck2: 0x33373e, seam: 0x17191c, walk: 0x3b4048,
      panel: 0x2f343c, panel2: 0x272b31, face: 0x353a43, edge: 0x4b525c, bezel: 0x141619, black: 0x06070a, key: 0x8e98a4, screw: 0x9aa2ad,
      shield: 0x1c1e22, coam: 0x1b1d21, vent: 0x0f1013,
      wall: shade(hull2, 0.74), wall2: shade(hull2, 0.64), wallSeam: shade(hull2, 0.46),
      frame: mix(0x6b727d, trim, 0.2), frame2: 0x58606a,
      shell: shade(hull2, 0.55), cushion: 0x30343b, cushion2: 0x393e46, bolster: 0x24272c,
      metal: 0xa3abb5, metal2: 0x6b737e, rail: 0x3f454e, dark: 0x1b1d21,
      red: 0xc42a22, yellow: 0xe8b41e, green: 0x1f8a46, blue: 0x2a5d9c,
      acc, acc2: shade(acc, 0.7), glow, glowDim: shade(glow, 0.5), legend: 0xd8eeff, amber: 0xffb347,
    };
    // ---- the canopy's inner surface: the generator's 0.25 m height map, smoothed twice, read bilinearly
    const RF = C.roof && C.roof.nx ? C.roof : null;
    let H = null;
    if (RF) {
      H = Float32Array.from(RF.h);
      for (let pass = 0; pass < 2; pass++) {
        const o2 = new Float32Array(H.length);
        for (let c = 0; c < RF.nz; c++) for (let a = 0; a < RF.nx; a++) {
          const n0 = c * RF.nx + a; if (!H[n0]) continue;
          let s = 0, w = 0;
          for (let dc = -1; dc <= 1; dc++) for (let da = -1; da <= 1; da++) { const aa = a + da, cc = c + dc; if (aa < 0 || cc < 0 || aa >= RF.nx || cc >= RF.nz) continue; const q = H[cc * RF.nx + aa]; if (q) { s += q; w++; } }
          o2[n0] = s / w;
        }
        H = o2;
      }
    }
    const roofAt = (x, z) => {
      if (!H) return 0;
      const fa = (x - RF.x0) / RF.step - 0.5, fc = (z - RF.z0) / RF.step - 0.5, a = Math.floor(fa), c = Math.floor(fc), u = fa - a, w = fc - c;
      let s = 0, ws = 0;
      for (const [da, dc, k] of [[0, 0, (1 - u) * (1 - w)], [1, 0, u * (1 - w)], [0, 1, (1 - u) * w], [1, 1, u * w]]) {
        const aa = a + da, cc = c + dc; if (aa < 0 || cc < 0 || aa >= RF.nx || cc >= RF.nz) continue;
        const h = H[cc * RF.nx + aa]; if (h) { s += h * k; ws += k; }
      }
      return ws > 0.3 ? s / ws : 0;
    };
    // ---- the box the static voxels live in
    let gx = hw + 0.1;
    if (!solo && RF) for (let a = 0; a < RF.nx; a++) for (let c = 0; c < RF.nz; c++) if (RF.h[c * RF.nx + a]) gx = Math.max(gx, Math.abs(RF.x0 + (a + 0.5) * RF.step) + RF.step * 0.5);
    gx = Math.min(gx, hw + 1.6);
    const dashTop = ey - 0.3, shBot = dashTop - 0.075, pBot = F + 0.28, faceTopZ = ez - 0.8, tilt = 0.3;
    const yLo = solo ? pBot - 0.2 : F0 - 0.05, yHi = solo ? ey - 0.02 : (C.top || rim + 2) + 0.05, zLo = solo ? zf - 0.05 : Math.min(C.zNose, zf) - 0.05, zHi = solo ? sz - 0.05 : zb + 0.05;
    const S = new Grid(res, I(-gx) - 1, I(yLo), I(zLo), I(gx) + 2, I(yHi) + 1, I(zHi) + 1);
    const put = (i, j, k, c) => S.set(i, j, k, c);
    const box = (x0, y0, z0, x1, y1, z1, col) => {
      const i0 = I(x0), i1 = I(x1), j0 = I(y0), j1 = I(y1), k0 = I(z0), k1 = I(z1), fn = typeof col === 'function';
      for (let j = j0; j < j1; j++) for (let k = k0; k < k1; k++) for (let i = i0; i < i1; i++) { const c = fn ? col(ctr(i), ctr(j), ctr(k), i, j, k) : col; if (c !== null && c !== undefined) put(i, j, k, c); }
    };
    // a square bar from a to b (metres), half thickness r
    const seg = (a, b, r, col) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(L * res * 2)), rr = Math.max(0.5, r * res);
      for (let t = 0; t <= n; t++) {
        const x = (a[0] + (b[0] - a[0]) * t / n) * res, y = (a[1] + (b[1] - a[1]) * t / n) * res, z = (a[2] + (b[2] - a[2]) * t / n) * res;
        for (let j = Math.round(y - rr); j < Math.round(y + rr); j++) for (let k = Math.round(z - rr); k < Math.round(z + rr); k++) for (let i = Math.round(x - rr); i < Math.round(x + rr); i++) put(i, j, k, typeof col === 'function' ? col(t / n) : col);
      }
    };
    const screens = [], labels = [], controls = [], parts = {}, frame = [];
    let doorInfo = null;
    const label = (t, c, r, u, h) => labels.push({ t, c, r, u, h: h || 0.022 });
    const UP = [0, 1, 0], RIGHT = [1, 0, 0];
    // a legend on a horizontal console top, read from the seat (text runs along +x, its top toward −z)
    const flatLabel = (t, x, y, z, h) => label(t, [x, y + 0.004, z], RIGHT, [0, 0, -1], h);

    // ================================================================ the room
    const conW = two ? 0.3 : Math.max(0.12, hw - 0.27), conTop = F + 0.66;
    const wing = () => 0;
    const faceZ = (x, y) => faceTopZ + (shBot - y) * tilt + wing(x);
    // the glare shield's front edge: it bulges out over each pilot's screen
    const lipZ = (x) => { let k = 0.045; for (const [sx2] of C.seats) k = Math.max(k, 0.045 + 0.035 * Math.max(0, 1 - ((x - sx2) / 0.42) ** 2)); return faceZ(x, shBot) + k - (Math.abs(x) > hw - 0.1 ? (Math.abs(x) - hw + 0.1) * 0.8 : 0); };
    const FUP = [0, 1 / Math.hypot(1, tilt), -tilt / Math.hypot(1, tilt)];   // up along the leaning panel face
    const conZ1 = solo ? ez + 0.05 : sz + 0.42, MCPZ = lipZ(0) + 0.045, MCPY = (shBot + dashTop) / 2 - 0.004;
    if (!solo) {
      // deck: 0.5 m plates with seams, a lighter walkway down the middle, light strips along the walls
      box(-hw, F0, zf, hw, F, zb, (x, y, z) => {
        const tx = (x + 50.25) % 0.5, tz = (z + 50) % 0.5;
        if (tx < v || tz < v) return K.seam;
        return Math.abs(x) < (two ? 0.26 : 0.18) && z > sz + 0.3 ? K.walk : K.deck;
      });
      for (const s of [-1, 1]) box(s < 0 ? -hw + v : hw - 2 * v, F, conZ1, s < 0 ? -hw + 2 * v : hw - v, F + v, zb - 0.05, K.glowDim | EM);
      // the coaming: wherever there is glass overhead outside the room (the nose ahead of the panel, the shelves beside
      // the room) the hull's top gets a dark matte cover, with defrost slots along the windscreen's foot
      if (RF) {
        for (let k = I(C.zNose - 0.3); k < I(zb + 0.02); k++) for (let i = I(-gx); i < I(gx); i++) {
          const x = ctr(i), z = ctr(k), inRoom = Math.abs(x) < hw && z >= zf;
          if (inRoom || !roofAt(x, z)) continue;
          const vent = !roofAt(x, z - 0.1) && roofAt(x, z - 0.05) > 0 && Math.abs(x) < hw;
          for (let j = I(rim - v); j < I(rim + v); j++) put(i, j, k, vent ? K.vent : K.coam);
        }
        // the sill rail along the room's top edge
        for (const s of [-1, 1]) box(s < 0 ? -hw : hw - 2 * v, rim - 2 * v, zf, s < 0 ? -hw + 2 * v : hw, rim + 2 * v, zb, K.frame2);
      }
    }

    // ================================================================ the instrument panel
    {
      const x0 = -hw, x1 = hw, kneeZ = (x) => faceZ(x, pBot) - 0.14;
      for (let j = I(solo ? pBot - 0.12 : F); j < I(shBot); j++) for (let i = I(x0); i < I(x1); i++) {
        const x = ctr(i), y = ctr(j), zFace = y < pBot ? kneeZ(x) : faceZ(x, y), kf = I(zFace) - 1;
        for (let k = I(solo ? zFace - 0.1 : zf); k <= kf; k++) {
          let c = K.panel2;
          if (k === kf) {
            if (y < pBot) c = K.panel2;
            else {
              // sub-panels: a seam every 0.4 m across, one along the lower row; screws at the corners
              const sx = (x + 50.2) % 0.4, sy = y - pBot;
              c = (sx < v || Math.abs(sy - 0.17) < v * 0.5) ? K.edge : K.face;
              if ((sx > v && sx < 2 * v) && (Math.abs(sy - 0.04) < v * 0.5 || Math.abs(sy - (shBot - pBot - 0.04)) < v * 0.5)) c = K.screw;
            }
          }
          put(i, j, k, c);
        }
      }
      // rudder pedals in each footwell
      if (!solo) for (const [sx2] of C.seats) for (const s of [-1, 1]) {
        const x = sx2 + s * 0.11, z = kneeZ(x) + 0.12;
        box(x - 0.045, F + 0.06, z, x + 0.045, F + 0.2, z + 2 * v, K.metal2);
        box(x - 0.045, F + 0.06, z + 2 * v, x + 0.045, F + 0.08, z + 0.1, K.rail);
      }
      // glare shield: a padded overhang that bulges out over each pilot's screen, a flood strip under its lip
      for (let i = I(x0); i < I(x1); i++) {
        const x = ctr(i), zl = lipZ(x);
        for (let j = I(shBot); j < I(dashTop); j++) for (let k = I(zf); k < I(zl); k++) {
          if (k === I(zl) - 1 && (j === I(shBot) || j === I(dashTop) - 1)) continue;      // rounded lip
          put(i, j, k, K.shield);
        }
      }
      // the autopilot panel (centre of the shield) and the HUD combiner frame in front of the pilot
      const mcpW = two ? 0.25 : Math.min(0.17, hw * 0.4), mcpZ = MCPZ, dX0 = mcpW * 0.12, dW = mcpW * 0.72, mY = MCPY;
      box(-mcpW, shBot - 0.012, faceZ(0, shBot), mcpW, dashTop, mcpZ, (x, y, z, i, j, k) => (k === I(mcpZ) - 1 ? (Math.abs(y - mY) < 0.022 && x > dX0 - 0.012 && x < dX0 + dW + 0.012 ? K.bezel : K.panel) : K.panel2));
      screens.push({ tile: 3, c: [dX0 + dW / 2, mY, mcpZ + 0.002], r: RIGHT, u: UP, w: dW, h: 0.032 });
      for (const kx of [-mcpW * 0.22, -mcpW * 0.02]) { const i = I(kx), j = I(mY); put(i, j, I(mcpZ), K.metal2); put(i, j, I(mcpZ) + 1, K.metal); }
      label('AUTOPILOT', [-mcpW * 0.6, dashTop + 0.004, (mcpZ + faceZ(0, shBot)) / 2], RIGHT, [0, 0, -1], 0.014);
      // the HUD projector on the shield in front of the pilot
      const hx = px, hz = faceZ(hx, shBot) + 0.02;
      box(hx - 0.06, dashTop, hz - 0.1, hx + 0.06, dashTop + 0.03, hz, K.bezel);
      box(hx - 0.03, dashTop + 0.03, hz - 0.075, hx + 0.03, dashTop + 0.03 + v, hz - 0.035, 0x1d3a44);
      // the three screens in their bezels, with four soft keys on either side
      const bw = 0.03, scrW = two ? 0.34 : Math.min(0.26, hw * 0.55), scrH = 0.23, sideW = two ? scrW : clamp(hw - 0.12 - scrW / 2 - 2 * bw - 0.01, 0.08, 0.15);
      const scrY = shBot - 0.045 - scrH / 2, sideX = scrW / 2 + 2 * bw + 0.01 + sideW / 2;
      const SX = two ? [px, 0, -px] : [0, -sideX, sideX];
      SX.forEach((cx, n) => {
        const w = n === 0 || two ? scrW : sideW, h = n === 0 || two ? scrH : scrH * 0.8, cy = n === 0 || two ? scrY : scrY + scrH * 0.1;
        const keyW = two ? 0.045 : 0;
        for (let j = I(cy - h / 2 - bw); j < I(cy + h / 2 + bw); j++) for (let i = I(cx - w / 2 - bw - keyW); i < I(cx + w / 2 + bw + keyW); i++) {
          const x = ctr(i), y = ctr(j), kz = I(faceZ(x, y)), ins = Math.abs(x - cx) < w / 2 && Math.abs(y - cy) < h / 2;
          if (ins) { put(i, j, kz - 1, K.black); continue; }
          const inBezel = Math.abs(x - cx) < w / 2 + bw;
          if (inBezel) { put(i, j, kz, K.bezel); if (Math.abs(x - cx) > w / 2 + bw - v && Math.abs(y - cy) < h / 2 + bw - v) put(i, j, kz, K.edge); continue; }
          // soft keys
          const ky = (y - (cy - h / 2)) / h * 4;
          if (ky > 0.15 && ky < 3.85 && (ky % 1) > 0.22 && (ky % 1) < 0.78 && Math.abs(Math.abs(x - cx) - (w / 2 + bw + keyW / 2)) < keyW * 0.32) { put(i, j, kz, K.key); }
        }
        const zA = faceZ(cx, cy - h / 2), zB = faceZ(cx, cy + h / 2), ul = Math.hypot(h, zB - zA);
        screens.push({ tile: n, c: [cx, cy, (zA + zB) / 2 + 0.003], r: RIGHT, u: [0, h / ul, (zB - zA) / ul], w, h });
      });
      // the lower row: gear lever (pilot side), standby clock and two decorative switches (co-pilot side)
      if (two) {
        const cx = -px * 0.5, cy = pBot + 0.085;
        for (let j = I(cy - 0.05); j < I(cy + 0.05); j++) for (let i = I(cx - 0.05); i < I(cx + 0.05); i++) { const x = ctr(i), y = ctr(j); if (Math.hypot(x - cx, y - cy) < 0.048) put(i, j, I(faceZ(x, y)), Math.hypot(x - cx, y - cy) > 0.04 ? K.edge : K.black); }
        screens.push({ tile: 4, c: [cx, cy, faceZ(cx, cy) + 0.003], r: RIGHT, u: [0, 1 / Math.hypot(1, tilt), -tilt / Math.hypot(1, tilt)], w: 0.07, h: 0.07 });
      }
    }

    // ================================================================ consoles & pedestal
    const conX = (s) => s * (hw - conW / 2);
    for (const s of [-1, 1]) {
      const xa = s < 0 ? -hw : hw - conW, xb = s < 0 ? -hw + conW : hw, zc0 = faceZ(s * (hw - 0.02), conTop) - 0.05;
      const yb = solo ? conTop - 0.1 : F;
      for (let k = I(zc0); k < I(conZ1); k++) {
        const z = ctr(k), front = clamp((zc0 + 0.15 - z) / 0.15, 0, 1), top = conTop + front * 0.05;   // the front rises toward the panel
        for (let j = I(yb); j < I(top); j++) for (let i = I(xa); i < I(xb); i++) {
          const x = ctr(i), y = ctr(j), inner = s < 0 ? x > xb - v : x < xa + v, topL = j === I(top) - 1;
          let c = inner ? K.panel2 : K.panel2;
          if (topL) c = Math.abs(x - (xa + xb) / 2) > conW / 2 - v ? K.edge : K.panel;
          if (inner && !topL && Math.abs(y - (F + 0.12)) < v * 0.5 && !solo) c = K.vent;
          put(i, j, k, c);
        }
      }
      // a padded arm rest behind the switch panels
      if (!solo) box(xa + 0.03, conTop, sz - 0.05, xb - 0.03, conTop + 0.05, conZ1 - 0.03, (x, y, z, i, j, k) => (j === I(conTop + 0.05) - 1 && Math.abs(x - (xa + xb) / 2) < conW / 2 - 0.05 ? K.cushion2 : K.cushion));
    }
    let ped = null;
    if (two) {
      const pz0 = faceZ(0, F + 0.4) - 0.04, pz1 = solo ? ez - 0.05 : sz + 0.06, pw = 0.17;
      // (low and flat where it meets the panel — under the centre screen — a short slope, then flat at hand height)
      const pTop = (z) => F + 0.42 + clamp((z - pz0 - 0.2) / 0.12, 0, 1) * 0.18;
      for (let k = I(pz0); k < I(pz1); k++) {
        const z = ctr(k), top = pTop(z);
        for (let j = I(solo ? top - 0.12 : F); j < I(top); j++) for (let i = I(-pw); i < I(pw); i++) {
          const x = ctr(i), y = ctr(j), topL = j === I(top) - 1;
          put(i, j, k, topL ? (Math.abs(x) > pw - v ? K.edge : K.panel) : (Math.abs(x) > pw - v && Math.abs(y - (F + 0.12)) < v * 0.5 ? K.vent : K.panel2));
        }
      }
      ped = { z0: pz0, z1: pz1, top: pTop, w: pw };
    }

    // ================================================================ seats
    if (!solo) for (const [sx2, sz2] of C.seats) {
      const W2 = two ? 0.27 : Math.min(0.27, hw - 0.02), pan = F + 0.46, back0 = sz2 + 0.2;
      for (const s of [-1, 1]) box(sx2 + s * 0.15 - v, F, sz2 - 0.38, sx2 + s * 0.15 + v, F + 2 * v, sz2 + 0.38, K.rail);
      box(sx2 - 0.12, F, sz2 - 0.12, sx2 + 0.12, pan - 0.12, sz2 + 0.14, K.metal2);
      // seat pan with bolsters (the front edge rolls down)
      box(sx2 - W2, pan - 0.12, sz2 - 0.3, sx2 + W2, pan + 0.06, back0, (x, y, z) => {
        const side = Math.abs(x - sx2) > W2 - 0.07, front = z < sz2 - 0.26;
        if (y > pan && !side) return null;
        if (y > pan - 0.02 && front && !side) return null;
        if (y < pan - 0.06) return K.shell;
        return side ? (y > pan + 0.03 && Math.abs(x - sx2) > W2 - 0.035 ? K.acc2 : K.bolster) : (((z - sz2 + 5) % 0.09) < v ? K.cushion2 : K.cushion);
      });
      // backrest: reclined, side bolsters, a seam down the middle, the shell behind
      for (let j = I(pan - 0.04); j < I(F + 1.18); j++) {
        const y = ctr(j), zb0 = back0 + (y - pan) * 0.22, bol = y > pan + 0.12 && y < F + 1.0;
        for (let i = I(sx2 - W2); i < I(sx2 + W2); i++) {
          const x = ctr(i), side = Math.abs(x - sx2) > W2 - 0.07;
          const zFront = zb0 - (side && bol ? 0.07 : 0);
          for (let k = I(zFront); k < I(zb0 + 0.13); k++) {
            const z = ctr(k), shellL = z > zb0 + 0.07;
            put(i, j, k, shellL ? K.shell : side ? (bol && Math.abs(x - sx2) > W2 - 0.035 && k === I(zFront) ? K.acc2 : K.bolster) : (((y - pan + 5) % 0.12) < v ? K.cushion2 : K.cushion));
          }
        }
      }
      // headrest
      const hy0 = F + 1.21, hz = back0 + (hy0 - pan) * 0.22 - 0.02;
      box(sx2 - 0.13, hy0, hz, sx2 + 0.13, hy0 + 0.22, hz + 0.12, (x, y, z) => (z > hz + 0.08 ? K.shell : K.cushion));
      for (const s of [-1, 1]) box(sx2 + s * 0.07 - v, F + 1.16, hz + 0.06, sx2 + s * 0.07 + v, hy0, hz + 0.09, K.metal2);
      // four-point harness in the ship's accent colour, lying on the cushions: shoulder straps down the backrest, lap belts
      // across the seat to a round buckle
      for (const s of [-1, 1]) {
        for (let j = I(pan + 0.02); j < I(F + 1.17); j++) { const y = ctr(j), zf2 = back0 + (y - pan) * 0.22; for (let i = I(sx2 + s * 0.075 - 0.022); i < I(sx2 + s * 0.075 + 0.022); i++) put(i, j, I(zf2) - 1, K.acc); }
        box(Math.min(sx2 + s * (W2 - 0.08), sx2 + s * 0.03), pan, sz2 - 0.06, Math.max(sx2 + s * (W2 - 0.08), sx2 + s * 0.03), pan + v, sz2 - 0.02, K.acc);
      }
      box(sx2 - 0.035, pan, sz2 - 0.08, sx2 + 0.035, pan + 0.03, sz2, K.metal);
    }

    // ================================================================ walls & the rear bulkhead
    if (!solo) {
      for (const s of [-1, 1]) {
        box(s < 0 ? -hw : hw - v, F, conZ1, s < 0 ? -hw + v : hw, rim - v, zb, (x, y, z) => {
          const sz3 = ((z + 50) % 0.42), sy = y - F;
          if (sz3 < v || Math.abs(sy - 0.42) < v * 0.5) return K.wallSeam;
          return sy > 0.42 ? K.wall : K.wall2;
        });
        // grab handle
        const hzz = (conZ1 + zb) / 2;
        seg([s * (hw - 0.05), rim - 0.12, hzz - 0.16], [s * (hw - 0.05), rim - 0.12, hzz + 0.16], 0.018, K.acc);
        for (const dz of [-0.16, 0.16]) seg([s * (hw - v), rim - 0.12, hzz + dz], [s * (hw - 0.05), rim - 0.12, hzz + dz], 0.018, K.metal2);
      }
      const doorW = two ? 0.7 : 0.48, rf0 = roofAt(0, zb - 0.05) || rim + 0.9, doorH = clamp(rf0 - F - 0.1, 1.1, 1.92);
      for (let j = I(F); j < I(F + 3.2); j++) for (let i = I(-hw); i < I(hw); i++) {
        const x = ctr(i), y = ctr(j), rf = roofAt(x, zb - 0.1);
        if (rf ? y > rf : y > rim) continue;
        const ax = Math.abs(x), inDoor = ax < doorW / 2 && y < F + doorH, edge = !inDoor && ax < doorW / 2 + 2 * v && y < F + doorH + 2 * v;
        if (inDoor) continue;   // the opening: its leaf is a part (it slides along the wall)
        let c = y < F + 0.08 ? K.wallSeam : (ax > doorW / 2 + 0.25 && ((x + 50) % 0.5) < v) ? K.wallSeam : K.wall;
        if (edge) c = (ax > doorW / 2 + v || y > F + doorH + v) ? K.frame : (K.glowDim | EM);
        put(i, j, I(zb) - 1, c); put(i, j, I(zb) - 2, c);
      }
      // hazard stripes on the threshold, the door's control pad
      box(-doorW / 2, F, zb - 0.16, doorW / 2, F + v, zb - 2 * v, (x, y, z, i) => ((i >> 2) & 1 ? K.yellow : K.dark));
      // the leaf: a panel in front of the wall that slides to the right — a framed metal plate, a window slit, a grip
      const lw = Math.round(doorW * pr / 2), lh = Math.round((doorH - 0.01) * pr), win0 = Math.round(1.1 * pr), win1 = Math.round(1.5 * pr);
      parts.cdoor = { q: new Part().box(-lw, 0, 0, lw - 1, lh - 1, 1, (x, y, z) => (Math.abs(x + 0.5) > lw - 2.5 || y < 2 || y > lh - 3 ? (z ? 0x4a515b : 0x3c424b) : (y > win0 && y < win1 && Math.abs(Math.abs(x + 0.5) - lw * 0.5) < 2 ? 0x0d1a24 : y < 6 ? ((x & 4) ? 0xe8b41e : 0x1b1d21) : (z ? 0x6e7682 : 0x626a75)))).box(-lw + 4, Math.round(1.0 * pr), 2, -lw + 5, Math.round(1.2 * pr), 2, 0xa3abb5), at: [0, F, zb - 2 * v - 2 / pr] };
      doorInfo = { w: doorW, h: doorH };
      const padX = -(doorW / 2 + 0.12);
      box(padX - 0.04, F + 1.0, zb - 2 * v - 0.02, padX + 0.04, F + 1.12, zb - 2 * v, K.bezel);
      box(padX - 0.02, F + 1.04, zb - 2 * v - 0.025, padX + 0.02, F + 1.08, zb - 2 * v - 0.02, K.green | EM);
      // a fire extinguisher on the left of the door
      const fx = -(doorW / 2 + 0.22);
      for (let j = I(F + 0.1); j < I(F + 0.5); j++) for (let k = I(zb - 0.16); k < I(zb - 2 * v); k++) for (let i = I(fx - 0.06); i < I(fx + 0.06); i++) { const x = ctr(i), z = ctr(k); if (Math.hypot(x - fx, z - (zb - 0.09)) < 0.055) put(i, j, k, ctr(j) > F + 0.44 ? K.dark : K.red); }

      // ================================================================ the canopy frame: smooth bars just under the glass
      if (RF) {
        // a bar along (x, z) waypoints, hanging just under the glass; it breaks where the glass ends
        const bar = (pts, w, th, col) => {
          let cur = null;
          const flush = () => { if (cur && cur.p.length > 1) frame.push(cur); cur = null; };
          for (let s = 0; s < pts.length - 1; s++) {
            const A = pts[s], B = pts[s + 1], n = Math.max(2, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 0.04));
            for (let t = s ? 1 : 0; t <= n; t++) {
              const x = A[0] + (B[0] - A[0]) * t / n, z = A[1] + (B[1] - A[1]) * t / n, h = roofAt(x, z);
              if (!h || h < rim + 0.1) { flush(); continue; }
              const e = 0.03, hx = (roofAt(x + e, z) || h) - (roofAt(x - e, z) || h), hz = (roofAt(x, z + e) || h) - (roofAt(x, z - e) || h);
              const nl = Math.hypot(hx, 2 * e, hz), n3 = [-hx / nl, 2 * e / nl, -hz / nl];
              if (!cur) cur = { p: [], n: [], w, h: th, col };
              cur.p.push([x - n3[0] * th * 0.5, h - n3[1] * th * 0.5 - 0.004, z - n3[2] * th * 0.5]); cur.n.push(n3);
            }
          }
          flush();
        };
        const zA = zf - 0.12, zM = Math.min(sz - 0.5, (zf + zb) / 2), zR = zb - 0.12, X = gx - 0.02;
        bar([[-X, zA], [X, zA]], 0.075, 0.06, K.frame);                   // windscreen arch (its feet are the A-pillars)
        bar([[0, zA], [0, C.zNose + 0.2]], 0.05, 0.05, K.frame);          // the windscreen's centre post
        bar([[-X, zM], [X, zM]], 0.055, 0.05, K.frame);                   // roof bow over the pilots
        bar([[-X, zR], [X, zR]], 0.075, 0.06, K.frame);                   // rear arch
        bar([[0, zA], [0, zR]], 0.05, 0.045, K.frame2);                   // roof spine
        // a dome light in the spine over the seats
        const dz = (zM + zR) / 2, dh = roofAt(0, dz);
        if (dh) box(-0.06, dh - 0.1, dz - 0.04, 0.06, dh - 0.06, dz + 0.04, (x, y) => (y < dh - 0.09 ? K.legend | EM : K.frame2));
      }
    }

    // ================================================================ the controls (moving parts at twice the detail)
    const cv = 1 / pr, Q = (m) => Math.round(m * pr);
    const add = (name, at, fill) => { const q = new Part(); fill(q); parts[name] = { q, at }; };
    const ctl = (c) => (controls.push(c), c);
    const plate = (x, y, z, w, d, col) => box(x - w / 2, y - v, z - d / 2, x + w / 2, y, z + d / 2, col || K.bezel);
    // toggle: a metal bat with a coloured tip on a chrome collar
    const toggle = (name, p, tip) => {
      plate(p[0], p[1], p[2], 0.07, 0.07);
      add(name, p, (q) => { q.box(-1, 0, -1, 1, 0, 1, K.metal2); q.box(0, 1, 0, 0, 2, 0, K.metal); q.box(-1, 3, 0, 1, 3, 0, tip); q.box(0, 3, -1, 0, 3, 1, tip); q.set(0, 4, 0, tip); });
    };
    // a hinged guard over a switch (opens up and back); stripes: yellow & black
    const guard = (name, p, col, stripes) => add(name, [p[0], p[1], p[2] + 3 * cv], (q) => q.box(-2, 0, -6, 2, 5, 0, (x, y, z) => (y === 5 || x === -2 || x === 2 || z === -6 ? (stripes && ((x + z + y + 30) % 4) < 2 ? 0x18181a : col) : null)));
    // push button with a lamp ring
    const button = (name, p, w, d, col) => {
      plate(p[0], p[1], p[2], (w + 3) * cv, (d + 3) * cv);
      add(name, p, (q) => q.box(-(w >> 1), 0, -(d >> 1), w - 1 - (w >> 1), 1, d - 1 - (d >> 1), (x, y) => (y === 1 ? col : shade(col, 0.6))));
      add(name + '_lamp', [p[0], p[1] - cv * 0.5, p[2]], (q) => { const a = (w >> 1) + 1, b = (d >> 1) + 1; for (let x = -a; x <= w - (w >> 1); x++) for (let z = -b; z <= d - (d >> 1); z++) if (x === -a || z === -b || x === w - (w >> 1) || z === d - (d >> 1)) q.set(x, 0, z, 0xffffff | EM); });
    };
    // switch deck: power (guarded) · start · lights · ramp — the left console with two seats, the right one alone
    const deckS = two ? -1 : 1, dX = conX(deckS), wide = conW >= 0.24;
    const xa2 = wide ? dX - deckS * conW * 0.18 : dX, xb2 = wide ? dX + deckS * conW * 0.2 : dX;
    const zs0 = ez - 0.42, zs1 = wide ? ez - 0.24 : zs0 + 0.13, zs2 = wide ? zs0 : zs0 + 0.26, zs3 = wide ? zs1 : zs0 + 0.39;
    toggle('sw_power', [xa2, conTop, zs0], K.red); guard('guard_power', [xa2, conTop, zs0], K.red);
    ctl({ id: 'power', kind: 'switch', part: 'sw_power', guard: 'guard_power', label: 'Energie', icon: 'power', p: [xa2, conTop + 0.05, zs0], r: 0.06 });
    button('btn_start', [xb2, conTop, zs2], 5, 5, K.green);
    ctl({ id: 'start', kind: 'button', part: 'btn_start', lamp: 'btn_start_lamp', label: 'Start', icon: 'start', p: [xb2, conTop + 0.02, zs2], r: 0.06 });
    toggle('sw_lights', [xa2, conTop, zs1], 0xf0f0f0);
    ctl({ id: 'lights', kind: 'switch', part: 'sw_lights', label: 'Licht', icon: 'light', p: [xa2, conTop + 0.05, zs1], r: 0.06 });
    toggle('sw_ramp', [xb2, conTop, zs3], 0x3a8cff);
    ctl({ id: 'ramp', kind: 'switch', part: 'sw_ramp', label: 'Rampe', icon: 'ramp', p: [xb2, conTop + 0.05, zs3], r: 0.06 });
    // legends under them, two decorative switches behind
    flatLabel('ENERGIE', xa2, conTop, zs0 + 0.065, 0.019); flatLabel('START', xb2, conTop, zs2 + 0.065, 0.019);
    flatLabel('LICHT', xa2, conTop, zs1 + 0.065, 0.019); flatLabel('RAMPE', xb2, conTop, zs3 + 0.065, 0.019);
    if (wide) { for (const x of [xa2, xb2]) { const z = ez - 0.08; plate(x, conTop, z, 0.05, 0.05); box(x - 0.5 * v, conTop, z - 0.5 * v, x + 0.5 * v, conTop + 0.045, z + 0.5 * v, K.metal); } flatLabel('NAV', (xa2 + xb2) / 2, conTop, ez - 0.02, 0.013); }
    // gear lever with a wheel-shaped knob and three lamps (nose, left, right)
    {
      const gxx = two ? px * 0.5 : -Math.min(0.22, hw - 0.12), gy0 = pBot + 0.08, gz0 = faceZ(gxx, gy0);
      box(gxx - 0.035, gy0 - 0.06, gz0 - v, gxx + 0.035, gy0 + 0.06, gz0 + v, K.bezel);
      add('gear_lever', [gxx, gy0, gz0 + v], (q) => { q.box(0, 0, 0, 0, 0, 7, K.metal); q.box(-1, -3, 7, 0, 3, 13, (x, y, z) => (Math.hypot(y, z - 10) <= 2.6 ? (Math.hypot(y, z - 10) < 1.2 ? 0xc8c8c8 : 0xf4f4f4) : null)); });
      const lamps = [[0, 0.075], [-0.028, 0.042], [0.028, 0.042]];
      lamps.forEach(([lx, ly], n) => { const x = gxx + 0.08 + lx, y = gy0 - 0.04 + ly, z = faceZ(x, y); box(x - 0.022, y - 0.022, z - v, x + 0.022, y + 0.022, z + v, K.bezel); add('gear_lamp' + n, [x, y, z + v], (q) => q.box(-1, -1, 0, 0, 0, 0, 0xffffff | EM)); });
      ctl({ id: 'gear', kind: 'lever', part: 'gear_lever', label: 'Fahrwerk', icon: 'gear', p: [gxx, gy0, gz0 + 0.12], r: 0.09 });
      label('FAHRWERK', [gxx + 0.04, gy0 + 0.078, faceZ(gxx + 0.04, gy0 + 0.078) + 0.003], RIGHT, FUP, 0.013);
    }
    // autopilot: the wide push button on the shield panel
    {
      const mcpW = two ? 0.25 : Math.min(0.17, hw * 0.4), mcpZ = MCPZ, ax = -mcpW * 0.6, ay = MCPY;
      add('btn_auto', [ax, ay, mcpZ], (q) => q.box(-3, -1, 0, 3, 1, 1, (x, y, z) => (z === 1 ? (y === 0 && Math.abs(x) < 2 ? 0x9fd8ff : 0x22405e) : 0x16283a)));
      add('btn_auto_lamp', [ax, ay, mcpZ], (q) => { for (let x = -4; x <= 4; x++) for (let y = -2; y <= 2; y++) if (Math.abs(x) === 4 || Math.abs(y) === 2) q.set(x, y, 0, 0xffffff | EM); });
      ctl({ id: 'auto', kind: 'button', part: 'btn_auto', lamp: 'btn_auto_lamp', label: 'Autopilot', icon: 'auto', p: [ax, ay, mcpZ + 0.02], r: 0.065, push: [0, 0, -1] });
      // master caution lamps on the shield's lip in front of each pilot
      C.seats.forEach(([sx2], n) => { const x = two ? sx2 + (sx2 < 0 ? 0.25 : -0.25) : Math.min(0.2, hw * 0.45), z = lipZ(x); add('caution' + n, [x, (shBot + dashTop) / 2, z], (q) => q.box(-2, -1, 0, 2, 0, 0, 0xffffff | EM)); });
    }
    // throttle: a T-handle on a lever in a slot with detent marks (pedestal, or the left console alone)
    {
      const tx = two ? -0.075 : conX(-1), tz0 = sz - 0.56, tz1 = sz - 0.21, rev = 0.09, ty = two ? ped.top(sz - 0.4) : conTop;
      for (let k = I(tz0 - 0.02); k < I(tz1 + rev + 0.02); k++) { const z = ctr(k), top = two ? ped.top(z) : conTop; for (let i = I(tx - v); i < I(tx + v); i++) put(i, I(top) - 1, k, K.black); }
      for (let n = 0; n <= 4; n++) { const z = tz1 - (tz1 - tz0) * n / 4, top = two ? ped.top(z) : conTop; box(tx + 1.5 * v, top - v, z - 0.004, tx + 1.5 * v + 0.035, top + 0.001, z + 0.004 + v * 0.01, n === 0 ? K.amber | EM : 0x7f95a8 | EM); }
      add('thr', [tx, ty - 0.02, tz1], (q) => { q.box(0, 0, 0, 0, 9, 0, K.metal2); q.box(-4, 10, -1, 4, 12, 1, (x, y) => (y === 12 ? (Math.abs(x) < 3 ? K.acc : 0x2a2c31) : 0x2a2c31)); q.box(-5, 11, 0, -5, 11, 0, K.red); });
      // (its click zone: the handle's height along the slot — slim, so the switches beside it stay in sight)
      const zA = tz0 - 0.04, zB = tz1 + rev + 0.02;
      ctl({ id: 'throttle', kind: 'slider', part: 'thr', label: 'Schub', icon: 'throttle', p: [tx, ty + 0.14, (zA + zB) / 2], r: 0.06, slot: [tz0, tz1], ext: [0.05, 0.05, (zB - zA) / 2] });
      label('SCHUB', two ? [tx + 0.1, (two ? ped.top(tz1) : conTop) + 0.004, tz1 + 0.04] : [tx, conTop + 0.004, tz1 + 0.12], RIGHT, [0, 0, -1], 0.019);
    }
    // weapons: a guarded switch with a striped guard (pedestal rear — behind the throttle's travel, so its handle
    // never hides it from the pilot's seat — or the right console)
    {
      const wx = two ? 0.09 : conX(1), wz = two ? sz - 0.06 : conZ1 - 0.12, wy = two ? ped.top(wz) : conTop;
      toggle('sw_weapons', [wx, wy, wz], K.red); guard('guard_weapons', [wx, wy, wz], K.yellow, true);
      ctl({ id: 'weapons', kind: 'switch', part: 'sw_weapons', guard: 'guard_weapons', label: 'Waffen', icon: 'weapons', p: [wx, wy + 0.05, wz], r: 0.07 });
      flatLabel('WAFFEN', wx, wy, wz + 0.07, 0.018);
    }
    // radio: a knurled knob (pedestal front, or the panel's right side alone)
    {
      const rx = two ? 0.075 : hw - 0.1, rz = two ? ped.z0 + 0.1 : faceZ(hw - 0.1, pBot + 0.1) + v, ry = two ? ped.top(rz) : pBot + 0.1;
      if (two) add('knob_radio', [rx, ry, rz], (q) => q.box(-2, 0, -2, 2, 2, 2, (x, y, z) => ((Math.abs(x) === 2 && Math.abs(z) === 2) ? null : y === 2 && x === 0 && z < 0 ? 0xffffff : (Math.abs(x) === 2 || Math.abs(z) === 2) && ((x + z) & 1) ? 0x2b2e34 : 0x3d4149)));
      else add('knob_radio', [rx, ry, rz], (q) => q.box(-2, -2, 0, 2, 2, 2, (x, y, z) => ((Math.abs(x) === 2 && Math.abs(y) === 2) ? null : z === 2 && x === 0 && y > 0 ? 0xffffff : 0x3d4149)));
      ctl({ id: 'radio', kind: 'knob', part: 'knob_radio', label: 'Funk', icon: 'radio', p: [rx, ry + (two ? 0.03 : 0), rz + (two ? 0 : 0.03)], r: 0.065, axis: two ? 1 : 2 });
      if (two) { const ty2 = ped.top(rz); flatLabel('FUNK', -0.075, ty2, rz - 0.045, 0.014); box(-0.13, ty2 - v, rz - 0.024, -0.02, ty2 + 0.001, rz + 0.024, K.bezel); screens.push({ tile: 5, c: [-0.075, ty2 + 0.003, rz], r: RIGHT, u: [0, 0, -1], w: 0.09, h: 0.034 }); }
      else label('FUNK', [rx, ry + 0.06, faceZ(rx, ry + 0.06) + 0.003], RIGHT, FUP, 0.013);
    }

    // ---- meshes are made by job(); hand back the grids & layout
    const bounds = { gx, dashTop, shBot, pBot, faceTopZ, tilt };
    return { res, pr, S, parts, controls, screens, labels, eye: E, dashTop, rim, solo, bounds, two, frame, top: C.top || rim + 2, door: doorInfo };
  }

  // the worker job: build, bake the light, mesh. → plain data + transferable buffers
  function job(m) {
    const t0 = Date.now();
    const pal = m.pal && VR.Starship && VR.Starship.PAL ? VR.Starship.PAL.find(p => p.key === m.pal) || null : (m.palObj || null);
    const d = build(m.C, pal, m.res, { console: !!m.console });
    const light = skyField(d.S, m.console ? -1e9 : d.rim, !!m.console, d.rim + 0.3);
    const out = { body: joinMesh(mesh(d.S, 1, light), tubes(d.frame, d.res)), glow: mesh(d.S, 2, null), parts: {} };
    const tr = [out.body.data.buffer, out.glow.data.buffer], layout = {};
    let tris = (out.body.count + out.glow.count) / 3;
    for (const name in d.parts) {
      const G = d.parts[name].q.grid(d.pr); if (!G) continue;
      const pm = mesh(G, 0, null); out.parts[name] = pm; tr.push(pm.data.buffer); tris += pm.count / 3;
      layout[name] = d.parts[name].at;
    }
    let vox = 0; for (let n = 0; n < d.S.c.length; n++) if (d.S.c[n]) vox++;
    return { res: d.res, pr: d.pr, meshes: out, layout, controls: d.controls, screens: d.screens, labels: d.labels, eye: d.eye, dashTop: d.dashTop, solo: d.solo, two: d.two, bounds: d.bounds, door: d.door, tris: Math.round(tris), vox, ms: Date.now() - t0, transfer: tr };
  }

  VR.CockpitKit = { Grid, Part, mesh, skyField, tubes, build, job, EM };
})(VR);

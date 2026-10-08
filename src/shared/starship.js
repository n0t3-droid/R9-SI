// ============================================================================
// Mini-voxel starships (shared: generated & meshed in workers). Ships are grown
// from a seed at 2–4 voxels per block: tapered hulls with bevelled panels,
// seams and panel-tone variation, framed glass canopies with a cockpit inside,
// swept / delta / gull / twin-deck wings, glowing engine bells, wingtip
// cannons, nav lights, stripes, vents, antennas, lit portholes, the ship's
// code stencilled on the hull and retractable landing gear. Output: greedy
// meshes with baked ambient occlusion (hull, glass, gear) plus flight metadata.
// Local frame: nose toward -z, x starboard, y up, metres, origin at the centre
// of the ship's footprint on the ground.
// ============================================================================
(function (VR) {
  'use strict';
  const PRESENT = 1 << 26, EMIS = 1 << 24, GLASSF = 1 << 25;
  const rgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const pack = (c, emis, glass) => ((c[0] & 255) << 16) | ((c[1] & 255) << 8) | (c[2] & 255) | (emis ? EMIS : 0) | (glass ? GLASSF : 0) | PRESENT;
  const mul = (c, k) => [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];
  const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  const PAL = [
    { key: 'starforge', name: 'Starforge', hull: 0xe9ecf1, hull2: 0xc3c9d3, trim: 0x3a3f4b, acc: 0xf07a1e, acc2: 0x2e7de0, glow: 0x5af4ff, glass: 0x1b3a66, eng: 0x4a4f5a, core: 0xffb45a },
    { key: 'nightwing', name: 'Nightwing', hull: 0x2c2f3a, hull2: 0x3d4150, trim: 0x16181e, acc: 0xe0409e, acc2: 0x8a4bff, glow: 0xff5ad8, glass: 0x2a1446, eng: 0x23252d, core: 0xff6adf },
    { key: 'sunstrike', name: 'Sunstrike', hull: 0xf2efe8, hull2: 0xd9d3c7, trim: 0x46403a, acc: 0xd83b2b, acc2: 0xf5c43a, glow: 0xffc23a, glass: 0x1d4f7a, eng: 0x4d4843, core: 0xffd27a },
    { key: 'verdant', name: 'Verdant Corps', hull: 0xd8ddd2, hull2: 0xaeb8a4, trim: 0x2f4a2b, acc: 0x6fd83a, acc2: 0x2c8a4a, glow: 0x9cff6a, glass: 0x173d33, eng: 0x3e4a3e, core: 0xc8ff7a },
    { key: 'royal', name: 'Royal Blue', hull: 0x2f5ad8, hull2: 0x5c86ec, trim: 0x1e2a4a, acc: 0xf5d03a, acc2: 0xffffff, glow: 0xfff3a8, glass: 0x10244a, eng: 0x2a3148, core: 0xfff0a0 },
    { key: 'hauler', name: 'Rust Hauler', hull: 0xb8683a, hull2: 0x8f5433, trim: 0x3a2f28, acc: 0xf2c230, acc2: 0x2b2b2b, glow: 0xffa13a, glass: 0x1f3440, eng: 0x4b4541, core: 0xffa850 },
    { key: 'prism', name: 'Prism Guild', hull: 0xf4f1fb, hull2: 0xd8cff0, trim: 0x4b2f78, acc: 0xa35cff, acc2: 0xff5ad8, glow: 0x9f7bff, glass: 0x2a1450, eng: 0x3b3150, core: 0xc9a2ff },
    { key: 'arctic', name: 'Arctic Survey', hull: 0xf5f8fb, hull2: 0xcfdbe6, trim: 0x2f4f63, acc: 0x2bb3e0, acc2: 0xff7a3a, glow: 0x7ef1ff, glass: 0x123a52, eng: 0x3d4b57, core: 0x9ef8ff },
    { key: 'crimson', name: 'Crimson Fleet', hull: 0xb3262b, hull2: 0x8c1e22, trim: 0x2a1718, acc: 0xf2f2f2, acc2: 0xf2a33a, glow: 0xff5a4a, glass: 0x2a0f12, eng: 0x3a2a2b, core: 0xff8a5a },
  ];
  const NAMES = ['Kestrel', 'Starling', 'Halcyon', 'Vesper', 'Corvid', 'Tern', 'Lumen', 'Solace', 'Wayfarer', 'Drift', 'Ember', 'Nimbus', 'Quill', 'Harrier', 'Aurel', 'Sable', 'Vanta', 'Cinder', 'Zephyr', 'Lyra', 'Orrin', 'Juno', 'Talon', 'Mistral', 'Borealis', 'Solstice', 'Rook', 'Gale', 'Aster', 'Pike', 'Marlin', 'Osprey', 'Wren', 'Kite', 'Swift', 'Petrel', 'Heron', 'Lark', 'Fulmar', 'Comet', 'Meridian', 'Halo', 'Tempest', 'Nova', 'Umbra', 'Pioneer', 'Bramble', 'Saffron', 'Cobalt', 'Tidewater'];
  const ARCH = {
    shuttle: { label: 'Shuttle', code: 'SH', res: 4, weight: 3 },
    interceptor: { label: 'Interceptor', code: 'IX', res: 4, weight: 4 },
    racer: { label: 'Racer', code: 'NR', res: 4, weight: 2 },
    gunship: { label: 'Gunship', code: 'GW', res: 4, weight: 2 },
    dropship: { label: 'Dropship', code: 'DM', res: 4, weight: 2 },
    freighter: { label: 'Freighter', code: 'HX', res: 3, weight: 2 },
    cruiser: { label: 'Cruiser', code: 'CR', res: 3, weight: 1 },
    carrier: { label: 'Carrier', code: 'CV', res: 2, weight: 0 },
  };

  // 3×5 stencil font
  const FONT = { 'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110', 'E': '111100110100111', 'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101', 'I': '111010010010111', 'K': '101101110101101', 'L': '100100100100111', 'M': '101111111101101', 'N': '110101101101101', 'O': '010101101101010', 'P': '110101110100100', 'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101111', 'V': '101101101101010', 'W': '101101111111101', 'X': '101101010101101', 'Y': '101101010010010', 'Z': '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110', '-': '000000111000000' };

  // ---------------------------------------------------------------- voxel grid in metres
  class Grid {
    constructor(R, x0, x1, y0, y1, z0, z1) {
      this.R = R; this.x0 = x0; this.y0 = y0; this.z0 = z0;
      this.nx = Math.ceil((x1 - x0) * R); this.ny = Math.ceil((y1 - y0) * R); this.nz = Math.ceil((z1 - z0) * R);
      this.d = new Uint32Array(this.nx * this.ny * this.nz);
      this.part = new Uint8Array(this.nx * this.ny * this.nz); // 0 hull, 1 gear
    }
    ix(x) { return Math.floor((x - this.x0) * this.R); } iy(y) { return Math.floor((y - this.y0) * this.R); } iz(z) { return Math.floor((z - this.z0) * this.R); }
    cx(i) { return this.x0 + (i + 0.5) / this.R; } cy(j) { return this.y0 + (j + 0.5) / this.R; } cz(k) { return this.z0 + (k + 0.5) / this.R; }
    idx(i, j, k) { return (j * this.nz + k) * this.nx + i; }
    ok(i, j, k) { return i >= 0 && j >= 0 && k >= 0 && i < this.nx && j < this.ny && k < this.nz; }
    get(i, j, k) { return this.ok(i, j, k) ? this.d[this.idx(i, j, k)] : 0; }
    set(i, j, k, v, part) { if (this.ok(i, j, k)) { const n = this.idx(i, j, k); this.d[n] = v; this.part[n] = part || 0; } }
    // iterate voxel centres inside a metric box, calling fn(x, y, z, i, j, k)
    each(x0, x1, y0, y1, z0, z1, fn) {
      const i0 = Math.max(0, this.ix(x0)), i1 = Math.min(this.nx - 1, this.ix(x1)), j0 = Math.max(0, this.iy(y0)), j1 = Math.min(this.ny - 1, this.iy(y1)), k0 = Math.max(0, this.iz(z0)), k1 = Math.min(this.nz - 1, this.iz(z1));
      for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) fn(this.cx(i), this.cy(j), this.cz(k), i, j, k);
    }
    box(x0, x1, y0, y1, z0, z1, v, part) { this.each(x0, x1 - 1e-6, y0, y1 - 1e-6, z0, z1 - 1e-6, (x, y, z, i, j, k) => this.set(i, j, k, typeof v === 'function' ? v(x, y, z) : v, part)); }
    clear(x0, x1, y0, y1, z0, z1) { this.each(x0, x1 - 1e-6, y0, y1 - 1e-6, z0, z1 - 1e-6, (x, y, z, i, j, k) => this.set(i, j, k, 0)); }
    solidAt(x, y, z) { return this.get(this.ix(x), this.iy(y), this.iz(z)) !== 0; }
  }

  // ---------------------------------------------------------------- shape primitives (metric)
  function hull(G, z0, z1, prof, paint) {
    let maxW = 0, maxH = 0, minY = 1e9, maxY = -1e9;
    for (let t = 0; t <= 1; t += 0.05) { const P = prof(t); if (!P) continue; maxW = Math.max(maxW, P.w); maxH = Math.max(maxH, P.h); minY = Math.min(minY, P.cy - P.h); maxY = Math.max(maxY, P.cy + P.h); }
    G.each(-maxW - 0.1, maxW + 0.1, minY - 0.1, maxY + 0.1, z0, z1, (x, y, z, i, j, k) => {
      const t = (z - z0) / (z1 - z0), P = prof(t); if (!P || P.w <= 0.05 || P.h <= 0.05) return;
      const p = P.p || 3, dx = Math.abs(x - (P.cx || 0)) / P.w, dy = Math.abs(y - P.cy) / P.h;
      if (Math.pow(dx, p) + Math.pow(dy, p) <= 1) G.set(i, j, k, paint(x, y, z, t, P));
    });
  }
  function cylZ(G, cx, cy, r, z0, z1, paint, part) { G.each(cx - r, cx + r, cy - r, cy + r, z0, z1, (x, y, z, i, j, k) => { const d = Math.hypot(x - cx, y - cy); if (d <= r) G.set(i, j, k, paint(x, y, z, d / r), part); }); }
  function cylY(G, cx, cz, r, y0, y1, v, part) { G.each(cx - r, cx + r, y0, y1, cz - r, cz + r, (x, y, z, i, j, k) => { if (Math.hypot(x - cx, z - cz) <= r) G.set(i, j, k, v, part); }); }
  function ellipsoid(G, cx, cy, cz, rx, ry, rz, paint) { G.each(cx - rx, cx + rx, cy - ry, cy + ry, cz - rz, cz + rz, (x, y, z, i, j, k) => { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2; if (d <= 1) G.set(i, j, k, paint(x, y, z, d)); }); }
  // wing planform: root at |x| = xr, leading edge zle(s) & chord(s) for s = distance from root, thickness th(s), mid-height wy(s)
  function wing(G, xr, span, zle, chord, th, wy, paint, sides) {
    for (const sgn of sides || [-1, 1]) {
      const xa = sgn < 0 ? -xr - span : xr, xb = sgn < 0 ? -xr : xr + span;
      G.each(xa, xb, -2, 30, -80, 80, (x, y, z, i, j, k) => {
        const s = Math.abs(x) - xr; if (s < 0 || s > span) return;
        const le = zle(s), c = chord(s); if (z < le || z > le + c) return;
        const u = (z - le) / c, h = th(s) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.05)));
        if (Math.abs(y - wy(s)) <= h / 2) G.set(i, j, k, paint(x, y, z, s / span, u));
      });
    }
  }
  function ring(G, cx, cy, cz, Rr, r, paint) { G.each(cx - Rr - r, cx + Rr + r, cy - Rr - r, cy + Rr + r, cz - r, cz + r, (x, y, z, i, j, k) => { const q = Math.hypot(x - cx, y - cy) - Rr, d = Math.hypot(q, z - cz); if (d <= r) G.set(i, j, k, paint(x, y, z, q)); }); }

  // ---------------------------------------------------------------- common components
  // glowing engine bell pointing aft (+z) at (cx, cy), mouth at z = zEnd
  function engine(G, S, cx, cy, r, zEnd, len) {
    const E = pack(S.eng), rim = pack(mul(S.eng, 0.7)), core = pack(S.core, 1), hot = pack(mul(S.core, 1.1), 1), ringC = pack(S.acc);
    cylZ(G, cx, cy, r, zEnd - len, zEnd, (x, y, z, dr) => (Math.abs(z - (zEnd - len * 0.55)) < 0.14 ? ringC : dr > 0.8 ? rim : E));
    // hollow nozzle with a burning core
    G.each(cx - r, cx + r, cy - r, cy + r, zEnd - 0.5, zEnd, (x, y, z, i, j, k) => { const d = Math.hypot(x - cx, y - cy); if (d < r * 0.72) G.set(i, j, k, d < r * 0.45 ? hot : core); });
    G.each(cx - r, cx + r, cy - r, cy + r, zEnd - 0.26, zEnd, (x, y, z, i, j, k) => { const d = Math.hypot(x - cx, y - cy); if (d < r * 0.72) G.set(i, j, k, 0); });
    S.meta.exhaust.push([cx, cy, zEnd + 0.1, r]);
  }
  function cannon(G, S, x, y, z, len) {
    const B = pack(S.trim), M = pack(mul(S.trim, 1.4)), muzzle = pack(S.glow, 1);
    G.box(x - 0.13, x + 0.13, y - 0.13, y + 0.13, z - len, z, (xx, yy, zz) => ((zz - (z - len)) % 0.75 < 0.26 ? M : B));
    G.box(x - 0.13, x + 0.13, y - 0.13, y + 0.13, z - len - 0.26, z - len, muzzle);
    S.meta.guns.push([x, y, z - len - 0.3]);
  }
  function antenna(G, S, x, y, z, h) { G.box(x - 0.13, x + 0.13, y, y + h, z - 0.13, z + 0.13, pack(mul(S.hull2, 0.8))); G.box(x - 0.13, x + 0.13, y + h, y + h + 0.26, z - 0.13, z + 0.13, pack(S.navW || [255, 80, 80], 1)); }
  function gear(G, S, x, z, y1, foot) {
    const st = pack(mul(S.trim, 1.2)), pad = pack(S.trim);
    G.box(x - 0.13, x + 0.13, 0.25, y1, z - 0.13, z + 0.13, st, 1);
    G.box(x - (foot || 0.4), x + (foot || 0.4), 0, 0.26, z - 0.5, z + 0.5, pad, 1);
    G.box(x - 0.26, x + 0.26, y1 - 0.5, y1, z - 0.26, z + 0.26, st, 1);
  }
  // the cockpit: a room carved into the hull (a floor, a dash along the front, one or two seats) whose roof — and the
  // nose ahead of it — is glazed above the dash line: the big canopy you look through. A slim sill marks where glass
  // meets hull. The furniture is a coarse stand-in (part 2), drawn whenever the detailed 1/16 m cockpit (cockpit.js,
  // placed by meta.cockpit) isn't; collisions only see the hull.
  function cockpitRoom(G, S, o) {
    // (everything on the voxel grid, so the furnished cockpit sits exactly on the deck and against the walls)
    const R = G.R, q = (v) => Math.round(v * R) / R, zNose = q(o.zNose), zf = q(o.zf), zb = q(o.zb), floor = q(o.floor), rim = q(o.rim), hw = q(o.hw), gw = o.glassW || 99, v1 = 1 / R;
    const glass = pack(S.glass, 0, 1), sill = pack(mul(S.trim, 1.25)), deck = pack(mul(S.trim, 0.85));
    const carve = (x, y, z) => (z >= zf && z <= zb && ((Math.abs(x) <= hw && y >= floor) || (y > rim && Math.abs(x) < gw))) || (z >= zNose && z < zf && y > rim && Math.abs(x) < gw);
    const rm = [];
    G.each(-gw - 6, gw + 6, floor, floor + 7, zNose, zb, (x, y, z, i, j, k) => {
      if (!carve(x, y, z)) return;
      if (G.get(i, j, k) && G.get(i + 1, j, k) && G.get(i - 1, j, k) && G.get(i, j + 1, k) && G.get(i, j - 1, k) && G.get(i, j, k + 1) && G.get(i, j, k - 1)) rm.push(i, j, k);
    });
    for (let n = 0; n < rm.length; n += 3) G.set(rm[n], rm[n + 1], rm[n + 2], 0);
    // glaze the skin above the dash line, a sill along its foot and a frame along its back edge
    let top = rim;
    G.each(-gw - 6, gw + 6, rim, rim + 7, zNose - v1, zb + v1, (x, y, z, i, j, k) => {
      const v = G.get(i, j, k); if (!v || G.part[G.idx(i, j, k)] || Math.abs(x) >= gw) return;
      if (y <= rim + v1 || z > zb) { G.set(i, j, k, sill); return; }
      G.set(i, j, k, glass); if (y > top) top = y;
    });
    // deck plates
    G.box(-hw, hw, floor - v1, floor, zf, zb, deck);
    // stand-in furniture (part 2): dash with glowing screens, seats
    const dash = pack(mul(S.trim, 0.9)), scr = pack(S.glow, 1), seatC = pack(o.seatCol || [150, 42, 42]), seat2 = pack(mul(o.seatCol || [150, 42, 42], 0.65));
    G.box(-hw, hw, floor, rim, zf, zf + 0.5, (x, y) => (y > rim - 0.5 && y < rim - 0.2 && Math.abs(x) < hw - 0.2 && Math.floor((x + 5) * 4) % 3 ? scr : dash), 2);
    const sz = zf + (o.seatZ || 1.75), seats = o.seats === 2 ? [-0.55, 0.55] : [0];
    for (const sx of seats) {
      G.box(sx - 0.26, sx + 0.26, floor, floor + 0.5, sz - 0.26, sz + 0.26, seatC, 2);
      G.box(sx - 0.26, sx + 0.26, floor + 0.5, floor + 1.3, sz + 0.26, sz + 0.52, seat2, 2);
    }
    const px = seats[0], eye = [px, floor + 1.2, sz - 0.14];
    S.meta.eye = eye; S.meta.seat = [px, floor + 0.5, sz];
    // the glazed roof as a height map (inner glass surface over the room and the nose), for the detailed cockpit's frame
    const step = 0.25, nx = Math.ceil(2 * Math.min(gw, hw + 2) / step), nz = Math.ceil((zb - zNose) / step) + 1, x0 = -nx * step / 2, roof = new Array(nx * nz).fill(0);
    for (let c = 0; c < nz; c++) for (let a = 0; a < nx; a++) {
      const x = x0 + (a + 0.5) * step, z = zNose + (c + 0.5) * step;
      let best = 0;
      for (let y = rim + 6; y > rim; y -= v1) { const v = G.get(G.ix(x), G.iy(y), G.iz(z)); if (v && (v & GLASSF)) { best = y - 0.5 * v1; } else if (best) break; }
      roof[c * nx + a] = +best.toFixed(3);
    }
    S.meta.cockpit = { hw, floor, rim, zNose, zf, zb, seats: seats.map(x => [x, sz]), eye, top: +(top + 0.5 * v1).toFixed(3), roof: { x0, z0: zNose, step, nx, nz, h: roof }, glassW: Math.min(gw, 99) };
  }
  // ---------------------------------------------------------------- archetypes (metres; y = 0 ground)
  const ARCHS = {};
  ARCHS.shuttle = (G, S, rng) => {
    const L = rng.range(20, 24), z0 = -L / 2, z1 = L / 2, W = rng.range(2.1, 2.5), H = 1.9, gearH = 1.1, cy = gearH + H;
    const hullC = pack(S.hull), hull2 = pack(S.hull2), acc = pack(S.acc), acc2 = pack(S.acc2), dark = pack(S.trim);
    hull(G, z0, z1 - 2.2, (t) => {
      const n = Math.min(1, t / 0.28);
      return { w: W * (0.32 + 0.68 * Math.pow(n, 0.55)), h: H * (0.5 + 0.5 * Math.pow(n, 0.7)), cy: cy - (1 - n) * 0.35, p: 3.2 };
    }, (x, y, z, t, P) => {
      const ry = (y - P.cy) / P.h;
      if (t < 0.035) return dark; // nose cap
      if (ry < -0.55) return hull2; // belly
      if (Math.abs(ry + 0.05) < 0.1 && t > 0.12) return acc; // side stripe
      if (Math.abs(ry - 0.18) < 0.06 && t > 0.2) return acc2;
      return hullC;
    });
    // aft engine housing
    // (it reaches down to the deck so the cargo bay runs flat to the ramp; the engines sit round the ramp's opening)
    G.box(-W * 0.95, W * 0.95, gearH - 0.1, cy + H * 0.75, z1 - 2.4, z1 - 0.8, (x, y, z) => (Math.abs(y - cy) < 0.2 ? acc : hull2));
    for (const [ex, ey, er] of [[-1.55, cy - 0.35, 0.5], [1.55, cy - 0.35, 0.5], [0, cy + 1.05, 0.45]]) engine(G, S, ex, ey, er, z1 + 0.2, 1.4);
    // delta wings with striped leading edges
    wing(G, W * 0.8, rng.range(4.6, 5.8), (s) => z0 + L * 0.42 + s * 0.95, (s) => Math.max(1.2, L * 0.42 - s * 1.25), (s) => 0.62 - s * 0.05, (s) => cy - H * 0.55 + s * 0.04,
      (x, y, z, s, u) => (u < 0.12 ? acc : u > 0.86 ? dark : (Math.floor(u * 6) % 2 && s > 0.3 ? hull2 : hullC)));
    // tail fin
    const fz0 = z1 - 6.5;
    G.each(-0.26, 0.26, cy + H * 0.6, cy + H + 3.4, fz0, z1 - 1, (x, y, z, i, j, k) => {
      const h = (y - (cy + H * 0.6)); const lead = fz0 + h * 1.1; if (z < lead || z > z1 - 1 - h * 0.25) return;
      G.set(i, j, k, h > 2.9 ? pack(S.glow, 1) : (Math.abs(z - lead) < 0.4 ? acc : (h > 1.6 && h < 2.0 ? acc2 : hullC)));
    });
    // (glazed almost to the tip: the nose must not rise into the pilots' view)
    cockpitRoom(G, S, { zNose: z0 + 0.25, zf: z0 + L * 0.1, zb: z0 + L * 0.29, floor: cy - 0.85, rim: cy, hw: 1.15, seats: 2 });
    // side windows row (none where the side door goes: port, 1.65–2.95 m behind the cockpit)
    const zDoor = Math.round((z0 + L * 0.29) * G.R) / G.R + 2.3;
    for (let z = z0 + L * 0.34; z < z1 - 4; z += 1.25) for (const sx of [-1, 1]) if (!(sx < 0 && z + 0.5 > zDoor - 0.75 && z < zDoor + 0.75)) G.each(sx * (W + 0.3), sx * (W + 0.3), cy + 0.3, cy + 0.7, z, z + 0.5, (x, y, zz, i, j, k) => { for (let ii = i; ii >= 0 && ii < G.nx; ii -= sx) { if (G.get(ii, j, k)) { G.set(ii, j, k, pack(S.glass, 0, 1)); break; } } });
    S.meta.gearParts = [[-1.1, z0 + L * 0.2], [1.1, z0 + L * 0.2], [-2.2, z0 + L * 0.66], [2.2, z0 + L * 0.66]];
    for (const [x, z] of S.meta.gearParts) gear(G, S, x, z, cy - H * 0.55);
    antenna(G, S, 0.6, cy + H - 0.1, z0 + L * 0.45, 0.9);
    // the walkable inside: cabin & cargo bay, the side door with its stair, the rear ramp (shipcabin.js)
    if (VR.ShipCabin) VR.ShipCabin.carve(G, S, { zb: S.meta.cockpit.zb, cfloor: S.meta.cockpit.floor, zT: z1 - 0.8, W, Hh: H, cy, side: -1, hull2: S.hull2, trim: S.trim }, { pack, mul, GLASSF });
  };
  ARCHS.interceptor = (G, S, rng) => {
    const L = rng.range(13, 17), z0 = -L / 2, z1 = L / 2, W = rng.range(1.2, 1.5), H = 1.15, gearH = 1.0, cy = gearH + H;
    const hullC = pack(S.hull), hull2 = pack(S.hull2), acc = pack(S.acc), dark = pack(S.trim);
    hull(G, z0, z1 - 1.8, (t) => { const n = Math.min(1, t / 0.45); return { w: W * (0.22 + 0.78 * Math.pow(n, 0.6)), h: H * (0.35 + 0.65 * Math.pow(n, 0.75)), cy: cy - (1 - n) * 0.3, p: 2.6 }; },
      (x, y, z, t, P) => { const ry = (y - P.cy) / P.h; if (t < 0.04) return pack(S.acc2); if (ry < -0.5) return hull2; if (t > 0.1 && t < 0.18) return acc; return hullC; });
    // intakes
    for (const sx of [-1, 1]) G.box(sx > 0 ? W * 0.7 : -W * 1.25, sx > 0 ? W * 1.25 : -W * 0.7, cy - 0.45, cy + 0.2, z0 + L * 0.45, z1 - 2.4, (x, y, z) => (z < z0 + L * 0.47 ? pack([20, 22, 28]) : dark));
    engine(G, S, -0.55, cy, 0.5, z1 + 0.1, 1.9); engine(G, S, 0.55, cy, 0.5, z1 + 0.1, 1.9);
    const cfg = rng.pick(['swept', 'delta', 'forward', 'gull', 'twin']);
    const span = rng.range(3.8, 5.2), root = z0 + L * 0.45;
    const paintW = (x, y, z, s, u) => (u < 0.14 ? acc : s > 0.92 ? pack(S.glow, 1) : Math.floor(s * 8) % 3 === 0 ? hull2 : hullC);
    if (cfg === 'twin') {
      for (const wy of [cy - 0.55, cy + 0.75]) wing(G, W * 0.7, span, (s) => root + s * 0.7, (s) => 3.2 - s * 0.35, () => 0.36, () => wy, paintW);
      for (const sx of [-1, 1]) G.box(sx * (W * 0.7 + span) - 0.2, sx * (W * 0.7 + span) + 0.2, cy - 0.6, cy + 0.9, root + span * 0.7, root + span * 0.7 + 1.2, acc);
    } else if (cfg === 'gull') wing(G, W * 0.7, span, (s) => root + s * 0.6, (s) => 3.4 - s * 0.4, () => 0.42, (s) => cy - 0.3 + (s < 1.6 ? s * 0.45 : 0.72 - (s - 1.6) * 0.2), paintW);
    else if (cfg === 'delta') wing(G, W * 0.7, span, (s) => root - 1 + s * 1.05, (s) => Math.max(0.9, 5.2 - s * 1.0), () => 0.44, () => cy - 0.35, paintW);
    else if (cfg === 'forward') wing(G, W * 0.7, span, (s) => root + 1.4 - s * 0.45, (s) => 2.8 - s * 0.3, () => 0.4, () => cy - 0.3, paintW);
    else wing(G, W * 0.7, span, (s) => root + s * 0.85, (s) => 3.0 - s * 0.35, () => 0.42, (s) => cy - 0.35 + s * 0.06, paintW);
    // wingtip cannons
    const tipZ = cfg === 'forward' ? root + 1.4 - span * 0.45 : cfg === 'delta' ? root - 1 + span * 1.05 : root + span * 0.8;
    for (const sx of [-1, 1]) cannon(G, S, sx * (W * 0.7 + span + 0.15), cy - (cfg === 'twin' ? 0.55 : 0.3), tipZ + 0.6, 1.9);
    // twin or single tail
    const twin = rng.chance(0.5);
    for (const fx of twin ? [-0.6, 0.6] : [0]) G.each(fx - 0.14, fx + 0.14, cy + H * 0.5, cy + H + 1.6, z1 - 4, z1 - 0.8, (x, y, z, i, j, k) => { const h = y - (cy + H * 0.5); if (z < z1 - 4 + h * 1.2) return; G.set(i, j, k, h > 1.35 ? acc : hullC); });
    cockpitRoom(G, S, { zNose: z0 + L * 0.1, zf: z0 + L * 0.2, zb: z0 + L * 0.38, floor: cy - 0.75, rim: cy - 0.05, hw: 0.55, seats: 1, seatZ: 1.3 });
    S.meta.gearParts = [[0, z0 + L * 0.22], [-1.1, z0 + L * 0.62], [1.1, z0 + L * 0.62]];
    for (const [x, z] of S.meta.gearParts) gear(G, S, x, z, cy - H * 0.55, 0.3);
  };
  ARCHS.racer = (G, S, rng) => {
    const L = rng.range(12, 15), z0 = -L / 2, z1 = L / 2, cy = 1.9;
    const hullC = pack(S.hull), acc = pack(S.acc), glow = pack(S.glow, 1), dark = pack(S.trim);
    hull(G, z0, z1 - 3, (t) => ({ w: 0.95 * (0.25 + 0.75 * Math.min(1, t / 0.5)) + (t > 0.25 && t < 0.55 ? 0.25 : 0), h: 0.9 * (0.3 + 0.7 * Math.min(1, t / 0.4)), cy, p: 2.4 }),
      (x, y, z, t, P) => (Math.abs(y - P.cy) < 0.14 && Math.abs(x) > P.w * 0.6 ? glow : t < 0.05 ? acc : Math.abs(x) < 0.2 && y > P.cy ? acc : hullC));
    const er = rng.range(1.0, 1.3);
    cylZ(G, 0, cy, er, z1 - 4.2, z1 - 0.2, (x, y, z, d) => (d > 0.85 ? dark : Math.abs(z - (z1 - 3)) < 0.2 ? acc : pack(S.eng)));
    engine(G, S, 0, cy, er * 0.85, z1 + 0.3, 0.6);
    wing(G, 0.6, rng.range(1.6, 2.4), (s) => z0 + 2 + s * 0.8, () => 1.1, () => 0.26, () => cy - 0.1, () => acc);
    wing(G, er * 0.8, rng.range(1.8, 2.8), (s) => z1 - 4.2 + s * 1.1, (s) => 2.6 - s * 0.5, () => 0.3, (s) => cy + s * 0.35, (x, y, z, s) => (s > 0.85 ? glow : hullC));
    cockpitRoom(G, S, { zNose: z0 + L * 0.1, zf: z0 + L * 0.3, zb: z0 + L * 0.46, floor: cy - 0.65, rim: cy, hw: 0.45, seats: 1, seatZ: 1.2 });
    S.meta.gearParts = [[0, z0 + L * 0.3], [-0.9, z1 - 3.4], [0.9, z1 - 3.4]];
    for (const [x, z] of S.meta.gearParts) gear(G, S, x, z, cy - 0.7, 0.3);
  };
  ARCHS.gunship = (G, S, rng) => {
    const L = rng.range(17, 21), z0 = -L / 2, z1 = L / 2, W = 1.9, H = 1.7, cy = 1.2 + H;
    const hullC = pack(S.hull), hull2 = pack(S.hull2), acc = pack(S.acc), acc2 = pack(S.acc2), dark = pack(S.trim);
    const podEnd = z0 + L * 0.7;
    hull(G, z0, podEnd, (t) => ({ w: W * (0.4 + 0.6 * Math.min(1, t / 0.3)), h: H * (0.5 + 0.5 * Math.min(1, t / 0.25)), cy, p: 3.6 }), (x, y, z, t, P) => { const ry = (y - P.cy) / P.h; if (ry < -0.5) return hull2; if (Math.abs(ry) < 0.1 && t > 0.15) return acc; return hullC; });
    const bx = rng.range(3.8, 4.6), br = 0.85, bz0 = z0 + L * 0.28;
    for (const sx of [-1, 1]) {
      cylZ(G, sx * bx, cy, br, bz0, z1 - 1.3, (x, y, z, d) => (d > 0.8 && Math.floor(z * 2) % 3 === 0 ? dark : Math.abs(y - cy) < 0.15 ? acc2 : hull2));
      engine(G, S, sx * bx, cy, 0.7, z1 + 0.1, 1.5);
      G.each(sx * bx - 0.14, sx * bx + 0.14, cy + br * 0.6, cy + br + 2.2, z1 - 4.2, z1 - 1.2, (x, y, z, i, j, k) => { const h = y - (cy + br * 0.6); if (z < z1 - 4.2 + h * 1.1) return; G.set(i, j, k, h > 1.8 ? pack(S.glow, 1) : acc); });
    }
    wing(G, W * 0.9, bx - W * 0.9, (s) => bz0 + 1 + s * 0.25, () => 3.2, () => 0.4, () => cy - 0.2, (x, y, z, s, u) => (u < 0.12 ? acc : hullC));
    G.box(-bx, bx, cy + br * 0.7, cy + br * 0.7 + 0.35, z1 - 2.1, z1 - 1.5, dark);
    engine(G, S, -0.7, cy, 0.55, podEnd + 0.9, 1.4); engine(G, S, 0.7, cy, 0.55, podEnd + 0.9, 1.4);
    // chin turret
    ellipsoid(G, 0, cy - H * 0.85, z0 + L * 0.2, 0.7, 0.45, 0.7, () => dark);
    for (const sx of [-0.22, 0.22]) cannon(G, S, sx, cy - H * 0.9, z0 + L * 0.2 - 0.3, 1.6);
    cockpitRoom(G, S, { zNose: z0 + L * 0.05, zf: z0 + L * 0.1, zb: z0 + L * 0.27, floor: cy - 0.85, rim: cy - 0.05, hw: 1.15, seats: 2, glassW: W });
    S.meta.gearParts = [[-0.9, z0 + L * 0.3], [0.9, z0 + L * 0.3], [-bx, z1 - 3], [bx, z1 - 3]];
    for (const [x, z] of S.meta.gearParts) gear(G, S, x, z, cy - H * 0.6);
  };
  ARCHS.dropship = (G, S, rng) => {
    const L = rng.range(16, 20), z0 = -L / 2, z1 = L / 2, W = rng.range(4.8, 6.2), H = 1.6, cy = 1.3 + H;
    const hullC = pack(S.hull), hull2 = pack(S.hull2), acc = pack(S.acc), dark = pack(S.trim);
    hull(G, z0, z1 - 0.6, (t) => ({ w: W * Math.pow(Math.sin(Math.PI * Math.min(0.97, 0.12 + t * 0.85)), 0.6) + 0.5, h: H * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.05))), cy, p: 2.4 }),
      (x, y, z, t, P) => { const rx = Math.abs(x) / P.w; if (rx > 0.86) return acc; if ((y - P.cy) / P.h < -0.5) return hull2; return (Math.floor(Math.abs(x) * 1.6) % 3 === 0 && y > P.cy) ? hull2 : hullC; });
    for (const sx of [-1, 1]) G.each(sx * 2.2 - 0.14, sx * 2.2 + 0.14, cy + H * 0.7, cy + H + 2.2, z1 - 5, z1 - 1, (x, y, z, i, j, k) => { const h = y - (cy + H * 0.7); if (z < z1 - 5 + h * 1.1) return; G.set(i, j, k, h > 1.9 ? pack(S.glow, 1) : acc); });
    for (const ex of [-2.8, -1.1, 1.1, 2.8]) engine(G, S, ex, cy - 0.2, 0.55, z1 + 0.2, 1.2);
    cockpitRoom(G, S, { zNose: z0 + L * 0.06, zf: z0 + L * 0.12, zb: z0 + L * 0.27, floor: cy - 0.8, rim: cy - 0.05, hw: 1.15, seats: 2, glassW: 2.2 });
    // side door outline & portholes
    for (const sx of [-1, 1]) for (let z = z0 + L * 0.4; z < z1 - 3; z += 1.5) G.each(sx * W, sx * W, cy - 0.1, cy + 0.35, z, z + 0.5, (x, y, zz, i, j, k) => { for (let ii = i; ii >= 0 && ii < G.nx; ii -= sx) if (G.get(ii, j, k)) { G.set(ii, j, k, pack(S.core, 1)); break; } });
    S.meta.gearParts = [[-2, z0 + L * 0.3], [2, z0 + L * 0.3], [-3, z1 - 4], [3, z1 - 4]];
    for (const [x, z] of S.meta.gearParts) gear(G, S, x, z, cy - H * 0.6);
  };
  ARCHS.freighter = (G, S, rng) => {
    const L = rng.range(26, 34), z0 = -L / 2, z1 = L / 2, W = rng.range(3.2, 3.8), H = 2.6, cy = 1.6 + H;
    const hullC = pack(S.hull), hull2 = pack(S.hull2), acc = pack(S.acc), acc2 = pack(S.acc2), dark = pack(S.trim);
    hull(G, z0 + 3, z1 - 1.6, (t) => ({ w: W, h: H, cy, p: 8 }), (x, y, z, t, P) => { const ry = (y - P.cy) / P.h; if (ry > 0.88) return hull2; if (Math.floor((z - z0) / 1.5) % 4 === 0) return hull2; if (Math.abs(ry + 0.2) < 0.08) return acc; return hullC; });
    // bridge block with a window band
    G.box(-W - 0.8, W + 0.8, cy - H * 0.6, cy + H + 0.8, z0, z0 + 4, (x, y, z) => (Math.abs(y - (cy + H * 0.35)) < 0.3 && z < z0 + 0.6 ? pack(S.glass, 0, 1) : (Math.abs(y - (cy + H + 0.5)) < 0.3 ? acc : hull2)));
    S.meta.eye = [0, cy + H * 0.35, z0 + 1.2]; S.meta.seat = [0, cy - 0.5, z0 + 1.6];
    // cargo containers in coloured stacks with ribs
    const CONT = [0xc8322d, 0x2d64c8, 0xe0b52d, 0x3a9a44, 0xe0772d, 0x2db3c8, 0xe8e8e8, 0x8a3ac8];
    for (let z = z0 + 5; z + 2.6 < z1 - 3; z += 3) for (const sx of [-1, 1]) {
      if (!rng.chance(0.8)) continue;
      const c = rgb(rng.pick(CONT)), stack = rng.chance(0.35) ? 2 : 1;
      for (let k = 0; k < stack; k++) G.box(sx < 0 ? -W - 1.9 : W - 0.1, sx < 0 ? -W + 0.1 : W + 1.9, cy + H * 0.2 + k * 2.1 - 1.4, cy + H * 0.2 + k * 2.1 + 0.6, z, z + 2.6, (x, y, zz) => (Math.floor(zz * 3) % 3 === 0 ? pack(mul(c, 0.75)) : pack(c)));
    }
    // engine bank
    G.box(-W, W, cy - H, cy + H, z1 - 2, z1 - 1.5, dark);
    for (let ey = cy - H * 0.55; ey <= cy + H * 0.6; ey += 1.7) for (let ex = -W + 1.1; ex <= W - 1.1 + 0.01; ex += 1.8) engine(G, S, ex, ey, 0.7, z1 + 0.2, 1.8);
    // pipes along the flanks
    for (const sx of [-1, 1]) cylZ(G, sx * (W + 0.25), cy - H * 0.55, 0.28, z0 + 4, z1 - 2, (x, y, z) => (Math.floor(z * 1.4) % 4 === 0 ? acc2 : pack(mul(S.hull2, 0.8))));
    antenna(G, S, W - 0.5, cy + H + 0.8, z0 + 1.5, 1.6); antenna(G, S, -W + 0.5, cy + H + 0.8, z0 + 2.5, 1.1);
    S.meta.gearParts = [[-W + 0.8, z0 + 4], [W - 0.8, z0 + 4], [-W + 0.8, z1 - 4], [W - 0.8, z1 - 4]];
    for (const [x, z] of S.meta.gearParts) gear(G, S, x, z, cy - H + 0.2, 0.6);
  };
  ARCHS.cruiser = (G, S, rng) => {
    const L = rng.range(34, 42), z0 = -L / 2, z1 = L / 2, W = 2.8, H = 2.4, Rr = W + rng.range(3.2, 4.2), cy = Rr + 1.6;
    const hullC = pack(S.hull), hull2 = pack(S.hull2), acc = pack(S.acc), acc2 = pack(S.acc2), dark = pack(S.trim), glow = pack(S.glow, 1);
    hull(G, z0, z1 - 1.8, (t) => { const n = Math.min(1, t / 0.36); return { w: W * (0.22 + 0.78 * Math.pow(n, 0.75)), h: H * (0.32 + 0.68 * Math.pow(n, 0.7)), cy: cy + (1 - n) * 0.3, p: 3.4 }; },
      (x, y, z, t, P) => { const ry = (y - P.cy) / P.h; if (t < 0.03) return acc; if (ry < -0.5) return hull2; if (Math.abs(ry - 0.1) < 0.08 && t > 0.1) return acc; if (Math.floor(z) % 5 === 0) return hull2; return hullC; });
    // superstructure with lit windows
    const tz0 = z0 + L * 0.5, tz1 = tz0 + 5;
    G.box(-1.6, 1.6, cy + H * 0.8, cy + H + 2.8, tz0, tz1, (x, y, z) => (Math.abs(y - (cy + H + 1.9)) < 0.2 && Math.floor(z * 2) % 2 === 0 ? pack(S.core, 1) : (y > cy + H + 2.5 ? dark : hull2)));
    G.box(-1.2, 1.2, cy + H + 2.8, cy + H + 3.4, tz0 + 0.5, tz0 + 3, pack(S.glass, 0, 1));
    antenna(G, S, 0, cy + H + 3.4, tz0 + 3.6, 2.2); antenna(G, S, 0.9, cy + H + 2.8, tz1 - 0.6, 1.2);
    // ring drive
    const rz = z0 + L * 0.74;
    ring(G, 0, cy, rz, Rr, 0.55, (x, y, z, q) => (q < -0.35 ? glow : Math.floor(Math.atan2(y - cy, x) * 6) % 2 === 0 ? hull2 : acc2));
    for (let a = 0; a < 4; a++) { const ang = a * Math.PI / 2 + Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang); G.each(-Rr, Rr, cy - Rr, cy + Rr, rz - 0.3, rz + 0.3, (x, y, z, i, j, k) => { const px = x * ca + (y - cy) * sa, py = -x * sa + (y - cy) * ca; if (px > W * 0.8 && px < Rr && Math.abs(py) < 0.25) G.set(i, j, k, dark); }); }
    // turrets
    for (const tz of [z0 + L * 0.25, z0 + L * 0.38]) { ellipsoid(G, 0, cy + H * 0.95, tz, 0.8, 0.5, 0.8, () => dark); for (const sx of [-0.25, 0.25]) cannon(G, S, sx, cy + H * 1.05, tz - 0.3, 1.8); }
    for (const [ex, ey] of [[0, cy], [-1.3, cy - 0.3], [1.3, cy - 0.3], [0, cy + 1.2]]) engine(G, S, ex, ey, 0.62, z1 + 0.2, 1.6);
    cockpitRoom(G, S, { zNose: z0 + L * 0.08, zf: z0 + L * 0.12, zb: z0 + L * 0.22, floor: cy - 1.0, rim: cy - 0.1, hw: 1.1, seats: 2 });
    for (let z = z0 + L * 0.25; z < z1 - 4; z += 0.75) for (const sx of [-1, 1]) if (rng.chance(0.55)) G.each(sx * (W + 0.3), sx * (W + 0.3), cy + 0.4, cy + 0.6, z, z + 0.3, (x, y, zz, i, j, k) => { for (let ii = i; ii >= 0 && ii < G.nx; ii -= sx) if (G.get(ii, j, k)) { G.set(ii, j, k, pack(S.core, 1)); break; } });
    S.meta.gearParts = [[-1.6, z0 + L * 0.3], [1.6, z0 + L * 0.3], [-1.6, z1 - 6], [1.6, z1 - 6]];
    for (const [x, z] of S.meta.gearParts) gear(G, S, x, z, cy - H + 0.4, 0.55);
  };
  ARCHS.carrier = (G, S, rng) => {
    const L = rng.range(58, 70), z0 = -L / 2, z1 = L / 2, W = rng.range(6, 7.5), H = 4.5, cy = 2.5 + H;
    const hullC = pack(S.hull), hull2 = pack(S.hull2), acc = pack(S.acc), dark = pack(S.trim), win = pack(S.core, 1);
    hull(G, z0, z1 - 2, (t) => { const n = Math.min(1, t / 0.2); return { w: W * (0.5 + 0.5 * n), h: H * (0.55 + 0.45 * n), cy, p: 6 }; },
      (x, y, z, t, P) => { const ry = (y - P.cy) / P.h, rx = Math.abs(x) / P.w; if (rx > 0.97 && Math.abs(ry) < 0.6 && Math.floor(z * 2) % 3 === 0 && Math.floor(y * 2) % 3 === 0) return win; if (ry > 0.92) return Math.floor(z / 3) % 2 ? hull2 : hullC; if (Math.abs(ry + 0.3) < 0.06) return acc; return hullC; });
    for (const sx of [-1, 1]) G.box(sx < 0 ? -W - 2.5 : W - 0.2, sx < 0 ? -W + 0.2 : W + 2.5, cy - H * 0.5, cy + H * 0.3, z0 + L * 0.3, z1 - 8, (x, y, z) => (Math.abs(x) > W + 2.2 && Math.floor(z * 2) % 2 === 0 && Math.floor(y * 2) % 2 === 0 ? win : hull2));
    G.box(-3, 3, cy + H, cy + H + 5, z1 - 20, z1 - 11, (x, y, z) => (Math.abs(y - (cy + H + 3.5)) < 0.3 ? pack(S.glass, 0, 1) : (Math.floor(y * 2) % 3 === 0 && Math.abs(x) > 2.8 ? win : hull2)));
    antenna(G, S, 0, cy + H + 5, z1 - 17, 3.2); antenna(G, S, 2, cy + H + 5, z1 - 14, 2);
    G.box(-W + 1, W - 1, cy - H * 0.45, cy + H * 0.2, z0 + 1, z0 + 9, 0);
    G.box(-W + 1, W - 1, cy - H * 0.5, cy - H * 0.45, z0 + 1, z0 + 9, pack(S.glow, 1));
    for (let ey = cy - H * 0.5; ey <= cy + H * 0.5; ey += 2.2) for (let ex = -W + 1.4; ex <= W - 1.4; ex += 2.4) engine(G, S, ex, ey, 0.9, z1 + 0.3, 2.2);
    S.meta.eye = [0, cy + H + 3.5, z1 - 19.2]; S.meta.seat = [0, cy + H + 2.5, z1 - 18.5];
    S.meta.gearParts = [];
  };

  // ---------------------------------------------------------------- detail passes
  function surfaceDetail(G, S, rng) {
    const { nx, ny, nz, d, R } = G;
    const out = new Uint32Array(d);
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const n = G.idx(i, j, k), v = d[n];
      if (!v || (v & (EMIS | GLASSF))) continue;
      const up = !G.get(i, j + 1, k), exposed = up || !G.get(i - 1, j, k) || !G.get(i + 1, j, k) || !G.get(i, j, k - 1) || !G.get(i, j, k + 1) || !G.get(i, j - 1, k);
      if (!exposed) continue;
      let c = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
      // panel tone variation per 1.5 m panel & seams every 2 m
      const px = Math.floor(G.cx(i) / 1.5), pz = Math.floor(G.cz(k) / 1.5), py = Math.floor(G.cy(j) / 1.5);
      c = mul(c, 0.965 + hash(px, py, pz) * 0.07);
      if ((k % (R * 2) === 0) || (up && i % (R * 3) === 0 && G.part[n] === 0)) c = mul(c, 0.8);
      // bevel light on edges
      let open = 0; if (!G.get(i - 1, j, k)) open++; if (!G.get(i + 1, j, k)) open++; if (!G.get(i, j, k - 1)) open++; if (!G.get(i, j, k + 1)) open++; if (up) open++;
      if (open >= 2) c = mul(c, 1.07);
      // tiny vents & rivets on the top skin
      if (up && hash(i, j, k * 3 + 1) < 0.018) c = mul(c, 0.55);
      out[n] = pack(c, 0, 0);
    }
    G.d = out;
  }
  function stencil(G, S, text, sx, yC, zC, scale) {
    // write text on the hull side (sx = ±1) reading nose→tail on both sides
    const R = G.R, px = Math.max(1, Math.round(scale * R / 4));
    const col = pack(S.acc2 && S.hull[0] + S.hull[1] > 400 ? mul(S.trim, 0.9) : [240, 240, 240]);
    let zc = zC - (text.length * 4 * px) / (2 * R);
    const chars = sx > 0 ? text.split('').reverse() : text.split('');
    for (const ch of chars) {
      const F = FONT[ch]; if (!F) { zc += 4 * px / R; continue; }
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (F[r * 3 + c] === '1') for (let a = 0; a < px; a++) for (let b = 0; b < px; b++) {
        const z = zc + ((sx > 0 ? 2 - c : c) * px + a + 0.5) / R, y = yC + ((4 - r) * px + b + 0.5) / R - 2.5 * px / R;
        const j = G.iy(y), k = G.iz(z); if (j < 0 || k < 0 || j >= G.ny || k >= G.nz) continue;
        for (let i = sx > 0 ? G.nx - 1 : 0; sx > 0 ? i >= 0 : i < G.nx; i -= sx) { const v = G.get(i, j, k); if (v) { if (!(v & (EMIS | GLASSF))) G.set(i, j, k, col); break; } }
      }
      zc += 4 * px / R;
    }
  }
  function navLights(G) {
    let lo = null, hi = null;
    for (let i = 0; i < G.nx && !lo; i++) for (let j = 0; j < G.ny && !lo; j++) for (let k = 0; k < G.nz; k++) if (G.get(i, j, k) && !G.part[G.idx(i, j, k)]) { lo = [i, j, k]; break; }
    for (let i = G.nx - 1; i >= 0 && !hi; i--) for (let j = 0; j < G.ny && !hi; j++) for (let k = 0; k < G.nz; k++) if (G.get(i, j, k) && !G.part[G.idx(i, j, k)]) { hi = [i, j, k]; break; }
    if (lo) G.set(lo[0], lo[1], lo[2], pack([255, 40, 60], 1));
    if (hi) G.set(hi[0], hi[1], hi[2], pack([60, 255, 110], 1));
  }

  // ---------------------------------------------------------------- greedy mesher with baked AO
  // vertex: f32 x,y,z | i8 nx,ny,nz,pad | u8 r,g,b,emissive  (20 bytes)
  const AOK = [1, 0.8, 0.66, 0.54];
  // filter(cell, part) → include; occl(cell, part) → does this neighbour hide the face
  function meshGrid(G, filter, occl) {
    const { nx, ny, nz } = G, d = G.d, part = G.part;
    const dims = [nx, ny, nz];
    const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) ? -1 : (j * nz + k) * nx + i;
    const solidAO = (i, j, k) => { const n = at(i, j, k); if (n < 0) return 0; const v = d[n]; return v && !(v & GLASSF) && part[n] === 0 ? 1 : 0; };
    let cap = 1 << 16, out = new Float32Array(cap * 5), u8v = new Uint8Array(out.buffer), i8v = new Int8Array(out.buffer), nV = 0;
    const grow = () => { cap *= 2; const o2 = new Float32Array(cap * 5); o2.set(out); out = o2; u8v = new Uint8Array(out.buffer); i8v = new Int8Array(out.buffer); };
    const emit = (x, y, z, nxv, nyv, nzv, r, g, b, e) => {
      if (nV >= cap) grow();
      const o = nV * 5, ob = nV * 20;
      out[o] = x; out[o + 1] = y; out[o + 2] = z;
      i8v[ob + 12] = nxv * 127; i8v[ob + 13] = nyv * 127; i8v[ob + 14] = nzv * 127; i8v[ob + 15] = 0;
      u8v[ob + 16] = r; u8v[ob + 17] = g; u8v[ob + 18] = b; u8v[ob + 19] = e;
      nV++;
    };
    const AX = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
    const P = [0, 0, 0], Q = [0, 0, 0], C = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], cor = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let a = 0; a < 3; a++) {
      const ua = AX[a][1], va = AX[a][2];
      for (const s of [1, -1]) {
        const U = s > 0 ? ua : va, V = s > 0 ? va : ua;
        const nU = dims[U], nVv = dims[V];
        const keys = new Float64Array(nU * nVv), cols = new Uint32Array(nU * nVv), aos = new Uint8Array(nU * nVv);
        for (let w = 0; w < dims[a]; w++) {
          let any = false;
          for (let v = 0; v < nVv; v++) for (let u = 0; u < nU; u++) {
            P[a] = w; P[U] = u; P[V] = v;
            const m = v * nU + u; keys[m] = 0;
            const n = at(P[0], P[1], P[2]); const c = d[n];
            if (!c || !filter(c, part[n])) continue;
            Q[0] = P[0]; Q[1] = P[1]; Q[2] = P[2]; Q[a] += s;
            const nn = at(Q[0], Q[1], Q[2]);
            if (nn >= 0 && d[nn] && occl(c, d[nn], part[nn])) continue;
            let sig = 0;
            if (!(c & EMIS)) for (let t = 0; t < 4; t++) {
              const du = cor[t][0], dv = cor[t][1];
              const s1 = (Q[U] += du, solidAO(Q[0], Q[1], Q[2])); Q[U] -= du;
              const s2 = (Q[V] += dv, solidAO(Q[0], Q[1], Q[2])); Q[V] -= dv;
              Q[U] += du; Q[V] += dv; const s3 = solidAO(Q[0], Q[1], Q[2]); Q[U] -= du; Q[V] -= dv;
              sig |= (s1 && s2 ? 3 : s1 + s2 + s3) << (t * 2);
            }
            cols[m] = c; aos[m] = sig; keys[m] = (c & 0x7ffffff) * 256 + sig + 1; any = true;
          }
          if (!any) continue;
          const plane = s > 0 ? w + 1 : w;
          for (let v = 0; v < nVv; v++) for (let u = 0; u < nU;) {
            const m = v * nU + u, key = keys[m];
            if (!key) { u++; continue; }
            let wd = 1; while (u + wd < nU && keys[m + wd] === key) wd++;
            let ht = 1, stop = false;
            while (v + ht < nVv && !stop) { const row = (v + ht) * nU + u; for (let t = 0; t < wd; t++) if (keys[row + t] !== key) { stop = true; break; } if (!stop) ht++; }
            for (let hh = 0; hh < ht; hh++) { const row = (v + hh) * nU + u; for (let t = 0; t < wd; t++) keys[row + t] = 0; }
            const c = cols[m], sig = aos[m];
            const cu = [u, u + wd, u + wd, u], cv = [v, v, v + ht, v + ht];
            for (let t = 0; t < 4; t++) { C[t][a] = plane; C[t][U] = cu[t]; C[t][V] = cv[t]; }
            const nxv = a === 0 ? s : 0, nyv = a === 1 ? s : 0, nzv = a === 2 ? s : 0;
            const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, e = (c & EMIS) ? 255 : 0;
            const ao0 = AOK[sig & 3], ao1 = AOK[(sig >> 2) & 3], ao2 = AOK[(sig >> 4) & 3], ao3 = AOK[(sig >> 6) & 3];
            const A = [ao0, ao1, ao2, ao3];
            const order = ao0 + ao2 < ao1 + ao3 ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
            for (const t of order) emit(C[t][0], C[t][1], C[t][2], nxv, nyv, nzv, r * A[t], g * A[t], b * A[t], e);
            u += wd;
          }
        }
      }
    }
    return { data: new Uint8Array(out.buffer, 0, nV * 20).slice(), count: nV };
  }
  // coarse 1 m occupancy for collisions & landing (cells ≥ 30% filled)
  function occupancy(G) {
    const R = G.R, bx = Math.ceil(G.nx / R), by = Math.ceil(G.ny / R), bz = Math.ceil(G.nz / R);
    const occ = new Uint8Array(bx * by * bz), cnt = new Uint16Array(bx * by * bz);
    // (a walkable cabin's rooms count as solid: G.hollow, shipcabin.js)
    const hol = G.hollow || null;
    for (let j = 0; j < G.ny; j++) for (let k = 0; k < G.nz; k++) for (let i = 0; i < G.nx; i++) { const n = G.idx(i, j, k), v = G.d[n], p = G.part[n]; if ((v && (!p || p === 3 || p === 4)) || (hol && hol[n])) cnt[(Math.floor(j / R) * bz + Math.floor(k / R)) * bx + Math.floor(i / R)]++; }
    const th = R * R * R * 0.3;
    for (let n = 0; n < occ.length; n++) occ[n] = cnt[n] >= th ? 1 : 0;
    return { bx, by, bz, occ };
  }

  // software isometric preview (shipyard cards): view from starboard-front-above
  function isoPreview(G, W, H) {
    const img = new Uint8ClampedArray(W * H * 4);
    const c30 = Math.cos(Math.PI / 6), s30 = 0.5;
    const pr = (i, j, k) => [(i + k) * c30, (i - k) * s30 - j];
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    let bi0 = 1e9, bi1 = -1, bj1 = -1, bk0 = 1e9, bk1 = -1;
    for (let j = 0; j < G.ny; j++) for (let k = 0; k < G.nz; k++) for (let i = 0; i < G.nx; i++) if (G.d[G.idx(i, j, k)]) { if (i < bi0) bi0 = i; if (i > bi1) bi1 = i; if (j > bj1) bj1 = j; if (k < bk0) bk0 = k; if (k > bk1) bk1 = k; }
    for (const i of [bi0, bi1 + 1]) for (const j of [0, bj1 + 1]) for (const k of [bk0, bk1 + 1]) { const p = pr(i, j, k); mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); }
    const S = Math.min((W - 16) / (mxx - mnx), (H - 16) / (mxy - mny));
    const ox = (W - (mxx - mnx) * S) / 2 - mnx * S, oy = (H - (mxy - mny) * S) / 2 - mny * S;
    const list = [];
    for (let j = 0; j < G.ny; j++) for (let k = 0; k < G.nz; k++) for (let i = 0; i < G.nx; i++) {
      const v = G.d[G.idx(i, j, k)]; if (!v) continue;
      const solidN = (a, b, c) => { const w = G.get(a, b, c); return w && !(w & GLASSF); };
      const top = !solidN(i, j + 1, k), side = !solidN(i + 1, j, k), front = !solidN(i, j, k - 1);
      if (top || side || front) list.push(i, j, k, v, (top ? 1 : 0) | (side ? 2 : 0) | (front ? 4 : 0));
    }
    const ord = []; for (let n = 0; n < list.length; n += 5) ord.push(n);
    ord.sort((a, b) => (list[a] + list[a + 1] - list[a + 2]) - (list[b] + list[b + 1] - list[b + 2]));
    const fill = (pts, r, g, b, a) => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5; let inside = true, sign = 0;
        for (let t = 0; t < 4 && inside; t++) { const A = pts[t], B = pts[(t + 1) & 3]; const cr = (B[0] - A[0]) * (py - A[1]) - (B[1] - A[1]) * (px - A[0]); if (cr !== 0) { const sg = cr > 0 ? 1 : -1; if (!sign) sign = sg; else if (sg !== sign) inside = false; } }
        if (!inside) continue;
        const o = (y * W + x) * 4;
        if (a >= 1) { img[o] = r; img[o + 1] = g; img[o + 2] = b; img[o + 3] = 255; }
        else { img[o] = img[o] * (1 - a) + r * a; img[o + 1] = img[o + 1] * (1 - a) + g * a; img[o + 2] = img[o + 2] * (1 - a) + b * a; img[o + 3] = Math.max(img[o + 3], 200); }
      }
    };
    const P = (i, j, k) => { const p = pr(i, j, k); return [ox + p[0] * S, oy + p[1] * S]; };
    for (const n of ord) {
      const i = list[n], j = list[n + 1], k = list[n + 2], v = list[n + 3], f = list[n + 4];
      const e = v & EMIS ? 1.3 : 1, gl = v & GLASSF, a = gl ? 0.5 : 1;
      const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
      const C = (k2) => [Math.min(255, r * k2 * e), Math.min(255, g * k2 * e), Math.min(255, b * k2 * e)];
      if (f & 1) { const c = C(1); fill([P(i, j + 1, k), P(i + 1, j + 1, k), P(i + 1, j + 1, k + 1), P(i, j + 1, k + 1)], c[0], c[1], c[2], a); }
      if (f & 2) { const c = C(0.84); fill([P(i + 1, j, k), P(i + 1, j + 1, k), P(i + 1, j + 1, k + 1), P(i + 1, j, k + 1)], c[0], c[1], c[2], a); }
      if (f & 4) { const c = C(0.68); fill([P(i, j, k), P(i + 1, j, k), P(i + 1, j + 1, k), P(i, j + 1, k)], c[0], c[1], c[2], a); }
    }
    return { w: W, h: H, rgba: img };
  }

  // ---------------------------------------------------------------- public API
  const Starship = VR.Starship = {
    ARCH, PAL, archetypes: Object.keys(ARCH),
    pickArch(rng, allow) {
      const keys = (allow || Object.keys(ARCH)).filter(k => ARCH[k] && (allow || ARCH[k].weight > 0));
      let tot = 0; for (const k of keys) tot += Math.max(0.2, ARCH[k].weight);
      let r = rng.next() * tot; for (const k of keys) { r -= Math.max(0.2, ARCH[k].weight); if (r <= 0) return k; }
      return keys[0];
    },
    // design + mesh (worker). → {meta, hull:{data,count}, glass, gear, occ}
    build(seed, arch, opts) {
      opts = opts || {};
      const rng = new VR.RNG(((seed >>> 0) ^ 0x2545f491) >>> 0);
      arch = arch && ARCH[arch] ? arch : this.pickArch(rng, opts.allow);
      const palOpts = arch === 'shuttle' ? [PAL[0], PAL[0], PAL[7]] : arch === 'freighter' ? [PAL[5], PAL[0], PAL[3], PAL[2]] : PAL;
      const pal = opts.palette ? (PAL.find(p => p.key === opts.palette) || PAL[0]) : rng.pick(palOpts);
      const S = { hull: rgb(pal.hull), hull2: rgb(pal.hull2), trim: rgb(pal.trim), acc: rgb(pal.acc), acc2: rgb(pal.acc2), glow: rgb(pal.glow), glass: rgb(pal.glass), eng: rgb(pal.eng), core: rgb(pal.core), meta: { exhaust: [], guns: [], eye: null, seat: null } };
      const R = ARCH[arch].res;
      const big = arch === 'carrier', mid = arch === 'cruiser' || arch === 'freighter';
      const G = new Grid(R, big ? -14 : mid ? -10 : -9, big ? 14 : mid ? 10 : 9, 0, big ? 22 : mid ? 18 : 10, big ? -38 : mid ? -23 : -14, big ? 38 : mid ? 23 : 14);
      ARCHS[arch](G, S, rng);
      navLights(G);
      const nr = new VR.RNG(((seed >>> 0) ^ 0x9e3779b9) + Object.keys(ARCH).indexOf(arch) * 7777);
      const code = ARCH[arch].code + '-' + (10 + nr.int(90));
      const nm = nr.chance(0.25) ? ['Bright', 'Silent', 'Wandering', 'Crimson', 'Distant', 'Lucky', 'Patient', 'Golden', 'Midnight', 'Gentle', 'Rising'][nr.int(11)] + ' ' + nr.pick(NAMES) : nr.pick(NAMES);
      surfaceDetail(G, S, rng);
      // stencil the registry on both flanks
      if (!big) {
        let yC = 2, zC = 0, best = -1;
        for (let k = Math.floor(G.nz * 0.35); k < Math.floor(G.nz * 0.7); k += R) for (let j = 0; j < G.ny; j++) { let w = 0; for (let i = G.nx - 1; i >= Math.floor(G.nx / 2); i--) if (G.d[G.idx(i, j, k)] && !G.part[G.idx(i, j, k)]) { w = i; break; } if (w > best) { best = w; yC = G.cy(j); zC = G.cz(k); } }
        stencil(G, S, 'R9-' + code.slice(-2), 1, yC + 0.05, zC, 1); stencil(G, S, 'R9-' + code.slice(-2), -1, yC + 0.05, zC, 1);
      }
      // bounds (metres) of the whole model
      let i0 = 1e9, i1 = -1, j1 = -1, k0 = 1e9, k1 = -1;
      for (let j = 0; j < G.ny; j++) for (let k = 0; k < G.nz; k++) for (let i = 0; i < G.nx; i++) if (G.d[G.idx(i, j, k)]) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j > j1) j1 = j; if (k < k0) k0 = k; if (k > k1) k1 = k; }
      const meta = {
        seed: seed >>> 0, arch, label: ARCH[arch].label, name: code + ' ' + nm, code, palette: pal.key, paletteName: pal.name, res: R,
        origin: [G.x0, G.y0, G.z0], dims: [G.nx, G.ny, G.nz],
        bounds: [G.cx(i0) - 0.5 / R, 0, G.cz(k0) - 0.5 / R, G.cx(i1) + 0.5 / R, G.cy(j1) + 0.5 / R, G.cz(k1) + 0.5 / R],
        eye: S.meta.eye || [0, 3, -3], seat: S.meta.seat || [0, 2, -3], exhaust: S.meta.exhaust, guns: S.meta.guns,
        gear: (S.meta.gearParts || []).map(q => [q[0], q[1]]),   // landing feet [x, z] (pads at y = 0)
        cockpit: S.meta.cockpit || null,                          // the room for the furnished cockpit (cockpit.js)
        cabin: S.meta.cabin || null,                              // the walkable deck behind it (shipcabin.js, cabin.js)
      };
      meta.length = +(meta.bounds[5] - meta.bounds[2]).toFixed(1); meta.width = +(meta.bounds[3] - meta.bounds[0]).toFixed(1); meta.height = +meta.bounds[4].toFixed(1);
      meta.speed = Math.round(Math.min(90, 26 + meta.exhaust.length * 7 * 40 / Math.max(20, meta.length * meta.width * 0.6)));
      // hull faces are only hidden by other hull voxels (so retracting the gear leaves no holes)
      const hullM = meshGrid(G, (c, p) => !(c & GLASSF) && p === 0, (c, nb, np) => !(nb & GLASSF) && np === 0);
      const glassM = meshGrid(G, (c) => !!(c & GLASSF), () => true);
      const gearM = meshGrid(G, (c, p) => p === 1, (c, nb) => !(nb & GLASSF));
      // the cockpit's stand-in furniture (drawn whenever the detailed cockpit isn't)
      const intM = meshGrid(G, (c, p) => p === 2 && !(c & GLASSF), (c, nb, np) => !(nb & GLASSF) && np !== 1);
      const occ = occupancy(G);
      meta.tris = (hullM.count + glassM.count + gearM.count + intM.count) / 3;
      const res = { meta, hull: hullM, glass: glassM, gear: gearM, interior: intM, occ };
      // a walkable inside: the ramp, the side door's plug, its stair and the cabin's coarse furniture move / hide on their own
      if (meta.cabin) {
        const own = (pp) => (c, nb, np) => !(nb & GLASSF) && np === pp;
        res.extra = { ramp: meshGrid(G, (c, p) => p === 3, own(3)), door: meshGrid(G, (c, p) => p === 4, own(4)), stair: meshGrid(G, (c, p) => p === 5, own(5)), cabin: meshGrid(G, (c, p) => p === 6, (c, nb, np) => !(nb & GLASSF) && (np === 6 || np === 0)) };
        res.walk = VR.ShipCabin.walkGrid(G);
        for (const k in res.extra) meta.tris += res.extra[k].count / 3;
      }
      if (opts.preview) res.preview = isoPreview(G, opts.preview[0], opts.preview[1]);
      if (opts.debugGrid) res.grid = G;
      return res;
    },
  };
  void Starship;
})(VR);

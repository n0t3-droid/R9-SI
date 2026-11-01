// ============================================================================
// a-fairy · the enchanted places' voxel models (VR.VOXMODELS, built on first use; our own, from boxes and ellipsoids):
//   fy_shroom_0/1/2  a giant glowing mushroom (teal slender · violet broad · rose dome), glowing gills and spots
//   fy_tree          the Slumber Tree: a flared trunk with roots, a round door (its own part: it swings), warm windows,
//                    a sleeping face, a great crown with blossoms and glowing berries
//   fy_house_0/1/2   a tiny folk house (a mushroom cap roof), fy_lamp a little lamp post, fy_lantern a lost lantern
//   fy_pool, fy_crystal_0/1/2   the Wishing Spring's glowing pool and its crystal shards
//   fy_stone, fy_altar, fy_tablet   the Moonstone Circle's stones with faint runes
//   fy_garden, fy_puff, fy_note_0…4 the Floating Garden, a cloud of the bridge, the five singing stones
//   fy_sprite_0…4, fy_sprite_hat     the Flausel (a round fluffy body, big eyes, rosy cheeks, a leaf cap, a glowing feeler,
//                    two small wings, tiny arms and legs: parts body, cap, wing_l, wing_r, arm_l, arm_r, leg_l, leg_r)
//   fy_seed          o-wander2: the glow seed of an adventure's twist (a dandelion puff of light)
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (!M || !Grid) return;
  const TAU = Math.PI * 2;
  const part = (sx, sy, sz, pv, fn) => { const gr = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(gr); return { grid: gr, pivot: [0, 0, 0] }; };
  const hs = (x, y, z, s) => { let v = Math.imul(x * 374761393 + y * 668265263 + z * 2147483647 + (s | 0) * 1274126177, 1103515245); v ^= v >>> 13; v = Math.imul(v, 1597334677); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  const mix = (a, b, k) => { const r = ((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k, g = ((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k, c = (a & 255) * (1 - k) + (b & 255) * k; return (r << 16) | (g << 8) | c; };

  // ---------------------------------------------------------------- the glowing mushrooms (1 voxel = 1/4 m; 4.5 m tall at scale 1)
  const SHROOM = [
    { cap: 0x2fb7a8, top: 0x5fd8c4, spot: 0xd8fff6, gill: 0x7affe6, stem: 0xeef6ea, capR: 6.4, capH: 7, stemH: 12, cone: 1 },
    { cap: 0x7a4ad8, top: 0x9a6ae8, spot: 0xf4e4ff, gill: 0xc89aff, stem: 0xf2ecf6, capR: 8.8, capH: 5, stemH: 10, cone: 0 },
    { cap: 0xe0607e, top: 0xf08aa0, spot: 0xfff4f6, gill: 0xffb4cc, stem: 0xfaf0ea, capR: 7.4, capH: 6.2, stemH: 11, cone: 0.4 },
  ];
  SHROOM.forEach((S, v) => {
    M['fy_shroom_' + v] = () => {
      const W = 20, c = 10;
      const body = part(W, 22, W, [c, 0, c], (gr) => {
        // the stem: a gentle lean, thicker at the foot, a skirt of glow at the ground
        for (let y = 0; y <= S.stemH; y++) {
          const lean = Math.sin(y / S.stemH * 1.4) * 0.9, r = 1.6 + (y < 3 ? (3 - y) * 0.45 : 0) + (v === 1 ? 0.4 : 0);
          for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) { const d = Math.hypot(x + 0.5 - c - lean, z + 0.5 - c); if (d <= r) gr.set(x, y, z, y === 0 && d > r - 1 ? S.gill : mix(S.stem, S.gill, y < 2 ? 0.25 : 0), y === 0 && d > r - 1 ? 1 : 0); }
        }
        // the cap: a dome (or a cone) over the stem; its underside the glowing gills, its top spotted
        const y0 = S.stemH - 1, lean = Math.sin(1.4) * 0.9;
        for (let y = y0; y < y0 + S.capH + 2; y++) for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
          const u = (y - y0) / S.capH, d = Math.hypot(x + 0.5 - c - lean, z + 0.5 - c);
          const R = S.capR * (S.cone ? Math.max(0, 1 - Math.pow(u, 1.6 - S.cone * 0.6)) : Math.sqrt(Math.max(0, 1 - u * u)));
          if (d > R || u > 1) continue;
          const under = y === y0, edge = d > R - 1.1;
          if (under) { gr.set(x, y, z, ((x + z) & 1) ? S.gill : mix(S.gill, 0xffffff, 0.3), 1); continue; }
          const spot = hs(x, y, z, v) < 0.09 && edge;
          gr.set(x, y, z, spot ? S.spot : mix(S.cap, S.top, Math.min(1, u * 1.2)), spot ? 1 : 0);
        }
        // a ring of little glowing buttons at the foot
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + v, x = Math.round(c + Math.cos(a) * 4.2), z = Math.round(c + Math.sin(a) * 4.2); gr.set(x, 0, z, S.stem); gr.set(x, 1, z, S.gill, 1); }
      });
      return { unit: 4, radius: 3, parts: { body }, layout: { body: [0, 0, 0] } };
    };
  });

  // ---------------------------------------------------------------- the Slumber Tree (1 voxel = 1/2 m: 17 m of trunk, a 28 m crown)
  M.fy_tree = () => {
    const bark = 0x7a5236, bark2 = 0x5e3e28, moss = 0x5e8a44, warm = 0xffc870, dark = 0x2e1c12;
    const W = 34, c = 17, H = 36;
    const rad = (y, a) => { const flare = y < 7 ? (7 - y) * 0.75 : 0, root = y < 6 ? 3.2 * Math.max(0, Math.cos(a * 5 + 0.4)) * (1 - y / 6) : 0, wob = Math.sin(y * 0.35 + a * 3) * 0.35; return 5 + flare + root + wob - (y > 24 ? (y - 24) * 0.12 : 0); };
    const trunk = part(W, H, W, [c, 0, c], (gr) => {
      for (let y = 0; y < H; y++) for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - c, dz = z + 0.5 - c, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx), R = rad(y, a);
        if (d > R || d < R - 2.2) continue;
        const groove = Math.sin(a * 14 + y * 0.18) > 0.55;
        const col = y < 3 && hs(x, y, z, 1) < 0.55 ? moss : groove ? bark2 : (hs(x, y, z, 2) < 0.2 ? 0x8a6040 : bark);
        gr.set(x, y, z, col);
      }
      // the door's passage on the front (−z): a round arch between the roots, warm light at its end
      const zD = c - 4;
      for (let y = 0; y <= 8; y++) for (let x = c - 3; x <= c + 2; x++) {
        const ax = x + 0.5 - c, out = y > 5 ? Math.hypot(ax, (y - 5) * 1.1) > 3 : Math.abs(ax) > 3; if (out) continue;
        for (let z = 0; z < zD; z++) gr.c[gr.i(x, y, z)] = 0;
        gr.set(x, y, zD, y > 6 ? mix(warm, 0xffffff, 0.2) : warm, 1);
      }
      // the passage's walls: lighter wood, two little lamps
      for (let y = 0; y <= 6; y++) for (let z = 0; z < zD; z++) for (const x of [c - 4, c + 3]) if (gr.get(x, y, z)) gr.set(x, y, z, z > zD - 3 ? 0xb08050 : gr.get(x, y, z) & 0xffffff);
      for (const x of [c - 4, c + 3]) { gr.set(x, 5, zD - 1, 0xffe08a, 1); }
      // warm round windows up the trunk, little sills
      for (const [a, y] of [[-1.2, 13], [-2.0, 19], [0.4, 16], [2.3, 22], [-0.6, 27], [1.4, 10]]) {
        const R = rad(y, a), wx = c + Math.cos(a) * (R - 0.6), wz = c + Math.sin(a) * (R - 0.6);
        for (let dy = -1; dy <= 0; dy++) for (let k = -1; k <= 0; k++) gr.set(Math.floor(wx + k * Math.sin(a)), y + dy, Math.floor(wz - k * Math.cos(a)), warm, 1);
        gr.set(Math.floor(wx + Math.cos(a) * 0.8), y - 2, Math.floor(wz + Math.sin(a) * 0.8), 0xb08050);
      }
      // the sleeping face (front, −z): two closed eyes (soft arcs), a little round mouth, two knots for cheeks
      const fz = (x, y) => Math.floor(c - rad(y, Math.atan2(-1, (x + 0.5 - c) / 6))) ;
      for (const ex of [c - 4, c + 2]) for (let k = 0; k < 4; k++) { const x = ex + k, y = 23 - (k === 0 || k === 3 ? 0 : 1); gr.set(x, y, fz(x, y), dark); gr.set(x, y, fz(x, y) + 1, dark); }
      for (const [x, y] of [[c - 1, 18], [c, 18], [c - 1, 17], [c, 17]]) { gr.set(x, y, fz(x, y), dark); gr.set(x, y, fz(x, y) + 1, dark); }
      for (const x of [c - 6, c + 5]) { const y = 20; gr.set(x, y, fz(x, y), 0xa06a48); }
      // branch arms up into the crown
      for (const [a, y0] of [[0.3, 26], [2.4, 28], [4.3, 25]]) for (let k = 0; k < 9; k++) { const R = rad(y0, a) + k, x = Math.floor(c + Math.cos(a) * R), z = Math.floor(c + Math.sin(a) * R); gr.box(x, y0 + Math.floor(k * 0.8), z, x + 1, y0 + Math.floor(k * 0.8) + 1, z + 1, bark); }
    });
    const CW = 56, cc = 28;
    const crown = part(CW, 30, CW, [cc, 0, cc], (gr) => {
      const blobs = [[0, 12, 0, 20, 11, 20], [-10, 9, 5, 12, 8, 12], [9, 10, -7, 13, 8, 12], [4, 15, 9, 12, 8, 11], [-6, 16, -8, 11, 7, 11], [0, 20, 0, 12, 7, 12]];
      const leaf = [0x4f9a48, 0x5fb056, 0x3f8040, 0x6ac060];
      for (const [bx, by, bz, rx, ry, rz] of blobs) gr.ell(cc + bx, by, cc + bz, rx, ry, rz, (x, y, z, d) => {
        if (d < 0.72) return null;   // a shell (the inside is never seen)
        const r = hs(x, y, z, 7);
        if (r < 0.012) return 0xffe08a;   // a glowing berry (set emissive below)
        if (r < 0.07) return 0xf4a8c8;    // a blossom
        return leaf[Math.floor(hs(x, y, z, 8) * 4)];
      });
      for (let i = 0; i < gr.c.length; i++) if ((gr.c[i] & 0xffffff) === 0xffe08a && gr.c[i]) gr.c[i] = (gr.c[i] | (1 << 24)) >>> 0;
    });
    const door = part(6, 8, 1, [0, 0, 0], (gr) => {
      gr.box(0, 0, 0, 5, 5, 0, (x) => (x & 1 ? 0x6a4428 : 0x7a5232));
      for (let y = 6; y < 8; y++) for (let x = 0; x < 6; x++) if (Math.hypot(x + 0.5 - 3, (y - 5) * 1.1) <= 3) gr.set(x, y, 0, 0x6a4428);
      gr.set(2, 5, 0, 0xffd27a, 1); gr.set(3, 5, 0, 0xffd27a, 1); gr.set(2, 6, 0, 0xffd27a, 1); gr.set(3, 6, 0, 0xffd27a, 1);
      gr.set(4, 3, 0, 0xe8c050);
    });
    return { unit: 2, radius: 16, parts: { trunk, crown, door }, layout: { trunk: [0, 0, 0], crown: [0, 30, 0], door: [-3, 0, -5] } };
  };

  // ---------------------------------------------------------------- the tiny folk's houses and lamps (1 voxel = 1/8 m)
  const ROOF = [[0xd8483a, 0xfff4ea], [0xe0a040, 0xfff0d0], [0x7a6ad8, 0xf0ecff]];
  ROOF.forEach(([roof, dot], v) => {
    M['fy_house_' + v] = () => ({
      unit: 8, radius: 1.2, parts: {
        body: part(18, 17, 18, [9, 0, 9], (gr) => {
          gr.ell(9, 4, 9, 4.6, 5, 4.6, (x, y) => (y < 9 ? (y < 1 ? 0xc8b89a : 0xf2e6cc) : null), { shade: 0.08 });
          for (let y = 0; y < 5; y++) for (let x = 8; x <= 9; x++) gr.set(x, y, 4, y > 3 ? 0x4a2e18 : 0x6a4428);   // the door (−z)
          gr.set(10, 2, 4, 0xe8c050);
          for (const [x, z] of [[4, 9], [14, 9]]) { gr.set(x, 5, z, 0xffd27a, 1); gr.set(x, 6, z, 0xffd27a, 1); }   // warm windows
          gr.set(9, 6, 4, 0xffd27a, 1);
          gr.ell(9, 9.5, 9, 8.6, 5, 8.6, (x, y, z, d) => (y < 9 ? null : (d > 0.6 && hs(x, y, z, v + 3) < 0.12 ? dot : roof)));
          gr.box(12, 13, 11, 13, 15, 12, 0x8a7a6a);   // a chimney
        }),
      }, layout: { body: [0, 0, 0] },
    });
  });
  M.fy_lamp = () => ({ unit: 8, radius: 0.8, parts: { body: part(5, 10, 5, [2, 0, 2], (gr) => { gr.box(2, 0, 2, 2, 6, 2, 0x5a3a22); gr.box(1, 7, 1, 3, 9, 3, 0xffd27a, { emis: 1 }); gr.box(1, 10, 1, 3, 10, 3, 0x3a2a1e); }) }, layout: { body: [0, 0, 0] } });
  M.fy_lantern = () => ({
    unit: 16, radius: 0.5, parts: {
      body: part(8, 12, 8, [4, 0, 4], (gr) => {
        gr.box(1, 0, 1, 6, 1, 6, 0x3a2a1e); gr.box(2, 2, 2, 5, 7, 5, 0xffb84a, { emis: 1 }); gr.box(3, 3, 3, 4, 6, 4, 0xfff0b0, { emis: 1 });
        for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) gr.box(x, 2, z, x, 7, z, 0x4a3422);
        gr.box(1, 8, 1, 6, 8, 6, 0x3a2a1e); gr.box(3, 9, 3, 4, 9, 4, 0x3a2a1e); gr.set(3, 10, 3, 0xc8a050); gr.set(4, 11, 3, 0xc8a050); gr.set(3, 11, 4, 0xc8a050);
      }),
    }, layout: { body: [0, 0, 0] },
  });

  // ---------------------------------------------------------------- the Wishing Spring (1 voxel = 1/4 m: a pool 5.5 m across)
  M.fy_pool = () => ({
    unit: 4, radius: 4, parts: {
      body: part(26, 3, 26, [13, 0, 13], (gr) => {
        for (let z = 0; z < 26; z++) for (let x = 0; x < 26; x++) {
          const d = Math.hypot(x + 0.5 - 13, z + 0.5 - 13);
          if (d < 10.5) { const k = d / 10.5; gr.set(x, 0, z, k < 0.45 ? mix(0xb8fbff, 0x6ae0f4, k / 0.45) : mix(0x6ae0f4, 0x2a90c0, (k - 0.45) / 0.55), k < 0.62 ? 1 : 0); }
          else if (d < 12.6) { const r = hs(x, 0, z, 4); gr.set(x, 0, z, r < 0.3 ? 0xe8e4dc : r < 0.6 ? 0xb8b4ac : 0x7e8a6a); if (r < 0.25) gr.set(x, 1, z, 0xd8d4cc); }
        }
        for (const [x, z, f] of [[6, 9, 0xff9ac8], [17, 6, 0xffffff], [19, 16, 0xff9ac8], [8, 18, 0xffe08a]]) { gr.box(x, 0, z, x + 2, 0, z + 1, 0x4a9a4a); gr.set(x + 1, 1, z, f, 1); }   // lily pads with glowing blooms
      }),
    }, layout: { body: [0, 0, 0] },
  });
  const CRY = [[0x7ad8ff, 0xd8f6ff], [0xff9ad8, 0xffe0f2], [0xffe08a, 0xfff6d8]];
  CRY.forEach(([cc, hi], v) => {
    M['fy_crystal_' + v] = () => ({
      unit: 8, radius: 1.5, parts: {
        body: part(14, 24, 14, [7, 0, 7], (gr) => {
          const shards = [[7, 7, 0, 0, 22, 2.2], [4, 8, -0.35, 0.1, 14, 1.6], [10, 6, 0.3, -0.25, 16, 1.7], [7, 10, 0.05, 0.4, 11, 1.4], [8, 4, 0.1, -0.4, 9, 1.2]];
          for (const [sx, sz, tx, tz, L, r] of shards) for (let k = 0; k < L; k++) {
            const u = k / L, rr = r * (u < 0.75 ? 1 : (1 - u) / 0.25) + 0.3, cx = sx + tx * k, cz = sz + tz * k;
            for (let z = Math.floor(cz - rr); z <= cz + rr; z++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++) if (Math.abs(x + 0.5 - cx) + Math.abs(z + 0.5 - cz) <= rr + 0.3) gr.set(x, k, z, u > 0.8 || Math.abs(x + 0.5 - cx) > rr - 0.7 ? hi : cc, 1);
          }
          gr.box(4, 0, 4, 10, 0, 10, (x, y, z) => (hs(x, y, z, 9) < 0.5 ? 0x9a9690 : null));
        }),
      }, layout: { body: [0, 0, 0] },
    });
  });

  // ---------------------------------------------------------------- the Moonstone Circle (1 voxel = 1/4 m)
  const stoneCol = (x, y, z, s) => { const r = hs(x, y, z, s); return r < 0.08 ? 0x6a7280 : r < 0.5 ? 0x8a92a0 : 0x9aa2ae; };
  M.fy_stone = () => ({
    unit: 4, radius: 2.5, parts: {
      body: part(8, 18, 6, [4, 0, 3], (gr) => {
        for (let y = 0; y < 18; y++) { const w = 3.2 - Math.max(0, y - 12) * 0.35 + Math.sin(y * 0.7) * 0.25, t = 2.2 - Math.max(0, y - 13) * 0.25; for (let z = 0; z < 6; z++) for (let x = 0; x < 8; x++) { if (Math.abs(x + 0.5 - 4) > w || Math.abs(z + 0.5 - 3) > t) continue; gr.set(x, y, z, y < 2 && hs(x, y, z, 3) < 0.6 ? 0x5a8a4a : y > 15 && hs(x, y, z, 4) < 0.35 ? 0x6a9a50 : stoneCol(x, y, z, 1)); } }
        // the runes: a faint spiral and two dots, cut into the front (−z) and the back
        const rune = [[4, 4], [3, 5], [3, 6], [4, 7], [5, 7], [5, 6], [4, 9], [4, 11], [3, 12], [5, 12]];
        for (const [x, y] of rune) { for (let z = 0; z < 6; z++) if (gr.get(x, y, z)) { gr.set(x, y, z, 0x9ae8ff, 1); break; } for (let z = 5; z >= 0; z--) if (gr.get(x, y, z)) { gr.set(x, y, z, 0x9ae8ff, 1); break; } }
      }),
    }, layout: { body: [0, 0, 0] },
  });
  M.fy_altar = () => ({
    unit: 4, radius: 2, parts: {
      body: part(14, 4, 14, [7, 0, 7], (gr) => {
        gr.ell(7, 0, 7, 6.6, 3.2, 6.6, (x, y, z) => stoneCol(x, y, z, 5));
        for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 1.25 + 0.9; gr.set(Math.floor(7 + Math.cos(a) * 3.6), 2, Math.floor(7 + Math.sin(a) * 3.6), 0xd8f0ff, 1); }   // a crescent moon
      }),
    }, layout: { body: [0, 0, 0] },
  });
  M.fy_tablet = () => ({
    unit: 4, radius: 1, parts: {
      body: part(6, 7, 3, [3, 0, 1], (gr) => {
        gr.box(0, 0, 0, 5, 5, 2, (x, y, z) => stoneCol(x, y, z, 6)); gr.box(1, 6, 0, 4, 6, 2, (x, y, z) => stoneCol(x, y, z, 7));
        for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3], [2, 4], [3, 4]]) { gr.set(x, y, 0, 0xffe6a0, 1); gr.set(x, y, 2, 0xffe6a0, 1); }
      }),
    }, layout: { body: [0, 0, 0] },
  });

  // ---------------------------------------------------------------- the Floating Garden (1 voxel = 1/2 m: 16 m across), its clouds, the singing stones
  const garden = (flowers) => ({
    unit: 2, radius: 10, parts: {
      body: part(34, 28, 34, [17, 0, 17], (gr) => {
        for (let y = 0; y <= 13; y++) for (let z = 0; z < 34; z++) for (let x = 0; x < 34; x++) {
          const dx = x + 0.5 - 17, dz = z + 0.5 - 17, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
          const R = 15.6 * Math.pow(y / 13, 0.55) + Math.sin(a * 5 + y * 0.4) * 0.8;
          if (d > R || (y < 12 && d < R - 2.5)) continue;
          gr.set(x, y, z, y === 13 ? (hs(x, y, z, 1) < 0.5 ? 0x6ac85a : 0x5ab84e) : y > 10 ? 0x7a5a3a : hs(x, y, z, 2) < 0.4 ? 0x8a8478 : 0x6e6a60);
        }
        // hanging roots and glowing moss drops under it
        for (let k = 0; k < 18; k++) { const a = k * 2.4, r = 3 + (k % 5) * 2.2, x = Math.floor(17 + Math.cos(a) * r), z = Math.floor(17 + Math.sin(a) * r), L = 2 + (k % 4); let y0 = 0; while (y0 < 13 && !gr.get(x, y0, z)) y0++; for (let y = y0 - L; y < y0; y++) gr.set(x, y, z, 0x6a4a2a); if (k % 3 === 0) gr.set(x, y0 - L - 1, z, 0x9affc8, 1); }
        // flowers on the lawn
        const FL = [0xff9ac8, 0xffe08a, 0xffffff, 0xc8a0ff, 0xff8a7a];
        if (flowers) for (let z = 0; z < 34; z++) for (let x = 0; x < 34; x++) if (gr.get(x, 13, z) && hs(x, 14, z, 3) < 0.16) gr.set(x, 14, z, FL[Math.floor(hs(x, 14, z, 4) * 5)], hs(x, 14, z, 5) < 0.2 ? 1 : 0);
        // (f-polish5: without the 0.5 m flower voxels the lawn gets a few soft tufts of a lighter green instead)
        if (!flowers) for (let z = 0; z < 34; z++) for (let x = 0; x < 34; x++) if (gr.get(x, 13, z) && hs(x, 14, z, 3) < 0.3) gr.set(x, 13, z, hs(x, 14, z, 4) < 0.5 ? 0x7ad466 : 0x86dc74);
        // a blossom tree, a little fountain, two lamps
        gr.box(23, 14, 22, 24, 19, 23, 0x6a4428);
        gr.ell(23.5, 22, 22.5, 4.6, 3.6, 4.6, (x, y, z) => (hs(x, y, z, 6) < 0.08 ? 0xffffff : hs(x, y, z, 7) < 0.5 ? 0xf4a8c8 : 0xf0b8d4));
        gr.ell(12, 14, 13, 2.6, 1, 2.6, 0xd8d4cc); gr.box(12, 14, 13, 12, 16, 13, 0xd8d4cc); gr.set(12, 17, 13, 0x9af0ff, 1); gr.box(11, 15, 12, 13, 15, 14, 0x7ae0f4, { emis: 1 }); gr.set(12, 15, 13, 0xd8d4cc);
        for (const [x, z] of [[8, 22], [25, 9]]) { gr.box(x, 14, z, x, 16, z, 0x4a3a2a); gr.set(x, 17, z, 0xffd27a, 1); }
      }),
    }, layout: { body: [0, 0, 0] },
  });
  M.fy_garden = () => garden(true);         // (Very Low: the garden as it was, its flowers in its own voxels)
  M.fy_garden_lawn = () => garden(false);   // (f-polish5, Low and up: the lawn, its flowers the soft fy_bloom clumps)
  // f-polish5 · a clump of soft flowers (1 voxel = 1/8 m, ~0.7 m across): thin stems, leaves, round petal heads with a
  // warm heart — rose · butter · lilac
  const BLOOM = [[0xf6a2c4, 0xffd6e6, 0xffe27a], [0xffe08a, 0xfff2c4, 0xf2a03a], [0xc6a6ff, 0xe8dcff, 0xfff0a0]];
  BLOOM.forEach((B, v) => {
    M['fy_bloom_' + v] = () => ({
      unit: 8, radius: 0.6, parts: {
        body: part(7, 6, 7, [3, 0, 3], (gr) => {
          const leaf = 0x5cb048, leaf2 = 0x76c45a;
          for (const [x, z] of [[1, 2], [5, 4], [2, 5], [4, 1], [3, 3]]) gr.set(x, 0, z, hs(x, 0, z, 9 + v) < 0.5 ? leaf : leaf2);
          const heads = [[3, 4, 3], [1, 3, 2], [5, 3, 4], [2, 2, 5], [5, 2, 1]];
          heads.forEach(([x, y, z], i) => {
            for (let k = 1; k < y; k++) gr.set(x, k, z, leaf);
            if (i > 2 && hs(x, y, z, v) < 0.3) return;
            gr.set(x, y, z, B[2], 1);   // the heart (a soft glow at dusk)
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (x + dx >= 0 && x + dx < 7 && z + dz >= 0 && z + dz < 7) gr.set(x + dx, y, z + dz, (dx + dz + i) & 1 ? B[0] : B[1]);
            if (y + 1 < 6) gr.set(x, y + 1, z, B[1]);
          });
        }),
      }, layout: { body: [0, 0, 0] },
    });
  });
  M.fy_puff = () => ({
    unit: 4, radius: 2.4, parts: {
      body: part(18, 9, 14, [9, 4, 7], (gr) => {
        for (const [cx, cy, cz, r] of [[9, 4, 7, 4.6], [5, 3.5, 6, 3.4], [13, 3.6, 8, 3.6], [9, 6, 6, 3.2], [7, 3, 10, 2.8]]) gr.ell(cx, cy, cz, r * 1.1, r * 0.75, r, (x, y) => (y < 3 ? 0xf6dce8 : y < 5 ? 0xfaf4fa : 0xffffff));
      }),
    }, layout: { body: [0, 0, 0] },
  });
  const NOTE = [0xff7a7a, 0xffb85a, 0xfff07a, 0x8aff9a, 0x8ad0ff];
  NOTE.forEach((gem, i) => {
    M['fy_note_' + i] = () => ({
      unit: 8, radius: 0.8, parts: {
        body: part(9, 7, 9, [4, 0, 4], (gr) => {
          gr.ell(4.5, 0.5, 4.5, 4.2, 4.5, 3.8, (x, y, z) => stoneCol(x, y, z, 10 + i));
          gr.ell(4.5, 3.6, 4.5, 1.6, 1.7, 1.6, gem, { emis: 1 });
        }),
      }, layout: { body: [0, 0, 0] },
    });
  });

  // ---------------------------------------------------------------- the Flausel (1 voxel = 1/16 m: 0.85 m to the feeler's tip)
  const FOLK = [
    { body: 0xf6d880, belly: 0xfff2c4, cap: 0x6ab84a, cap2: 0x4a9a3a },   // Tüpfel: buttercup yellow, a fresh leaf
    { body: 0xf6a070, belly: 0xffdcc0, cap: 0xd85a2a, cap2: 0xb8401a },   // Zwirbel: peach, an autumn leaf
    { body: 0xd8c8f6, belly: 0xf4eeff, cap: 0xeef0ff, cap2: 0xc8cce8 },   // Silbrin: lilac, a silver leaf
    { body: 0xa8e0b8, belly: 0xe4fae8, cap: 0x9a6a3a, cap2: 0x7a4e28 },   // Dusel, Mutter Borke: mint, a bark-brown cap
    { body: 0xe4f2ff, belly: 0xffffff, cap: 0xd8ecff, cap2: 0xb8d8f4 },   // Flöckchen: snow-blue (a little spirit: glows)
  ];
  // o-wander2: the Flausel as real little figures (1 voxel = 1/32 m: ≈ 0.97 m to the feeler) — a round fluffy body
  // (a fur shell: tufts and two shades), big eyes with two glints, rosy cheeks, a smile, tiny arms and legs that move
  // (parts arm_l/arm_r/leg_l/leg_r: rotX swings them), the leaf cap with its glowing feeler, two small wings
  const shadeC = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) * k) | 0, g = Math.min(255, ((c >> 8) & 255) * k) | 0, b = Math.min(255, (c & 255) * k) | 0; return (r << 16) | (g << 8) | b; };
  const flausel = (C, glow, hat) => () => ({
    unit: 32, radius: 0.75, parts: {
      body: part(19, 21, 18, [9.5, 0, 9], (gr) => {
        const cx = 9.5, cy = 10, cz = 9, rx = 8.4, ry = 9.4, rz = 7.8;
        gr.ell(cx, cy, cz, rx, ry, rz, (x, y, z, d) => (d > 0.72 ? shadeC(C.body, hs(x, y, z, 3) < 0.5 ? 1.06 : 0.92) : C.body), glow ? { emis: 1 } : null);
        // the fur: tufts a voxel out on a third of the shell
        for (let y = 0; y < 21; y++) for (let z = 0; z < 18; z++) for (let x = 0; x < 19; x++) {
          const d = ((x + 0.5 - cx) / (rx + 1)) ** 2 + ((y + 0.5 - cy) / (ry + 1)) ** 2 + ((z + 0.5 - cz) / (rz + 1)) ** 2;
          if (d <= 1 && !gr.get(x, y, z) && hs(x, y, z, 5) < 0.33 && y > 2) gr.set(x, y, z, shadeC(C.body, 1.1), glow ? 1 : 0);
        }
        // the face (−z): paint the frontmost voxel of each column
        const front = (x, y) => { for (let z = 0; z < 18; z++) if (gr.get(x, y, z)) return z; return -1; };
        for (let y = 0; y < 21; y++) for (let x = 0; x < 19; x++) {
          const z = front(x, y); if (z < 0) continue;
          let c = null;
          for (const ex of [cx - 3.4, cx + 3.4]) {
            const ux = (x + 0.5 - ex) / 2.1, uy = (y + 0.5 - 11.6) / 2.7;
            if (ux * ux + uy * uy <= 1) { c = 0x1e1628; if (Math.abs(x + 0.5 - (ex - 0.7)) < 0.6 && Math.abs(y + 0.5 - 12.9) < 1.1) c = 0xffffff; else if (Math.abs(x + 0.5 - (ex + 0.8)) < 0.6 && Math.abs(y + 0.5 - 10.3) < 0.6) c = 0xd8e8ff; else if (uy < -0.45) c = 0x3a2a58; }
          }
          if (c === null && Math.abs(y + 0.5 - 8.6) < 1.1 && Math.abs(Math.abs(x + 0.5 - cx) - 6.0) < 1.2) c = 0xff9aa8;   // cheeks
          if (c === null && ((y === 7 && Math.abs(x + 0.5 - cx) < 1.6) || (y === 8 && Math.abs(Math.abs(x + 0.5 - cx) - 2.0) < 0.6))) c = 0x8a3a4a;   // a small smile
          if (c === null && y > 2 && y < 7 && Math.abs(x + 0.5 - cx) < 4.5) c = C.belly;
          if (c !== null) gr.set(x, y, z, c, glow && c !== 0x1e1628 ? 1 : 0);
        }
      }),
      arm_l: part(3, 6, 3, [1.5, 6, 1.5], (gr) => { gr.box(0, 1, 0, 2, 5, 2, shadeC(C.body, 0.95)); gr.box(0, 0, 0, 2, 0, 2, C.belly); }),
      arm_r: part(3, 6, 3, [1.5, 6, 1.5], (gr) => { gr.box(0, 1, 0, 2, 5, 2, shadeC(C.body, 0.95)); gr.box(0, 0, 0, 2, 0, 2, C.belly); }),
      leg_l: part(4, 4, 6, [2, 4, 3], (gr) => { gr.box(0, 1, 1, 3, 3, 4, shadeC(C.body, 0.9)); gr.box(0, 0, 0, 3, 0, 4, 0x8a6a4a); }),
      leg_r: part(4, 4, 6, [2, 4, 3], (gr) => { gr.box(0, 1, 1, 3, 3, 4, shadeC(C.body, 0.9)); gr.box(0, 0, 0, 3, 0, 4, 0x8a6a4a); }),
      cap: part(21, 14, 21, [10.5, 0, 10.5], (gr) => {
        gr.ell(10.5, 1.6, 10.5, 9, 3.6, 9.4, (x, y, z) => (y < 2 ? null : (Math.abs(x + 0.5 - 10.5) < 1 ? C.cap2 : (hs(x, y, z, 8) < 0.2 ? shadeC(C.cap, 1.12) : C.cap))));
        gr.ell(10.5, 3, 2, 3, 2, 2.6, C.cap);            // the leaf's tip over the brow
        gr.box(10, 5, 14, 11, 8, 15, 0x6a4a2a);           // its stalk
        for (let y = 5; y < 11; y++) gr.set(8 + ((y - 5) >> 2), y, 8 - ((y - 5) >> 1), 0x7a6a50);   // the feeler…
        gr.box(9, 11, 4, 10, 12, 5, 0xfff0a0, { emis: 1 });                                          // …and its light
        if (hat) { gr.ell(10.5, 6.4, 10.5, 6.4, 3.2, 6.4, (x, y, z) => ((x + z) & 1 ? 0x8a5a2a : 0x6a4220)); gr.box(9, 9, 9, 12, 11, 12, 0x5a3a1a); }
      }),
      wing_l: part(1, 12, 10, [0, 2, 0], (gr) => gr.box(0, 0, 0, 0, 11, 9, (x, y, z) => (y === 11 || z === 9 || (y + z) % 7 === 0 ? 0xb8e4ff : 0xe4f6ff), { emis: glow ? 1 : 0 })),
      wing_r: part(1, 12, 10, [0, 2, 0], (gr) => gr.box(0, 0, 0, 0, 11, 9, (x, y, z) => (y === 11 || z === 9 || (y + z) % 7 === 0 ? 0xb8e4ff : 0xe4f6ff), { emis: glow ? 1 : 0 })),
    },
    layout: { body: [0, 3, 0], arm_l: [-8.6, 12, 0.5], arm_r: [8.6, 12, 0.5], leg_l: [-3.4, 4, 0], leg_r: [3.4, 4, 0], cap: [0, 20.5, 0], wing_l: [-6.5, 14, 5], wing_r: [6.5, 14, 5] },
  });
  FOLK.forEach((C, v) => { M['fy_sprite_' + v] = flausel(C, v === 4, false); });
  M.fy_sprite_hat = flausel(FOLK[1], false, true);
  // o-wander2: Very Low's night glow at a fairy place (1/4 m): a ring of glowing moss and tiny warm lights, 9 m across
  M.fy_glow = () => ({ unit: 4, radius: 5, parts: { body: part(37, 1, 37, [18.5, 0, 18.5], (gr) => {
    for (let z = 0; z < 37; z++) for (let x = 0; x < 37; x++) { const d = Math.hypot(x - 18, z - 18); if (d > 18 || d < 6) continue; const k = hs(x, 0, z, 11); if (k < 0.16) gr.set(x, 0, z, k < 0.05 ? 0xffd890 : k < 0.1 ? 0xb8f0d0 : 0xffb0d0, 1); }
  }) }, layout: { body: [0, 0, 0] } });
  // o-wander2: the glow seed (1/16 m): a pale puff on a short stalk, a warm glowing heart
  M.fy_seed = () => ({ unit: 16, radius: 0.5, parts: { body: part(9, 12, 9, [4.5, 0, 4.5], (gr) => {
    gr.box(4, 0, 4, 4, 4, 4, 0x8a9a6a);
    gr.ell(4.5, 8, 4.5, 3.6, 3.6, 3.6, (x, y, z, d) => (d < 0.25 ? 0xfff0a0 : d > 0.7 && hs(x, y, z, 2) < 0.55 ? 0xf4f8ff : null), { emis: 1 });
  }) }, layout: { body: [0, 0, 0] } });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

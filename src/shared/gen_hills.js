// ============================================================================
// The Pod Hills (TRAILER.md §3.3): the green hills behind the Palm City wear
// white pod houses (a dome cap on a slim stem with a glowing door), long white
// tube houses lying on the slopes, and white ribbon paths that wind up the
// hill with little lights — the trailer's backdrop behind the city.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M, HEART = VR.Heart;
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (!HEART || !OG) return;
  const HILLS = VR.HillsGen = {};
  const stCache = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stCache.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stCache.set(key, s); return s; };
  HILLS.box = { x0: -270, x1: 270, z0: -430, z1: -200 };

  HILLS.build = function (g) {
    if (g._hillsOps) return g._hillsOps;
    const K = { STEM: st('vx_pod_stem'), WHITE: st('hull_plating'), GRAY: st('hull_plating_gray'), GLASS: st('viewport'), GLOW: st('tech_panel'), PATH: st('vx_floor_plaza'), LINE: st('vx_floor_plaza_line'), LAMP0: st('vx_lamppost_tech', { head: 0 }), LAMP1: st('vx_lamppost_tech', { head: 1 }), GRASS: st('grass_block'), DIRT: st('dirt'), PLANTER: st('vx_tech_planter'), BUSH: st('vx_bush'), HEDGE: st('vx_hedge_light') || st('vx_hedge'), DOOR: st('neon_lime') || st('tech_panel') };
    const chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) bucket(x, z).f.push(x, z, y0, y1, s); };
    const put = (x, y, z, s) => { bucket(x, z).o.push(x, y, z, s); };
    const rng = new VR.RNG(g.seed ^ 0x9111);
    const gy = (x, z) => g.surfaceY(x, z);
    const used = [];
    const freeSpot = (x, z, r) => !used.some(u => Math.hypot(u[0] - x, u[1] - z) < r + u[2]);
    const onHill = (x, z) => { const cl = g.climateAt(x, z); return cl.heart > 0.5 && gy(x, z) >= 86 && !(g.villageNear && g.villageNear(x, z, 4)); };
    // ---- ribbon paths: three winding tracks from the city's north edge up over the hills, 3 wide, with lights
    const paths = [];
    for (let k = 0; k < 3; k++) {
      let x = -120 + k * 120 + rng.int(40), z = -215, ang = -Math.PI / 2 + (rng.next() - 0.5) * 0.6;
      const pts = [];
      for (let t = 0; t < 190; t++) {
        ang += (rng.next() - 0.5) * 0.09 + Math.sin(t * 0.05 + k) * 0.02;
        x += Math.cos(ang); z += Math.sin(ang);
        if (z < HILLS.box.z0 + 8 || Math.abs(x) > HILLS.box.x1 - 8) break;
        pts.push([Math.round(x), Math.round(z), ang]);
      }
      paths.push(pts);
      const hs = pts.map(p => gy(p[0], p[1]));
      const sm = hs.map((h, i) => { let s2 = 0, n2 = 0; for (let q = -4; q <= 4; q++) { const v = hs[i + q]; if (v !== undefined) { s2 += v; n2++; } } return Math.round(s2 / n2); });
      let last = null;
      for (let i = 0; i < pts.length; i++) {
        const [px, pz, a] = pts[i], y = sm[i], nx = -Math.sin(a), nz = Math.cos(a);
        for (let v = -1; v <= 1; v++) {
          const qx = Math.round(px + nx * v), qz = Math.round(pz + nz * v);
          if (!onHill(qx, qz)) continue;
          const g0 = gy(qx, qz);
          if (g0 < y) fill(qx, qz, g0 + 1, y - 1, K.DIRT);
          put(qx, y, qz, (v === 0 && (i % 7 === 0)) ? K.LINE : K.PATH);
          fill(qx, qz, y + 1, Math.max(y + 4, g0 + 3), 0);
          used.push([qx, qz, 1.2]);
        }
        if (i % 16 === 8) { const lx = Math.round(px + nx * 2.2), lz = Math.round(pz + nz * 2.2); if (onHill(lx, lz)) { const ly = Math.max(gy(lx, lz), y); put(lx, ly + 1, lz, K.LAMP0); put(lx, ly + 2, lz, K.LAMP1); } }
        last = [px, pz];
      }
      void last;
    }
    // ---- pod houses: a white mushroom cap (radius 3–4) with a ring of cyan windows on a slim stem, in loose
    // groups beside the paths
    let pods = 0;
    for (let k = 0; k < 600 && pods < 30; k++) {
      const P = paths[rng.int(paths.length)], p = P[rng.int(P.length)];
      if (!p) continue;
      const side = rng.chance(0.5) ? 1 : -1, off = 6 + rng.int(12);
      const x = Math.round(p[0] - Math.sin(p[2]) * off * side), z = Math.round(p[1] + Math.cos(p[2]) * off * side);
      const rad = 3 + rng.int(2);
      if (!onHill(x, z) || !freeSpot(x, z, rad + 2)) continue;
      const y = gy(x, z);
      const h = 4 + rng.int(3);
      fill(x, z, y + 1, y + h, K.STEM);
      put(x, y + 1, z, K.DOOR);
      const cy = y + h;   // cap base
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > rad + 0.4) continue;
        const hh = Math.sqrt(Math.max(0, (rad + 0.5) * (rad + 0.5) - d * d)) * 0.7;  // flattened dome
        const top = cy + Math.max(1, Math.round(hh));
        const g0 = gy(x + dx, z + dz);
        for (let yy = cy; yy <= top; yy++) {
          const rim = yy === cy && d > rad - 1.2;
          put(x + dx, yy, z + dz, rim ? K.GLASS : (yy === top && d < 1 ? K.GLOW : K.WHITE));
        }
        fill(x + dx, z + dz, top + 1, Math.max(top + 4, g0 + 3), 0);
      }
      if (rng.chance(0.6)) put(x + rad, y + 1, z + rad, K.BUSH);
      used.push([x, z, rad + 1]); pods++;
    }
    // ---- tube houses: white half-cylinders (5 wide, 8–14 long) lying along x or z, a glowing doorway at one end
    let tubes = 0;
    for (let k = 0; k < 400 && tubes < 9; k++) {
      const x = -230 + rng.int(460), z = HILLS.box.z0 + 20 + rng.int(HILLS.box.z1 - HILLS.box.z0 - 40);
      const alongX = rng.chance(0.5), len = 8 + rng.int(7);
      if (!onHill(x, z) || !freeSpot(x, z, len / 2 + 4)) continue;
      const y = gy(x, z);
      let ok = true;
      for (let t = 0; t < len; t++) { const px = alongX ? x + t : x, pz = alongX ? z : z + t; if (!onHill(px, pz) || Math.abs(gy(px, pz) - y) > 3) { ok = false; break; } }
      if (!ok) continue;
      for (let t = 0; t < len; t++) for (let v = -2; v <= 2; v++) {
        const px = alongX ? x + t : x + v, pz = alongX ? z + v : z + t;
        const g0 = gy(px, pz);
        fill(px, pz, g0 + 1, y, K.GRASS);
        const hh = Math.round(Math.sqrt(Math.max(0, 6.25 - v * v)));   // half-cylinder radius 2.5
        for (let yy = 1; yy <= hh; yy++) {
          const end = t === 0 || t === len - 1;
          let s = K.WHITE;
          if (end && Math.abs(v) <= 1 && yy <= 2 && t === 0) s = K.DOOR;            // doorway
          else if (!end && yy === 2 && Math.abs(v) === 2 && (t % 3 === 1)) s = K.GLASS; // portholes
          else if (!end && yy === hh && v === 0 && t % 4 === 2) s = K.GLASS;
          put(px, y + yy, pz, s);
        }
        fill(px, pz, y + hh + 1, Math.max(y + hh + 4, g0 + 3), 0);
      }
      put(alongX ? x - 1 : x + 3, y + 1, alongX ? z + 3 : z - 1, K.PLANTER);
      used.push([x + (alongX ? len / 2 : 0), z + (alongX ? 0 : len / 2), len / 2 + 3]); tubes++;
    }
    g._hillsOps = chunks;
    return chunks;
  };

  HEART.builders.push(function (g, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16, B = HILLS.box;
    if (x0 + 16 <= B.x0 || x0 > B.x1 || z0 + 16 <= B.z0 || z0 > B.z1) return;
    const chunks = HILLS.build(g);
    const b = chunks.get(cx + ',' + cz);
    if (!b) return;
    const blocks = out.blocks;
    for (let i = 0; i < b.f.length; i += 5) {
      const lx = b.f[i] - x0, lz = b.f[i + 1] - z0, s = b.f[i + 4];
      const y0 = Math.max(1, b.f[i + 2]), y1 = Math.min(254, b.f[i + 3]);
      for (let y = y0; y <= y1; y++) blocks[(y << 8) | (lz << 4) | lx] = s;
    }
    for (let i = 0; i < b.o.length; i += 4) {
      const lx = b.o[i] - x0, lz = b.o[i + 2] - z0, y = b.o[i + 1];
      if (y < 1 || y > 254) continue;
      blocks[(y << 8) | (lz << 4) | lx] = b.o[i + 3];
    }
  });
})(VR);

// ============================================================================
// The Mountain Station (TRAILER.md §3.8): a space station grown onto the summit
// of the jagged peaks north-west of the temple — a central hull tower with cyan
// light strips and viewport rings, three levels of radial modules cantilevered
// off the rock, two landing pads on stems, an antenna mast with a saucer and
// red beacons, and an octagonal hangar mouth with a runway ledge facing the
// Gate Plateau. Built once into per-chunk op buckets, stamped by the Heartland.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M, HEART = VR.Heart;
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (!HEART || !OG) return;
  const STA = VR.StationGen = {};
  const stCache = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stCache.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stCache.set(key, s); return s; };
  const oct = (dx, dz) => Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) * 0.7071);
  const C = HEART.STATION;
  STA.box = { x0: C.x - 70, x1: C.x + 70, z0: C.z - 70, z1: C.z + 70 };

  STA.site = function (g) {
    if (g._station) return g._station;
    // the summit: the highest point near the centre
    let bx = C.x, bz = C.z, bh = 0;
    for (let dz = -30; dz <= 30; dz += 2) for (let dx = -30; dx <= 30; dx += 2) { const h = g.surfaceY(C.x + dx, C.z + dz); if (h > bh) { bh = h; bx = C.x + dx; bz = C.z + dz; } }
    g._station = { x: bx, z: bz, y: Math.min(bh - 6, 190), yaw: Math.atan2(0 - bz, 0 - bx) }; // the mouth faces the temple
    return g._station;
  };

  STA.build = function (g) {
    if (g._stationOps) return g._stationOps;
    const K = { HULL: st('hull_plating'), GRAY: st('hull_plating_gray'), DARK: st('hull_plating_dark'), PANEL: st('tech_panel'), AMBER: st('tech_panel_amber'), VIEW: st('viewport'), CYAN: st('neon_cyan'), AMB: st('neon_amber'), BEACON: st('beacon_red'), ANT: st('antenna'), LIGHT: st('light_panel', { facing: 5 }), DECK: st('vx_floor_deck'), PAD: st('vx_floor_pad'), HAZ: st('hazard_stripes'), FRAME: st('vx_portal_frame', { facing: 0 }), VEIL: st('portal_veil'), DISH: st('satellite_dish', { facing: 2 }), TURRET: st('turret'), STRIPE: st('hull_stripe_orange', { axis: 0 }), REACTOR: st('reactor_core'), CONSOLE: st('vx_console', { facing: 0 }), HOLO: st('vx_holo_screen', { facing: 0 }), HEXL: st('vx_hex_light_cyan', { head: 1 }) };
    const S = STA.site(g), Y = S.y;
    const chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) bucket(x, z).f.push(x, z, y0, y1, s); };
    const put = (x, y, z, s) => { bucket(x, z).o.push(x, y, z, s); };
    const gy = (x, z) => g.surfaceY(x, z);
    const cx = S.x, cz = S.z, H = 42;
    // ---- central tower: octagon r 6, foundation into the rock, cyan strips every 5 rows, viewport rings, a wider crown
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
      const d = oct(dx, dz), x = cx + dx, z = cz + dz;
      if (d > 8.2) continue;
      const g0 = gy(x, z);
      if (d <= 6.2) {
        fill(x, z, Math.min(g0, Y - 14), Y, K.DARK);                          // foundation
        for (let t = 1; t <= H; t++) {
          const shell = d > 5.2;
          let s = shell ? K.GRAY : 0;
          if (shell && t % 5 === 3 && (Math.abs(dx) < 2 || Math.abs(dz) < 2)) s = K.PANEL;
          if (shell && (t % 10 === 6 || t % 10 === 7) && d > 5.9) s = K.VIEW;
          if (!shell && t % 6 === 0) s = K.HULL;                               // floors inside
          if (!shell && t % 6 === 5 && (dx === 0 && dz === 0)) s = K.HEXL;
          put(x, Y + t, z, s);
        }
        put(x, Y + H + 1, z, d > 5.2 ? K.CYAN : K.HULL);
      }
      // crown ring (r 8) near the top with a viewport band
      if (d > 6.2) for (let t = H - 6; t <= H - 2; t++) put(x, Y + t, z, t === H - 4 ? K.VIEW : t === H - 6 ? K.AMB : K.GRAY);
    }
    fill(cx, cz, Y + H + 2, Y + H + 26, K.HULL);                                 // the mast
    for (let t = 6; t <= 22; t += 8) put(cx, Y + H + 2 + t, cz, K.AMB);
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) { const d = Math.hypot(dx, dz); if (d <= 5.5) { put(cx + dx, Y + H + 27, cz + dz, d > 4.5 ? K.CYAN : K.GRAY); put(cx + dx, Y + H + 28, cz + dz, d > 4.2 ? 0 : K.HULL); } }
    put(cx, Y + H + 29, cz, K.ANT); put(cx, Y + H + 30, cz, K.BEACON);
    put(cx + 3, Y + H + 2, cz + 3, K.DISH); put(cx - 3, Y + H + 2, cz - 3, K.TURRET);
    // ---- radial modules: three levels, four per level, rotated between levels
    const modules = [];
    for (let lvl = 0; lvl < 3; lvl++) {
      const y0 = Y + 6 + lvl * 12, n = 4;
      for (let k = 0; k < n; k++) {
        const a = k * Math.PI / 2 + lvl * Math.PI / 4 + 0.3;
        if (Math.abs(((a - S.yaw + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.5 && lvl === 0) continue; // keep the mouth free
        modules.push({ a, y0, len: 9 + (lvl === 1 ? 3 : 0) });
        const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, nz = ca;
        for (let u = 5; u <= 5 + 9 + (lvl === 1 ? 3 : 0); u++) for (let v = -2; v <= 2; v++) for (let t = 0; t <= 6; t++) {
          const x = Math.round(cx + ca * u + nx * v), z = Math.round(cz + sa * u + nz * v), y = y0 + t;
          const end = u === 5 + 9 + (lvl === 1 ? 3 : 0), shell = t === 0 || t === 6 || Math.abs(v) === 2 || end;
          let s = shell ? K.HULL : 0;
          if (shell && t === 3 && Math.abs(v) === 2 && u % 3 === 1) s = K.VIEW;
          if (shell && t === 5 && Math.abs(v) === 2) s = K.PANEL;
          if (end && t >= 2 && t <= 4 && Math.abs(v) <= 1) s = K.AMB;
          if (!shell && t === 1 && u % 4 === 0) s = v === 0 ? K.CONSOLE : 0;
          put(x, y, z, s);
          if (t === 0) { const g0 = gy(x, z); if (g0 < y - 1 && u % 4 === 2 && v === 0) fill(x, z, Math.max(g0 + 1, y - 10), y - 1, K.DARK); } // struts to the rock
        }
      }
    }
    // ---- landing pads on stems, off the flanks
    for (const [a, lvl] of [[S.yaw + 1.3, 1], [S.yaw - 1.4, 2]]) {
      const px = Math.round(cx + Math.cos(a) * 20), pz = Math.round(cz + Math.sin(a) * 20), py = Y + 8 + lvl * 8;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
        const d = oct(dx, dz); if (d > 6.2) continue;
        put(px + dx, py, pz + dz, d > 5.4 ? K.HAZ : (Math.max(Math.abs(dx), Math.abs(dz)) <= 1 ? K.PAD : K.DECK));
        fill(px + dx, pz + dz, py + 1, py + 10, 0);
        if (d <= 1.2) { const g0 = gy(px + dx, pz + dz); fill(px + dx, pz + dz, Math.max(2, g0 - 4), py - 1, K.DARK); }
      }
      // a walkway back to the tower
      const len = Math.round(Math.hypot(px - cx, pz - cz)) - 6;
      for (let u = 6; u <= len; u++) for (let v = -1; v <= 1; v++) { const x = Math.round(cx + Math.cos(a) * u - Math.sin(a) * v), z = Math.round(cz + Math.sin(a) * u + Math.cos(a) * v); put(x, py, z, v === 0 ? K.DECK : K.GRAY); fill(x, z, py + 1, py + 4, 0); }
      put(px + 5, py + 1, pz + 5, K.BEACON);
    }
    // ---- the hangar mouth: an octagon 9 wide × 7 tall in the tower base facing the temple, a runway ledge outside
    {
      const a = S.yaw, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, nz = ca;
      const OPEN = [2, 3, 4, 4, 4, 3, 2];
      for (let t = 0; t <= 8; t++) for (let v = -5; v <= 5; v++) {
        const av = Math.abs(v), o = t <= 6 ? OPEN[t] : -1;
        const x = Math.round(cx + ca * 5.5 + nx * v), z = Math.round(cz + sa * 5.5 + nz * v), y = Y + 2 + t;
        if (o >= 0 && av <= o) { for (let u = 5; u <= 7; u++) put(Math.round(cx + ca * u + nx * v), y, Math.round(cz + sa * u + nz * v), u === 5 ? K.VEIL : 0); }
        else if ((o >= 0 && av === o + 1) || (t === 7 && av <= 3)) put(x, y, z, K.FRAME);
        else if (t === 8 && av <= 4) put(x, y, z, K.AMB);
      }
      for (let u = 6; u <= 22; u++) for (let v = -5; v <= 5; v++) {
        const x = Math.round(cx + ca * u + nx * v), z = Math.round(cz + sa * u + nz * v), y = Y + 1;
        const g0 = gy(x, z);
        put(x, y, z, Math.abs(v) === 5 ? K.HAZ : (v === 0 && u % 2 === 0 ? K.CYAN : K.DECK));
        fill(x, z, y + 1, y + 9, 0);
        if (g0 < y - 1 && Math.abs(v) <= 4 && u % 5 === 0 && Math.abs(v) === 3) fill(x, z, Math.max(g0 + 1, y - 16), y - 1, K.DARK);
      }
      // inside the base: a floor, consoles, a reactor
      for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) if (oct(dx, dz) <= 5.2) put(cx + dx, Y + 1, cz + dz, K.DECK);
      put(cx, Y + 2, cz, K.REACTOR); put(cx - 3, Y + 2, cz - 3, K.CONSOLE); put(cx + 3, Y + 2, cz - 3, K.CONSOLE);
      for (let dx = -3; dx <= 3; dx++) put(cx + dx, Y + 4, cz - 5, K.HOLO);
    }
    void modules;
    g._stationOps = chunks;
    return chunks;
  };

  HEART.builders.push(function (g, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16, B = STA.box;
    if (x0 + 16 <= B.x0 || x0 > B.x1 || z0 + 16 <= B.z0 || z0 > B.z1) return;
    const chunks = STA.build(g);
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

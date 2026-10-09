// ============================================================================
// Starship designer (shared: worker world-gen + main thread). Original ship
// archetypes are grown from a seed: tapered hulls, wings, booms, ring drives,
// engines, paint schemes, greebles, landing gear — and real interiors with a
// bridge, corridors, bunks, galley, cargo bay and reactor room.
// Blueprint frame: nose toward -z (north), x = starboard(+)/port(-), y up,
// landing gear at y = 0. Every block is 26-connected to the helm so the whole
// design lifts off as one ship.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const DIRN = ['north', 'east', 'south', 'west'];

  // ---------------------------------------------------------------- state rotation (quarter turns clockwise from above)
  function rotName(v, k, vals) {
    if (typeof v !== 'string') return -1;
    const toks = v.split('_');
    let changed = false;
    const mt = toks.map((t) => { const i = DIRN.indexOf(t); if (i < 0) return t; changed = true; return DIRN[(i + k) & 3]; });
    if (!changed) return -1;
    let ni = vals.indexOf(mt.join('_'));
    if (ni < 0 && mt.length === 2) ni = vals.indexOf(mt[1] + '_' + mt[0]);
    return ni;
  }
  function rotateState(s, k) {
    k = ((k % 4) + 4) % 4;
    if (!k || !s) return s;
    const t = R.types[R.T.type[s]];
    if (!t || !t.props || !t.props.length) return s;
    let ns = s;
    for (const pr of t.props) {
      const vals = pr.values, cur = t.get(ns, pr.name), v = vals[cur];
      if (pr.name === 'axis') {
        if (k & 1) { const nv = v === 'x' ? 'z' : v === 'z' ? 'x' : v; const ni = vals.indexOf(nv); if (ni >= 0) ns = t.with(ns, pr.name, ni); }
      } else if (pr.name === 'rotation' && vals.length === 16) ns = t.with(ns, pr.name, (cur + k * 4) & 15);
      else { const ni = rotName(v, k, vals); if (ni >= 0) ns = t.with(ns, pr.name, ni); }
    }
    return ns;
  }
  VR.rotateState = rotateState;
  // local (x, z) → rotated offset for a quarter-turn count (0 = nose north)
  VR.rotXZ = (x, z, dir) => { switch (dir & 3) { case 0: return [x, z]; case 1: return [-z, x]; case 2: return [-x, -z]; default: return [z, -x]; } };

  // ---------------------------------------------------------------- roles
  const E = 0, HULL = 1, HULL2 = 2, TRIM = 3, ACC = 4, GLASS = 5, GLOW = 6, ENG = 7, AIR = 8, FLOOR = 9, GRATE = 10, ACC2 = 11, NAVL = 12, NAVR = 13, PORT = 14;

  const S = (n, p) => { const t = R.byName[n]; if (!t) return 0; return p ? t.state(p) : t.defaultState; };
  const PALETTES = [
    { key: 'starforge', name: 'Starforge', hull: 'hull_plating', hull2: 'hull_plating_gray', trim: 'hull_plating_dark', acc: 'hull_stripe_orange', acc2: 'hull_stripe_blue', glow: 'neon_cyan', glass: 'viewport', eng: 'hull_plating_dark' },
    { key: 'nightwing', name: 'Nightwing', hull: 'hull_plating_dark', hull2: 'black_concrete', trim: 'gray_concrete', acc: 'magenta_concrete', acc2: 'purple_concrete', glow: 'neon_magenta', glass: 'purple_stained_glass', eng: 'black_concrete' },
    { key: 'sunstrike', name: 'Sunstrike', hull: 'white_concrete', hull2: 'light_gray_concrete', trim: 'gray_concrete', acc: 'red_concrete', acc2: 'yellow_concrete', glow: 'neon_amber', glass: 'light_blue_stained_glass', eng: 'hull_plating_dark' },
    { key: 'verdant', name: 'Verdant Corps', hull: 'light_gray_concrete', hull2: 'hull_plating_gray', trim: 'green_concrete', acc: 'lime_concrete', acc2: 'green_concrete', glow: 'neon_lime', glass: 'viewport', eng: 'hull_plating_dark' },
    { key: 'royal', name: 'Royal Blue', hull: 'blue_concrete', hull2: 'light_blue_concrete', trim: 'hull_plating_dark', acc: 'yellow_concrete', acc2: 'white_concrete', glow: 'neon_white', glass: 'light_blue_stained_glass', eng: 'hull_plating_dark' },
    { key: 'hauler', name: 'Rust Hauler', hull: 'orange_terracotta', hull2: 'brown_concrete', trim: 'hull_plating_dark', acc: 'yellow_concrete', acc2: 'black_concrete', glow: 'neon_amber', glass: 'viewport', eng: 'gray_concrete' },
    { key: 'prism', name: 'Prism Guild', hull: 'white_concrete', hull2: 'hull_plating', trim: 'purple_concrete', acc: 'tech_panel_violet', acc2: 'magenta_concrete', glow: 'neon_cyan', glass: 'magenta_stained_glass', eng: 'hull_plating_dark' },   // (violet tech panels and cyan neon where crystal blocks were: f-nocrystal)
    { key: 'arctic', name: 'Arctic Survey', hull: 'white_concrete', hull2: 'hull_plating_gray', trim: 'cyan_concrete', acc: 'hull_stripe_blue', acc2: 'cyan_concrete', glow: 'neon_cyan', glass: 'viewport', eng: 'hull_plating_dark' },
  ];
  const NAMES = ['Kestrel', 'Starling', 'Halcyon', 'Vesper', 'Corvid', 'Tern', 'Lumen', 'Solace', 'Wayfarer', 'Drift', 'Ember', 'Nimbus', 'Quill', 'Harrier', 'Aurel', 'Sable', 'Vanta', 'Cinder', 'Zephyr', 'Lyra', 'Orrin', 'Juno', 'Talon', 'Mistral', 'Borealis', 'Solstice', 'Rook', 'Gale', 'Aster', 'Pike', 'Marlin', 'Osprey', 'Wren', 'Kite', 'Swift', 'Petrel', 'Heron', 'Lark', 'Fulmar', 'Comet', 'Meridian', 'Halo', 'Tempest', 'Nova', 'Umbra', 'Pioneer', 'Bramble', 'Saffron', 'Cobalt', 'Tidewater'];
  const ADJ = ['Bright', 'Silent', 'Wandering', 'Crimson', 'Distant', 'Lucky', 'Patient', 'Restless', 'Golden', 'Midnight', 'Gentle', 'Iron', 'Last', 'First', 'Rising'];
  const ARCH = {
    interceptor: { label: 'Interceptor', code: 'IX', weight: 3 },
    gunship: { label: 'Gunship', code: 'GW', weight: 2 },
    freighter: { label: 'Freighter', code: 'HX', weight: 2 },
    cruiser: { label: 'Cruiser', code: 'CR', weight: 1 },
    racer: { label: 'Racer', code: 'NR', weight: 2 },
    dropship: { label: 'Dropship', code: 'DM', weight: 2 },
    shuttle: { label: 'Shuttle', code: 'SH', weight: 2 },
    carrier: { label: 'Carrier', code: 'CV', weight: 0, big: true },
  };

  // ---------------------------------------------------------------- builder
  class Builder {
    constructor(XR, YH, ZR) {
      this.XR = XR; this.YH = YH; this.ZR = ZR;
      this.SX = XR * 2 + 1; this.SY = YH + 1; this.SZ = ZR * 2 + 1;
      this.role = new Uint8Array(this.SX * this.SY * this.SZ);
      this.fixt = new Uint16Array(this.SX * this.SY * this.SZ);
    }
    in(x, y, z) { return x >= -this.XR && x <= this.XR && y >= 0 && y <= this.YH && z >= -this.ZR && z <= this.ZR; }
    i(x, y, z) { return (y * this.SZ + (z + this.ZR)) * this.SX + (x + this.XR); }
    get(x, y, z) { return this.in(x, y, z) ? this.role[this.i(x, y, z)] : E; }
    set(x, y, z, r) { if (this.in(x, y, z)) this.role[this.i(x, y, z)] = r; }
    solid(x, y, z) { const r = this.get(x, y, z); return r !== E && r !== AIR; }
    fix(x, y, z, s) { if (!this.in(x, y, z) || !s) return; const i = this.i(x, y, z); this.fixt[i] = s; if (this.role[i] === E) this.role[i] = AIR; }
    fill(x0, y0, z0, x1, y1, z1, r, onlyEmpty) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        if (onlyEmpty && this.get(x, y, z) !== E) continue;
        this.set(x, y, z, r);
      }
    }
    // tapered superellipse hull along z (z0 = nose, z1 = tail). prof(t) → {w, h, cy, p}
    hull(z0, z1, prof, role, sx) {
      for (let z = z0; z <= z1; z++) {
        const t = (z - z0) / Math.max(1, z1 - z0);
        const P = prof(t);
        if (!P || P.w <= 0.2 || P.h <= 0.2) continue;
        const p = P.p || 2.5, cx = sx || 0;
        for (let y = Math.floor(P.cy - P.h - 1); y <= Math.ceil(P.cy + P.h + 1); y++) for (let x = Math.floor(cx - P.w - 1); x <= Math.ceil(cx + P.w + 1); x++) {
          const dx = Math.abs(x - cx) / P.w, dy = Math.abs(y + 0.5 - P.cy) / P.h;
          if (Math.pow(dx, p) + Math.pow(dy, p) <= 1) this.set(x, y, z, role);
        }
      }
    }
    cyl(cx, cy, r, z0, z1, role, capped) {
      for (let z = z0; z <= z1; z++) for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x - cx, y + 0.5 - cy);
        if (d <= r + 0.15) this.set(x, y, z, role);
      }
      void capped;
    }
    // swept wing: root at |x| = x0 (both sides), leading edge at zLE, chord c0, span S
    wing(x0, y, zLE, c0, S, sweep, taper, role, dihedral, thick) {
      for (let k = 0; k <= S; k++) {
        const t = k / Math.max(1, S);
        const le = Math.round(zLE + sweep * k), c = Math.max(1, Math.round(c0 * (1 - taper * t)));
        const yy = Math.round(y + (dihedral || 0) * k);
        for (const sgn of [-1, 1]) {
          const x = sgn * (x0 + k);
          for (let z = le; z < le + c; z++) for (let d = 0; d < (thick || 1); d++) this.set(x, yy + d, z, role);
        }
      }
    }
    torus(cx, cy, cz, Rr, r, role) {
      for (let y = Math.floor(cy - Rr - r - 1); y <= Math.ceil(cy + Rr + r + 1); y++) for (let x = Math.floor(cx - Rr - r - 1); x <= Math.ceil(cx + Rr + r + 1); x++) for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++) {
        const q = Math.hypot(x - cx, y + 0.5 - cy) - Rr, d = Math.hypot(q, z - cz);
        if (d <= r + 0.2) this.set(x, y, z, role);
      }
    }
    // carve a room of air inside the hull, leaving a 1-block shell
    carve(x0, y0, z0, x1, y1, z1) {
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        if (!this.solid(x, y, z)) continue;
        let inside = true;
        for (let dy = -1; dy <= 1 && inside; dy++) for (let dz = -1; dz <= 1 && inside; dz++) for (let dx = -1; dx <= 1; dx++) { const r = this.get(x + dx, y + dy, z + dz); if (r === E) { inside = false; break; } }
        if (inside) this.set(x, y, z, AIR);
      }
    }
    // height of the top/bottom solid cell at a column (or -1)
    top(x, z) { for (let y = this.YH; y >= 0; y--) if (this.solid(x, y, z)) return y; return -1; }
    bottom(x, z) { for (let y = 0; y <= this.YH; y++) if (this.solid(x, y, z)) return y; return -1; }
  }

  // ---------------------------------------------------------------- shared detailing
  function cockpit(B, z, floorY, st, opts) {
    // helm at z, pilot seat behind it, head room above, canopy/glass is painted by the caller
    B.set(0, floorY, z, FLOOR); B.set(0, floorY, z + 1, FLOOR);
    for (const zz of [z, z + 1]) for (let y = floorY + 1; y <= floorY + 2; y++) B.set(0, y, zz, AIR);
    B.fix(0, floorY + 1, z, st.helm);
    B.fix(0, floorY + 1, z + 1, st.seat);
    if (opts && opts.consoles) { for (const sx of [-1, 1]) if (B.get(sx, floorY + 1, z) === AIR) B.fix(sx, floorY + 1, z, sx < 0 ? st.consoleE : st.consoleW); }
  }
  function thruster(B, x, y, z, st, dir) {
    // dir: exhaust direction index (FACING6), default south (aft)
    B.set(x, y, z, E);
    B.fix(x, y, z, dir === 5 ? st.thrDown : st.thr);
  }
  // thruster mounted on the last solid cell of row (x, y) toward the tail
  function rearThruster(B, x, y, st) {
    for (let z = B.ZR - 1; z >= -B.ZR; z--) if (B.solid(x, y, z)) { if (z + 1 <= B.ZR) thruster(B, x, y, z + 1, st); return true; }
    return false;
  }
  function lights(B, x, yCeil, z0, z1, st, step) {
    for (let z = z0; z <= z1; z += step || 4) if (B.get(x, yCeil - 1, z) === AIR && B.solid(x, yCeil, z)) B.fix(x, yCeil - 1, z, st.light);
  }
  function landingGear(B, pts, top) {
    for (const [x, z] of pts) { for (let y = 0; y < top; y++) B.set(x, y, z, TRIM); }
  }

  // ---------------------------------------------------------------- archetypes
  const ARCHS = {};
  ARCHS.interceptor = (rng, B, st) => {
    const L = rng.irange(14, 19), z0 = -Math.floor(L / 2), z1 = z0 + L;
    const W = rng.range(1.9, 2.5), H = 2.05, cy = 1 + H, nose = rng.range(0.3, 0.42);
    B.hull(z0, z1 - 1, (t) => {
      const n = Math.min(1, t / nose);
      return { w: W * (0.28 + 0.72 * Math.pow(n, 0.65)) * (t > 0.85 ? 1 - (t - 0.85) * 1.6 : 1), h: H * (0.4 + 0.6 * Math.pow(n, 0.8)), cy: cy - (1 - n) * 0.5, p: 2.6 };
    }, HULL);
    // wings: swept, delta, forward-swept, gull or stacked twin-deck
    const cfg = rng.pick(['swept', 'delta', 'forward', 'gull', 'twin']);
    const S = rng.irange(5, 8), zW = z0 + Math.round(L * rng.range(0.42, 0.52));
    const chord = cfg === 'delta' ? rng.irange(6, 8) : rng.irange(4, 6);
    const sweep = cfg === 'delta' ? 1.0 : cfg === 'forward' ? -0.45 : cfg === 'gull' ? 0.7 : rng.pick([0.9, 0.6, 1.2]);
    const taper = cfg === 'delta' ? 0.85 : 0.55;
    if (cfg === 'twin') {
      B.wing(2, 1, zW, chord, S, sweep, taper, HULL2, 0, 1);
      B.wing(2, 4, zW + 1, chord - 1, S - 1, sweep, taper, HULL2, 0, 1);
      for (const sgn of [-1, 1]) { const x = sgn * (2 + S - 1); let z = null; for (let zz = -B.ZR; zz <= B.ZR && z === null; zz++) if (B.get(x, 4, zz) === HULL2) z = zz; if (z !== null) for (let y = 2; y <= 3; y++) for (let zz = z; zz < z + 2; zz++) B.set(x, y, zz, ACC); }
    } else if (cfg === 'gull') {
      B.wing(2, 2, zW, chord, 2, sweep, 0.1, HULL2, 0.8, 1);
      B.wing(4, 4, zW + 2, chord - 1, S - 2, sweep, taper, HULL2, -0.25, 1);
    } else B.wing(2, 1 + rng.int(2), zW, chord, S, sweep, taper, HULL2, rng.chance(0.4) ? 0.25 : 0, 1);
    if (rng.chance(0.45)) B.wing(1, 2, z0 + 2, 2, 2, 0.6, 0.4, ACC, 0, 1); // canards
    // wing stripes & tips
    for (const sgn of [-1, 1]) {
      const x = sgn * (2 + S);
      let zt = null; for (let z = -B.ZR; z <= B.ZR && zt === null; z++) for (let y = 0; y <= B.YH; y++) if (B.get(x, y, z) === HULL2) { zt = z; B.tipY = y; break; }
      if (zt !== null) { // wingtip cannon
        for (let z = zt - 2; z <= zt + 1; z++) B.set(x, B.tipY + 1, z, TRIM);
        B.set(x, B.tipY + 1, zt - 3, GLOW);
      }
      for (let k = 2; k < 2 + S; k += 2) for (let z = -B.ZR; z <= B.ZR; z++) for (let y = 0; y <= B.YH; y++) if (B.get(sgn * k, y, z) === HULL2 && B.get(sgn * k, y, z - 1) === E) { B.set(sgn * k, y, z, ACC); break; }
    }
    // tail fin
    const fz0 = z1 - rng.irange(4, 6), twinTail = rng.chance(0.35);
    for (const fx of twinTail ? [-1, 1] : [0]) for (let z = fz0; z < z1; z++) { const topY = B.top(fx, z); if (topY < 0) continue; const h = Math.min(3, 1 + Math.floor((z - fz0) * 0.7)); for (let y = topY + 1; y <= topY + h; y++) B.set(fx, y, z, z === z1 - 1 && y === topY + h ? GLOW : ACC2); }
    // engines
    for (const sx of [-1, 1]) { B.cyl(sx * 1.2, cy - 0.3, 1.05, z1 - 3, z1 - 1, ENG); thruster(B, sx, Math.floor(cy - 0.3), z1, st); }
    // cockpit
    const zc = z0 + Math.round(L * 0.3);
    cockpit(B, zc, 1, st);
    B.canopy = { z0: zc - 2, z1: zc + 2, y0: 3 };
    landingGear(B, [[-1, zc], [1, zc], [-2, zW + 2], [2, zW + 2]], 1);
  };
  ARCHS.racer = (rng, B, st) => {
    const L = rng.irange(12, 16), z0 = -Math.floor(L / 2), z1 = z0 + L;
    const cy = 3.0;
    B.hull(z0, z1 - 4, (t) => ({ w: 1.25 * (0.3 + 0.7 * Math.min(1, t / 0.4)) + (t > 0.3 && t < 0.6 ? 0.35 : 0), h: 2.0 * (0.4 + 0.6 * Math.min(1, t / 0.35)), cy, p: 2.2 }), HULL);
    const er = rng.range(1.7, 2.2);
    B.cyl(0, cy, er, z1 - 5, z1 - 1, ENG);
    for (let a = 0; a < 8; a++) { const x = Math.round(Math.cos(a / 8 * Math.PI * 2) * (er + 0.3)), y = Math.floor(cy + Math.sin(a / 8 * Math.PI * 2) * (er + 0.3)); B.set(x, y, z1 - 2, GLOW); }
    thruster(B, 0, Math.floor(cy), z1, st); thruster(B, -1, Math.floor(cy), z1, st); thruster(B, 1, Math.floor(cy), z1, st);
    // canards & fins
    B.wing(1, 2, z0 + 3, 2, rng.irange(2, 3), 0.8, 0.5, ACC, 0, 1);
    B.wing(2, 2, z1 - 5, 3, rng.irange(2, 4), 0.9, 0.6, HULL2, 0.3, 1);
    for (let z = z0 + 2; z < z1 - 5; z++) for (const sx of [-1, 1]) { const y = Math.floor(cy); if (B.get(sx * 2, y, z) === HULL) B.set(sx * 2, y, z, GLOW); else if (B.get(sx, y, z) === HULL && B.get(sx * 2, y, z) === E) B.set(sx, y, z, ACC); }
    const zc = z0 + Math.round(L * 0.35);
    cockpit(B, zc, 1, st);
    B.canopy = { z0: zc - 1, z1: zc + 2, y0: 3 };
    landingGear(B, [[0, zc], [-1, z1 - 4], [1, z1 - 4]], 1);
  };
  ARCHS.gunship = (rng, B, st) => {
    const L = rng.irange(18, 24), z0 = -Math.floor(L / 2), z1 = z0 + L;
    const W = 2.6, H = 2.3, cy = 1 + H;
    const podEnd = z0 + Math.round(L * 0.72);
    B.hull(z0, podEnd, (t) => ({ w: W * (0.35 + 0.65 * Math.min(1, t / 0.3)), h: H * (0.45 + 0.55 * Math.min(1, t / 0.25)), cy, p: 3.4 }), HULL);
    const bx = rng.irange(5, 6), br = 1.3, bz0 = z0 + Math.round(L * 0.3);
    for (const sgn of [-1, 1]) {
      B.cyl(sgn * bx, cy, br, bz0, z1 - 1, HULL2);
      for (let z = bz0; z <= bz0 + 1; z++) B.set(sgn * bx, Math.floor(cy), z - 1, GLOW);
      // boom fin
      for (let z = z1 - 5; z < z1; z++) for (let y = Math.ceil(cy + br); y <= Math.ceil(cy + br) + Math.min(3, z - (z1 - 5)); y++) B.set(sgn * bx, y, z, ACC);
      rearThruster(B, sgn * bx, Math.floor(cy), st);
    }
    // main wing joining pod & booms, rear stabilizer bar
    const wz = bz0 + 1;
    for (let z = wz; z < wz + 5; z++) for (let x = -bx; x <= bx; x++) { const y = Math.floor(cy) - 1; if (B.get(x, y, z) === E) B.set(x, y, z, z === wz ? ACC : TRIM); }
    for (let x = -bx; x <= bx; x++) { B.set(x, Math.ceil(cy + br), z1 - 2, TRIM); }
    // pod engines and chin cannons
    for (const sx of [-1, 1]) rearThruster(B, sx, Math.floor(cy), st);
    for (const sx of [-1, 1]) { for (let z = z0; z <= z0 + 3; z++) B.set(sx, 1, z, TRIM); B.set(sx, 1, z0 - 1, GLOW); }
    // stripe
    for (let z = z0 + 3; z <= podEnd; z++) for (const sx of [-1, 1]) { const x = sx * Math.round(W); if (B.get(x, Math.floor(cy), z) === HULL) B.set(x, Math.floor(cy), z, ACC); }
    // interior: cockpit + gunner bay
    const zc = z0 + 3;
    B.carve(-1, 2, zc, 1, 4, podEnd - 2);
    for (let z = zc; z <= podEnd - 2; z++) for (let x = -1; x <= 1; x++) if (B.get(x, 2, z) === AIR) B.set(x, 1, z, FLOOR);
    cockpit(B, zc, 1, st, { consoles: true });
    for (let z = zc + 4; z <= podEnd - 3; z += 3) { if (B.get(-1, 2, z) === AIR) B.fix(-1, 2, z, st.seatE); if (B.get(1, 2, z) === AIR) B.fix(1, 2, z, st.seatW); }
    if (B.get(0, 2, podEnd - 2) === AIR) B.fix(0, 2, podEnd - 2, st.crate);
    lights(B, 0, 5, zc + 2, podEnd - 2, st, 3);
    // side hatch
    B.hatch = { x: -Math.round(W), z: Math.round((zc + podEnd) / 2), y: 2 };
    B.canopy = { z0: zc - 1, z1: zc + 2, y0: 4 };
    landingGear(B, [[-1, zc + 1], [1, zc + 1], [-bx, z1 - 3], [bx, z1 - 3]], 1);
  };
  ARCHS.freighter = (rng, B, st) => {
    const L = rng.irange(24, 32), z0 = -Math.floor(L / 2), z1 = z0 + L;
    const W = rng.irange(4, 5), H = 3.4, cy = 1 + H;
    B.hull(z0 + 2, z1 - 1, (t) => ({ w: W, h: H * (t < 0.08 ? 0.8 : 1), cy, p: 7 }), HULL);
    // hammerhead bridge
    const bw = W + 2;
    for (let z = z0; z <= z0 + 4; z++) for (let y = 2; y <= Math.floor(cy + H) + 1; y++) for (let x = -bw; x <= bw; x++) { const edge = Math.abs(x) === bw && (z === z0 || z === z0 + 4); if (!edge) B.set(x, y, z, HULL2); }
    for (let x = -bw + 1; x <= bw - 1; x++) B.set(x, Math.floor(cy) + 1, z0, GLASS);
    for (let x = -bw + 1; x <= bw - 1; x++) B.set(x, Math.floor(cy + H) + 1, z0 + 2, ACC2);
    // cargo pods
    const pods = rng.irange(2, 3), podLen = Math.floor((L - 10) / pods) - 1;
    for (let k = 0; k < pods; k++) {
      const pz = z0 + 7 + k * (podLen + 1);
      for (const sgn of [-1, 1]) for (let z = pz; z < pz + podLen; z++) for (let y = 2; y <= 5; y++) for (let x = W + 1; x <= W + 3; x++) B.set(sgn * x, y, z, (y === 5 && (z - pz) % 3 === 0) ? ACC : (x === W + 3 && y === 3) ? ACC2 : HULL2);
    }
    // cargo containers stacked on the dorsal deck
    const CONT = ['red_concrete', 'blue_concrete', 'yellow_concrete', 'green_concrete', 'orange_concrete', 'cyan_concrete', 'white_concrete', 'purple_concrete'];
    const deckY = B.top(0, z0 + 8) + 1;
    for (let z = z0 + 7; z + 2 < z1 - 4; z += 4) for (const cx of [-2, 1]) {
      if (!rng.chance(0.7)) continue;
      const cs = S(rng.pick(CONT)), stack = rng.chance(0.3) ? 2 : 1;
      for (let k = 0; k < stack; k++) for (let y = deckY + k * 2; y < deckY + k * 2 + 2; y++) for (let zz = z; zz < z + 3; zz++) for (let xx = cx; xx < cx + 2; xx++) B.fix(xx, y, zz, (zz === z || zz === z + 2) && y === deckY + k * 2 + 1 ? S('hull_plating_dark') : cs);
    }
    B.fix(W - 1, B.top(W - 1, z0 + 3) + 1, z0 + 3, st.dish); B.fix(-W + 1, B.top(-W + 1, z0 + 3) + 1, z0 + 3, st.antenna);
    // engine block
    for (let y = 2; y <= Math.floor(cy + H) - 1; y++) for (let x = -W + 1; x <= W - 1; x++) B.set(x, y, z1 - 1, ENG);
    for (let y = 3; y <= Math.floor(cy + H) - 2; y += 2) for (let x = -W + 2; x <= W - 2; x += 2) thruster(B, x, y, z1, st);
    // decks: bridge, corridor, quarters, galley, cargo, engine room
    const fy = 2;
    B.carve(-bw + 1, fy + 1, z0 + 1, bw - 1, fy + 3, z0 + 3);
    B.carve(-W + 1, fy + 1, z0 + 4, W - 1, fy + 3, z1 - 3);
    for (let z = z0 + 1; z <= z1 - 3; z++) for (let x = -bw; x <= bw; x++) if (B.get(x, fy + 1, z) === AIR) B.set(x, fy, z, FLOOR);
    cockpit(B, z0 + 1, fy, st, { consoles: true });
    for (const sx of [-2, 2]) if (B.get(sx, fy + 1, z0 + 2) === AIR) B.fix(sx, fy + 1, z0 + 2, st.seat);
    // partitions with doorways
    const zQ = z0 + 6, zG = zQ + 5, zC = zG + 4, zE = z1 - 6;
    for (const zp of [zQ, zG, zC, zE]) for (let y = fy + 1; y <= fy + 3; y++) for (let x = -W + 1; x <= W - 1; x++) if (Math.abs(x) > 0 || y > fy + 2) { if (B.get(x, y, zp) === AIR) B.set(x, y, zp, HULL2); }
    // quarters: bunks along the walls
    for (let z = zQ + 1; z < zG - 1; z += 2) { if (B.get(-W + 1, fy + 1, z) === AIR && B.get(-W + 1, fy + 1, z + 1) === AIR) { B.fix(-W + 1, fy + 1, z, st.bedS0); B.fix(-W + 1, fy + 1, z + 1, st.bedS1); } if (B.get(W - 1, fy + 1, z) === AIR && B.get(W - 1, fy + 1, z + 1) === AIR) { B.fix(W - 1, fy + 1, z, st.bedS0); B.fix(W - 1, fy + 1, z + 1, st.bedS1); } }
    // galley
    B.fix(-W + 1, fy + 1, zG + 1, st.table); B.fix(-W + 1, fy + 1, zG + 2, st.furnace); B.fix(W - 1, fy + 1, zG + 1, st.barrel); B.fix(W - 1, fy + 1, zG + 2, st.chest);
    // cargo bay
    for (let z = zC + 1; z < zE; z++) for (let x = -W + 1; x <= W - 1; x++) if (B.get(x, fy, z) === FLOOR) B.set(x, fy, z, GRATE);
    for (let z = zC + 1; z < zE; z++) for (const x of [-W + 1, W - 1]) { if (B.get(x, fy + 1, z) === AIR && rng.chance(0.75)) { B.fix(x, fy + 1, z, st.crate); if (rng.chance(0.4) && B.get(x, fy + 2, z) === AIR) B.fix(x, fy + 2, z, st.crate); } }
    // engine room
    B.fix(0, fy + 1, zE + 2, st.reactor); B.fix(0, fy + 2, zE + 2, st.conduitY); B.fix(0, fy + 3, zE + 2, st.conduitY);
    for (const sx of [-2, 2]) if (B.get(sx, fy + 1, zE + 2) === AIR) B.fix(sx, fy + 1, zE + 2, st.conduitY);
    lights(B, 0, fy + 4, z0 + 2, z1 - 3, st, 3);
    B.hatch = { x: -W, z: zC + 2, y: fy + 1, w: 2 };
    B.canopy = null;
    landingGear(B, [[-W + 1, z0 + 3], [W - 1, z0 + 3], [-W + 1, z1 - 3], [W - 1, z1 - 3]], 2);
  };
  ARCHS.cruiser = (rng, B, st) => {
    const L = rng.irange(32, 42), z0 = -Math.floor(L / 2), z1 = z0 + L;
    const W = 3.4, H = 3.2, Rr = W + rng.irange(4, 5), cy = Rr + 2.4, bottom = Math.floor(cy - H);
    B.hull(z0, z1 - 1, (t) => { const n = Math.min(1, t / 0.38); return { w: W * (0.25 + 0.75 * Math.pow(n, 0.8)), h: H * (0.35 + 0.65 * Math.pow(n, 0.7)), cy: cy + (1 - n) * 0.4, p: 3 }; }, HULL);
    // command tower
    const tz0 = z0 + Math.round(L * 0.55), tz1 = tz0 + 5, ty0 = Math.floor(cy + H);
    for (let z = tz0; z <= tz1; z++) for (let y = ty0; y <= ty0 + 4; y++) for (let x = -2; x <= 2; x++) B.set(x, y, z, y === ty0 + 3 && Math.abs(x) <= 1 ? GLASS : (y === ty0 + 4 ? TRIM : HULL2));
    B.fix(0, ty0 + 5, tz0 + 1, st.antenna); B.fix(0, ty0 + 5, tz1 - 1, st.dish);
    // ring drive
    const rz = z0 + Math.round(L * 0.72);
    B.torus(0, cy, rz, Rr, 1.05, HULL2);
    for (let a = 0; a < 4; a++) { const ang = a * Math.PI / 2 + Math.PI / 4; for (let d = 2; d < Rr; d++) B.set(Math.round(Math.cos(ang) * d), Math.floor(cy + Math.sin(ang) * d), rz, TRIM); }
    for (let a = 0; a < 24; a++) { const ang = a / 24 * Math.PI * 2; B.set(Math.round(Math.cos(ang) * (Rr - 1)), Math.floor(cy + Math.sin(ang) * (Rr - 1)), rz, GLOW); }
    // weapons & greebles
    B.fix(0, Math.floor(cy + H) + 0, z0 + Math.round(L * 0.3), st.turret);
    for (let z = z0 + 6; z < z1 - 2; z += 4) for (const sx of [-1, 1]) { const x = sx * Math.round(W); if (B.get(x, Math.floor(cy), z) === HULL) B.set(x, Math.floor(cy), z, ACC); }
    for (let z = z0 + 8; z < z1 - 3; z++) if (B.get(0, Math.floor(cy + H), z) === HULL && z % 2 === 0) B.set(0, Math.floor(cy + H), z, ACC2);
    // engines
    for (const [x, y] of [[0, Math.floor(cy)], [-2, Math.floor(cy)], [2, Math.floor(cy)], [0, Math.floor(cy) + 2], [0, Math.floor(cy) - 2]]) rearThruster(B, x, y, st);
    // interior
    const fy = bottom + 1;
    B.carve(-2, fy + 1, z0 + 7, 2, fy + 3, z1 - 3);
    for (let z = z0 + 7; z <= z1 - 3; z++) for (let x = -2; x <= 2; x++) if (B.get(x, fy + 1, z) === AIR) B.set(x, fy, z, FLOOR);
    cockpit(B, z0 + 7, fy, st, { consoles: true });
    const zQ = z0 + 10, zR = rz - 2;
    for (let z = zQ; z < zR - 2; z += 2) { if (B.get(-2, fy + 1, z) === AIR && B.get(-2, fy + 1, z + 1) === AIR) { B.fix(-2, fy + 1, z, st.bedS0); B.fix(-2, fy + 1, z + 1, st.bedS1); } }
    for (let z = zQ; z < zR - 2; z += 3) if (B.get(2, fy + 1, z) === AIR) B.fix(2, fy + 1, z, rng.chance(0.5) ? st.chest : st.table);
    B.fix(0, fy + 1, zR + 1, st.reactor); B.fix(0, fy + 2, zR + 1, st.conduitY);
    if (B.get(0, fy + 1, zR + 3) === AIR) B.fix(0, fy + 1, zR + 3, st.holo);
    // tower access
    for (let y = fy + 1; y <= ty0 + 2; y++) { B.set(0, y, tz0 + 2, AIR); B.set(0, y, tz0 + 1, AIR); }
    for (let y = fy + 1; y <= ty0 + 1; y++) B.fix(0, y, tz0 + 1, st.ladderN);
    B.carve(-1, ty0 + 1, tz0 + 1, 1, ty0 + 2, tz1 - 1);
    lights(B, 0, fy + 4, z0 + 8, z1 - 3, st, 4);
    B.hatch = { x: -Math.round(W), z: zQ + 2, y: fy + 1 };
    B.canopy = { z0: z0 + 5, z1: z0 + 9, y0: Math.floor(cy) + 2 };
    for (const [x, z] of [[-2, z0 + 10], [2, z0 + 10], [-2, z1 - 5], [2, z1 - 5]]) { const b = B.bottom(x, z); for (let y = 0; y < b; y++) B.set(x, y, z, TRIM); B.set(x, 0, z, ACC2); }
  };
  ARCHS.dropship = (rng, B, st) => {
    const L = rng.irange(18, 23), z0 = -Math.floor(L / 2), z1 = z0 + L;
    const W = rng.range(6.5, 8.5), H = 2.6, cy = 1 + H;
    B.hull(z0, z1 - 1, (t) => ({ w: W * Math.pow(Math.sin(Math.PI * Math.min(0.98, 0.1 + t * 0.9)), 0.7) + 0.6, h: H * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.1))), cy, p: 2.3 }), HULL);
    // wing edges glow, dorsal stripe
    for (let z = z0; z < z1; z++) { let mx = 0; for (let x = 0; x <= B.XR; x++) if (B.solid(x, Math.floor(cy), z)) mx = x; if (mx > 3) { B.set(mx, Math.floor(cy), z, ACC); B.set(-mx, Math.floor(cy), z, ACC); } const t = B.top(0, z); if (t > 0 && z % 2 === 0) B.set(0, t, z, ACC2); }
    // interior troop bay & cockpit
    const fy = 1;
    B.carve(-3, fy + 1, z0 + 3, 3, fy + 3, z1 - 3);
    for (let z = z0 + 3; z <= z1 - 3; z++) for (let x = -3; x <= 3; x++) if (B.get(x, fy + 1, z) === AIR) B.set(x, fy, z, FLOOR);
    cockpit(B, z0 + 3, fy, st, { consoles: true });
    for (let z = z0 + 7; z <= z1 - 4; z += 2) { if (B.get(-3, fy + 1, z) === AIR) B.fix(-3, fy + 1, z, st.seatE); if (B.get(3, fy + 1, z) === AIR) B.fix(3, fy + 1, z, st.seatW); }
    lights(B, 0, fy + 4, z0 + 5, z1 - 3, st, 3);
    // rear ramp opening
    for (let y = fy + 1; y <= fy + 2; y++) for (let x = -1; x <= 1; x++) { B.set(x, y, z1 - 1, AIR); B.set(x, y, z1 - 2, AIR); }
    for (let x = -1; x <= 1; x++) { B.set(x, fy, z1 - 1, ACC); }
    for (const sx of [-4, -2, 2, 4]) rearThruster(B, sx, Math.floor(cy), st);
    B.canopy = { z0: z0 + 1, z1: z0 + 5, y0: Math.floor(cy) + 1 };
    landingGear(B, [[-3, z0 + 5], [3, z0 + 5], [-4, z1 - 5], [4, z1 - 5]], 1);
  };
  ARCHS.carrier = (rng, B, st) => {
    const L = rng.irange(58, 76), z0 = -Math.floor(L / 2), z1 = z0 + L;
    const W = rng.irange(6, 8), H = 5, cy = 3 + H, bottom = Math.floor(cy - H);
    // armoured spine with a stepped bow
    B.hull(z0, z1 - 1, (t) => { const n = Math.min(1, t / 0.22); return { w: W * (0.45 + 0.55 * n), h: H * (0.55 + 0.45 * n), cy, p: 6 }; }, HULL);
    // side sponsons with rows of lit portholes
    const sp0 = z0 + Math.round(L * 0.25), sp1 = z1 - 8;
    for (const sgn of [-1, 1]) for (let z = sp0; z <= sp1; z++) for (let y = bottom + 2; y <= bottom + 6; y++) for (let x = W + 1; x <= W + 3; x++) {
      const face = x === W + 3;
      B.set(sgn * x, y, z, face && (y === bottom + 3 || y === bottom + 5) && z % 2 === 0 ? PORT : (face && y === bottom + 4 ? ACC : HULL2));
    }
    // stacked decks toward the stern and a command bridge
    const d0 = z0 + Math.round(L * 0.45);
    for (let z = d0; z <= z1 - 6; z++) for (let y = Math.floor(cy + H); y <= Math.floor(cy + H) + 2; y++) for (let x = -W + 2; x <= W - 2; x++) B.set(x, y, z, y === Math.floor(cy + H) + 1 && Math.abs(x) === W - 2 && z % 2 === 0 ? PORT : HULL2);
    const bz0 = z1 - 16, by0 = Math.floor(cy + H) + 3;
    for (let z = bz0; z <= bz0 + 6; z++) for (let y = by0; y <= by0 + 3; y++) for (let x = -3; x <= 3; x++) B.set(x, y, z, y === by0 + 2 ? GLASS : (y === by0 + 3 ? TRIM : HULL2));
    B.fix(0, by0 + 4, bz0 + 2, st.antenna); B.fix(2, by0 + 4, bz0 + 4, st.dish); B.fix(-2, by0 + 4, bz0 + 4, st.antenna);
    // bow hangar mouth glowing at the edges
    const hz = z0 + Math.round(L * 0.2);
    for (let z = hz - 2; z <= hz + 6; z++) for (let y = bottom + 2; y <= bottom + 4; y++) for (let x = -W + 1; x <= W - 1; x++) if (B.get(x, y, z) !== E) B.set(x, y, z, AIR);
    for (let x = -W + 1; x <= W - 1; x++) { B.set(x, bottom + 1, hz - 3, GLOW); B.set(x, bottom + 5, hz - 3, GLOW); }
    // turrets and dorsal lights
    for (let z = z0 + 10; z < d0; z += 8) B.fix(0, B.top(0, z) + 1, z, st.turret);
    for (let z = z0 + 4; z < z1 - 4; z += 3) { const t = B.top(-W + 1, z); if (t > 0 && B.get(-W + 1, t, z) === HULL) B.set(-W + 1, t, z, GLOW); const t2 = B.top(W - 1, z); if (t2 > 0 && B.get(W - 1, t2, z) === HULL) B.set(W - 1, t2, z, GLOW); }
    // engine bank
    for (let y = bottom + 2; y <= Math.floor(cy + H) - 2; y += 2) for (let x = -W + 2; x <= W - 2; x += 2) rearThruster(B, x, y, st);
    // bridge interior with the helm
    const fy = by0 - 1;
    for (let z = bz0 + 1; z <= bz0 + 5; z++) for (let y = by0; y <= by0 + 1; y++) for (let x = -2; x <= 2; x++) B.set(x, y, z, AIR);
    for (let z = bz0 + 1; z <= bz0 + 5; z++) for (let x = -2; x <= 2; x++) B.set(x, fy, z, FLOOR);
    cockpit(B, bz0 + 1, fy, st, { consoles: true });
    for (const sx of [-2, 2]) B.fix(sx, fy + 1, bz0 + 3, st.seat);
    B.fix(0, fy + 1, bz0 + 5, st.holo);
    B.canopy = null;
    for (const [x, z] of [[-W + 2, z0 + 12], [W - 2, z0 + 12], [-W + 2, z1 - 10], [W - 2, z1 - 10], [0, Math.round((z0 + z1) / 2)]]) { const b = B.bottom(x, z); for (let y = 0; y < b; y++) B.set(x, y, z, TRIM); }
  };
  ARCHS.shuttle = (rng, B, st) => {
    if (!VR.buildShuttle) return ARCHS.interceptor(rng, B, st);
    // the classic Starforge shuttle, written straight into the builder as fixtures
    VR.buildShuttle((u, yy, v, s) => { if (!B.in(u, yy, v)) return; const i = B.i(u, yy, v); if (s) { B.fixt[i] = s; B.role[i] = HULL; } else { B.fixt[i] = 0; B.role[i] = AIR; } }, (f) => f, rng);
    B.prebuilt = true;
  };

  // ---------------------------------------------------------------- generic detailing: stripes, windows, nav lights, vents
  function detail(B, rng, arch, st) {
    // longitudinal accent stripe at the widest row
    if (arch !== 'freighter' && arch !== 'carrier') {
      let bestY = -1, bestW = 0;
      for (let y = 1; y <= B.YH; y++) { let w = 0; for (let z = -B.ZR; z <= B.ZR; z++) for (let x = 0; x <= B.XR; x++) if (B.get(x, y, z) === HULL) { w += x; } if (w > bestW) { bestW = w; bestY = y; } }
      if (bestY > 0) for (let z = -B.ZR; z <= B.ZR; z++) for (const sgn of [-1, 1]) {
        let ox = null; for (let x = B.XR; x >= 0; x--) if (B.solid(sgn * x, bestY, z)) { ox = x; break; }
        if (ox !== null && B.get(sgn * ox, bestY, z) === HULL && B.get(sgn * (ox + 1), bestY, z) === E) B.set(sgn * ox, bestY, z, ACC);
      }
    }
    // windows at head height where a room touches the outer skin
    for (let y = 2; y < B.YH; y++) for (let z = -B.ZR; z <= B.ZR; z++) for (let x = -B.XR + 1; x < B.XR; x++) {
      const r = B.get(x, y, z); if (r !== HULL && r !== HULL2 && r !== ACC) continue;
      for (const sgn of [-1, 1]) if (B.get(x - sgn, y, z) === AIR && B.get(x - sgn, y - 1, z) === AIR && B.get(x + sgn, y, z) === E && ((z & 1) === 0)) { B.set(x, y, z, GLASS); break; }
    }
    // navigation lights: port (left) red-magenta, starboard (right) green
    let minX = 1e9, maxX = -1e9, lp = null, rp = null;
    for (let y = 0; y <= B.YH; y++) for (let z = -B.ZR; z <= B.ZR; z++) for (let x = -B.XR; x <= B.XR; x++) { if (!B.solid(x, y, z) || B.fixt[B.i(x, y, z)]) continue; if (x < minX || (x === minX && z < lp[2])) { minX = x; lp = [x, y, z]; } if (x > maxX || (x === maxX && z < rp[2])) { maxX = x; rp = [x, y, z]; } }
    if (lp && rp && maxX - minX > 4) { B.set(lp[0], lp[1], lp[2], NAVL); B.set(rp[0], rp[1], rp[2], NAVR); }
    // dorsal vents and a few antennas on bigger hulls
    let n = 0; for (let i = 0; i < B.role.length; i++) if (B.role[i] !== E && B.role[i] !== AIR) n++;
    for (let z = -B.ZR; z <= B.ZR; z++) for (let x = -B.XR; x <= B.XR; x++) {
      const t = B.top(x, z); if (t < 2) continue;
      const r = B.get(x, t, z);
      if ((r === HULL || r === HULL2) && !B.fixt[B.i(x, t, z)] && rng.chance(0.035)) B.fix(x, t, z, S('vent'));
      else if (n > 420 && (r === HULL || r === HULL2) && t + 1 <= B.YH && rng.chance(0.012) && Math.abs(x) <= 2) B.fix(x, t + 1, z, st.antenna);
    }
  }

  // ---------------------------------------------------------------- finishing: paint, glass, hatch, connectivity
  function paint(B, pal, rng, arch) {
    const st = {
      hull: S(pal.hull), hull2: S(pal.hull2), trim: S(pal.trim), glass: S(pal.glass), glow: S(pal.glow), eng: S(pal.eng), floor: S('hull_plating_dark'), grate: S('metal_grate'),
      navl: S('neon_magenta'), navr: S('neon_lime'), port: S(pal.key === 'nightwing' ? 'neon_magenta' : 'neon_amber'),
    };
    const accT = R.byName[pal.acc], acc2T = R.byName[pal.acc2];
    const accS = (axis) => accT ? (accT.has('axis') ? accT.state({ axis }) : accT.defaultState) : st.hull2;
    const acc2S = (axis) => acc2T ? (acc2T.has('axis') ? acc2T.state({ axis }) : acc2T.defaultState) : st.hull2;
    const out = new Uint16Array(B.role.length);
    const SX = B.SX, SZ = B.SZ;
    for (let y = 0; y <= B.YH; y++) for (let z = -B.ZR; z <= B.ZR; z++) for (let x = -B.XR; x <= B.XR; x++) {
      const i = B.i(x, y, z), r = B.role[i];
      if (B.fixt[i]) { out[i] = B.fixt[i]; continue; }
      let s = 0;
      switch (r) {
        case HULL: s = (((z + 64) % 4 === 0) && B.get(x, y + 1, z) === E) || (arch === 'freighter' && rng.chance(0.06)) ? st.hull2 : st.hull; break;
        case HULL2: s = st.hull2; break;
        case TRIM: s = st.trim; break;
        case ACC: s = accS(2); break;
        case ACC2: s = acc2S(2); break;
        case GLASS: s = st.glass; break;
        case GLOW: s = st.glow; break;
        case ENG: s = st.eng; break;
        case FLOOR: s = st.floor; break;
        case GRATE: s = st.grate; break;
        case NAVL: s = st.navl; break;
        case NAVR: s = st.navr; break;
        case PORT: s = rng.chance(0.8) ? st.port : st.hull2; break;
        default: s = 0;
      }
      out[i] = s;
    }
    void SX; void SZ;
    return out;
  }
  function applyCanopy(B) {
    const c = B.canopy; if (!c) return;
    for (let z = c.z0; z <= c.z1; z++) for (let y = c.y0; y <= B.YH; y++) for (let x = -B.XR; x <= B.XR; x++) {
      const r = B.get(x, y, z);
      if (r !== HULL && r !== HULL2) continue;
      // glass only on the outer skin above the cockpit
      let open = false; for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]]) if (B.get(x + dx, y + dy, z + dz) === E) open = true;
      if (open) B.set(x, y, z, GLASS);
    }
  }
  function applyHatch(B) {
    const h = B.hatch; if (!h) return;
    // find the port-side wall at this z and open a 2-high doorway through it
    for (let dz = 0; dz < (h.w || 1); dz++) {
      const z = h.z + dz;
      for (let x = -B.XR; x < 0; x++) {
        if (!B.solid(x, h.y, z)) continue;
        B.set(x, h.y, z, AIR); B.set(x, h.y + 1, z, AIR);
        if (B.solid(x, h.y - 1, z)) B.set(x, h.y - 1, z, ACC2);
        break;
      }
    }
  }
  function keepConnected(bp) {
    const { sx, sy, sz, blocks, helm } = bp;
    const idx = (x, y, z) => (y * sz + z) * sx + x;
    const seen = new Uint8Array(blocks.length);
    const q = [helm[0], helm[1], helm[2]]; seen[idx(helm[0], helm[1], helm[2])] = 1;
    while (q.length) {
      const z = q.pop(), y = q.pop(), x = q.pop();
      for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
        const i = idx(nx, ny, nz);
        if (seen[i] || !blocks[i]) continue;
        seen[i] = 1; q.push(nx, ny, nz);
      }
    }
    let dropped = 0;
    for (let i = 0; i < blocks.length; i++) if (blocks[i] && !seen[i]) { blocks[i] = 0; dropped++; }
    return dropped;
  }

  function states() {
    return {
      helm: S('helm', { facing: 0 }), seat: S('pilot_seat', { facing: 0 }), seatE: S('pilot_seat', { facing: 1 }), seatW: S('pilot_seat', { facing: 3 }),
      consoleE: S('console', { facing: 1 }), consoleW: S('console', { facing: 3 }),
      thr: S('thruster', { facing: 2, lit: 1 }), thrDown: S('thruster', { facing: 5, lit: 1 }),
      light: S('light_panel', { facing: 5 }), crate: S('cargo_crate', { facing: 0 }), reactor: S('reactor_core'), conduitY: S('energy_conduit', { axis: 0 }),
      bedS0: S('light_gray_bed', { facing: 2, part: 0 }), bedS1: S('light_gray_bed', { facing: 2, part: 1 }),
      table: S('crafting_table'), furnace: S('furnace'), barrel: S('barrel', { facing: 4 }), chest: S('chest', { facing: 0 }),
      antenna: S('antenna'), dish: S('satellite_dish', { facing: 0 }), turret: S('turret'), holo: S('holo_projector'), ladderN: S('ladder', { facing: 2 }),
    };
  }

  // ---------------------------------------------------------------- public API
  const ShipGen = VR.ShipGen = {
    ARCH, PALETTES,
    archetypes: Object.keys(ARCH),
    pickArch(rng, allow) {
      const keys = (allow || Object.keys(ARCH)).filter(k => ARCH[k]);
      let tot = 0; for (const k of keys) tot += ARCH[k].weight;
      let r = rng.next() * tot; for (const k of keys) { r -= ARCH[k].weight; if (r <= 0) return k; }
      return keys[0];
    },
    // → {name, arch, palette, sx, sy, sz, blocks (Uint16, idx (y*sz+z)*sx+x), helm [x,y,z], ox, oz (grid index of local x=0 / z=0), count, thrusters, length, width, height}
    design(seed, arch, opts) {
      opts = opts || {};
      const rng = new VR.RNG((seed >>> 0) ^ 0x51f7a3);
      arch = arch && ARCH[arch] ? arch : this.pickArch(rng, opts.allow);
      const pal = opts.palette ? (PALETTES.find(p => p.key === opts.palette) || PALETTES[0]) : (arch === 'shuttle' ? PALETTES[0] : arch === 'freighter' && rng.chance(0.5) ? PALETTES[5] : rng.pick(PALETTES));
      const B = ARCH[arch].big ? new Builder(24, 36, 42) : new Builder(16, 24, 26);
      const st = states();
      ARCHS[arch](rng, B, st);
      if (!B.prebuilt) { detail(B, rng, arch, st); applyCanopy(B); applyHatch(B); }
      const full = B.prebuilt ? (() => { const o = new Uint16Array(B.role.length); for (let i = 0; i < o.length; i++) o[i] = B.fixt[i]; return o; })() : paint(B, pal, rng, arch);
      // crop to bounds
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let y = 0; y <= B.YH; y++) for (let z = -B.ZR; z <= B.ZR; z++) for (let x = -B.XR; x <= B.XR; x++) if (full[B.i(x, y, z)]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      y0 = 0;
      const sx = x1 - x0 + 1, sy = y1 - y0 + 1, sz = z1 - z0 + 1;
      const blocks = new Uint16Array(sx * sy * sz);
      let helm = null, count = 0, thr = 0;
      const tHelm = R.byName.helm.id, tThr = R.byName.thruster.id;
      for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
        const s = full[B.i(x + x0, y + y0, z + z0)]; if (!s) continue;
        blocks[(y * sz + z) * sx + x] = s;
        const ty = R.T.type[s];
        if (ty === tHelm && !helm) helm = [x, y, z];
        if (ty === tThr) thr++;
      }
      const bp = { arch, palette: pal.key, paletteName: pal.name, sx, sy, sz, blocks, helm, ox: -x0, oz: -z0, seed: seed >>> 0 };
      if (helm) keepConnected(bp);
      for (let i = 0; i < blocks.length; i++) if (blocks[i]) count++;
      bp.count = count; bp.thrusters = thr; bp.length = sz; bp.width = sx; bp.height = sy;
      const nr = new VR.RNG(((seed >>> 0) ^ 0x9e3779b9) + Object.keys(ARCH).indexOf(arch) * 7777);
      const nm = nr.chance(0.25) ? nr.pick(ADJ) + ' ' + nr.pick(NAMES) : nr.pick(NAMES);
      bp.name = `${ARCH[arch].code}-${10 + nr.int(90)} ${nm}`;
      bp.label = ARCH[arch].label;
      return bp;
    },
    // write a blueprint into the world through put(x, y, z, state). (x, y, z) = where local (0, 0, 0) lands; dir = quarter turns (0 = nose north)
    place(bp, put, x, y, z, dir) {
      const { sx, sy, sz, blocks, ox, oz } = bp;
      for (let ly = 0; ly < sy; ly++) for (let lz = 0; lz < sz; lz++) for (let lx = 0; lx < sx; lx++) {
        const s = blocks[(ly * sz + lz) * sx + lx]; if (!s) continue;
        const [dx, dz] = VR.rotXZ(lx - ox, lz - oz, dir);
        put(x + dx, y + ly, z + dz, rotateState(s, dir));
      }
    },
    // local-space bounding box (relative to the placement point), before rotation
    bounds(bp) { return { x0: -bp.ox, x1: bp.sx - 1 - bp.ox, z0: -bp.oz, z1: bp.sz - 1 - bp.oz, h: bp.sy }; },
  };
  void ShipGen;
})(VR);

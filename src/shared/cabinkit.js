// ============================================================================
// Cabin kit (shared — built in a worker, like the cockpit kit): furnishes the
// shuttle's walkable deck from meta.cabin (shipcabin.js). Deck plates with
// seams, a yellow walkway line and tie-down rails in the cargo bay, smooth
// frame ribs following the hull's inside, warm light strips along the ceiling
// and the walls, jump seats with harnesses that fold out of the walls, lockers
// with lit seams and handles, the holo map table (its hologram is a moving
// part), a hoverbike in its rack, strapped crate stacks, tread plates with
// yellow nosings on the steps up to the cockpit, and the wall buttons for the
// cockpit door, the side door and the ramp. Static detail at 1/32 m (1/16 m on
// Very Low), light baked as short-range occlusion (the cabin is lit by its own
// lamps, not by the sky). Output: the cockpit kit's mesh format.
// ============================================================================
(function (VR) {
  'use strict';
  const CK = VR.CockpitKit, EM = CK.EM;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const shade = (c, k) => { const f = (s) => Math.min(255, Math.round(((c >> s) & 255) * k)); return (f(16) << 16) | (f(8) << 8) | f(0); };

  // walk: the 25 cm occupancy (shipcabin.js walkGrid) — the hull's inside is read from it for the ribs
  function build(Cb, walk, pal, res) {
    const P = pal || {}, v = 1 / res, I = (m) => Math.floor(m * res + 1e-6), ctr = (i) => (i + 0.5) / res;
    const acc = P.acc !== undefined ? P.acc : 0xf07a1e, glow = P.glow !== undefined ? P.glow : 0x5af4ff, hull2 = P.hull2 !== undefined ? P.hull2 : 0xc3c9d3;
    const K = {
      deck: 0x30343a, seam: 0x1c1e22, rail: 0x5b626c, line: 0xe8b41e, dark: 0x1b1d21,
      rib: shade(hull2, 0.62), panel: shade(hull2, 0.8), panel2: shade(hull2, 0.68), seat: 0x2f3339, seat2: 0x3a3f46, shell: shade(hull2, 0.55),
      metal: 0xa3abb5, metal2: 0x6b737e, crate: 0x8a7550, crate2: 0x6d5c3f, crateE: 0x4a4034, strap: 0xd8a020, bike: acc, bike2: 0x2a2d33,
      lamp: 0xfff1d8, glow, glowDim: shade(glow, 0.55), green: 0x2fd06a, amber: 0xffb347, acc,
    };
    const yF = Cb.floor, zIn = Cb.zIn, zC = Cb.zC, zEnd = Cb.zEnd, W = Cb.wx + 0.45;
    // the hull's inside, per cross-section: the wall's x at each 25 cm row (from the walk grid), smoothed
    const R = walk.res, O = walk.origin, D = walk.dims;
    const HB = walk.hull || walk.bits;
    const solidC = (i, j, k) => { if (i < 0 || j < 0 || k < 0 || i >= D[0] || j >= D[1] || k >= D[2]) return true; const n = (j * D[2] + k) * D[0] + i; return !!(HB[n >> 3] & (1 << (n & 7))); };
    const ci0 = Math.round((0 - O[0]) * R);
    // the hull's inner face from the middle outward at (y, z): the first solid 25 cm cell (no furniture), smoothed over ±25 cm
    const wallX1 = (y, z, sgn) => {
      const j = Math.floor((y - O[1]) * R), k = Math.floor((z - O[2]) * R);
      for (let a = 0; a < 40; a++) { const i = sgn > 0 ? ci0 + a : ci0 - 1 - a; if (solidC(i, j, k)) return sgn * a / R; }
      return sgn * 2;
    };
    const wallX = (y, z, sgn) => (wallX1(y - 0.2, z, sgn) + wallX1(y, z, sgn) * 2 + wallX1(y + 0.2, z, sgn)) / 4;
    const ceilY = (z) => { const k = Math.floor((z - O[2]) * R); for (let j = Math.floor((yF + 0.3 - O[1]) * R); j < D[1]; j++) if (solidC(ci0, j, k)) return O[1] + j / R; return yF + 3; };
    const top = Math.max(ceilY(zIn + 1.5), ceilY((zC + zEnd) / 2)) + 0.05;
    const S = new CK.Grid(res, I(-W) - 1, I(yF - 0.05), I(zIn - 0.6), I(W) + 2, I(top) + 1, I(zEnd + 0.1) + 1);
    const put = (i, j, k, c) => S.set(i, j, k, c);
    const box = (x0, y0, z0, x1, y1, z1, col) => {
      const i0 = I(Math.min(x0, x1)), i1 = I(Math.max(x0, x1)), j0 = I(y0), j1 = I(y1), k0 = I(z0), k1 = I(z1), fn = typeof col === 'function';
      for (let j = j0; j < j1; j++) for (let k = k0; k < k1; k++) for (let i = i0; i < i1; i++) { const c = fn ? col(ctr(i), ctr(j), ctr(k), i, j, k) : col; if (c !== null && c !== undefined) put(i, j, k, c); }
    };
    const parts = {}, tubes = [], add = (name, at, fill) => { const q = new CK.Part(); fill(q); parts[name] = { q, at }; };
    const F = yF + v;   // the plates' top
    // ---- deck plates (wall to wall), seams every metre, the walkway line, tie-down rails in the cargo bay
    for (let k = I(zIn); k < I(zEnd); k++) {
      const z = ctr(k), xl = wallX(yF + 0.1, z, -1) + 0.02, xr = wallX(yF + 0.1, z, 1) - 0.02;
      for (let i = I(xl); i < I(xr); i++) {
        const x = ctr(i), seam = ((z - zIn + 100) % 1) < v || Math.abs(Math.abs(x) - 0.75) < v * 0.5;
        const line = z > zC && Math.abs(Math.abs(x) - 0.62) < 0.025, railL = z > zC + 0.3 && Math.abs(Math.abs(x) - 1.05) < v * 0.6;
        put(i, I(yF), k, line ? K.line : seam ? K.seam : K.deck);
        if (railL) put(i, I(yF) + 1, k, ((k >> 2) & 1) ? K.rail : K.metal2);
      }
    }
    // ---- tread plates with yellow nosings on the steps up to the cockpit
    for (let s = 0; s < 3; s++) {
      const tp = Cb.cfloor - 0.25 * (s + 1); if (tp <= yF + 1e-3) break;
      box(-0.75, tp, zIn + s * 0.25, 0.75, tp + v, zIn + (s + 1) * 0.25, (x, y, z) => (z < zIn + s * 0.25 + 0.05 ? K.line : K.deck));
    }
    // ---- frame ribs: smooth tubes up the walls and over the ceiling, every 1.5 m (open at the back: the hull hides it)
    for (let z = zIn + 0.35; z < zEnd - 0.2; z += 1.5) {
      const pts = [], nrm = [];
      for (let y = yF + 0.12; y < top; y += 0.3) { const x = wallX(y, z, -1); pts.push([x + 0.05, y, z]); nrm.push([-1, 0, 0]); }
      const yc = ceilY(z) - 0.05; pts.push([-0.4, yc, z]); nrm.push([0, 1, 0]); pts.push([0.4, yc, z]); nrm.push([0, 1, 0]);
      for (let y = top - 0.01; y > yF + 0.1; y -= 0.3) { const x = wallX(y, z, 1); if (x < 0.5) continue; pts.push([x - 0.05, y, z]); nrm.push([1, 0, 0]); }
      // keep the wall points that are really below the ceiling
      const P2 = [], N2 = []; for (let n = 0; n < pts.length; n++) if (pts[n][1] <= yc + 0.01) { P2.push(pts[n]); N2.push(nrm[n]); }
      if (P2.length > 3) tubes.push({ p: P2, n: N2, w: 0.09, h: 0.06, col: K.rib, open: true });
    }
    // ---- light strips: two along the ceiling, one along each wall at shoulder height
    for (let k = I(zIn + 0.1); k < I(zEnd - 0.1); k++) {
      const z = ctr(k), yc = ceilY(z);
      for (const sx of [-0.45, 0.45]) for (let i = I(sx - 0.03); i < I(sx + 0.03); i++) put(i, I(yc) - 1, k, K.lamp | EM);
      for (const sg of [-1, 1]) { const x = wallX(yF + 1.3, z, sg); put(I(x - sg * 0.02), I(yF + 1.3), k, K.glowDim | EM); }
    }
    // ---- the items
    for (const it of Cb.items) {
      if (it.kind === 'seat') {
        // a jump seat on the wall facing in: pan, back against the wall, headrest, harness in the accent colour
        const f = it.face, xw = it.x - f * 0.3, x0 = it.x - 0.25 * f, x1 = it.x + 0.22 * f, pan = F + 0.46, z = it.z;
        box(x0, pan - 0.08, z - 0.24, x1, pan, z + 0.24, (x, y, zz) => (Math.abs(zz - z) > 0.18 ? K.shell : ((y > pan - 0.04 && Math.abs(zz - z) < 0.18) ? K.seat2 : K.seat)));
        box(it.x - f * 0.05 - 0.02, F, z - 0.02, it.x - f * 0.05 + 0.02, pan - 0.08, z + 0.02, K.metal2);
        box(xw - f * 0.02, pan, z - 0.24, xw + f * 0.12, F + 1.22, z + 0.24, (x, y, zz) => (Math.abs(zz - z) > 0.18 ? K.shell : (f * (x - xw) > 0.08 ? K.seat2 : K.seat)));
        box(xw - f * 0.02, F + 1.25, z - 0.13, xw + f * 0.12, F + 1.45, z + 0.13, K.seat);
        for (const sz of [-0.08, 0.08]) for (let j = I(pan + 0.04); j < I(F + 1.18); j++) put(I(xw + f * 0.13), j, I(z + sz), K.acc);
        box(xw + f * 0.12, pan, z - 0.1, it.x + f * 0.12, pan + v, z + 0.1, K.acc);
        box(it.x - 0.03, pan, z - 0.03, it.x + 0.03, pan + 0.03, z + 0.03, K.metal);
      } else if (it.kind === 'locker') {
        // a cabinet against the wall: doors with handles, lit seams between them, a lamp on top
        const sg = Math.sign(it.x), xi = it.x - sg * it.w / 2, xo = it.x + sg * it.w / 2;
        const nD = Math.max(1, Math.round((it.z1 - it.z0) / 0.4)), dw = (it.z1 - it.z0) / nD;
        box(xi, it.y0 + v, it.z0, xo, it.y1, it.z1, (x, y, z) => {
          const front = Math.abs(x - xi) < v, rel = (z - it.z0) / dw, seam = Math.abs(rel - Math.round(rel)) * dw < v * 0.6;
          if (!front) return K.panel2;
          if (seam) return (y > it.y0 + 0.1 && y < it.y1 - 0.1) ? K.glowDim | EM : K.dark;
          return y > it.y1 - 0.12 ? K.panel2 : K.panel;
        });
        for (let n = 0; n < nD; n++) { const zc = it.z0 + (n + 0.75) * dw; box(xi - sg * 0.035, it.y0 + 1.0, zc - 0.012, xi, it.y0 + 1.18, zc + 0.012, K.metal); }
      } else if (it.kind === 'table') {
        // the holo map table: a pedestal, a round top with a glowing rim, a projector lens
        const r = it.r, cx = it.x, cz = it.z, ht = F + it.h;
        for (let j = I(F); j < I(ht); j++) for (let k = I(cz - r); k < I(cz + r); k++) for (let i = I(cx - r); i < I(cx + r); i++) {
          const x = ctr(i), y = ctr(j), z = ctr(k), d = Math.hypot(x - cx, z - cz);
          if (y > ht - 0.06) { if (d < r) put(i, j, k, d > r - 0.035 ? K.glow | EM : y > ht - 0.03 && d < 0.09 ? K.lamp | EM : K.dark); }
          else if (y > ht - 0.1) { if (d < r - 0.06) put(i, j, k, K.metal2); }
          else if (d < (y < F + 0.08 ? 0.22 : 0.12)) put(i, j, k, K.metal2);
        }
        // the hologram (a moving part): a wireframe planet — three parallels, three meridians — inside a tilted orbit
        // with a ship on it, on a beam from the lens; thin glowing tubes (metres, so it is the same size on Very Low)
        const H = [], hy = 0.3, hr = 0.16, TAU = Math.PI * 2, rad = (p) => { const l = Math.hypot(p[0], p[1] - hy, p[2]) || 1; return [p[0] / l, (p[1] - hy) / l, p[2] / l]; };
        const loop = (n, fn, w, col) => { const p = []; for (let a = 0; a < n; a++) p.push(fn(a / n * TAU)); H.push({ p, n: p.map(rad), w, h: w, col, em: 1, loop: true }); };
        for (const la of [-0.9, 0, 0.9]) loop(10, (t) => [Math.cos(t) * hr * Math.cos(la), hy + hr * Math.sin(la), Math.sin(t) * hr * Math.cos(la)], 0.012, glow);
        for (const lo of [0, Math.PI / 3, Math.PI * 2 / 3]) loop(12, (t) => [Math.cos(t) * hr * Math.cos(lo), hy + hr * Math.sin(t), Math.cos(t) * hr * Math.sin(lo)], 0.01, glow);
        const tilt = 0.38, orb = (t) => [Math.cos(t) * 0.29, hy + Math.sin(t) * 0.29 * Math.sin(tilt), Math.sin(t) * 0.29 * Math.cos(tilt)];
        loop(16, orb, 0.008, 0xffd88a);
        H.push({ p: [orb(0), orb(0.22)], n: [rad(orb(0)), rad(orb(0.22))], w: 0.03, h: 0.022, col: K.amber, em: 1 });
        H.push({ p: [[0, 0.01, 0], [0, hy - hr - 0.01, 0]], n: [[1, 0, 0], [1, 0, 0]], w: 0.014, h: 0.014, col: glow, em: 1 });
        parts.holo = { tubes: H, at: [cx, ht + 0.05, cz] };
      } else if (it.kind === 'bike') {
        // a hoverbike on its rack: two posts with cradles, the bike's body, seat, bars and glowing pads
        const sg = Math.sign(it.x), cx = it.x, z0 = it.z0 + 0.15, z1 = it.z1 - 0.15, hb = F + 0.45;
        for (const zz of [z0 + 0.25, z1 - 0.25]) { box(cx - sg * 0.45, F, zz - 0.04, cx - sg * 0.37, hb + 0.25, zz + 0.04, K.metal2); box(cx - sg * 0.45, hb - 0.04, zz - 0.04, cx + 0.3 * sg, hb, zz + 0.04, K.metal2); }
        box(cx - 0.2, hb, z0, cx + 0.2, hb + 0.22, z1, (x, y, z) => (Math.abs(x - cx) > 0.16 && y > hb + 0.12 ? K.bike2 : y > hb + 0.18 ? K.bike : (z < z0 + 0.25 ? K.bike : K.bike2)));
        box(cx - 0.13, hb + 0.22, z0 + 0.6, cx + 0.13, hb + 0.3, z1 - 0.45, K.seat);
        box(cx - 0.32, hb + 0.38, z0 + 0.25, cx + 0.32, hb + 0.42, z0 + 0.29, K.metal);
        box(cx - 0.02, hb + 0.22, z0 + 0.24, cx + 0.02, hb + 0.38, z0 + 0.3, K.metal2);
        for (const zz of [z0 + 0.15, z1 - 0.2]) box(cx - 0.25, hb - 0.06, zz - 0.14, cx + 0.25, hb, zz + 0.14, (x, y) => (y < hb - 0.04 ? K.glow | EM : K.bike2));
      } else if (it.kind === 'crate') {
        // a crate (or two stacked): dark frame edges, plank faces, a strap in yellow
        const h = it.h, n = h > 1 ? 2 : 1, ch = h / n, w = it.w;
        for (let c = 0; c < n; c++) {
          const y0 = F + c * ch, y1 = y0 + ch - 0.01;
          box(it.x - w / 2, y0, it.z - w / 2, it.x + w / 2, y1, it.z + w / 2, (x, y, z) => {
            const ex = Math.abs(Math.abs(x - it.x) - w / 2) < v * 1.2, ey = y < y0 + v || y > y1 - v, ez = Math.abs(Math.abs(z - it.z) - w / 2) < v * 1.2;
            if ((ex && ey) || (ex && ez) || (ey && ez)) return K.crateE;
            if (Math.abs(z - it.z) < 0.035) return K.strap;
            return ((Math.floor((y - y0) / 0.25)) & 1) ? K.crate : K.crate2;
          });
        }
      }
    }
    // ---- wall buttons: the cockpit door pad, the side door's and the ramp's (green when open, amber when moving)
    // a pad on a side wall (sg: the way into the room)
    const pad = (x, y, z, sg) => { box(x, y - 0.08, z - 0.06, x + sg * 0.03, y + 0.08, z + 0.06, K.dark); box(x + sg * 0.03, y - 0.025, z - 0.025, x + sg * 0.05, y + 0.025, z + 0.025, K.green | EM); };
    const cd = Cb.cockpitDoor; box(cd.w / 2 + 0.17, cd.y0 + 1.0, cd.z + 0.5, cd.w / 2 + 0.33, cd.y0 + 1.2, cd.z + 0.53, K.dark); box(cd.w / 2 + 0.22, cd.y0 + 1.07, cd.z + 0.53, cd.w / 2 + 0.28, cd.y0 + 1.13, cd.z + 0.56, K.green | EM);
    const dr = Cb.door, dzb = dr.z - dr.w / 2 - 0.2, dwx = wallX(dr.y0 + 1.15, dzb, dr.side);
    pad(dwx, dr.y0 + 1.15, dzb, -dr.side);
    const rwx = -(Cb.ramp.w + 0.35);
    box(rwx - 0.08, Cb.floor + 1.05, zEnd - 0.04, rwx + 0.08, Cb.floor + 1.25, zEnd, K.dark); box(rwx - 0.03, Cb.floor + 1.12, zEnd - 0.06, rwx + 0.03, Cb.floor + 1.18, zEnd - 0.04, K.amber | EM);
    return { res, pr: res * 2, S, parts, tubes, labels: [
      { t: 'RAMPE', c: [rwx, Cb.floor + 1.32, zEnd - 0.005], r: [-1, 0, 0], u: [0, 1, 0], h: 0.024 },
      { t: 'TÜR', c: [cd.w / 2 + 0.25, cd.y0 + 1.27, cd.z + 0.535], r: [1, 0, 0], u: [0, 1, 0], h: 0.024 },
    ] };
  }

  // the worker job (type 'cabin') → meshes + layout
  function job(m) {
    const t0 = Date.now();
    const pal = m.pal && VR.Starship && VR.Starship.PAL ? VR.Starship.PAL.find(p => p.key === m.pal) || null : null;
    const d = build(m.cabin, m.walk, pal, m.res);
    // (a coarse light: the cabin is big, 25 cm cells and four steps keep it under its triangle budget)
    const light = CK.skyField(d.S, -1e9, true, undefined, { cell: 0.25, levels: 4 });
    const body = CK.mesh(d.S, 1, light), tb = CK.tubes(d.tubes, d.res);
    const out = { body: { data: new Uint8Array(body.data.length + tb.data.length), count: body.count + tb.count }, glow: CK.mesh(d.S, 2, null), parts: {} };
    out.body.data.set(body.data, 0); out.body.data.set(tb.data, body.data.length);
    const tr = [out.body.data.buffer, out.glow.data.buffer], layout = {};
    let tris = (out.body.count + out.glow.count) / 3;
    for (const name in d.parts) {
      const P = d.parts[name], G = P.tubes ? null : P.q.grid(d.pr); if (!P.tubes && !G) continue;
      const pm = P.tubes ? CK.tubes(P.tubes, d.pr) : CK.mesh(G, 0, null); out.parts[name] = pm; tr.push(pm.data.buffer); tris += pm.count / 3; layout[name] = P.at;
    }
    return { res: d.res, pr: d.pr, meshes: out, layout, labels: d.labels, tris: Math.round(tris), ms: Date.now() - t0, transfer: tr };
  }
  VR.CabinKit = { build, job };
})(VR);

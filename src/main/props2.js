// ============================================================================
// Smooth furniture, round II (t-smooth2; the owner: „die Items sollen schon echte Möbel sein") — the pieces round I
// (props.js) left as voxels, so that a furnished room has no voxel piece left in view: curtains (a hanging sheet with
// soft vertical folds on a rod with rings), fridges (a rounded steel box, the door seam, the handles, a dark vent on
// top), the dishwasher (steel with a black glass front), range hoods (a chimney hood with a light strip), art (a thin
// frame round a painted canvas from the furniture atlas), mirrors (a reflective F2 material, MAT.mirror), desks (a thin
// top on slab legs or a trestle, a drawer box), wardrobes (a tall box, door seams, handles, a plinth, lacquer or wood),
// the villages' chandeliers and lanterns, the corner sofas (they join the sofa rows as the rows join), the mansion's
// pieces (gen_modern.js: bookcases, vanities, counters, dining sets, the tub, the TV wall …), the villa's remaining ones
// (sideboard, dresser, benches, shelves, office chair, bath, beds, fireplace, piano) and the garden's (lounger, parasol,
// garden chairs, outdoor sofa, fire pit). Every model is built from the voxel piece's own numbers (16 units a block,
// the front at −z) with the builder of props.js (PR.FB, PR.H); the mesher lists the blocks (mesher.js PROP_FURN, the
// joins in PROP_JOIN, the stacked and hanging pieces in PROP_STACK). Nothing is saved; no block id changes.
// ============================================================================
(function (VR) {
  'use strict';
  const PR = VR.Props;
  if (!PR || !PR.H) return;
  const { lin, shd, norm3, cross, sub, hash, MD, WOOD, COL, B_BOT, steelLeg, pillow, glowShade, loop, front, counter, carcass } = PR.H;
  const MAT = PR.MAT, FM = PR.FURN, FDEF = PR.FDEF, TAU = Math.PI * 2;
  MAT.mirror = 12;                                    // a mirror: the shader's reflective F2 response (FURN_FS m == 12)
  const P = { white: 0xF2F2EE, cream: 0xEDE6D6, charcoal: 0x2E3136, black: 0x1C1E22, steel: 0xB8BEC6, chrome: 0xD8DEE4, walnut: 0x6A4426, oak: 0xC09A62, marble: 0xEAEAEC, brass: 0xC8A048, warm: 0xFFD27A, glass: 0xB8DCF0, water: 0x7AC8F0, leaf: 0x3E8A4A, leafL: 0x5AAE5A, soil: 0x4A3626, iron: 0x3A3D44 };
  const MIRROR = 0xDCE6EC;

  // ---------------------------------------------------------------- small builders
  // a face of four points, wound so that its normal points along `out` (whatever order the points come in)
  const face = (F, pts, out, uv, two) => {
    const n = cross(sub(pts[1], pts[0]), sub(pts[3], pts[0]));
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) pts = [pts[1], pts[0], pts[3], pts[2]];
    F.quad(pts[0], pts[1], pts[2], pts[3], uv, two);
  };
  // a closed frustum between two axis-aligned rectangles (a hood's canopy, a lamp's shade, a pot): bottom [x0, z0, x1, z1]
  // at y0, top at y1; caps: 1 bottom, 2 top
  const frustum = (F, b, y0, t, y1, caps) => {
    const B = [[b[0], y0, b[1]], [b[2], y0, b[1]], [b[2], y0, b[3]], [b[0], y0, b[3]]], T = [[t[0], y1, t[1]], [t[2], y1, t[1]], [t[2], y1, t[3]], [t[0], y1, t[3]]];
    const cx = (b[0] + b[2] + t[0] + t[2]) / 4, cz = (b[1] + b[3] + t[1] + t[3]) / 4;
    for (let i = 0; i < 4; i++) { const j = (i + 1) & 3, m = [(B[i][0] + B[j][0] + T[i][0] + T[j][0]) / 4 - cx, 0, (B[i][2] + B[j][2] + T[i][2] + T[j][2]) / 4 - cz]; face(F, [B[i], B[j], T[j], T[i]], m); }
    if ((caps === undefined ? 3 : caps) & 1) face(F, [B[0], B[1], B[2], B[3]], [0, -1, 0]);
    if ((caps === undefined ? 3 : caps) & 2) face(F, [T[0], T[1], T[2], T[3]], [0, 1, 0]);
  };
  // a ring of points round an axis-aligned centre line (a curtain ring round its rod: axis 'x')
  const ringX = (x, y, z, r, n) => { const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * TAU; pts.push([x, y + Math.cos(a) * r, z + Math.sin(a) * r]); } return pts; };
  // a ring in the wall plane (x, y) at depth z (a round mirror's frame)
  const ringZ = (x, y, z, r, n) => { const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * TAU; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, z]); } return pts; };
  // a disc in the wall plane facing −z (a round mirror's glass), uv optional
  const discZ = (F, x, y, z, r, n) => { const c = F.emit(x, y, z, 0, 0, -1), base = F.count(); for (let i = 0; i <= n; i++) { const a = i / n * TAU; F.emit(x + Math.cos(a) * r, y + Math.sin(a) * r, z, 0, 0, -1); } for (let i = 0; i < n; i++) F.tri(c, base + i + 1, base + i); };
  // a bar handle on two stand-off posts: vertical (dir 'y') or horizontal ('x'), in front of the face at z
  const handle = (F, x, y, z, len, dir, r) => {
    r = r || 0.4;
    if (dir === 'y') { F.rod(x, y, z - 1.0, x, y + len, z - 1.0, r, { seg: 7 }); F.rod(x, y + 0.6, z - 1.0, x, y + 0.6, z, r * 0.7, { seg: 5, caps: 1 }); F.rod(x, y + len - 0.6, z - 1.0, x, y + len - 0.6, z, r * 0.7, { seg: 5, caps: 1 }); }
    else { F.rod(x, y, z - 1.0, x + len, y, z - 1.0, r, { seg: 7 }); F.rod(x + 0.6, y, z - 1.0, x + 0.6, y, z, r * 0.7, { seg: 5, caps: 1 }); F.rod(x + len - 0.6, y, z - 1.0, x + len - 0.6, y, z, r * 0.7, { seg: 5, caps: 1 }); }
  };
  const BOOKS = [0x2F55C8, 0xC0443A, 0xE8B83A, 0x3E8A4A, 0xF2F2EE, 0x7A4A32, 0x2A2D33, 0x8A5AC8, 0x2F7A6A, 0xD2A84A];
  // a row of books on a shelf from x0 to x1 at y (spines to −z at z0, back at z1), seeded
  const bookRow = (F, x0, x1, y, z0, z1, seed, hmax) => {
    let x = x0, k = seed;
    while (x < x1 - 0.8) {
      const w = 0.75 + (k % 3) * 0.4, h = Math.min(hmax || 6, 3.6 + ((k * 5) % 4) * 0.6), c = BOOKS[(k * 3 + seed) % BOOKS.length];
      if (x + w > x1) break;
      F.m(MAT.matte, c).rbox(x, y, z0, x + w - 0.06, y + h, z1, 0.12, { seg: 1 });
      F.m(MAT.matte, COL.paper).box(x + 0.15, y + 0.25, z0 - 0.04, x + w - 0.2, y + h - 0.25, z0);
      x += w; k++; if (k % 6 === 0) x += 0.6;
    }
  };

  // a leaf blade (a palm's leaflet, a tropical plant's leaf): a tapered strip from its base along dir, bending down by
  // droop toward the tip, both faces drawn in the current material (no cutout: a solid green)
  const blade = (F, base, dir, side, len, wid, droop, k0, k1) => {
    const up = norm3(cross(side, dir)), rows = 4, A = F.count();
    for (let i = 0; i <= rows; i++) {
      const t = i / rows, dd = droop * t * t, w = wid * (t < 0.35 ? 0.55 + 1.3 * t : 1.04 - 0.98 * (t - 0.35) / 0.65) * 0.5, c = [base[0] + dir[0] * len * t - up[0] * dd, base[1] + dir[1] * len * t - up[1] * dd, base[2] + dir[2] * len * t - up[2] * dd];
      const k = (k0 === undefined ? 0.85 : k0) + ((k1 === undefined ? 1.1 : k1) - (k0 === undefined ? 0.85 : k0)) * t;
      F.emit(c[0] - side[0] * w, c[1] - side[1] * w, c[2] - side[2] * w, up[0], up[1], up[2], k); F.emit(c[0] + side[0] * w, c[1] + side[1] * w, c[2] + side[2] * w, up[0], up[1], up[2], k);
    }
    for (let i = 0; i < rows; i++) { const a = A + i * 2; F.tri(a, a + 1, a + 3); F.tri(a, a + 3, a + 2); }
    const B = F.count();
    for (let i = 0; i <= rows * 2 + 1; i++) { const p = F.pos(A + i); F.emit(p[0], p[1], p[2], -up[0], -up[1], -up[2], 0.8); }
    for (let i = 0; i < rows; i++) { const a = B + i * 2; F.tri(a, a + 3, a + 1); F.tri(a, a + 2, a + 3); }
  };

  // ---------------------------------------------------------------- the paintings (the furniture atlas, props.js)
  // five canvases in the atlas's free corners (the white quarter keeps its corner round UV0): the three abstracts of the
  // villages' art blocks in their palettes (the voxel motif, painted finer: soft colour fields and brush strokes), the
  // villas' abstract (navy, mustard, red on cream) and their landscape (hills under a dusk sky, a lake, the sun)
  const SLOT = { warm: [128, 128, 64, 64], cool: [192, 128, 64, 64], gold: [128, 192, 64, 64], abstract: [0, 200, 64, 56], landscape: [64, 200, 64, 56] };
  for (const k in SLOT) { const [x, y, w, h] = SLOT[k]; PR.ATL['paint_' + k] = [(x + 0.5) / 256, (y + 0.5) / 256, (x + w - 0.5) / 256, (y + h - 0.5) / 256]; }
  const PALS = { warm: [0xF2E8D8, 0xE07A3A, 0xC8443A, 0x2E3136], cool: [0xE8F0F4, 0x3F6AC0, 0x2F9C98, 0x1C1E22], gold: [0xF2F2EE, 0x1C1E22, 0xC8A048, 0x8A8A90] };
  const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  PR.paint = function (name, u, v) {   // u, v in 0…1 (v down): the colour of a painting at a point (also the test's probe)
    if (PALS[name]) {
      // the voxel motif's own field and bands, painted as a hard-edged print: flat colour fields with crisp curved
      // borders, a fine dark line where two fields meet, the canvas weave (run 2's soft brush strokes read as blotches)
      const p = PALS[name].map(rgb), x = u * 6 + 1, y = (1 - v) * 6 + 1, sd = name === 'warm' ? 1 : name === 'cool' ? 2 : 3;
      const f = (Math.sin(x * 0.9 + sd * 1.7) + Math.cos(y * 1.1 + sd * 2)) * 0.5;
      const band = f > 0.5 ? 1 : f > 0 ? 2 : f > -0.5 ? 0 : 3, edge = Math.min(Math.abs(f - 0.5), Math.abs(f), Math.abs(f + 0.5));
      const c = edge < 0.035 && band !== 3 ? mix3(p[band], p[3], 0.6) : p[band];
      return c.map((q) => q * (0.95 + 0.05 * ((Math.floor(u * 64) + Math.floor(v * 64)) & 1)));
    }
    if (name === 'abstract') {
      let c = rgb(0xE8E2D4);
      if (u > 0.1 && u < 0.62 && v > 0.2 && v < 0.85 && (v - 0.2) * 0.4 + 0.1 > (u - 0.55) * -0.1 && u < 0.55 + (v - 0.2) * -0.2 + 0.1) c = rgb(0x2F3F60);
      if (Math.hypot(u - 0.66, v - 0.38) < 0.2) c = rgb(0xD2A84A);
      if (v > 0.66 && v < 0.72 && u > 0.18 && u < 0.86) c = rgb(0xC0443A);
      return c.map((q) => q * (0.94 + 0.06 * hash(Math.floor(u * 64), Math.floor(v * 56), 0, 7)));
    }
    // the landscape: a dusk sky, far hills, a lake, the sun
    const ridge = 0.55 + 0.08 * Math.sin(u * 8) + 0.05 * Math.sin(u * 19 + 1);
    let c;
    if (v < ridge) { const t = v / ridge; c = mix3(rgb(0x6A9AC8), rgb(0xF0C8A0), t * t); if (Math.hypot(u - 0.72, v - 0.3) < 0.08) c = rgb(0xFFE4A0); }
    else if (v < 0.74) c = mix3(rgb(0x5A7A5A), rgb(0x3E5E46), (v - ridge) / 0.2);
    else c = mix3(rgb(0x5A86B8), rgb(0x3A5A8A), (v - 0.74) / 0.26);
    return c;
  };
  const baseAtlas = PR.furnAtlas;
  PR.furnAtlas = function () {
    const a = baseAtlas(), S = a.w, d = a.data;
    for (const k in SLOT) {
      const [x0, y0, w, h] = SLOT[k];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = PR.paint(k, (x + 0.5) / w, (y + 0.5) / h), o = ((y0 + y) * S + x0 + x) * 4; d[o] = Math.max(0, Math.min(255, c[0])) | 0; d[o + 1] = Math.max(0, Math.min(255, c[1])) | 0; d[o + 2] = Math.max(0, Math.min(255, c[2])) | 0; d[o + 3] = 255; }
    }
    return a;
  };

  // ================================================================ curtains
  // a linen curtain (two blocks high): a black rod with finials under the ceiling, rings round it, the sheet hanging from
  // them in soft vertical folds (a wave across, deeper at the hem), both faces drawn; the fabric takes the piece's colour
  // (tint 1). vm_curtain and the villages' vx_curtain hang in the same place of the cell (the rod 12.6 units back).
  MD('curtain', [1, 2, 1], (F) => {
    F.m(MAT.metal, COL.black).rod(0.4, 31.0, 12.6, 15.6, 31.0, 12.6, 0.38, { seg: 8 });
    F.sphere(0.75, 31.0, 12.6, 0.6, 0.6, 0.6, { seg: 4 }).sphere(15.25, 31.0, 12.6, 0.6, 0.6, 0.6, { seg: 4 });
    for (let k = 0; k < 6; k++) F.m(MAT.metal, COL.black).tube(ringX(1.6 + k * 2.56, 31.0, 12.6, 0.75, 10), 0.14, 0.14, { seg: 4, caps: 0 });
    // the sheet: z(x, y) = 12 + amplitude · sin(phase); five folds across, the amplitude growing toward the hem
    const NX = 30, NY = 14, x0 = 0.3, x1 = 15.7, y0 = 0.5, y1 = 30.4, z0 = 12.0, T = 0.22;
    const zAt = (x, y) => z0 + (1.05 + 0.45 * (1 - y / y1)) * Math.sin((x - x0) / (x1 - x0) * 5 * TAU);
    for (const side of [-1, 1]) {   // −1 the front face (normal toward −z), +1 the back face
      F.m(MAT.fabric, 0xFFFFFF, 1);
      const rows = [];
      for (let j = 0; j <= NY; j++) {
        const y = y0 + (y1 - y0) * j / NY, row = [];
        for (let i = 0; i <= NX; i++) {
          const x = x0 + (x1 - x0) * i / NX, z = zAt(x, y) + (side > 0 ? T : 0), e = 0.02;
          const fx = (zAt(x + e, y) - zAt(x - e, y)) / (2 * e), fy = (zAt(x, y + e) - zAt(x, y - e)) / (2 * e);
          const n = side < 0 ? norm3([fx, fy, -1]) : norm3([-fx, -fy, 1]);
          const deep = Math.sin((x - x0) / (x1 - x0) * 5 * TAU);       // the folds' valleys (toward the wall) a little darker
          row.push(F.emit(x, y, z, n[0], n[1], n[2], 0.9 + 0.1 * deep * side + (j === NY ? -0.06 : 0)));
        }
        rows.push(row);
      }
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const a = rows[j][i], b = rows[j][i + 1], c = rows[j + 1][i + 1], d = rows[j + 1][i];
        if (side < 0) { F.tri(a, d, c); F.tri(a, c, b); } else { F.tri(a, b, c); F.tri(a, c, d); }
      }
    }
    // the hem: a narrow strip closing the bottom edge between the two faces
    F.m(MAT.fabric, 0xE8E8E8, 1);
    for (let i = 0; i < NX; i++) { const xa = x0 + (x1 - x0) * i / NX, xb = x0 + (x1 - x0) * (i + 1) / NX; face(F, [[xa, y0, zAt(xa, y0)], [xb, y0, zAt(xb, y0)], [xb, y0, zAt(xb, y0) + T], [xa, y0, zAt(xa, y0) + T]], [0, -1, 0]); }
    F.m(MAT.fabric, 0xFFFFFF, 1); F.far(0.3, 0.5, 10.4, 15.7, 30.4, 13.8); F.m(MAT.metal, COL.black); F.far(0.4, 30.6, 12.2, 15.6, 31.4, 13.0);
  });

  // ================================================================ kitchen: fridges, the dishwasher, range hoods
  // the steel fridge (two blocks high): a rounded carcass, the freezer drawer below and the door above with a real seam
  // between them (the dark carcass shows in the gap), bar handles on stand-off posts, the water dispenser in black glass
  // with its light, a dark vent grille along the top's front edge, dark feet
  const fridgeBody = (F) => {
    F.m(MAT.matte, 0x22252A).box(1.6, 0, 3, 14.4, 0.8, 15.2, B_BOT);
    F.m(MAT.metal, shd(COL.steel, 0.82)).rbox(1, 0.8, 2.4, 15, 31.6, 16, 1.0, { seg: 2, skip: B_BOT, seam: 0.9 });
    F.m(MAT.gloss, 0x1A1C20).rbox(2.2, 31.45, 2.6, 13.8, 31.75, 7.4, 0.12, { seg: 1 });
    F.m(MAT.metal, 0x5A5E64); for (let k = 0; k < 6; k++) F.box(2.8 + k * 1.9, 31.7, 3.0, 3.6 + k * 1.9, 31.82, 7.0);
  };
  MD('fridge', [1, 2, 1], (F) => {
    fridgeBody(F);
    F.m(MAT.metal, COL.steel).rbox(1, 0.9, 1.2, 15, 19.55, 2.6, 0.7, { seg: 2, mid: 2, seam: 0.86 });
    F.m(MAT.metal, COL.steel).rbox(1, 19.9, 1.2, 15, 31.3, 2.6, 0.7, { seg: 2, mid: 2, seam: 0.86 });
    F.m(MAT.metal, shd(COL.steel, 1.06)); handle(F, 4, 17.6, 1.2, 8, 'x'); handle(F, 12.8, 21.4, 1.2, 8.4, 'y');
    F.m(MAT.gloss, 0x15171B).rbox(3.4, 22.8, 0.9, 8.6, 27.4, 1.3, 0.35, { seg: 1 });
    F.m(MAT.light, 0x4AC8FF).box(4.2, 24.6, 0.85, 7.8, 25.2, 0.9); F.m(MAT.metal, 0x8A9098).box(5, 23.2, 0.85, 7, 24.1, 0.92);
    F.m(MAT.metal, COL.steel); F.far(1, 0, 1.2, 15, 31.6, 16);
    F.shadow(0.4, 0.6, 15.6, 16.2);
  });
  // the French-door fridge (voxmodern's vm_kitchen_fridge_french): two doors above split in the middle, a wide drawer below
  MD('fridge:fr', [1, 2, 1], (F) => {
    fridgeBody(F);
    F.m(MAT.metal, COL.steel).rbox(1, 0.9, 1.2, 15, 11.6, 2.6, 0.7, { seg: 2, mid: 2, seam: 0.86 });
    F.m(MAT.metal, COL.steel).rbox(1, 11.95, 1.2, 7.85, 31.3, 2.6, 0.7, { seg: 2, mid: 2, seam: 0.86 }).rbox(8.15, 11.95, 1.2, 15, 31.3, 2.6, 0.7, { seg: 2, mid: 2, seam: 0.86 });
    F.m(MAT.metal, shd(COL.steel, 1.06)); handle(F, 3.5, 10.0, 1.2, 9, 'x'); handle(F, 6.8, 14.5, 1.2, 12, 'y'); handle(F, 9.2, 14.5, 1.2, 12, 'y');
    F.m(MAT.gloss, 0x15171B).rbox(2.4, 22, 0.9, 5.6, 26.5, 1.3, 0.3, { seg: 1 }); F.m(MAT.light, 0x4AC8FF).box(3, 25.2, 0.85, 5, 25.7, 0.9);
    F.m(MAT.metal, COL.steel); F.far(1, 0, 1.2, 15, 31.6, 16);
    F.shadow(0.4, 0.6, 15.6, 16.2);
  });
  // the dishwasher: the kitchen's carcass (the cabinets' colour, tint 1) and marble top, a steel door edged round a black
  // glass front, the steel bar handle, the control strip with its status light
  MD('dishwasher', [1, 1, 1], (F) => {
    carcass(F, false, 13);
    F.m(MAT.metal, COL.steel).rbox(0.35, 1.8, 0.9, 15.65, 12.75, 2.05, 0.35, { seg: 2, seam: 0.9 });
    F.m(MAT.gloss, 0x101216).rbox(1.2, 2.6, 0.62, 14.8, 10.1, 0.95, 0.25, { seg: 1, seam: 0.95 });
    F.m(MAT.gloss, 0x15171B).box(1.2, 11.55, 0.8, 14.8, 12.45, 0.92);
    F.m(MAT.light, 0x3AC8FF).box(12.4, 11.85, 0.76, 13.6, 12.15, 0.8); F.m(MAT.light, 0xFFFFFF).box(10.4, 11.9, 0.76, 11.2, 12.1, 0.8);
    F.m(MAT.metal, shd(COL.steel, 1.08)); handle(F, 2.6, 10.9, 0.9, 10.8, 'x', 0.38);
    counter(F);
    F.m(MAT.metal, COL.steel); F.far(0, 1.5, 0.9, 16, 13, 16); F.m(MAT.marble, COL.marble); F.far(0, 13, -0.5, 16, 15, 16);
    F.shadow(0, -0.5, 16, 16.5);
  });
  // the range hood over the hob (two blocks above the floor): a sloped steel canopy, its filter underneath, the chimney up
  // to the ceiling, a warm light strip under the front edge and two spots
  MD('hood', [1, 1, 1], (F) => {
    F.m(MAT.metal, COL.steel); frustum(F, [0.5, 2.2, 15.5, 15.8], 6.2, [3.6, 7.6, 12.4, 15.8], 9.4, 2);
    F.m(MAT.metal, COL.steel).box(0.5, 5.4, 2.2, 15.5, 6.2, 15.8);
    F.m(MAT.metal, 0x8A8E94).box(1.2, 5.3, 2.9, 14.8, 5.42, 15.2);
    F.m(MAT.metal, shd(COL.steel, 0.96)).rbox(4.3, 9.4, 8.2, 11.7, 16, 15.8, 0.3, { seg: 1, skip: (1 << 3) });
    F.m(MAT.light, 0xFFE2A8).box(1.6, 5.26, 2.7, 14.4, 5.34, 3.3);
    F.m(MAT.light, COL.warm); F.cyl(5.5, 9.5, 5.2, 5.3, 0.9, 0.9, { seg: 10, caps: 1 }); F.cyl(10.5, 9.5, 5.2, 5.3, 0.9, 0.9, { seg: 10, caps: 1 });
    F.m(MAT.gloss, 0x1C1E22).box(2.0, 5.6, 2.12, 14.0, 6.0, 2.2);
    F.m(MAT.metal, COL.steel); F.far(0.5, 5.3, 2.2, 15.5, 9.4, 15.8); F.far(4.3, 9.4, 8.2, 11.7, 16, 15.8);
  });
  // the island hood (voxmodern's vm_kitchen_hood_island): a box (its colour, tint 1) hanging from the ceiling on a slim duct, a light strip
  MD('hood:island', [1, 1, 1], (F) => {
    F.m(MAT.metal, 0xFFFFFF, 1).rbox(1.5, 4.5, 1.5, 14.5, 8.5, 14.5, 0.8, { seg: 2 });
    F.m(MAT.metal, 0x8A8E94).box(2.2, 4.4, 2.2, 13.8, 4.52, 13.8);
    F.m(MAT.light, 0xFFE2A8).box(2.6, 4.32, 2.6, 13.4, 4.4, 3.4).box(2.6, 4.32, 12.6, 13.4, 4.4, 13.4);
    F.m(MAT.metal, 0xF0F0F0, 1).cyl(8, 8, 8.5, 16, 2.4, 2.4, { seg: 14, caps: 0 });
    F.m(MAT.metal, 0xFFFFFF, 1); F.far(1.5, 4.4, 1.5, 14.5, 8.5, 14.5); F.far(5.6, 8.5, 5.6, 10.4, 16, 10.4);
  });

  // ================================================================ art and mirrors
  // a canvas (an atlas painting) in a thin frame on the back wall: the frame's bars (profile rounded), the canvas set a
  // little behind the frame's face, a paper mat between them (the villas' pieces), a hanging wire's shadow on the wall
  const canvas = (F, x0, y0, x1, y1, z, uv) => { F.m(MAT.matte, 0xFFFFFF); face(F, [[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]], [0, 0, -1], uv); };
  const frameBars = (F, x0, y0, x1, y1, w, zf, zb, r) => {
    F.rbox(x0, y0, zf, x1, y0 + w, zb, r, { seg: 1 }).rbox(x0, y1 - w, zf, x1, y1, zb, r, { seg: 1 });
    F.rbox(x0, y0 + w, zf, x0 + w, y1 - w, zb, r, { seg: 1 }).rbox(x1 - w, y0 + w, zf, x1, y1 - w, zb, r, { seg: 1 });
  };
  // the villages' art blocks: the frame round the whole face of the block (black, white or brass), the abstract canvas
  for (const [k, fc, fm] of [['warm', 0x1C1E22, MAT.gloss], ['cool', 0xF2F2EE, MAT.gloss], ['gold', 0xC8A048, MAT.metal]]) MD('vart:' + k, [1, 1, 1], (F) => {
    F.m(fm, fc); frameBars(F, 0.4, 0.4, 15.6, 15.6, 1.3, 14.4, 16, 0.35);
    F.m(MAT.matte, shd(fc, 0.8)).box(1.7, 1.7, 15.5, 14.3, 14.3, 15.9);
    canvas(F, 1.7, 1.7, 14.3, 14.3, 15.0, PR.ATL['paint_' + k]);
    F.m(fm, fc); F.far(0.4, 0.4, 14.4, 15.6, 15.6, 16);
  });
  // the villas' art (voxfurn's art(): a frame at eye height on the +z wall): the abstract and the landscape on canvas with
  // a paper mat; the photo trio as three small black frames
  for (const k of ['abstract', 'landscape']) MD('art:' + k, [1, 1, 1], (F) => {
    F.m(MAT.wood, 0x1A1A1C); frameBars(F, 1, 2, 15, 14, 0.8, 14.8, 16, 0.25);
    F.m(MAT.matte, COL.paper).box(1.8, 2.8, 15.25, 14.2, 13.2, 15.9);
    canvas(F, 2.7, 3.7, 13.3, 12.3, 15.2, PR.ATL['paint_' + k]);
    F.m(MAT.wood, 0x1A1A1C); F.far(1, 2, 14.8, 15, 14, 16);
  });
  MD('art:photo', [1, 1, 1], (F) => {
    for (let k = 0; k < 3; k++) {
      const x0 = 1 + k * 5;
      F.m(MAT.metal, COL.black); frameBars(F, x0, 5, x0 + 4.4, 11, 0.45, 15.0, 16, 0.12);
      F.m(MAT.matte, COL.paper).box(x0 + 0.45, 5.45, 15.5, x0 + 3.95, 10.55, 15.9);
      F.m(MAT.matte, [0x6A7078, 0x9A8A6A, 0x4A5A6A][k]).box(x0 + 0.9, 5.9, 15.42, x0 + 3.5, 10.1, 15.5);
    }
    F.m(MAT.metal, COL.black); F.far(1, 5, 15, 15.4, 11, 16);
  });
  // the floor mirror: a slim black frame leaning a little on the wall, the mirror glass (MAT.mirror), a foot bar
  MD('mirror:floor', [1, 2, 1], (F) => {
    F.turn([['x', -0.05]], [8, 0, 13]);
    F.m(MAT.metal, COL.black); frameBars(F, 2, 0.6, 14, 28.4, 0.7, 11.9, 13.3, 0.3);
    F.m(MAT.matte, 0x2A2D33).box(2.7, 1.3, 13.0, 13.3, 27.7, 13.3);
    F.m(MAT.mirror, MIRROR); face(F, [[13.3, 1.3, 12.3], [2.7, 1.3, 12.3], [2.7, 27.7, 12.3], [13.3, 27.7, 12.3]], [0, 0, -1]);
    F.turn(null);
    F.m(MAT.metal, COL.black).rbox(2, 0, 10.2, 14, 0.9, 13.8, 0.3, { seg: 1 });
    F.far(2, 0, 10.2, 14, 28.4, 13.8);
    F.shadow(1.5, 9.5, 14.5, 14.5);
  });
  // the round mirror (over a dresser, in the foyer): a brass ring and the glass disc
  MD('mirror:round', [1, 1, 1], (F) => {
    F.m(MAT.metal, COL.brass).tube(ringZ(8, 8, 15.3, 6.6, 36), 0.55, 0.55, { seg: 6, caps: 0 });
    F.m(MAT.mirror, MIRROR); discZ(F, 8, 8, 15.2, 6.2, 36);
    F.m(MAT.matte, 0x2A2D33).box(2.4, 2.4, 15.7, 13.6, 13.6, 15.95);
    F.m(MAT.metal, COL.brass); F.far(1.4, 1.4, 14.8, 14.6, 14.6, 16);
  });
  // the villages' LED mirror: a rectangle of mirror glass on the back wall, a warm light running round its edge
  MD('vmirror', [1, 1, 1], (F) => {
    F.m(MAT.matte, 0x2A2D33).box(0.6, 2.6, 15.4, 15.4, 13.4, 16);
    F.m(MAT.light, COL.warm); frameBars(F, 0.6, 2.6, 15.4, 13.4, 0.55, 14.9, 15.4, 0.15);
    F.m(MAT.mirror, MIRROR); face(F, [[14.85, 3.15, 15.05], [1.15, 3.15, 15.05], [1.15, 12.85, 15.05], [14.85, 12.85, 15.05]], [0, 0, -1]);
    F.m(MAT.light, COL.warm); F.far(0.6, 2.6, 14.9, 15.4, 13.4, 16);
  });

  // ================================================================ desks
  // the oak desk (two blocks): a thin top with a soft edge, a black steel trestle under its left end (two posts in a
  // frame, the slab of a leg), the drawer box under its right end (three drawers in smoked oak with bar pulls), a slim
  // monitor on its foot, the keyboard, a mouse, a pen cup
  MD('desk', [2, 1, 1], (F) => {
    F.m(MAT.wood, WOOD.oak).rbox(0, 11.3, 1, 32, 12.5, 15, 0.45, { seg: 2 });
    F.m(MAT.metal, COL.black).rbox(1.8, 0, 2, 3.2, 11.3, 3.2, 0.3, { seg: 1 }).rbox(1.8, 0, 12.8, 3.2, 11.3, 14, 0.3, { seg: 1 })
      .rbox(1.8, 0, 3.2, 3.2, 1.1, 12.8, 0.3, { seg: 1 }).rbox(1.8, 10.3, 3.2, 3.2, 11.3, 12.8, 0.3, { seg: 1 });
    F.m(MAT.wood, shd(WOOD.oak, 0.94)).rbox(19.6, 0.5, 2.2, 31.4, 11.3, 14.6, 0.35, { seg: 1 });
    F.m(MAT.matte, 0x2A2420).box(20, 0, 2.8, 31, 0.5, 14);
    for (const y of [1.0, 4.4, 7.8]) { F.m(MAT.wood, WOOD.smoked).rbox(19.9, y, 1.7, 31.1, y + 3.2, 2.35, 0.25, { seg: 1, seam: 0.9 }); F.m(MAT.metal, COL.black); handle(F, 23, y + 1.6, 1.7, 5, 'x', 0.3); }
    F.m(MAT.gloss, COL.black).rbox(6.8, 13.2, 9.6, 19.2, 20.4, 10.3, 0.3, { seg: 1 });
    F.m(MAT.light, 0x7AB8E8).box(7.3, 13.7, 9.52, 18.7, 19.9, 9.6);
    F.m(MAT.metal, COL.steel).rod(13, 12.5, 10.6, 13, 13.4, 10.6, 0.5, { seg: 6 }).rbox(10.8, 12.5, 9.6, 15.2, 12.8, 12, 0.3, { seg: 1 });
    F.m(MAT.gloss, 0x2A2D33).rbox(6, 12.5, 4, 15.5, 13.0, 7.5, 0.35, { seg: 1 }).rbox(17.4, 12.5, 5, 19.6, 13.2, 7, 0.6, { seg: 2 });
    F.m(MAT.gloss, 0x2F7A6A).lathe(4.5, 13, [[12.5, 1.15], [15, 1.05]], { seg: 10, capBot: true }); F.m(MAT.matte, 0xD2A84A).rod(4.5, 15, 13, 4.8, 17.4, 12.8, 0.2, { seg: 4 });
    F.m(MAT.wood, WOOD.oak); F.far(0, 11.3, 1, 32, 12.5, 15); F.far(19.6, 0, 2.2, 31.4, 11.3, 14.6); F.m(MAT.metal, COL.black); F.far(1.8, 0, 2, 3.2, 11.3, 14);
    F.shadow(0, 1, 32, 15.5);
  });
  // the tech desk (gen_modern's reception and studies): a white gloss top on two slab legs, a modesty panel at the back, a
  // slim monitor glowing cyan, a small amber lamp
  MD('tdesk', [1, 1, 1], (F) => {
    F.m(MAT.gloss, 0xF2F4F8).rbox(0.2, 10.2, 0.2, 15.8, 11.8, 15.8, 0.6, { seg: 2 });
    F.m(MAT.gloss, 0xDCE0E6).rbox(0.4, 0, 2, 1.8, 10.2, 14, 0.4, { seg: 1 }).rbox(14.2, 0, 2, 15.6, 10.2, 14, 0.4, { seg: 1 }).rbox(1.8, 2.2, 12.4, 14.2, 8.2, 13.4, 0.3, { seg: 1 });
    F.m(MAT.gloss, 0x2A2E36).rbox(4, 11.8, 11.6, 12, 12.2, 13.4, 0.2, { seg: 1 }).rod(8, 12.2, 12.5, 8, 13.4, 12.5, 0.45, { seg: 6 }).rbox(3.6, 13.2, 11.2, 12.4, 16, 12, 0.25, { seg: 1 });
    F.m(MAT.light, 0x5AE8FF).box(4.0, 13.6, 11.12, 12.0, 15.6, 11.2);
    F.m(MAT.light, 0xFFB02A).sphere(12.6, 12.4, 4.4, 0.6, 0.6, 0.6, { seg: 4 }); F.m(MAT.gloss, 0x2A2E36).cyl(12.6, 4.4, 11.8, 12.0, 0.9, 0.9, { seg: 8 });
    F.m(MAT.gloss, 0xF2F4F8); F.far(0.2, 10.2, 0.2, 15.8, 11.8, 15.8); F.m(MAT.gloss, 0xDCE0E6); F.far(0.4, 0, 2, 1.8, 10.2, 14); F.far(14.2, 0, 2, 15.6, 10.2, 14);
    F.shadow(0, 0.5, 16, 15.5);
  });
  // the school desk: an oak top on a black tube frame, the pupil's moulded seat with its back behind it (the seat colour)
  MD('sdesk', [1, 1, 1], (F) => {
    F.m(MAT.wood, P.oak).rbox(0.3, 8.6, 0.3, 15.7, 9.8, 7.4, 0.4, { seg: 2 });
    F.m(MAT.metal, COL.black); for (const x of [1.2, 14.8]) { F.rod(x, 0, 1.2, x, 8.6, 1.2, 0.4, { seg: 6 }).rod(x, 0, 6.4, x, 8.6, 6.4, 0.4, { seg: 6 }).rod(x, 0.6, 1.2, x, 0.6, 6.4, 0.3, { seg: 5 }); }
    F.rod(1.2, 8.2, 6.4, 14.8, 8.2, 6.4, 0.3, { seg: 5 });
    for (const x of [4.4, 11.6]) F.rod(x, 0, 12, x, 5, 12, 0.35, { seg: 6 }).rod(x, 5, 12, x, 11.5, 15.2, 0.35, { seg: 6 });
    F.m(MAT.gloss, 0xFFFFFF, 1).rbox(3.4, 4.6, 9.2, 12.6, 5.6, 14.4, 0.5, { seg: 2, bulge: { 3: 0.3 } });
    F.turn([['x', -0.12]], [8, 6.5, 15]); F.rbox(3.6, 6.8, 14.6, 12.4, 11.6, 15.6, 0.5, { seg: 2 }); F.turn(null);
    F.m(MAT.matte, COL.paper).box(3, 9.8, 2, 7, 9.95, 5); F.m(MAT.matte, 0x2F55C8).rbox(9, 9.8, 2.5, 12.5, 10.4, 5.5, 0.15, { seg: 1 });
    F.m(MAT.wood, P.oak); F.far(0.3, 8.6, 0.3, 15.7, 9.8, 7.4); F.m(MAT.gloss, 0x3F6AC0, 1); F.far(3.4, 4.6, 9.2, 12.6, 11.6, 15.6);
    F.shadow(0, 0, 16, 16);
  });

  // ================================================================ wardrobes
  // the villas' wardrobe with sliding doors: a white carcass, a dark plinth, two panels on their tracks — lacquer on the
  // left, mirror glass on the right (MAT.mirror) — with slim black edge profiles and bar handles
  MD('wardrobe', [2, 2, 1], (F) => {
    F.m(MAT.matte, 0xF2F2EE).rbox(0, 0.6, 4.2, 32, 32, 16, 0.4, { seg: 1, skip: B_BOT });
    F.m(MAT.matte, 0x2A2D33).box(0.6, 0, 4.8, 31.4, 0.6, 15.4, B_BOT);
    F.m(MAT.metal, COL.black).box(0, 31.3, 2.0, 32, 32, 4.2).box(0, 0.6, 2.0, 32, 1.1, 4.2);
    F.m(MAT.gloss, 0xECEAE4).rbox(0.5, 1.1, 3.1, 16.4, 31.3, 4.0, 0.2, { seg: 1, seam: 0.92 });
    F.m(MAT.metal, COL.black).box(15.5, 1.1, 2.0, 31.5, 1.7, 3.0).box(15.5, 30.7, 2.0, 31.5, 31.3, 3.0).box(15.5, 1.1, 2.0, 16.1, 31.3, 3.0).box(30.9, 1.1, 2.0, 31.5, 31.3, 3.0);
    F.m(MAT.mirror, MIRROR); face(F, [[30.9, 1.7, 2.05], [16.1, 1.7, 2.05], [16.1, 30.7, 2.05], [30.9, 30.7, 2.05]], [0, 0, -1]);
    F.m(MAT.metal, COL.black); handle(F, 14.4, 10, 3.1, 12, 'y', 0.33); handle(F, 17.6, 10, 2.0, 12, 'y', 0.33);
    F.m(MAT.matte, 0xF2F2EE); F.far(0, 0, 2, 32, 32, 16);
    F.shadow(-0.5, 1.5, 32.5, 16.5);
  });
  // the walnut wardrobe: four doors with shadow seams between them, brass bar handles at the middle pair's meeting edges
  // and the outer pair's, a cornice, a dark recessed plinth
  MD('wardrobe:walnut', [2, 2, 1], (F) => {
    F.m(MAT.wood, WOOD.walnut).rbox(0, 0.6, 4.2, 32, 31.2, 16, 0.3, { seg: 1, skip: B_BOT });
    F.m(MAT.matte, 0x2A2420).box(0.6, 0, 4.8, 31.4, 0.6, 15.4, B_BOT);
    F.m(MAT.wood, shd(WOOD.walnut, 0.88)).rbox(-0.1, 31.2, 3.0, 32.1, 32, 16, 0.25, { seg: 1 });
    for (let k = 0; k < 4; k++) {
      const x0 = k * 8;
      F.m(MAT.wood, shd(WOOD.walnut, 0.96 + (k & 1) * 0.06)).rbox(x0 + 0.25, 1.0, 3.0, x0 + 7.75, 30.9, 4.25, 0.25, { seg: 1, seam: 0.86 });
      F.m(MAT.metal, COL.brass); handle(F, k === 1 || k === 3 ? x0 + 1.4 : x0 + 6.6, 12, 3.0, 8, 'y', 0.3);
    }
    F.m(MAT.wood, WOOD.walnut); F.far(0, 0, 3, 32, 32, 16);
    F.shadow(-0.5, 2.5, 32.5, 16.5);
  });
  // the villages' and mansions' wardrobe (one block wide, two high): a tall box in lacquer or wood (the piece's colour,
  // tint 1), two doors with the seam between them and at the sides, a pair of handles, a plinth, a cornice
  for (const [k, m] of [['lacquer', MAT.gloss], ['wood', MAT.wood]]) MD('vwardrobe:' + k, [1, 2, 1], (F) => {
    F.m(m, 0xE4E4E4, 1).rbox(0.2, 0.9, 4.4, 15.8, 31.3, 16, 0.3, { seg: 1, skip: B_BOT });
    F.m(MAT.matte, 0x2A2D33).box(0.8, 0, 5, 15.2, 0.9, 15.4, B_BOT);
    F.m(m, 0xD0D0D0, 1).rbox(-0.1, 31.3, 3.4, 16.1, 32, 16, 0.25, { seg: 1 });
    F.m(m, 0xFFFFFF, 1).rbox(0.35, 1.2, 3.3, 7.85, 31.0, 4.5, 0.25, { seg: 1, seam: 0.84 }).rbox(8.15, 1.2, 3.3, 15.65, 31.0, 4.5, 0.25, { seg: 1, seam: 0.84 });
    F.m(MAT.metal, COL.chrome || 0xD8DEE4); handle(F, 6.6, 12.5, 3.3, 7, 'y', 0.3); handle(F, 9.4, 12.5, 3.3, 7, 'y', 0.3);
    F.m(m, 0xFFFFFF, 1); F.far(0, 0, 3.3, 16, 32, 16);
    F.shadow(-0.5, 2.5, 16.5, 16.5);
  });

  // ================================================================ lights: the villages' chandeliers, lanterns, pendants, sconces
  // the crystal chandelier: a brass canopy and stem, a ring with six arms carrying candle bulbs, crystal drops hanging
  // under the ring and a crystal ball at the bottom (they glow in the bulbs' light)
  MD('vchandelier', [1, 1, 1], (F) => {
    F.m(MAT.metal, P.brass).cyl(8, 8, 15.2, 16, 1.6, 1.6, { seg: 12, caps: 1 }).rod(8, 9.2, 8, 8, 15.2, 8, 0.3, { seg: 6 });
    F.lathe(8, 8, [[6.6, 0.01], [7.2, 1.1], [8.2, 1.5], [9.2, 0.6], [9.6, 0.01]], { seg: 14 });
    F.tube(loop(8, 8, 5.4, 7.6, 28), 0.36, 0.36, { seg: 6, caps: 0 });
    for (let k = 0; k < 6; k++) {
      const a = k * TAU / 6, x = 8 + Math.cos(a) * 5.4, z = 8 + Math.sin(a) * 5.4;
      F.m(MAT.metal, P.brass).rod(8, 7.6, 8, x, 7.6, z, 0.22, { seg: 5 }).cyl(x, z, 7.6, 8.3, 0.55, 0.65, { seg: 8 });
      F.m(MAT.light, 0xFFF4D8).cyl(x, z, 8.3, 9.6, 0.3, 0.3, { seg: 6 }).sphere(x, 10.0, z, 0.42, 0.6, 0.42, { seg: 4 });
      F.m(MAT.light, 0xEAF2FF).lathe(x, z, [[4.6, 0.01], [5.2, 0.32], [6.0, 0.4], [6.8, 0.01]], { seg: 6 });
    }
    F.m(MAT.light, 0xEAF2FF).sphere(8, 5.4, 8, 0.9, 1.1, 0.9, { seg: 6 });
    F.m(MAT.metal, P.brass); F.far(2.4, 7.0, 2.4, 13.6, 8.2, 13.6); F.far(7.5, 8.2, 7.5, 8.5, 16, 8.5);
  });
  // the hanging lantern (variant 1: something above holds it — a chain and a hook; variant 0 stands on the floor): an
  // iron frame of four posts round a glowing glass body (the lantern's light, tint 1: warm or the crystal's violet), a
  // pyramid roof and a ring
  for (let j = 0; j < 2; j++) MD('lantern:' + j, [1, 1, 1], (F) => {
    const y0 = j ? 4 : 0;
    F.m(MAT.light, 0xFFFFFF, 1).rbox(4.6, y0 + 0.6, 4.6, 11.4, y0 + 7.4, 11.4, 0.6, { seg: 1 });
    F.m(MAT.metal, P.iron);
    for (const [x, z] of [[4.2, 4.2], [11.8, 4.2], [4.2, 11.8], [11.8, 11.8]]) F.rbox(x - 0.55, y0, z - 0.55, x + 0.55, y0 + 8, z + 0.55, 0.2, { seg: 1 });
    F.rbox(3.4, y0, 3.4, 12.6, y0 + 0.7, 12.6, 0.25, { seg: 1 });
    frustum(F, [3.2, 3.2, 12.8, 12.8], y0 + 8, [6.8, 6.8, 9.2, 9.2], y0 + 10.2, 3);
    F.tube(ringX(8, y0 + 10.9, 8, 0.7, 10), 0.18, 0.18, { seg: 4, caps: 0 });
    if (j) { F.m(MAT.metal, 0x5A5A60); for (let y = 15.6; y > y0 + 11.6; y -= 1.1) F.tube(ringX(8, y, 8, 0.42, 8), 0.12, 0.12, { seg: 4, caps: 0 }); F.m(MAT.metal, P.iron).cyl(8, 8, 15.4, 16, 1.2, 1.2, { seg: 8, caps: 1 }); }
    F.m(MAT.metal, P.iron); F.far(3.4, y0, 3.4, 12.6, y0 + 10.2, 12.6);
    if (!j) F.shadow(2.5, 2.5, 13.5, 13.5);
  });
  // the pendant (black or brass, tint 1): a cord from a ceiling rose, a domed shade glowing inside, the bulb
  MD('vpendant', [1, 1, 1], (F) => {
    F.m(MAT.metal, COL.black).cyl(8, 8, 15.3, 16, 1.4, 1.4, { seg: 10, caps: 1 }).rod(8, 9.6, 8, 8, 15.3, 8, 0.16, { seg: 5 });
    F.m(MAT.metal, 0xFFFFFF, 1).lathe(8, 8, [[3.6, 6.2], [5.0, 5.9], [7.4, 4.2], [8.9, 2.0], [9.6, 0.8], [9.8, 0.01]], { seg: 22 });
    F.m(MAT.light, 0xFFE2B0).lathe(8, 8, [[3.7, 5.85], [5.0, 5.55], [7.3, 3.9], [8.7, 1.8], [9.5, 0.01]], { seg: 22, flip: true });
    F.m(MAT.light, 0xFFF2D0).sphere(8, 5.4, 8, 1.3, 1.4, 1.3, { seg: 6 });
    F.m(MAT.metal, 0xFFFFFF, 1); F.far(1.8, 3.6, 1.8, 14.2, 9.8, 14.2);
  });
  // the wall sconce (black): a slim backplate with a box that throws its light up and down the wall
  MD('sconce', [1, 1, 1], (F) => {
    F.m(MAT.metal, COL.black).rbox(6.6, 4.0, 15.3, 9.4, 12.0, 16, 0.4, { seg: 2 }).rod(8, 8, 15.3, 8, 8, 13.4, 0.45, { seg: 6 });
    F.m(MAT.metal, COL.black).cyl(8, 12.6, 4.8, 11.2, 2.0, 2.0, { seg: 18, caps: 0 });
    F.m(MAT.light, COL.warm).cyl(8, 12.6, 11.0, 11.2, 1.8, 1.8, { seg: 18, caps: 2 }).cyl(8, 12.6, 4.8, 5.0, 1.8, 1.8, { seg: 18, caps: 1 });
    F.m(MAT.metal, COL.black); F.far(6, 4.0, 10.6, 10, 12, 16);
  });
  // the villages' floor lamp: an iron foot, a brass stem, a fabric drum (the piece's colour) glowing from inside
  MD('vfloorlamp', [1, 1, 1], (F) => {
    F.m(MAT.metal, P.iron).lathe(8, 8, [[0, 4.4], [0.4, 4.4], [0.9, 3.6], [1.2, 1.0]], { seg: 16 });
    F.m(MAT.metal, P.brass).cyl(8, 8, 1.0, 10.2, 0.55, 0.45, { seg: 8, caps: 0 });
    glowShade(F, 8, 8, [[10, 5.4], [15.6, 5.0]], [[10.1, 5.05], [15.5, 4.7]], MAT.shade, 0xE8D8B0);
    F.m(MAT.light, 0xFFF2D0).sphere(8, 12, 8, 1.2, 1.3, 1.2, { seg: 5 });
    F.m(MAT.shade, 0xE8D8B0); F.far(2.6, 10, 2.6, 13.4, 15.6, 13.4); F.m(MAT.metal, P.brass); F.far(7.4, 0, 7.4, 8.6, 10, 8.6);
    F.shadow(3, 3, 13, 13);
  });

  // ================================================================ the corner sofa (an L's corner module)
  // the backs run along the back (+z) and the left (−x) side; the row it turns from continues on the right (+x) and the
  // other row toward the front (−z), both open. The corner joins the sofas of its colour as they join each other
  // (mesher PROP_JOIN): variant 1 has a sofa on its right and runs on into it, variant 0 ends there with an arm.
  for (let j = 0; j < 2; j++) MD('vcorner:' + j, [1, 1, 1], (F) => {
    const R = j & 1;
    F.m(MAT.metal, COL.black); for (const [x, z] of [[2.2, 3], [13.8, 3], [2.2, 14.4], [13.8, 14.4]]) F.cyl(x, z, 0, 1.6, 0.6, 0.75, { seg: 6 });
    F.m(MAT.fabric, 0xE2E2E2, 1);
    F.rbox(0, 1.5, -0.05, R ? 16.05 : 16, 6.6, 16, 0.6, { skip: B_BOT, seam: 0.88 });
    F.rbox(0, 6, 12.6, R ? 16.05 : 16, 14.2, 16, 1.4, { bulge: { 3: 0.2 } });
    F.rbox(0, 6, -0.05, 3.4, 14.2, 12.6, 1.4, { bulge: { 3: 0.2 } });
    if (!R) F.rbox(12.4, 6, 0, 16, 11.6, 12.6, 1.5, { bulge: { 3: 0.3 } });
    F.m(MAT.fabric, 0xFFFFFF, 1).rbox(3.6, 6.4, 0.2, R ? 15.8 : 12.2, 9.6, 12.4, 1.4, { mid: 3, bulge: { 3: 0.5 }, seam: 0.8 });
    F.turn([['x', 0.12]], [9.5, 9.2, 15.6]); F.rbox(3.8, 9.2, 10.6, R ? 15.8 : 12.2, 15.2, 14.8, 1.7, { mid: 3, bulge: { 4: 0.55 }, seam: 0.8 }); F.turn(null);
    F.turn([['z', -0.12]], [0.4, 9.2, 6]); F.rbox(1.2, 9.2, 0.4, 5.4, 15.2, 10.4, 1.7, { mid: 3, bulge: { 1: 0.55 }, seam: 0.8 }); F.turn(null);
    pillow(F, 5.6, 9.6, 9.4, 4.6, 0.32, 0.6);
    F.m(MAT.fabric, 0xE2E2E2, 1); F.far(0, 1.5, 0, 16, 6.6, 16); F.far(0, 6, 12.6, 16, 14.6, 16); F.far(0, 6, 0, 3.4, 14.6, 12.6); F.far(3.4, 6.4, 0.2, R ? 16 : 12.2, 9.6, 12.4);
    F.shadow(-1, -0.6, R ? 16 : 17, 17);
  });

  // ================================================================ the mansion's pieces (gen_modern.js) and the villages'
  // the bookcase block (white lacquer or walnut, its colour tint 1): two sides, the back, a bottom, a middle shelf and a
  // top board, two rows of books (stacked blocks make one tall case)
  for (const [k, m] of [['l', MAT.gloss], ['w', MAT.wood]]) MD('vbooks:' + k, [1, 1, 1], (F) => {
    F.m(m, 0xFFFFFF, 1).rbox(0, 0, 6, 1.2, 16, 16, 0.2, { seg: 1 }).rbox(14.8, 0, 6, 16, 16, 16, 0.2, { seg: 1 });
    F.m(m, 0xDADADA, 1).box(1.2, 0, 15.2, 14.8, 16, 16);
    F.m(m, 0xF4F4F4, 1); for (const y of [0, 7.6, 14.8]) F.rbox(1.2, y, 6, 14.8, y + 1.2, 15.2, 0.15, { seg: 1 });
    bookRow(F, 1.5, 14.5, 1.2, 7.4, 15.0, 3, 5.8); bookRow(F, 1.5, 11.0, 8.8, 7.4, 15.0, 8, 5.4);
    F.m(MAT.gloss, 0xE8E2D4).lathe(12.8, 11, [[8.8, 1.1], [10.6, 1.4], [12.2, 0.8], [12.8, 1.0]], { seg: 10, capBot: true });
    F.m(m, 0xFFFFFF, 1); F.far(0, 0, 6, 16, 16, 16);
    F.shadow(-0.5, 5.5, 16.5, 16.5);
  });
  // the tall indoor plant: a round pot (white or black, tint 1) with soil, stems and broad leaves (the monstera's cutout)
  MD('vplant', [1, 1, 1], (F) => {
    F.m(MAT.gloss, 0xFFFFFF, 1).lathe(8, 8, [[0, 3.4], [0.5, 3.8], [5.6, 4.3], [6.2, 4.1], [6.2, 3.7], [5.7, 3.6]], { seg: 18, capBot: true });
    F.m(MAT.matte, COL.soil).lathe(8, 8, [[5.6, 3.65], [5.6, 0.01]], { seg: 18 });
    for (let k = 0; k < 7; k++) {
      const a = k * 2.3 + 0.5, r = 1.2 + (k % 3) * 0.7, y = 9 + (k % 4) * 1.9 + (k > 3 ? 1.2 : 0), ca = Math.cos(a), sa = Math.sin(a), bx = 8 + ca * r, bz = 8 + sa * r;
      F.m(MAT.leaf, COL.stem).tube([[8 + ca * 0.3, 5.6, 8 + sa * 0.3], [8 + ca * r * 0.5, 5.6 + (y - 5.6) * 0.6, 8 + sa * r * 0.5], [bx, y, bz]], 0.3, 0.2, { seg: 5, caps: 0 });
      const el = 0.1 - 0.12 * (k % 3), dir = norm3([ca * Math.cos(el), Math.sin(el), sa * Math.cos(el)]), side = norm3([-sa, 0, ca]);
      F.m(MAT.leaf, k & 1 ? COL.leaf : 0x4C9A48).leaf([bx, y, bz], dir, side, 5.6, 5.2, 0.9, PR.ATL.monstera);
    }
    F.m(MAT.gloss, 0xFFFFFF, 1); F.far(3.8, 0, 3.8, 12.2, 6.2, 12.2); F.m(MAT.leaf, COL.leaf); F.far(2.5, 7, 2.5, 13.5, 14.2, 13.5);
    F.shadow(3, 3, 13, 13);
  });
  // the vanity sink: a walnut cabinet with two doors, a marble top overhanging the front, a white basin in it, a chrome tap
  MD('vvanity', [1, 1, 1], (F) => {
    F.m(MAT.wood, P.walnut).rbox(0.2, 0, 6, 15.8, 10, 16, 0.3, { seg: 1, skip: B_BOT });
    F.m(MAT.wood, shd(P.walnut, 0.9)).rbox(0.4, 0.4, 5.3, 7.85, 9.6, 6.2, 0.25, { seg: 1, seam: 0.88 }).rbox(8.15, 0.4, 5.3, 15.6, 9.6, 6.2, 0.25, { seg: 1, seam: 0.88 });
    F.m(MAT.metal, P.chrome); handle(F, 6.4, 6.4, 5.3, 2.4, 'y', 0.28); handle(F, 9.6, 6.4, 5.3, 2.4, 'y', 0.28);
    F.m(MAT.marble, P.marble).rbox(0, 10, 3.6, 16, 11.6, 16, 0.4, { seg: 2 });
    F.m(MAT.gloss, P.white).lathe(8, 9.6, [[11.6, 3.2], [12.2, 4.0], [13.6, 4.4], [13.7, 4.0], [12.3, 3.5], [12.2, 0.01]], { seg: 20, capBot: true });
    F.m(MAT.metal, P.chrome).cyl(8, 14.8, 11.6, 15.6, 0.55, 0.5, { seg: 8 }).rod(8, 15.4, 14.8, 8, 15.4, 12.0, 0.4, { seg: 6 }).rod(8, 15.4, 12.0, 8, 14.4, 12.0, 0.36, { seg: 6 });
    F.m(MAT.wood, P.walnut); F.far(0.2, 0, 5.3, 15.8, 10, 16); F.m(MAT.marble, P.marble); F.far(0, 10, 3.6, 16, 11.6, 16);
    F.shadow(-0.5, 5, 16.5, 16.5);
  });
  // the wall-hung upper cabinet: white lacquer fronts with a seam between the two doors, chrome bars, a warm light strip
  // underneath; a row joins (variant bits: 1 a cabinet on +x, 2 on −x — the end panels only where the row ends)
  for (let j = 0; j < 4; j++) MD('vupper:' + j, [1, 1, 1], (F) => {
    const R = j & 1, L = j & 2;
    F.m(MAT.gloss, 0xE8E8E8, 1).rbox(L ? -0.05 : 0.2, 6, 8.6, R ? 16.05 : 15.8, 16, 16, 0.25, { seg: 1 });
    F.m(MAT.gloss, 0xFFFFFF, 1).rbox(L ? 0.1 : 0.4, 6.3, 7.9, 7.9, 15.7, 8.7, 0.25, { seg: 1, seam: 0.88 }).rbox(8.1, 6.3, 7.9, R ? 15.9 : 15.6, 15.7, 8.7, 0.25, { seg: 1, seam: 0.88 });
    F.m(MAT.metal, P.chrome); handle(F, 6.6, 7.4, 7.9, 3.2, 'y', 0.26); handle(F, 9.4, 7.4, 7.9, 3.2, 'y', 0.26);
    F.m(MAT.light, COL.warm).box(L ? 0 : 1, 5.92, 9.2, R ? 16 : 15, 6.0, 10.4);
    F.m(MAT.gloss, 0xE8E8E8, 1); F.far(0, 6, 7.9, 16, 16, 16);
  });
  // the toilet: a pedestal and an oval bowl, the seat ring with the lid up against the tank, the tank and its button
  MD('vtoilet', [1, 1, 1], (F) => {
    F.m(MAT.gloss, P.white).lathe(8, 6.6, [[0, 2.6], [1, 2.8], [4.6, 3.2], [5.2, 3.6]], { seg: 16 });
    F.turn([['x', 0]], [8, 0, 6.6]); F.sphere(8, 6.0, 6.6, 4.6, 2.2, 5.2, { seg: 10 }); F.turn(null);
    F.m(MAT.gloss, 0xF6F6F4).tube(loop(8, 6.6, 4.1, 7.9, 28).map(([x, y, z]) => [x, y, 6.6 + (z - 6.6) * 1.18]), 0.55, 0.55, { seg: 6, caps: 0 });
    F.m(MAT.gloss, 0xBFE0EE).lathe(8, 6.6, [[7.6, 2.8], [7.62, 0.01]], { seg: 14 });
    F.m(MAT.gloss, P.white).rbox(2.2, 0, 12.2, 13.8, 13.4, 16, 0.9, { seg: 2, skip: B_BOT });
    F.turn([['x', -0.22]], [8, 8.6, 12.2]); F.m(MAT.gloss, 0xF6F6F4).rbox(3.4, 8.6, 11.0, 12.6, 16.2, 12.0, 1.2, { seg: 2 }); F.turn(null);
    F.m(MAT.metal, P.chrome).cyl(8, 14.2, 13.4, 13.7, 1.0, 1.0, { seg: 10 });
    F.m(MAT.gloss, P.white); F.far(3.4, 0, 1.4, 12.6, 8, 12.2); F.far(2.2, 0, 12.2, 13.8, 13.4, 16);
    F.shadow(2.5, 1, 13.5, 16);
  });
  // the counters of the modern kitchens (island, sink, hob; white or charcoal, tint 1): a carcass on a dark toe kick, two
  // door fronts and a chrome bar, the marble top; the sink's steel basin and gooseneck tap; the hob's black glass and
  // rings. Any counter joins any counter of the run (variant bits: 1 one on +x, 2 on −x)
  for (const kind of ['p', 's', 'h']) for (let j = 0; j < 4; j++) MD('vcounter:' + kind + ':' + j, [1, 1, 1], (F) => {
    const R = j & 1, L = j & 2;
    F.m(MAT.matte, 0x1C1E22).box(L ? 0 : 1.2, 0, 3.2, R ? 16 : 14.8, 2, 14.4, B_BOT);
    F.m(MAT.gloss, 0xE6E6E6, 1).rbox(L ? -0.05 : 0, 2, 2.0, R ? 16.05 : 16, 12, 16, 0.3, { seg: 1 });
    F.m(MAT.gloss, 0xFFFFFF, 1).rbox(0.35, 2.4, 1.2, 7.85, 11.6, 2.0, 0.25, { seg: 1, seam: 0.9 }).rbox(8.15, 2.4, 1.2, 15.65, 11.6, 2.0, 0.25, { seg: 1, seam: 0.9 });
    F.m(MAT.metal, P.chrome); handle(F, 4.5, 10.2, 1.2, 7, 'x', 0.3);
    F.m(MAT.marble, P.marble).rbox(L ? -0.05 : 0, 12, -0.3, R ? 16.05 : 16, 13.8, 16, 0.3, { seg: 1 });
    if (kind === 's') {
      F.m(MAT.metal, COL.steel).rbox(3, 13.8, 3.6, 13, 14.05, 12.4, 0.5, { seg: 1 }); F.m(MAT.metal, 0x5A6068).box(3.7, 14.05, 4.3, 12.3, 14.08, 11.7);
      F.m(MAT.metal, P.chrome).cyl(8, 13.6, 13.8, 18.6, 0.55, 0.5, { seg: 8 }).tube([[8, 18.4, 13.6], [8, 19.4, 12.4], [8, 19.1, 10.4], [8, 17.8, 9.6]], 0.42, 0.36, { seg: 7 });
    } else if (kind === 'h') {
      F.m(MAT.gloss, 0x111214).rbox(1.6, 13.8, 1.6, 14.4, 14.1, 14.4, 0.4, { seg: 1 });
      for (const [x, z] of [[4.6, 4.6], [11.4, 4.6], [4.6, 11.4], [11.4, 11.4]]) F.m(MAT.gloss, 0x4A4E56).lathe(x, z, [[14.12, 2.0], [14.12, 1.6]], { seg: 14 });
      F.m(MAT.light, 0xFF4A2A).box(7.2, 14.11, 13.2, 8.8, 14.16, 13.6);
    } else F.m(MAT.gloss, 0xE8E2D4).lathe(11.4, 8.6, [[13.8, 1.6], [14.4, 2.6], [15.6, 3.0], [16.0, 2.7]], { seg: 14, capBot: true });
    F.m(MAT.gloss, 0xE6E6E6, 1); F.far(0, 0, 1.2, 16, 12, 16); F.m(MAT.marble, P.marble); F.far(0, 12, -0.3, 16, 13.8, 16);
    F.shadow(L ? 0 : -0.5, -0.5, R ? 16 : 16.5, 16.5);
  });
  // the coffee tables of the modern towns: two black slab legs under a glass top in a thin frame, or under a marble slab
  for (const k of ['glass', 'marble']) MD('vcoffee:' + k, [1, 1, 1], (F) => {
    F.m(MAT.metal, P.black).rbox(2, 0, 2.4, 3.8, 6.2, 13.6, 0.3, { seg: 1 }).rbox(12.2, 0, 2.4, 14, 6.2, 13.6, 0.3, { seg: 1 });
    if (k === 'glass') { F.m(MAT.metal, P.black).rbox(0.2, 6.2, 0.2, 0.8, 7.2, 15.8, 0.15, { seg: 1 }).rbox(15.2, 6.2, 0.2, 15.8, 7.2, 15.8, 0.15, { seg: 1 }).rbox(0.8, 6.2, 0.2, 15.2, 7.2, 0.8, 0.15, { seg: 1 }).rbox(0.8, 6.2, 15.2, 15.2, 7.2, 15.8, 0.15, { seg: 1 }); F.m(MAT.glass, 0xC8E0EE).box(0.8, 6.6, 0.8, 15.2, 7.0, 15.2); }
    else F.m(MAT.marble, P.marble).rbox(0.2, 6.2, 0.2, 15.8, 7.8, 15.8, 0.7, { seg: 2 });
    const y = k === 'glass' ? 7.0 : 7.8;
    F.m(MAT.metal, P.brass).lathe(7, 8, [[y, 1.2], [y + 0.8, 2.6], [y + 1.4, 2.8], [y + 1.4, 2.5], [y + 0.9, 2.2], [y + 0.9, 0.01]], { seg: 14, capBot: true });
    F.m(MAT.gloss, P.leaf).sphere(7.2, y + 1.6, 7.6, 0.9, 0.8, 0.9, { seg: 5 }); F.m(MAT.gloss, 0xE8B83A).sphere(6.4, y + 1.5, 8.6, 0.8, 0.7, 0.8, { seg: 5 });
    F.m(MAT.matte, 0x2F55C8).rbox(10.4, y, 5, 14, y + 0.8, 9.6, 0.12, { seg: 1 });
    F.m(MAT.metal, P.black); F.far(2, 0, 2.4, 14, 6.2, 13.6); F.m(k === 'glass' ? MAT.metal : MAT.marble, k === 'glass' ? P.black : P.marble); F.far(0.2, 6.2, 0.2, 15.8, 7.8, 15.8);
    F.shadow(0.5, 0.5, 15.5, 15.5);
  });
  // the freestanding tub (a row joins along its length: variant bits 1 on +x, 2 on −x): a white shell with a rolled rim,
  // hollow, the water's surface inside, the tap at the end that has no neighbour on +x
  for (let j = 0; j < 4; j++) MD('vtub:' + j, [1, 1, 1], (F) => {
    const R = j & 1, L = j & 2, x0 = L ? -0.05 : 1.6, x1 = R ? 16.05 : 14.4;
    F.m(MAT.gloss, P.white);
    F.rbox(x0, 0, 1.6, x1, 9.6, 3.6, L || R ? 0.9 : 1.2, { seg: 2 }).rbox(x0, 0, 12.4, x1, 9.6, 14.4, L || R ? 0.9 : 1.2, { seg: 2 });
    if (!L) F.rbox(1.6, 0, 3.6, 3.6, 9.6, 12.4, 0.9, { seg: 2 });
    if (!R) F.rbox(12.4, 0, 3.6, 14.4, 9.6, 12.4, 0.9, { seg: 2 });
    F.m(MAT.gloss, 0xF4F4F2).box(L ? -0.05 : 3.6, 0.6, 3.6, R ? 16.05 : 12.4, 3.0, 12.4);
    F.m(MAT.glass, 0x9AD0E8).box(L ? 0 : 3.6, 6.6, 3.6, R ? 16 : 12.4, 7.0, 12.4);
    if (!R) { F.m(MAT.metal, P.chrome).cyl(14.2, 8, 0, 13, 0.5, 0.45, { seg: 8 }).rod(14.2, 12.6, 8, 11.8, 12.6, 8, 0.45, { seg: 6 }).rod(11.8, 12.6, 8, 11.6, 11.2, 8, 0.38, { seg: 6 }); }
    F.m(MAT.gloss, P.white); F.far(L ? 0 : 1.6, 0, 1.6, R ? 16 : 14.4, 9.6, 14.4);
    F.shadow(L ? 0 : 1, 1, R ? 16 : 15, 15);
  });
  // the park bench: two cast-iron side frames, four seat slats and two back slats in the bench's wood (tint 1)
  MD('vbench', [1, 1, 1], (F) => {
    F.m(MAT.metal, P.iron);
    for (const x of [0.4, 14.4]) { F.rbox(x, 0, 4, x + 1.2, 7.2, 5.2, 0.3, { seg: 1 }).rbox(x, 0, 10.8, x + 1.2, 6.6, 12, 0.3, { seg: 1 }).rbox(x, 6, 4, x + 1.2, 7.0, 12, 0.3, { seg: 1 }).rbox(x, 6.6, 11.2, x + 1.2, 14.6, 12.6, 0.3, { seg: 1 }); }
    F.m(MAT.wood, 0xFFFFFF, 1); for (let k = 0; k < 4; k++) F.rbox(0.2, 7.0, 3.6 + k * 2.1, 15.8, 7.9, 5.3 + k * 2.1, 0.35, { seg: 1 });
    for (const y of [9.4, 12.2]) F.rbox(0.2, y, 12.6, 15.8, y + 1.8, 13.6, 0.35, { seg: 1 });
    F.m(MAT.wood, 0xFFFFFF, 1); F.far(0.2, 7, 3.6, 15.8, 7.9, 12); F.far(0.2, 9.4, 12.6, 15.8, 14, 13.6); F.m(MAT.metal, P.iron); F.far(0.4, 0, 4, 1.6, 7.2, 12.6); F.far(14.4, 0, 4, 15.6, 7.2, 12.6);
    F.shadow(-0.5, 3, 16.5, 14);
  });
  // the long dining table of the mansions (a row joins along its length: variant bits 1 on +x, 2 on −x): a top in the
  // piece's first colour (walnut wood, or white marble), an apron, the legs (second colour) only at the row's ends
  for (const [k, m] of [['w', MAT.wood], ['m', MAT.marble]]) for (let j = 0; j < 4; j++) MD('vdtable:' + k + ':' + j, [1, 1, 1], (F) => {
    const R = j & 1, L = j & 2;
    F.m(m, 0xFFFFFF, 1).rbox(L ? -0.05 : 0, 10.4, 1.6, R ? 16.05 : 16, 12, 14.4, L || R ? 0.25 : 0.45, { seg: 1 });
    F.m(m, 0xC8C8C8, 1).box(L ? 0 : 1.2, 9.2, 2.6, R ? 16 : 14.8, 10.4, 13.4);
    F.m(MAT.gloss, 0xFFFFFF, 2);
    if (!L) for (const z of [2.8, 13.2]) F.rbox(0.6, 0, z - 0.8, 2.2, 10.4, z + 0.8, 0.3, { seg: 1 });
    if (!R) for (const z of [2.8, 13.2]) F.rbox(13.8, 0, z - 0.8, 15.4, 10.4, z + 0.8, 0.3, { seg: 1 });
    F.m(m, 0xFFFFFF, 1); F.far(0, 10.4, 1.6, 16, 12, 14.4); F.m(MAT.gloss, 0xFFFFFF, 2); if (!L) F.far(0.6, 0, 2, 2.2, 10.4, 14); if (!R) F.far(13.8, 0, 2, 15.4, 10.4, 14);
    F.shadow(L ? 0 : -0.5, 1, R ? 16 : 16.5, 15);
  });
  // the dining chair of the mansions: four slim legs (second colour: black steel or brass), the upholstered seat and back
  // (first colour)
  MD('vdchair', [1, 1, 1], (F) => {
    F.m(MAT.metal, 0xFFFFFF, 2); for (const [x, z] of [[3, 3], [13, 3], [3, 13], [13, 13]]) F.cyl(x, z, 0, 6.2, 0.5, 0.6, { seg: 7, caps: 2 });
    F.rod(3, 2.6, 3, 3, 2.6, 13, 0.3, { seg: 5 }).rod(13, 2.6, 3, 13, 2.6, 13, 0.3, { seg: 5 });
    F.m(MAT.fabric, 0xFFFFFF, 1).rbox(2, 6.2, 2, 14, 8.4, 14, 1.4, { mid: 3, bulge: { 3: 0.45 }, seam: 0.82 });
    F.turn([['x', 0.1]], [8, 8, 14.6]); F.rbox(2.2, 8, 12.4, 13.8, 16, 14.8, 1.3, { mid: 3, bulge: { 4: 0.4 }, seam: 0.82 }); F.turn(null);
    F.m(MAT.fabric, 0xFFFFFF, 1); F.far(2, 6.2, 2, 14, 8.4, 14); F.far(2.2, 8, 12.4, 13.8, 16, 14.8); F.m(MAT.metal, 0xFFFFFF, 2); F.far(2.5, 0, 2.5, 13.5, 6.2, 13.5);
    F.shadow(1.5, 1.5, 14.5, 14.5);
  });
  // the TV media wall (a row joins sideways: variant bits 1 on +x, 2 on −x): a floating walnut console with a warm light
  // under it, a charcoal wall panel, the black bezel and the screen's picture (the TV atlas: its left half at the row's
  // left end, its right half at the right end, the whole picture on a single block)
  for (let j = 0; j < 4; j++) MD('vtvwall:' + j, [1, 1, 1], (F) => {
    const R = j & 1, L = j & 2;
    F.m(MAT.gloss, P.walnut).rbox(L ? -0.05 : 1.2, 1.6, 10, R ? 16.05 : 14.8, 4.4, 15.6, 0.4, { seg: 1 });
    F.m(MAT.light, 0xFFB040).box(L ? 0 : 2, 1.52, 11.6, R ? 16 : 14, 1.6, 12.6);
    F.m(MAT.matte, 0x2E3136).box(0, 6, 15.2, 16, 16, 16);
    F.m(MAT.gloss, 0x111214).rbox(L ? -0.05 : 1.2, 6.4, 13.6, R ? 16.05 : 14.8, 14.6, 15.2, 0.2, { seg: 1 });
    const T = PR.ATL.tv, um = (T[0] + T[2]) / 2, uv = R && !L ? [T[0], T[1], um, T[3]] : L && !R ? [um, T[1], T[2], T[3]] : L && R ? [T[0] + (T[2] - T[0]) * 0.25, T[1], T[0] + (T[2] - T[0]) * 0.75, T[3]] : T;
    F.m(MAT.light, 0xFFFFFF); face(F, [[R ? 16 : 14.2, 7.0, 13.55], [L ? 0 : 1.8, 7.0, 13.55], [L ? 0 : 1.8, 14.0, 13.55], [R ? 16 : 14.2, 14.0, 13.55]], [0, 0, -1], uv);
    F.m(MAT.gloss, P.walnut); F.far(0, 1.6, 10, 16, 4.4, 15.6); F.m(MAT.gloss, 0x111214); F.far(0, 6.4, 13.6, 16, 14.6, 16);
  });
  // the tech stool: a dark foot, a grey column, a white shell and a round cushion (the stool's colour)
  MD('vstool', [1, 1, 1], (F) => {
    F.m(MAT.metal, 0x2A2E36).lathe(8, 8, [[0, 4.6], [0.4, 4.6], [0.9, 3.4], [1.2, 1.0]], { seg: 18 });
    F.m(MAT.metal, 0x8A9098).cyl(8, 8, 1.0, 8.0, 0.9, 0.8, { seg: 10, caps: 0 });
    F.m(MAT.gloss, 0xF2F4F8).lathe(8, 8, [[7.8, 0.01], [7.9, 5.4], [8.6, 6.4], [9.6, 6.6], [9.8, 6.0]], { seg: 22, capBot: true });
    F.m(MAT.fabric, 0xFFFFFF, 1).lathe(8, 8, [[9.6, 0.01], [9.6, 5.2], [10.2, 5.6], [11.0, 5.2], [11.4, 3.4], [11.5, 0.01]], { seg: 22 });
    F.m(MAT.gloss, 0xF2F4F8); F.far(1.4, 7.8, 1.4, 14.6, 11.5, 14.6); F.m(MAT.metal, 0x8A9098); F.far(7.2, 0, 7.2, 8.8, 7.8, 8.8);
    F.shadow(3, 3, 13, 13);
  });
  // the garden urn (white or stone, tint 1): a foot, a stem, a turned bowl with a rolled lip, soil, a small evergreen and two
  // flowers
  MD('urn', [1, 1, 1], (F) => {
    F.m(MAT.gloss, 0xFFFFFF, 1).lathe(8, 8, [[0, 4.4], [1.2, 4.4], [1.6, 2.4], [3.6, 2.0], [4.4, 3.4], [6.6, 5.6], [8.8, 6.4], [10.2, 6.6], [10.6, 6.0], [10.0, 5.6]], { seg: 22, capBot: true });
    F.m(MAT.matte, COL.soil).lathe(8, 8, [[10.0, 5.7], [10.0, 0.01]], { seg: 22 });
    F.m(MAT.leaf, 0x3E7A3A).sphere(8, 12.8, 8, 4.6, 3.4, 4.6, { seg: 10, lump: 0.16, seed: 17 });
    F.m(MAT.gloss, 0xF06292).sphere(6.2, 15.4, 6.8, 0.8, 0.7, 0.8, { seg: 4 }); F.m(MAT.gloss, 0xF0C040).sphere(10.2, 14.8, 7.4, 0.8, 0.7, 0.8, { seg: 4 });
    F.m(MAT.gloss, 0xFFFFFF, 1); F.far(1.4, 0, 1.4, 14.6, 10.6, 14.6); F.m(MAT.leaf, 0x3E7A3A); F.far(3.4, 10, 3.4, 12.6, 16, 12.6);
    F.shadow(2.5, 2.5, 13.5, 13.5);
  });
  // the tropical planter of the tech towns and Villa Nova (t1_29): a white box with a cyan light line round its foot, soil,
  // broad arching blades from its middle (the monstera's cutout), a round bush between them
  MD('tplanter', [1, 1, 1], (F) => {
    F.m(MAT.gloss, 0xF0F2F6).rbox(0.2, 0.6, 0.2, 15.8, 6, 15.8, 0.6, { seg: 2, skip: B_BOT });
    F.m(MAT.light, 0x3AF0FF).box(0.6, 0, 0.6, 15.4, 0.6, 15.4, B_BOT);
    F.m(MAT.matte, COL.soil).box(1.2, 6, 1.2, 14.8, 6.1, 14.8);
    F.m(MAT.leaf, 0x2E8A3A).sphere(8, 8.2, 8, 3.2, 2.2, 3.2, { seg: 8, lump: 0.2, seed: 23 });
    for (let k = 0; k < 7; k++) {
      const a = k * TAU / 7 + 0.3, ca = Math.cos(a), sa = Math.sin(a), el = 0.82 - 0.12 * (k % 3), r = 0.8 + (k % 2) * 0.6;
      F.m(MAT.leaf, COL.stem).tube([[8 + ca * 0.3, 6.2, 8 + sa * 0.3], [8 + ca * r, 7.6 + (k % 3) * 0.8, 8 + sa * r]], 0.25, 0.2, { seg: 4, caps: 0 });
      F.m(MAT.leaf, [0x2E8A3A, 0x4EB84A, 0x3E9A40][k % 3]).leaf([8 + ca * r, 7.6 + (k % 3) * 0.8, 8 + sa * r], norm3([ca * Math.cos(el), Math.sin(el), sa * Math.cos(el)]), norm3([-sa, 0, ca]), 6.2, 5.2, 1.5, PR.ATL.monstera);
    }
    F.m(MAT.gloss, 0xF0F2F6); F.far(0.2, 0, 0.2, 15.8, 6, 15.8); F.m(MAT.leaf, 0x2E8A3A); F.far(2.5, 6, 2.5, 13.5, 11.2, 13.5);
  });
  // the villages' potted plant: a terracotta pot with a rim, soil, a bushy clump of leaves and a flower
  MD('potplant', [1, 1, 1], (F) => {
    F.m(MAT.matte, 0xC06A3A).lathe(8, 8, [[0, 2.8], [0.4, 3.0], [4.6, 3.6], [4.8, 4.2], [6.0, 4.2], [6.0, 3.7]], { seg: 16, capBot: true });
    F.m(MAT.matte, COL.soil).lathe(8, 8, [[5.6, 3.7], [5.6, 0.01]], { seg: 16 });
    for (let k = 0; k < 6; k++) { const a = k * 2.2; F.m(MAT.leaf, k & 1 ? 0x4E9A48 : 0x3A7A38).sphere(8 + Math.cos(a) * 2.2, 8.4 + (k % 3) * 1.2, 8 + Math.sin(a) * 2.2, 2.6, 2.0, 2.4, { seg: 6, lump: 0.3, seed: 60 + k }); }
    F.m(MAT.gloss, 0xE84A6A).sphere(9.2, 12.6, 7.2, 1.0, 0.8, 1.0, { seg: 5 }); F.m(MAT.gloss, 0xF0D040).sphere(9.2, 13.1, 7.2, 0.4, 0.3, 0.4, { seg: 4 });
    F.m(MAT.matte, 0xC06A3A); F.far(3.8, 0, 3.8, 12.2, 6, 12.2); F.m(MAT.leaf, 0x3A7A38); F.far(3, 6, 3, 13, 13, 13);
    F.shadow(3.5, 3.5, 12.5, 12.5);
  });

  // ================================================================ the villas' remaining pieces (voxfurn.js)
  // the oak sideboard (three blocks): the body on black legs and a rail, four slatted doors, a teal vase with a branch, a
  // tray of fruit, a framed print leaning on the wall, a stack of books
  MD('sideboard', [3, 1, 1], (F) => {
    F.m(MAT.metal, COL.black).cyl(3, 9, 0, 2, 0.9, 0.7, { seg: 8 }).cyl(45, 9, 0, 2, 0.9, 0.7, { seg: 8 }).box(2.5, 1.5, 5, 45.5, 2, 13);
    F.m(MAT.wood, WOOD.oak).rbox(0, 2, 2.5, 48, 12, 16, 0.45, { seg: 2 });
    for (let k = 0; k < 4; k++) {
      F.m(MAT.wood, shd(WOOD.oak, 0.92)).rbox(k * 12 + 0.35, 2.35, 1.8, k * 12 + 11.65, 11.65, 2.6, 0.25, { seg: 1, seam: 0.9 });
      F.m(MAT.wood, shd(WOOD.oak, 0.72)); for (let y = 3.4; y < 11; y += 1.1) F.box(k * 12 + 0.8, y, 1.74, k * 12 + 11.2, y + 0.32, 1.82);
    }
    F.m(MAT.gloss, 0x2F7A6A).lathe(8, 9, [[12, 2.2], [14, 3], [17.5, 2], [18.5, 2.6]], { seg: 14, capBot: true });
    F.m(MAT.leaf, COL.stem).rod(8, 18, 9, 7.2, 21.4, 9.5, 0.28, { seg: 5 }); F.m(MAT.leaf, COL.leafL).sphere(7.2, 21.8, 9.5, 1.8, 0.9, 1.4, { seg: 5, lump: 0.3, seed: 5 });
    F.m(MAT.gloss, COL.paper).rbox(20, 12, 7, 32, 12.6, 11, 0.25, { seg: 1 });
    F.m(MAT.gloss, 0xC8442A).sphere(22.5, 13.5, 9, 1.4, 1.1, 1.4, { seg: 6 }); F.m(MAT.gloss, 0xE8B83A).sphere(26.5, 13.4, 8.8, 1.3, 1.0, 1.3, { seg: 6 }); F.m(MAT.gloss, 0x8AA07A).sphere(30, 13.4, 9.2, 1.2, 1.0, 1.2, { seg: 6 });
    F.turn([['x', 0.12]], [41.5, 12, 10]); F.m(MAT.gloss, 0x2A2D33).rbox(37, 12, 9, 46, 19, 10, 0.2, { seg: 1 }); F.m(MAT.matte, 0xD8C8A0).box(37.6, 12.6, 8.92, 45.4, 18.4, 9); F.turn(null);
    F.m(MAT.matte, 0x2F55C8).rbox(12, 12, 7, 18, 13, 14, 0.15, { seg: 1 }); F.m(MAT.matte, 0xE8B83A).rbox(12.4, 13, 7.4, 17.6, 14, 13.4, 0.15, { seg: 1 });
    F.m(MAT.wood, WOOD.oak); F.far(0, 1.5, 1.8, 48, 12, 16);
    F.shadow(-1, 1, 49, 17);
  });
  // the walnut dresser: six drawers in two columns with brass bars, black legs, a leather tray with perfume bottles, a vase
  MD('dresser', [2, 1, 1], (F) => {
    F.m(MAT.metal, COL.black); for (const [x, z] of [[2.5, 4], [29.5, 4], [2.5, 14], [29.5, 14]]) F.cyl(x, z, 0, 2.1, 0.9, 0.7, { seg: 8 });
    F.m(MAT.wood, P.walnut).rbox(0, 2, 2.5, 32, 12, 16, 0.4, { seg: 1 });
    for (let k = 0; k < 3; k++) for (const x0 of [0, 16]) { const y0 = 2 + k * 3.33; F.m(MAT.wood, WOOD.smoked).rbox(x0 + 0.35, y0 + 0.25, 1.9, x0 + 15.65, y0 + 3.08, 2.6, 0.25, { seg: 1, seam: 0.88 }); F.m(MAT.metal, COL.brass); handle(F, x0 + 5, y0 + 1.66, 1.9, 6, 'x', 0.28); }
    F.m(MAT.gloss, 0xE8E2D4).lathe(5, 9, [[12, 1.4], [13.5, 2], [16, 1.2], [16.6, 1.5]], { seg: 12, capBot: true });
    F.m(MAT.leaf, COL.stem).rod(5, 16.4, 9, 6, 20, 9.5, 0.25, { seg: 5 }); F.m(MAT.leaf, COL.leaf).sphere(6, 20.4, 9.5, 1.4, 0.8, 1.1, { seg: 5, lump: 0.3, seed: 6 });
    F.m(MAT.leather, 0x6A4A30).rbox(10, 12, 6, 16, 12.8, 11, 0.4, { seg: 1 });
    F.m(MAT.glass, 0xE8D8A0).lathe(13, 8.5, [[12.8, 0.8], [14.5, 0.7], [15, 0.4]], { seg: 8, capBot: true }); F.m(MAT.gloss, 0x2A2D33).lathe(10.8, 8.2, [[12.8, 0.6], [14, 0.6]], { seg: 8, capTop: true });
    F.m(MAT.wood, P.walnut); F.far(0, 0, 1.9, 32, 12, 16);
    F.shadow(-0.5, 1.5, 32.5, 16.5);
  });
  // the bed bench: four slim steel legs, a long taupe cushion with piping, a folded cream throw at one end
  MD('bench', [2, 1, 1], (F) => {
    for (const [x, z] of [[2.5, 4.5], [29.5, 4.5], [2.5, 11.5], [29.5, 11.5]]) steelLeg(F, x, z, 6);
    F.m(MAT.metal, COL.black).rod(2.5, 1.5, 4.5, 2.5, 1.5, 11.5, 0.38, { seg: 6 }).rod(29.5, 1.5, 4.5, 29.5, 1.5, 11.5, 0.38, { seg: 6 });
    F.m(MAT.fabric, 0xA89482).rbox(0, 6, 3, 32, 9.6, 13, 1.6, { mid: 4, bulge: { 3: 0.45 }, seam: 0.8 });
    F.m(MAT.fabric, 0xECE6D8).rbox(20, 9.5, 3.6, 30, 10.6, 12.4, 0.5, { seam: 0.9 });
    F.m(MAT.fabric, 0xA89482); F.far(0, 6, 3, 32, 9.6, 13); F.m(MAT.metal, COL.black); F.far(2, 0, 4, 30, 6, 12);
    F.shadow(-0.5, 2, 32.5, 14);
  });
  // the oak dining bench (three blocks): a top on two slab legs and a stretcher, a cream cushion along it
  MD('dbench', [3, 1, 1], (F) => {
    F.m(MAT.wood, WOOD.oak).rbox(0, 8, 4, 48, 9.5, 12, 0.5, { seg: 2 }).rbox(3, 0, 5, 5.5, 8, 11, 0.3, { seg: 1 }).rbox(42.5, 0, 5, 45, 8, 11, 0.3, { seg: 1 }).rbox(5.5, 1.5, 7.4, 42.5, 2.6, 8.6, 0.2, { seg: 1 });
    F.m(MAT.fabric, 0xECE6D8).rbox(1, 9.5, 4.5, 47, 11, 11.5, 0.8, { mid: 4, bulge: { 3: 0.3 }, seam: 0.84 });
    F.m(MAT.wood, WOOD.oak); F.far(0, 8, 4, 48, 11, 12); F.far(3, 0, 5, 5.5, 8, 11); F.far(42.5, 0, 5, 45, 8, 11);
    F.shadow(-0.5, 3, 48.5, 13);
  });
  // the floating walnut shelf: books (one leaning), a white vase with a plant, a candle that glows
  MD('wallshelf', [1, 1, 1], (F) => {
    F.m(MAT.wood, P.walnut).rbox(0, 6, 11, 16, 7, 16, 0.3, { seg: 1 });
    bookRow(F, 1, 4.6, 7, 12, 15.5, 4, 3.6);
    F.turn([['z', -0.3]], [5, 7, 13.5]); F.m(MAT.matte, 0xC0443A).rbox(4.8, 7, 12, 5.8, 11.4, 15.5, 0.12, { seg: 1 }); F.turn(null);
    F.m(MAT.gloss, P.white).lathe(10, 13.5, [[7, 1.5], [9, 2.3], [11.5, 1.2], [12.5, 1.6]], { seg: 12, capBot: true });
    F.m(MAT.leaf, COL.leafL).sphere(10, 13.6, 13.5, 2.2, 1.4, 2.0, { seg: 6, lump: 0.3, seed: 14 });
    F.m(MAT.gloss, COL.paper).lathe(14, 13.5, [[7, 1.1], [8.6, 1.1]], { seg: 10, capTop: true }); F.m(MAT.light, COL.warm).sphere(14, 9.2, 13.5, 0.35, 0.6, 0.35, { seg: 4 });
    F.m(MAT.wood, P.walnut); F.far(0, 6, 11, 16, 7, 16);
  });
  // the kitchen shelf: two oak boards on black brackets, jars with wooden lids, two mugs, a knife block
  MD('kshelf', [1, 1, 1], (F) => {
    F.m(MAT.wood, WOOD.oak).rbox(0, 6, 11, 16, 7, 16, 0.25, { seg: 1 }).rbox(0, 12, 11, 16, 13, 16, 0.25, { seg: 1 });
    F.m(MAT.metal, COL.black); for (const x of [1, 15]) F.box(x - 0.5, 5.4, 15.2, x + 0.5, 12, 16);
    for (const [x, c, h] of [[3, 0xD2A84A, 4], [6.5, 0xC8A878, 4.5], [10, 0x6A3A1A, 3.5], [13.5, 0xF4F0E8, 4]]) { F.m(MAT.glass, c).lathe(x, 13.5, [[7, 1.4], [7 + h, 1.4], [7.4 + h, 1]], { seg: 10, capBot: true }); F.m(MAT.wood, WOOD.ash).cyl(x, 13.5, 7.3 + h, 8 + h, 1.15, 1.1, { seg: 10 }); }
    F.m(MAT.gloss, P.white).lathe(3, 13.5, [[13, 1.4], [15.5, 1.3]], { seg: 12, capBot: true }).lathe(6.5, 13.5, [[13, 1.4], [15.5, 1.3]], { seg: 12, capBot: true });
    F.m(MAT.wood, P.walnut).rbox(9, 13, 12, 15, 15.8, 15, 0.3, { seg: 1 });
    F.m(MAT.wood, WOOD.oak); F.far(0, 6, 11, 16, 13, 16);
  });
  // the office chair: a five-star base on castors, the chrome column, a padded seat, the mesh back on its spine, armrests
  MD('ochair', [1, 1, 1], (F) => {
    for (let k = 0; k < 5; k++) { const a = k * TAU / 5, c = Math.cos(a), s = Math.sin(a); F.m(MAT.metal, COL.black).rod(8, 1.1, 8, 8 + c * 5.8, 0.9, 8 + s * 5.8, 0.55, { seg: 6 }); F.m(MAT.gloss, 0x111214).sphere(8 + c * 5.8, 0.6, 8 + s * 5.8, 0.6, 0.6, 0.6, { seg: 4 }); }
    F.m(MAT.metal, 0xD8DEE4).cyl(8, 8, 1.0, 7.4, 0.9, 0.8, { seg: 10, caps: 0 });
    F.m(MAT.metal, COL.black).rbox(5, 7, 5, 11, 8, 11, 0.3, { seg: 1 });
    F.m(MAT.fabric, 0x2E3136).rbox(2, 8, 2, 14, 10.4, 14, 1.6, { mid: 3, bulge: { 3: 0.4 }, seam: 0.84 });
    F.m(MAT.metal, COL.black).rbox(7, 8.6, 13.2, 9, 12, 14.4, 0.3, { seg: 1 });
    F.turn([['x', 0.12]], [8, 10.5, 14]); F.m(MAT.fabric, 0x3A3F48).rbox(2.6, 10.8, 12.8, 13.4, 17.2, 14.4, 1.6, { mid: 3, bulge: { 4: 0.35 }, seam: 0.86 }); F.turn(null);
    F.m(MAT.metal, COL.black); for (const x of [2.5, 13.5]) { F.rod(x, 10, 8, x, 12.4, 8, 0.4, { seg: 6 }); F.m(MAT.gloss, 0x111214).rbox(x - 1, 12.4, 4.6, x + 1, 13.2, 10.6, 0.4, { seg: 1 }); F.m(MAT.metal, COL.black); }
    F.m(MAT.fabric, 0x2E3136); F.far(2, 8, 2, 14, 10.4, 14); F.far(2.6, 10.4, 12.8, 13.4, 17, 14.4); F.m(MAT.metal, COL.black); F.far(2.5, 0, 2.5, 13.5, 8, 13.5);
    F.shadow(1.5, 1.5, 14.5, 14.5);
  });
  // the villa's vanity (two blocks high): an oak wall-hung cabinet with two drawers, a marble top, a white bowl basin, the
  // tall mixer, a round mirror over it with a lit ring
  MD('vanity', [1, 2, 1], (F) => {
    F.m(MAT.wood, WOOD.oak).rbox(0, 4, 6, 16, 12, 16, 0.3, { seg: 1 });
    for (const y of [4, 8]) F.m(MAT.wood, WOOD.smoked).rbox(0.35, y + 0.25, 5.3, 15.65, y + 3.75, 6.1, 0.25, { seg: 1, seam: 0.88 });
    F.m(MAT.marble, COL.marble).rbox(0, 12, 4, 16, 13.5, 16, 0.4, { seg: 2 });
    F.m(MAT.gloss, P.white).lathe(8, 10, [[13.5, 3.6], [14.4, 4.6], [16.6, 5.0], [16.8, 4.6], [14.6, 4.0], [14.5, 0.01]], { seg: 20, capBot: true });
    F.m(MAT.metal, 0xD8DEE4).cyl(8, 15, 13.5, 20, 0.6, 0.55, { seg: 8 }).rod(8, 19.6, 15, 8, 19.6, 11, 0.5, { seg: 6 }).rod(8, 19.6, 11, 8, 18.6, 11, 0.42, { seg: 6 });
    F.m(MAT.gloss, 0x2F7A6A).lathe(2.5, 12, [[13.5, 0.8], [16, 0.7], [16.5, 0.4]], { seg: 8, capTop: true });
    F.m(MAT.light, COL.warm).tube(ringZ(8, 25, 15.4, 7.0, 36), 0.35, 0.35, { seg: 5, caps: 0 });
    F.m(MAT.mirror, MIRROR); discZ(F, 8, 25, 15.3, 6.6, 36);
    F.m(MAT.matte, 0x2A2D33).box(1.6, 18.6, 15.6, 14.4, 31.4, 16);
    F.m(MAT.wood, WOOD.oak); F.far(0, 4, 5.3, 16, 12, 16); F.m(MAT.marble, COL.marble); F.far(0, 12, 4, 16, 13.5, 16);
  });
  // the wall-hung toilet: the cistern wall with its flush plate, the bowl floating off the floor, the seat and lid
  MD('toilet', [1, 1, 1], (F) => {
    F.m(MAT.matte, 0xE8E6E0).rbox(1, 0, 12, 15, 16, 16, 0.4, { seg: 1, skip: B_BOT });
    F.m(MAT.metal, 0xD8DEE4).rbox(5.5, 11, 11.6, 10.5, 13.5, 12, 0.3, { seg: 1 });
    F.m(MAT.gloss, P.white).lathe(8, 7.4, [[4.6, 0.01], [4.8, 2.6], [5.8, 4.0], [7.6, 4.8], [8.6, 4.9], [8.8, 4.4]], { seg: 22, capBot: true });
    F.m(MAT.gloss, 0xBFE0EE).lathe(8, 7.4, [[8.4, 3.7], [8.42, 0.01]], { seg: 16 });
    F.m(MAT.gloss, 0xF6F6F4).tube(loop(8, 7.4, 4.25, 9.1, 28), 0.55, 0.55, { seg: 6, caps: 0 });
    F.turn([['x', -0.25]], [8, 9.4, 11.6]); F.m(MAT.gloss, 0xF6F6F4).rbox(3.4, 9.4, 10.8, 12.6, 17.0, 11.6, 1.2, { seg: 2 }); F.turn(null);
    F.m(MAT.gloss, P.white); F.far(3, 2.6, 2.6, 13, 9, 12); F.m(MAT.matte, 0xE8E6E0); F.far(1, 0, 12, 15, 16, 16);
  });
  // the freestanding tub (two blocks): a white shell with a rolled rim, the water inside, a floor-standing tap, folded towels
  MD('bathtub', [2, 1, 1], (F) => {
    F.m(MAT.gloss, P.white);
    for (const [z0, z1] of [[1, 3.2], [12.8, 15]]) F.rbox(1.2, 0, z0, 30.8, 10, z1, 1.0, { seg: 2 });
    for (const [x0, x1] of [[1.0, 4], [28, 31.0]]) F.rbox(x0, 0, 1.6, x1, 10, 14.4, 1.6, { seg: 2, bulge: { [x0 < 2 ? 0 : 1]: 0.45 } });
    F.m(MAT.gloss, 0xF4F4F2).box(3.8, 0.6, 3.2, 28.2, 3.2, 12.8);
    F.m(MAT.glass, 0x9AD0E8).box(3.8, 7.2, 3.2, 28.2, 7.6, 12.8);
    F.m(MAT.metal, 0xD8DEE4).cyl(30, 0.2, 0, 13.6, 0.55, 0.5, { seg: 8 }).rod(30, 13.4, 0.2, 30, 13.4, 3.4, 0.45, { seg: 6 }).rod(30, 13.4, 3.4, 30, 12.2, 3.4, 0.4, { seg: 6 });
    F.m(MAT.fabric, 0xF4F0E8).rbox(4, 10, 1.4, 10, 11.6, 4.8, 0.7, { seam: 0.88 }); F.m(MAT.fabric, 0xE8E2D4).rbox(4.5, 11.6, 1.8, 9.5, 12.6, 4.4, 0.5, { seam: 0.88 });
    F.m(MAT.gloss, P.white); F.far(0.5, 0, 1, 31.5, 10, 15);
    F.shadow(0, 0, 32, 16);
  });
  // the walk-in shower: a tiled tray, two dark tiled walls, a framed glass panel, the rain head, the mixer, a shelf
  MD('shower', [1, 2, 1], (F) => {
    F.m(MAT.matte, 0x8A8E96).box(0, 0, 0, 16, 1, 16, B_BOT); F.m(MAT.metal, 0x6A7078).cyl(8, 8, 1, 1.05, 1.8, 1.8, { seg: 10 });
    F.m(MAT.matte, 0x3A3F48).box(0, 1, 15, 16, 32, 16).box(15, 1, 0, 16, 32, 15);
    F.m(MAT.metal, COL.black).box(0, 1, 0, 0.8, 30, 0.6).box(0, 29.2, 0, 0.8, 30, 15).box(0, 1, 0, 0.8, 1.8, 15);
    F.m(MAT.glass, 0xD6ECF4).box(0.1, 1.8, 0.6, 0.6, 29.2, 15);
    F.m(MAT.metal, 0xD8DEE4).rod(8, 28, 15, 8, 28, 7, 0.45, { seg: 6 }).cyl(8, 7, 27.2, 28.2, 3.8, 3.8, { seg: 18 });
    F.rod(11.5, 14, 15, 11.5, 14, 13, 0.45, { seg: 6 }).sphere(11.5, 14, 12.8, 0.9, 0.9, 0.9, { seg: 5 }).rod(12.5, 18, 14.4, 12.5, 24, 14.4, 0.32, { seg: 6 });
    F.m(MAT.marble, COL.marble).box(1, 11, 14, 7, 11.6, 15); F.m(MAT.gloss, 0x2F7A6A).lathe(3, 14.4, [[11.6, 0.6], [13.5, 0.55]], { seg: 8, capTop: true }); F.m(MAT.gloss, COL.paper).lathe(5, 14.4, [[11.6, 0.6], [13, 0.55]], { seg: 8, capTop: true });
    F.m(MAT.matte, 0x3A3F48); F.far(0, 0, 15, 16, 32, 16); F.far(15, 0, 0, 16, 32, 15); F.m(MAT.matte, 0x8A8E96); F.far(0, 0, 0, 15, 1, 15);
  });
  // the single bed: an oak frame on short legs, a slatted headboard, the mattress, a blue duvet folded back, a pillow, a
  // mustard cushion
  MD('bed1', [1, 1, 2], (F) => {
    F.m(MAT.wood, WOOD.oak).rbox(0, 2, 0, 16, 5, 32, 0.6, { skip: B_BOT });
    for (const [x, z] of [[1.5, 1.5], [14.5, 1.5], [1.5, 30.5], [14.5, 30.5]]) F.cyl(x, z, 0, 2.1, 0.9, 1.0, { seg: 8 });
    F.rbox(0, 5, 29.6, 16, 15, 32, 0.5, { seg: 1 }); F.m(MAT.wood, shd(WOOD.oak, 0.72)); for (const x of [2, 5, 8, 11, 14]) F.box(x - 0.3, 6, 29.5, x + 0.3, 14, 29.62);
    F.m(MAT.fabric, 0xF2F2EE).rbox(1, 5, 1, 15, 8.6, 29.6, 1.2, { skip: B_BOT, seam: 0.74 });
    F.m(MAT.fabric, 0x4F7FB8).rbox(0.5, 8, 0, 15.5, 11.4, 22, 1.8, { mid: 4, bulge: { 3: 0.6, 4: 0.3 }, seam: 0.88 });
    F.m(MAT.fabric, 0x4473AE).rbox(0.9, 10.2, 0.6, 15.1, 12.2, 6.4, 1.0, { mid: 3, bulge: { 3: 0.3 }, seam: 0.88 });
    F.m(MAT.fabric, 0xFAFAF6).rbox(2.5, 8.5, 23, 13.5, 12.2, 29, 1.9, { mid: 3, bulge: { 3: 0.6, 4: 0.4, 5: 0.4 }, seam: 0.86 });
    F.turn([['x', 0.3]], [8, 11, 28]); F.m(MAT.fabric, 0xD2A84A).rbox(4, 11, 24.6, 12, 14, 27.6, 1.3, { mid: 3, bulge: { 4: 0.5, 5: 0.5 }, seam: 0.84 }); F.turn(null);
    F.m(MAT.fabric, 0x4F7FB8); F.far(0, 2, 0, 16, 11.4, 29.6); F.m(MAT.wood, WOOD.oak); F.far(0, 2, 29.6, 16, 15, 32);
    F.shadow(-1, -1, 17, 33);
  });
  // the bunk bed: ash posts, two bunks with mattresses, duvets and pillows, the guard rail above, the ladder
  MD('bunk', [1, 2, 2], (F) => {
    F.m(MAT.wood, WOOD.ash); for (const [x, z] of [[1, 1], [15, 1], [1, 31], [15, 31]]) F.rbox(x - 1, 0, z - 1, x + 1, 30, z + 1, 0.4, { seg: 1 });
    for (const y of [3, 18]) {
      F.m(MAT.wood, WOOD.ash).rbox(0, y, 0, 16, y + 2, 32, 0.4, { seg: 1 });
      F.m(MAT.fabric, 0xF2F2EE).rbox(1, y + 2, 1, 15, y + 5, 31, 1.0, { skip: B_BOT, seam: 0.76 });
      F.m(MAT.fabric, y > 10 ? 0x4F7FB8 : 0xE8B83A).rbox(0.5, y + 4.4, 0.4, 15.5, y + 7.4, 21, 1.6, { mid: 3, bulge: { 3: 0.5 }, seam: 0.88 });
      F.m(MAT.fabric, 0xFAFAF6).rbox(2.5, y + 5, 23, 13.5, y + 8, 30, 1.5, { mid: 3, bulge: { 3: 0.5 }, seam: 0.86 });
    }
    F.m(MAT.wood, WOOD.ash).rbox(0.2, 20, 0, 15.8, 22.6, 1, 0.3, { seg: 1 }).rbox(0.2, 25, 0, 15.8, 26, 1, 0.3, { seg: 1 }); for (let x = 2; x < 14; x += 3) F.box(x, 22.6, 0.2, x + 1, 25, 0.8);
    F.rbox(14, 0, 11, 15, 20, 12, 0.25, { seg: 1 }).rbox(14, 0, 16, 15, 20, 17, 0.25, { seg: 1 }); for (let y = 2; y < 18; y += 3) F.rbox(14, y, 12, 15.6, y + 1, 16, 0.25, { seg: 1 });
    F.m(MAT.wood, WOOD.ash); F.far(0, 0, 0, 16, 30, 32);
    F.shadow(-1, -1, 17, 33);
  });
  // the stone fireplace (two by two): an ashlar face round the black firebox, logs and flames that glow, the walnut mantel,
  // a vase, two candles, a framed picture
  MD('fireplace', [2, 2, 1], (F) => {
    F.m(MAT.matte, 0x9A948A).box(0, 0, 6.6, 32, 32, 16);
    for (let y = 0; y < 32; y += 3) { const off = ((y / 3) | 0) & 1 ? 3.5 : 0; for (let x = off - 3.5; x < 32; x += 7) { const xa = Math.max(0, x + 0.3), xb = Math.min(32, x + 6.7); if (xb - xa < 1) continue; if (y < 13 && xb > 4 && xa < 28) continue; F.m(MAT.matte, y % 2 ? 0xA8A298 : 0x9E988E).rbox(xa, y + 0.3, 5.6, xb, y + 2.7, 6.6, 0.4, { seg: 1, seam: 0.86 }); } }
    F.m(MAT.gloss, 0x1C1E22).box(4, 0, 6, 28, 13, 6.6).box(3.4, 0, 5.4, 4, 13.4, 6.6).box(28, 0, 5.4, 28.6, 13.4, 6.6).box(4, 13, 5.4, 28, 13.4, 6.6);
    F.m(MAT.wood, 0x4A3A2A).rod(8, 1.6, 6.6, 24, 2.1, 10, 1.1, { seg: 8 }); F.m(MAT.wood, 0x3E2E24).rod(9, 2.6, 10, 23, 3.0, 6.8, 1.0, { seg: 8 });
    F.m(MAT.light, 0xFF7A20).lathe(16, 8.4, [[2.4, 4.5], [5, 3.4], [7.6, 1.6], [9.6, 0.01]], { seg: 10 }); F.m(MAT.light, 0xFFC040).lathe(16, 8.4, [[2.6, 2.6], [5, 1.8], [7, 0.01]], { seg: 10 });
    F.m(MAT.wood, P.walnut).rbox(-0.1, 14, 2, 32.1, 16, 16, 0.4, { seg: 1 });
    F.m(MAT.gloss, 0xE8E2D4).lathe(6, 9, [[16, 1.6], [18, 2.4], [20.5, 1.2], [21.5, 1.6]], { seg: 12, capBot: true }); F.m(MAT.leaf, COL.stem).rod(6, 21, 9, 7, 25, 9, 0.25, { seg: 4 }); F.m(MAT.leaf, COL.leaf).sphere(7, 25.4, 9, 1.6, 0.9, 1.3, { seg: 5, lump: 0.3, seed: 8 });
    for (const x of [12, 14.5]) { F.m(MAT.gloss, COL.paper).lathe(x, 9, [[16, 1], [18.5, 0.9]], { seg: 10, capTop: true }); F.m(MAT.light, 0xFFE2A0).sphere(x, 19, 9, 0.3, 0.5, 0.3, { seg: 4 }); }
    F.turn([['x', 0.1]], [24, 16, 8.4]); F.m(MAT.gloss, 0x2A2D33).rbox(19, 16, 7.6, 29, 24, 8.4, 0.2, { seg: 1 }); F.m(MAT.matte, 0xC9A24A).box(19.6, 16.6, 7.52, 28.4, 23.4, 7.6); F.turn(null);
    F.m(MAT.matte, 0x9A948A); F.far(0, 0, 5.6, 32, 32, 16); F.m(MAT.wood, P.walnut); F.far(0, 14, 2, 32, 16, 16);
    F.shadow(-0.5, 1, 32.5, 16.5);
  });
  // a prism from a convex outline [[x, z] …] between two heights (the grand piano's body)
  const prism = (F, poly, y0, y1) => {
    const n = poly.length, cx = poly.reduce((a, p) => a + p[0], 0) / n, cz = poly.reduce((a, p) => a + p[1], 0) / n;
    for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; face(F, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz]); }
    for (const [y, ny] of [[y0, -1], [y1, 1]]) {
      const c = F.emit(cx, y, cz, 0, ny, 0), base = F.count();
      for (const p of poly) F.emit(p[0], y, p[1], 0, ny, 0);
      for (let i = 0; i < n; i++) {
        const a = base + i, b = base + (i + 1) % n, pa = F.pos(a), pb = F.pos(b), pc = F.pos(c);
        const yN = (pa[2] - pc[2]) * (pb[0] - pc[0]) - (pa[0] - pc[0]) * (pb[2] - pc[2]);
        if (yN * ny > 0) F.tri(c, a, b); else F.tri(c, b, a);
      }
    }
  };
  // the grand piano: the black gloss body on three turned legs, the lid's rim, the keyboard (white and black keys), the
  // fallboard, the music stand with its sheet, the bench in leather, the brass pedals
  MD('piano', [2, 1, 2], (F) => {
    const body = [[0, 0], [32, 0], [32, 12], [26, 20], [16, 30], [4, 30], [0, 20]];
    F.m(MAT.gloss, 0x111214); prism(F, body, 9.5, 14); prism(F, body.map(([x, z]) => [x + (x < 16 ? 0.6 : -0.6), z + (z < 15 ? 0.6 : -0.6)]), 14, 15);
    for (const [x, z] of [[3, 3], [29, 3], [9, 26]]) F.lathe(x, z, [[0, 1.6], [0.6, 1.4], [2, 1.0], [8.5, 1.2], [9.5, 1.6]], { seg: 10 });
    F.rbox(2.5, 9.5, -0.4, 29.5, 10.2, 3.5, 0.2, { seg: 1 });
    F.m(MAT.gloss, P.white).box(3, 10.2, -0.2, 29, 11, 3); F.m(MAT.gloss, 0x111214); for (let i = 0; i < 14; i++) if (i % 7 !== 2 && i % 7 !== 6) F.box(3.8 + i * 1.85, 11, 0.4, 4.7 + i * 1.85, 11.7, 2.4);
    F.rbox(2.5, 11, 3.0, 29.5, 15, 4.4, 0.25, { seg: 1 });
    F.turn([['x', -0.25]], [16, 15, 6]); F.rbox(9, 15, 5.6, 23, 23, 6.2, 0.2, { seg: 1 }); F.m(MAT.matte, COL.paper).box(11, 16.5, 5.52, 21, 21.5, 5.6); F.turn(null);
    F.m(MAT.leather, 0x2A2C30).rbox(11, 5, 0.2, 21, 7, 4.4, 0.8, { mid: 3, bulge: { 3: 0.3 }, seam: 0.84 });
    F.m(MAT.gloss, 0x111214).rbox(11.5, 0, 0.7, 20.5, 5, 3.9, 0.3, { seg: 1 });
    F.m(MAT.metal, COL.brass); for (const x of [14, 16, 18]) F.rod(x, 0.6, 7.4, x, 1.4, 6.0, 0.28, { seg: 5 });
    F.m(MAT.gloss, 0x111214); F.far(0, 9.5, 0, 32, 15, 30); F.far(1.8, 0, 1.8, 4.2, 9.5, 4.2); F.far(27.8, 0, 1.8, 30.2, 9.5, 4.2);
    F.shadow(-1, -1, 33, 31);
  });
  // the sun lounger (two blocks long): a black frame on four feet, teak slats flat and up the raised back, a blue cushion
  // in two parts, a white pillow
  MD('lounger', [1, 1, 2], (F) => {
    F.m(MAT.metal, 0x2A2D33); for (const [x, z] of [[1.5, 2.5], [14.5, 2.5], [1.5, 28.5], [14.5, 28.5]]) F.cyl(x, z, 0, 3, 0.8, 0.7, { seg: 7 });
    F.rod(1.5, 2.6, 2.5, 1.5, 2.6, 28.5, 0.45, { seg: 6 }).rod(14.5, 2.6, 2.5, 14.5, 2.6, 28.5, 0.45, { seg: 6 });
    F.m(MAT.wood, 0xD8C8A8); for (let z = 1; z < 20; z += 1.6) F.rbox(0.5, 3, z, 15.5, 3.8, z + 1.1, 0.25, { seg: 1 });
    F.turn([['x', -0.64]], [8, 3.4, 20]); for (let t = 0; t < 12.5; t += 1.6) F.rbox(0.5, 3, 20 + t, 15.5, 3.8, 21.1 + t, 0.25, { seg: 1 });
    F.m(MAT.fabric, 0x3F6AC0).rbox(1.5, 3.8, 20.2, 14.5, 5.4, 32.2, 0.8, { mid: 3, bulge: { 3: 0.3 }, seam: 0.84 });
    F.m(MAT.fabric, 0xF4F0E8).rbox(3, 5.2, 27.2, 13, 7.6, 32, 1.1, { mid: 3, bulge: { 3: 0.5 }, seam: 0.84 }); F.turn(null);
    F.m(MAT.fabric, 0x3F6AC0).rbox(1.5, 3.8, 1.5, 14.5, 5.4, 19.8, 0.8, { mid: 4, bulge: { 3: 0.3 }, seam: 0.84 });
    F.m(MAT.wood, 0xD8C8A8); F.far(0.5, 2, 1, 15.5, 5.4, 20); F.far(0.5, 3, 20, 15.5, 11, 28);
    F.shadow(-0.5, 0.5, 16.5, 30);
  });
  // the coat rack: a walnut panel on the wall, brass hooks with coats and a bag, a bench below with shoes
  MD('coatrack', [1, 2, 1], (F) => {
    F.m(MAT.wood, P.walnut).rbox(0, 7, 14.5, 16, 32, 16, 0.3, { seg: 1 });
    F.m(MAT.metal, COL.brass); for (const x of [3, 8, 13]) { F.rod(x, 25, 14.5, x, 25.6, 12.6, 0.4, { seg: 6 }); F.sphere(x, 25.7, 12.5, 0.65, 0.65, 0.65, { seg: 4 }); }
    F.turn([['x', 0.08]], [3, 25, 13.5]); F.m(MAT.fabric, 0x2F3F60).rbox(0.6, 10.4, 11.6, 5.6, 25.2, 14.2, 1.2, { mid: 4, bulge: { 4: 0.6 }, seam: 0.86 }); F.turn(null);
    F.turn([['x', 0.06]], [8, 25, 13.5]); F.m(MAT.fabric, 0xC0443A).rbox(6.0, 13.0, 11.8, 10.6, 25.2, 14.2, 1.1, { mid: 4, bulge: { 4: 0.5 }, seam: 0.86 }); F.turn(null);
    F.m(MAT.leather, 0x6A4A30).rbox(11.4, 16, 12.4, 15.2, 22, 14.2, 1.0, { seg: 2 }); F.m(MAT.leather, 0x5A3A22).tube([[11.8, 21.6, 13.3], [13, 25.4, 13.0], [14.6, 21.6, 13.3]], 0.25, 0.25, { seg: 4, caps: 0 });
    F.m(MAT.wood, WOOD.oak).rbox(0, 5, 8, 16, 7, 16, 0.4, { seg: 1 }); F.m(MAT.metal, COL.black).rbox(1, 0, 9, 2, 5, 15, 0.25, { seg: 1 }).rbox(14, 0, 9, 15, 5, 15, 0.25, { seg: 1 });
    F.m(MAT.gloss, 0x2A2D33).rbox(3, 0, 9.5, 7, 2.6, 14, 1.0, { seg: 2 }); F.m(MAT.gloss, 0xE8E6E0).rbox(9, 0, 9.5, 13, 2.6, 14, 1.0, { seg: 2 });
    F.m(MAT.wood, P.walnut); F.far(0, 7, 14.5, 16, 32, 16); F.m(MAT.wood, WOOD.oak); F.far(0, 0, 8, 16, 7, 16);
    F.shadow(0, 7.5, 16, 16.5);
  });
  // the laundry basket: a woven basket (its bands lighter and darker), a cloth inside, a folded blue towel on it
  MD('laundry', [1, 1, 1], (F) => {
    for (let k = 0; k < 8; k++) { const y0 = k * 1.35, y1 = y0 + 1.35, r0 = 4.6 + 0.6 * y0 / 11, r1 = 4.6 + 0.6 * y1 / 11; F.m(MAT.wood, k & 1 ? 0xB08C5C : 0xC8A878).lathe(8, 8, [[y0, r0], [y1, r1]], { seg: 18, capBot: k === 0 }); }
    F.m(MAT.wood, 0xB08C5C).lathe(8, 8, [[10.8, 5.2], [11.2, 5.4], [11.4, 5.0]], { seg: 18 });
    F.m(MAT.fabric, 0xF4F0E8).sphere(8, 10.4, 8, 4.6, 1.6, 4.6, { seg: 8, lump: 0.2, seed: 31 });
    F.m(MAT.fabric, 0x4F7FB8).rbox(5, 11.2, 5, 11, 12.6, 11, 0.8, { seam: 0.86 });
    F.m(MAT.wood, 0xC8A878); F.far(2.8, 0, 2.8, 13.2, 11.4, 13.2);
    F.shadow(2.5, 2.5, 13.5, 13.5);
  });
  // the heated towel rail: a chrome ladder on the wall, a white and a sage towel over it
  MD('towelrail', [1, 1, 1], (F) => {
    F.m(MAT.metal, 0xD8DEE4).rod(3, 1, 15, 3, 15, 15, 0.45, { seg: 6 }).rod(13, 1, 15, 13, 15, 15, 0.45, { seg: 6 });
    for (let y = 2; y < 15; y += 1.6) F.rod(3, y, 15, 13, y, 15, 0.3, { seg: 5 });
    F.m(MAT.fabric, 0xF4F0E8).rbox(4, 7, 13.8, 12, 13.8, 15.2, 0.6, { mid: 3, bulge: { 4: 0.3 }, seam: 0.88 });
    F.m(MAT.fabric, 0x8FA38E).rbox(4.5, 3, 13.9, 11.5, 7.2, 15.2, 0.6, { mid: 3, bulge: { 4: 0.3 }, seam: 0.88 });
    F.m(MAT.metal, 0xD8DEE4); F.far(2.5, 1, 13.8, 13.5, 15, 15.5);
  });
  // the toy box: a white chest with an ash lid, a painted front, a ball, building blocks and a teddy on top
  MD('toybox', [1, 1, 1], (F) => {
    F.m(MAT.matte, 0xF2F2EE).rbox(1, 0, 2, 15, 8, 14, 0.5, { seg: 1, skip: B_BOT });
    F.m(MAT.wood, WOOD.ash).rbox(0.5, 8, 1.5, 15.5, 9, 14.5, 0.4, { seg: 1 });
    F.m(MAT.matte, 0x8FC8E8).box(2, 2, 1.85, 14, 6.5, 2.0); F.m(MAT.matte, 0xF2C84A).box(5, 3, 1.75, 11, 5.5, 1.85);
    F.m(MAT.gloss, 0xC0443A).sphere(4, 10.8, 8, 1.8, 1.8, 1.8, { seg: 7 });
    F.m(MAT.matte, 0x3F63A8).rbox(7, 9, 5, 10.6, 11.6, 8.6, 0.3, { seg: 1 }); F.m(MAT.matte, 0x3E8A4A).rbox(11.2, 9, 6, 13.8, 10.6, 8.6, 0.3, { seg: 1 });
    F.m(MAT.fabric, 0xC8A878).sphere(9.5, 10.8, 11.5, 2.0, 1.8, 1.6, { seg: 6 }).sphere(9.5, 13.4, 11.6, 1.4, 1.4, 1.3, { seg: 6 }).sphere(8.3, 14.5, 11.6, 0.5, 0.5, 0.4, { seg: 4 }).sphere(10.7, 14.5, 11.6, 0.5, 0.5, 0.4, { seg: 4 });
    F.m(MAT.matte, 0xF2F2EE); F.far(1, 0, 2, 15, 9, 14);
    F.shadow(0.5, 1.5, 15.5, 14.5);
  });
  // the washing machine: a white rounded box, the round door (a chrome ring round dark glass), the control panel with its
  // dial and a green light
  MD('washer', [1, 1, 1], (F) => {
    F.m(MAT.gloss, P.white).rbox(1, 0, 2, 15, 15, 16, 1.0, { seg: 2, skip: B_BOT });
    F.m(MAT.metal, 0xD8DEE4).tube(ringZ(8, 7, 1.6, 4.6, 32), 0.7, 0.7, { seg: 6, caps: 0 });
    F.m(MAT.gloss, 0x2A3A4E); discZ(F, 8, 7, 1.7, 4.0, 32);
    F.m(MAT.gloss, 0x2A2D33).box(2, 12.5, 1.85, 14, 14, 2); F.m(MAT.light, 0x2FD070).box(3, 13, 1.8, 5.5, 13.5, 1.85);
    F.m(MAT.metal, 0xD8DEE4).cyl(12, 13.2, 0, 0, 0.9, 0.9, { seg: 1 }); F.rod(12, 13.25, 1.85, 12, 13.25, 1.2, 0.85, { seg: 10 });
    F.m(MAT.gloss, P.white); F.far(1, 0, 2, 15, 15, 16);
    F.shadow(0.5, 1.5, 15.5, 16.5);
  });
  // the bronze sculpture on a marble plinth
  MD('sculpture', [1, 2, 1], (F) => {
    F.m(MAT.marble, COL.marble).rbox(4, 0, 4, 12, 15.6, 12, 0.3, { seg: 1, skip: B_BOT }).rbox(3.5, 15.4, 3.5, 12.5, 16, 12.5, 0.2, { seg: 1 });
    F.m(MAT.metal, 0x8A6A3A).lathe(8, 8, [[16, 2.2], [17, 1.2], [20, 1.6], [24, 2.8], [27, 1.4], [29.5, 2.2], [31, 0.8], [31.4, 0.01]], { seg: 16 });
    F.turn([['z', 0.4]], [8, 24, 8]); F.sphere(8, 24, 8, 3.8, 1.4, 2.4, { seg: 8 }); F.turn(null);
    F.m(MAT.marble, COL.marble); F.far(4, 0, 4, 12, 16, 12); F.m(MAT.metal, 0x8A6A3A); F.far(6, 16, 6, 10, 31, 10);
    F.shadow(3, 3, 13, 13);
  });
  // the Kentia palm in its pot (concrete or terracotta, tint 1): seven fronds arching from the pot, each a midrib with
  // pairs of slim leaflets that hang a little (two-sided cards)
  MD('palmpot', [1, 2, 1], (F) => {
    F.m(MAT.matte, 0xFFFFFF, 1).lathe(8, 8, [[0, 4.2], [0.5, 4.6], [7.2, 5.2], [7.8, 5.0], [7.8, 4.6], [7.4, 4.5]], { seg: 18, capBot: true });
    F.m(MAT.matte, COL.soil).lathe(8, 8, [[7.2, 4.55], [7.2, 0.01]], { seg: 18 });
    for (let k = 0; k < 7; k++) {
      const a = k * TAU / 7 + 0.2, ca = Math.cos(a), sa = Math.sin(a), lift = 2.6 + (k % 3) * 2.2, pts = [];
      for (let s = 0; s <= 8; s++) pts.push([8 + ca * s * 0.82, 7.2 + lift * Math.min(1, s / 2) + s * 2.7 - s * s * 0.27, 8 + sa * s * 0.82]);
      F.m(MAT.leaf, COL.stem).tube(pts, 0.3, 0.1, { seg: 4, caps: 0 });
      for (let s = 2; s < 8; s++) for (const sg of [-1, 1]) {
        const p = pts[s], q = pts[s + 1], d = norm3(sub(q, p)), side = norm3([-sa * sg, 0, ca * sg]), dir = norm3([side[0] * 0.75 + d[0] * 0.6, -0.3 + d[1] * 0.35, side[2] * 0.75 + d[2] * 0.6]);
        F.m(MAT.leaf, (s + k) & 1 ? 0x4E9A48 : 0x3E8A40); blade(F, p, dir, norm3(cross([0, 1, 0], dir)), 3.6 - (s - 2) * 0.32, 1.0, 0.7);
      }
    }
    F.m(MAT.matte, 0xFFFFFF, 1); F.far(2.8, 0, 2.8, 13.2, 7.8, 13.2); F.m(MAT.leaf, 0x3E8A40); F.far(2, 9, 2, 14, 20.5, 14);
    F.shadow(2.5, 2.5, 13.5, 13.5);
  });
  // the garden chair: a black metal frame, teak slats in the seat and the back, a cream cushion
  MD('gchair', [1, 1, 1], (F) => {
    F.m(MAT.metal, 0x2A2D33); for (const [x, z] of [[2.5, 2.5], [13.5, 2.5], [2.5, 13.5], [13.5, 13.5]]) F.cyl(x, z, 0, 8, 0.7, 0.6, { seg: 7 });
    F.rod(2.5, 8, 2.5, 2.5, 8, 13.5, 0.45, { seg: 6 }).rod(13.5, 8, 2.5, 13.5, 8, 13.5, 0.45, { seg: 6 }).rod(2.5, 8, 13.3, 2.5, 16, 13.7, 0.45, { seg: 6 }).rod(13.5, 8, 13.3, 13.5, 16, 13.7, 0.45, { seg: 6 });
    F.m(MAT.wood, 0xA8865A); for (let z = 2.5; z < 13; z += 1.6) F.rbox(1.6, 8, z, 14.4, 8.7, z + 1.1, 0.2, { seg: 1 });
    for (let y = 9.6; y < 16; y += 1.6) F.rbox(1.6, y, 12.8, 14.4, y + 1.1, 13.5, 0.2, { seg: 1 });
    F.m(MAT.fabric, 0xF4F0E8).rbox(2, 8.7, 2.5, 14, 10, 12.5, 0.8, { mid: 3, bulge: { 3: 0.3 }, seam: 0.86 });
    F.m(MAT.wood, 0xA8865A); F.far(1.6, 8, 2.5, 14.4, 10, 13.5); F.far(1.6, 9.6, 12.8, 14.4, 16, 13.7); F.m(MAT.metal, 0x2A2D33); F.far(2, 0, 2, 14, 8, 14);
    F.shadow(1.5, 1.5, 14.5, 14.5);
  });
  // the teak garden table: a slatted top, square legs, stretchers, a concrete pot with a plant
  MD('gtable', [2, 1, 1], (F) => {
    F.m(MAT.wood, 0xA8865A); for (let z = 0.5; z < 15.5; z += 2.5) F.rbox(0, 11.5, z, 32, 13, z + 2, 0.3, { seg: 1 });
    F.m(MAT.wood, 0x8E7048).box(0.6, 11, 0.8, 31.4, 11.5, 15.2);
    F.m(MAT.wood, 0xA8865A); for (const [x, z] of [[2, 2], [30, 2], [2, 14], [30, 14]]) F.rbox(x - 1, 0, z - 1, x + 1, 11, z + 1, 0.25, { seg: 1 });
    F.rbox(1, 7, 1.5, 31, 8, 2.5, 0.2, { seg: 1 }).rbox(1, 7, 13.5, 31, 8, 14.5, 0.2, { seg: 1 });
    F.m(MAT.matte, 0x6E7076).lathe(16, 8, [[13, 2.2], [14, 2.5], [16, 1.8]], { seg: 12, capBot: true, capTop: true }); F.m(MAT.leaf, 0x7E9A62).sphere(16, 17.6, 8, 2.4, 2.0, 2.4, { seg: 7, lump: 0.25, seed: 41 });
    F.m(MAT.wood, 0xA8865A); F.far(0, 11, 0.5, 32, 13, 15.5); F.far(1, 0, 1, 3, 11, 15); F.far(29, 0, 1, 31, 11, 15);
    F.shadow(-0.5, -0.5, 32.5, 16.5);
  });
  // the rattan outdoor sofa: a woven base and back (bands of two browns), low arms, cream cushions, two pillows
  MD('osofa', [2, 1, 1], (F) => {
    for (let k = 0; k < 4; k++) F.m(MAT.wood, k & 1 ? 0x7A6040 : 0x8A7050).rbox(0, 1.5 + k * 1.4, 0, 32, 2.9 + k * 1.4, 16, 0.5, { seg: 1, skip: k ? B_BOT : 0 });
    for (let k = 0; k < 4; k++) F.m(MAT.wood, k & 1 ? 0x7A6040 : 0x8A7050).rbox(0, 7 + k * 1.5, 12, 32, 8.5 + k * 1.5, 16, 0.5, { seg: 1 });
    F.m(MAT.wood, 0x8A7050).rbox(0, 7, 0, 2.5, 10, 12, 0.6, { seg: 1 }).rbox(29.5, 7, 0, 32, 10, 12, 0.6, { seg: 1 });
    F.m(MAT.fabric, 0xE8E2D4).rbox(2.5, 7, 0.5, 29.5, 9.5, 12, 1.2, { mid: 4, bulge: { 3: 0.4 }, seam: 0.84 });
    F.turn([['x', 0.12]], [16, 9, 13]); F.rbox(2.5, 9, 10, 29.5, 15, 13, 1.5, { mid: 4, bulge: { 4: 0.5 }, seam: 0.84 }); F.turn(null);
    for (const [x, c] of [[8, 0x2F7A6A], [24, 0xD2A84A]]) { F.m(MAT.fabric, c); F.turn([['x', 0.3]], [x, 9.5, 9]); F.rbox(x - 2.6, 9.5, 8, x + 2.6, 14.6, 10, 1.1, { mid: 3, bulge: { 4: 0.6, 5: 0.6 }, seam: 0.82 }); F.turn(null); }
    F.m(MAT.wood, 0x8A7050); F.far(0, 1.5, 0, 32, 7, 16); F.far(0, 7, 12, 32, 13, 16); F.m(MAT.fabric, 0xE8E2D4); F.far(2.5, 7, 0.5, 29.5, 9.5, 12);
    F.shadow(-0.5, -0.5, 32.5, 16.5);
  });
  // the fire pit (two by two): a concrete bowl, dark lava stones, the fire's glowing cones
  MD('firepit', [2, 1, 2], (F) => {
    F.m(MAT.matte, 0x5A5C62).lathe(16, 16, [[0, 11], [2, 11.5], [7, 12.5], [8, 12], [7.6, 11.2], [6, 10.6]], { seg: 28, capBot: true });
    F.m(MAT.matte, 0x2A2D33).lathe(16, 16, [[6, 10.6], [6, 0.01]], { seg: 28 });
    for (let k = 0; k < 14; k++) { const a = k * 2.4, r = 2 + (k % 5) * 1.6; F.m(MAT.gloss, 0x1A1A1C).sphere(16 + Math.cos(a) * r, 6.4, 16 + Math.sin(a) * r, 0.9, 0.6, 0.9, { seg: 4 }); }
    F.m(MAT.light, 0xFF7A20).lathe(16, 16, [[6, 6], [8.5, 4.5], [11, 2.2], [13, 0.01]], { seg: 14 }); F.m(MAT.light, 0xFFC040).lathe(16, 16, [[6.5, 3.5], [9, 2], [10.5, 0.01]], { seg: 12 });
    F.m(MAT.matte, 0x5A5C62); F.far(3.5, 0, 3.5, 28.5, 8, 28.5);
    F.shadow(2, 2, 30, 30);
  });
  // the cantilever parasol (three by three, two high): a concrete base, the mast, the arm, the cloth canopy and its ribs
  MD('parasol', [3, 2, 3], (F) => {
    F.m(MAT.matte, 0x6E7076).rbox(36, 0, 36, 46, 1.6, 46, 0.4, { seg: 1, skip: B_BOT });
    F.m(MAT.metal, 0x3A3D44).cyl(41, 41, 1.6, 28, 1.0, 0.9, { seg: 10 }).rod(41, 28, 41, 24, 31, 24, 0.85, { seg: 8 }).rod(24, 31, 24, 24, 24, 24, 0.5, { seg: 6 });
    F.m(MAT.fabric, 0xE8E2D4).lathe(24, 24, [[24.4, 22.6], [26.6, 19.4], [29.6, 11.4], [31.4, 1.4], [31.6, 0.01]], { seg: 24, capBot: false });
    F.m(MAT.fabric, 0xD8D2C4).lathe(24, 24, [[24.2, 22.4], [26.4, 19.2], [29.4, 11.2], [31.2, 1.2], [31.4, 0.01]], { seg: 24, flip: true });
    F.m(MAT.metal, 0x3A3D44); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; F.rod(24, 31, 24, 24 + Math.cos(a) * 21.5, 25.6, 24 + Math.sin(a) * 21.5, 0.3, { seg: 5 }); }
    F.m(MAT.fabric, 0xE8E2D4); F.far(1.4, 24.4, 1.4, 46.6, 31.6, 46.6); F.m(MAT.metal, 0x3A3D44); F.far(40, 0, 40, 42, 28, 42);
    F.shadow(35, 35, 47, 47);
  });

  // Villa Nova's light pad (shot G: t1_29, t1_30 — the pool-like pad in the white hall): a white plinth with round corners
  // on a cyan light line, its top recessed and glowing blue, darker at the rim, the cyan ring emblem in it
  MD('novapad', [3, 1, 3], (F) => {
    F.m(MAT.light, 0x3AF0FF).rbox(2.5, 0, 2.5, 45.5, 1.5, 45.5, 4.5, { seg: 3, skip: B_BOT });
    F.m(MAT.matte, 0xF6F7FA).rbox(1, 1.5, 1, 47, 11, 5, 3.6, { seg: 3, skip: 0 }).rbox(1, 1.5, 43, 47, 11, 47, 3.6, { seg: 3 }).rbox(1, 1.5, 5, 5, 11, 43, 1.6, { seg: 2 }).rbox(43, 1.5, 5, 47, 11, 43, 1.6, { seg: 2 });
    F.m(MAT.matte, 0xE8ECF2).box(5, 1.5, 5, 43, 8.4, 43);
    F.m(MAT.light, 0x0E2C78).box(5, 8.4, 5, 43, 8.6, 43);
    F.m(MAT.light, 0x1A50B8).lathe(24, 24, [[8.62, 16.5], [8.66, 15.5], [8.7, 0.01]], { seg: 40 });
    F.m(MAT.light, 0x3AF0FF);
    for (const [r, w] of [[12.3, 0.7], [8.0, 0.55]]) F.tube(loop(24, 24, r, 9.0, 48), w, w, { seg: 6, caps: 0 });
    F.cyl(24, 24, 8.6, 9.4, 2.4, 2.4, { seg: 18, caps: 2 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; F.rod(24 + Math.cos(a) * 3.4, 9.0, 24 + Math.sin(a) * 3.4, 24 + Math.cos(a) * 7.2, 9.0, 24 + Math.sin(a) * 7.2, 0.4, { seg: 5 }); }
    F.m(MAT.matte, 0xF6F7FA); F.far(1, 0, 1, 47, 11, 47);
    F.shadow(0, 0, 48, 48);
  });
  // the fountain's centre (the mansion's hall, the plazas, the park): a round stone basin with a rolled rim and water in
  // it, a turned column, an upper bowl brimming over in thin glassy streams, the jet on top
  MD('fountain', [1, 1, 1], (F) => {
    const ST = 0xCBC6BA;
    F.m(MAT.marble, ST).lathe(8, 8, [[0, 7.3], [0.5, 7.75], [2.9, 7.85], [3.5, 7.6], [3.6, 6.9], [3.3, 6.6], [1.4, 6.45]], { seg: 28, capBot: true });
    F.m(MAT.glass, P.water).lathe(8, 8, [[2.9, 6.55], [2.9, 0.01]], { seg: 28 });
    F.m(MAT.marble, ST).lathe(8, 8, [[2.8, 1.9], [3.6, 1.5], [7.4, 1.1], [8.6, 1.5], [9.2, 2.6], [10.2, 4.4], [10.9, 5.1], [11.3, 5.0], [11.1, 4.6]], { seg: 22 });
    F.m(MAT.glass, P.water).lathe(8, 8, [[10.95, 4.7], [10.95, 0.01]], { seg: 22 });
    F.m(MAT.glass, 0xBFEFFF);
    for (let k = 0; k < 10; k++) { const a = k * TAU / 10 + 0.16, c = Math.cos(a), s = Math.sin(a), pts = []; for (let t = 0; t <= 5; t++) { const u = t / 5, r = 5.25 + 0.95 * Math.sqrt(u); pts.push([8 + c * r, 11.1 - 8.2 * u * u, 8 + s * r]); } F.tube(pts, 0.24, 0.3, { seg: 4, caps: 0 }); }
    F.m(MAT.marble, ST).cyl(8, 8, 10.9, 12.0, 0.75, 0.55, { seg: 10 });
    F.m(MAT.glass, 0xDDF6FF).lathe(8, 8, [[12.0, 0.5], [13.4, 0.42], [14.3, 0.2], [14.5, 0.01]], { seg: 10, capBot: true });
    F.m(MAT.marble, ST); F.far(0.3, 0, 0.3, 15.7, 3.6, 15.7); F.far(6.6, 3.6, 6.6, 9.4, 9.2, 9.4); F.far(2.9, 9.2, 2.9, 13.1, 11.3, 13.1);
    F.shadow(-0.5, -0.5, 16.5, 16.5);
  });
  // the garden path light (the villas' pool edge, the towers' roofs): a black post on a round foot, an opal drum glowing
  // warm, a black cap
  MD('glamp', [1, 1, 1], (F) => {
    F.m(MAT.metal, P.black).cyl(8, 8, 0, 0.6, 2.8, 2.6, { seg: 14, caps: 2 }).cyl(8, 8, 0.6, 9.3, 1.3, 1.3, { seg: 10, caps: 0 });
    F.cyl(8, 8, 9.2, 9.7, 3.1, 3.1, { seg: 16, caps: 3 });
    F.m(MAT.light, 0xFFE2A8).cyl(8, 8, 9.7, 12.2, 2.85, 2.85, { seg: 16, caps: 0 });
    F.m(MAT.metal, P.black).lathe(8, 8, [[12.2, 3.5], [12.7, 3.7], [13.3, 3.3], [13.8, 0.01]], { seg: 16, capBot: true });
    F.far(6.7, 0, 6.7, 9.3, 9.7, 9.3); F.m(MAT.light, 0xFFE2A8); F.far(4.6, 9.7, 4.6, 11.4, 12.2, 11.4); F.m(MAT.metal, P.black); F.far(4.4, 12.2, 4.4, 11.6, 13.8, 11.6);
    F.shadow(4.5, 4.5, 11.5, 11.5);
  });
  // the village kitchen's cast-iron stove: a rounded iron body on four feet, the fire door's glass glowing, the ash
  // drawer, a top plate with two hot plates, the flue collar at the back
  MD('vstove', [1, 1, 1], (F) => {
    const IRON = 0x45484F;
    F.m(MAT.metal, 0x2A2C30); for (const [x, z] of [[2.4, 2.6], [13.6, 2.6], [2.4, 13.6], [13.6, 13.6]]) F.cyl(x, z, 0, 1.7, 0.85, 0.7, { seg: 8, caps: 2 });
    F.m(MAT.matte, IRON).rbox(0.6, 1.6, 0.8, 15.4, 12.6, 15.4, 1.0, { seg: 2 });
    F.m(MAT.metal, 0x2E3036).rbox(0.2, 12.6, 0.4, 15.8, 13.8, 15.8, 0.5, { seg: 1 });
    F.m(MAT.metal, 0x1E2024).cyl(5.2, 9.6, 13.8, 14.2, 2.6, 2.6, { seg: 16, caps: 2 }).cyl(11.2, 6.4, 13.8, 14.2, 2.2, 2.2, { seg: 16, caps: 2 });
    F.m(MAT.metal, 0x2A2C30).rbox(3.4, 3.2, 0.3, 12.6, 10.6, 1.0, 0.45, { seg: 1 }).rbox(4.0, 1.9, 0.4, 12.0, 2.9, 1.0, 0.25, { seg: 1 });
    F.m(MAT.light, 0xFF8A3A).box(4.6, 4.4, 0.18, 11.4, 9.2, 0.32);
    F.m(MAT.metal, 0x1E2024).box(6.8, 4.4, 0.1, 7.2, 9.2, 0.2).box(8.8, 4.4, 0.1, 9.2, 9.2, 0.2).rod(13.3, 5.2, 0.6, 13.3, 8.6, 0.6, 0.35, { seg: 6 });
    F.m(MAT.metal, 0x2E3036).cyl(4, 12, 13.8, 16, 1.7, 1.6, { seg: 12, caps: 0 }).cyl(4, 12, 13.8, 14.4, 2.2, 2.2, { seg: 12, caps: 2 });
    F.m(MAT.matte, IRON); F.far(0.6, 0, 0.8, 15.4, 13.8, 15.4);
    F.shadow(-0.5, -0.5, 16.5, 16.5);
  });
  // the village kitchen's counter: a wooden cabinet (tint 1) on a dark kick, two doors with knobs under a drawer, a pale
  // stone top, a cutting board on it
  MD('vkcounter', [1, 1, 1], (F) => {
    F.m(MAT.matte, 0x4A3A2A).box(0.8, 0, 2.2, 15.2, 1.2, 15.6, B_BOT);
    F.m(MAT.wood, 0xFFFFFF, 1).rbox(0, 1.2, 1.2, 16, 12.2, 16, 0.3, { seg: 1 });
    F.m(MAT.wood, 0xF2F2F2, 1).rbox(0.4, 9.2, 0.6, 15.6, 11.8, 1.3, 0.3, { seam: 0.9 }).rbox(0.4, 1.6, 0.6, 7.85, 8.9, 1.3, 0.3, { seam: 0.9 }).rbox(8.15, 1.6, 0.6, 15.6, 8.9, 1.3, 0.3, { seam: 0.9 });
    F.m(MAT.metal, 0x3A3026); for (const [x, y] of [[6.6, 7.4], [9.4, 7.4], [8, 10.5]]) F.sphere(x, y, 0.35, 0.45, 0.45, 0.4, { seg: 5 });
    F.m(MAT.marble, 0xD8D2C4).rbox(-0.2, 12.2, 0, 16.2, 13.6, 16, 0.35, { seg: 1 });
    F.m(MAT.wood, 0xC8A070).rbox(2.4, 13.6, 4.2, 8.6, 14.1, 8.8, 0.3, { seg: 1 });
    F.m(MAT.wood, 0xFFFFFF, 1); F.far(0, 0, 0.6, 16, 13.6, 16);
    F.shadow(-0.5, -0.5, 16.5, 16.5);
  });
  // the tech houses' suit locker: a steel cabinet, two doors (tint 1) with louvres at the top and bar handles, the dark
  // seam between them, a green status light
  MD('locker', [1, 1, 1], (F) => {
    F.m(MAT.metal, 0x8E98A2).rbox(0, 0, 4, 16, 16, 16, 0.5, { seg: 1 });
    F.m(MAT.metal, 0xFFFFFF, 1).rbox(0.5, 0.5, 3.4, 7.8, 15.5, 4.4, 0.3, { seam: 0.9 }).rbox(8.2, 0.5, 3.4, 15.5, 15.5, 4.4, 0.3, { seam: 0.9 });
    F.m(MAT.matte, 0x3A3F46); for (const x0 of [1.6, 9.3]) for (let k = 0; k < 4; k++) F.box(x0, 10.6 + k * 1.05, 3.2, x0 + 5.1, 11.05 + k * 1.05, 3.45);
    F.m(MAT.metal, 0x2A2D33).rod(6.6, 5.6, 3.1, 6.6, 8.4, 3.1, 0.3, { seg: 6 }).rod(9.4, 5.6, 3.1, 9.4, 8.4, 3.1, 0.3, { seg: 6 });
    F.m(MAT.light, 0x3AE07A).box(1.8, 1.8, 3.2, 2.8, 2.6, 3.4);
    F.m(MAT.metal, 0x8E98A2); F.far(0, 0, 3.4, 16, 16, 16);
    F.shadow(-0.5, 3, 16.5, 16.5);
  });
  // the villages' arc lamp in one block: a black dome foot in the back corner, the stem rising and arching over to the
  // front corner, a black dome shade glowing underneath
  MD('varclamp', [1, 1, 1], (F) => {
    F.m(MAT.gloss, P.black).lathe(11, 11, [[0, 3.0], [0.5, 3.0], [1.0, 2.3], [1.3, 0.01]], { seg: 16 });
    const pts = []; for (let t = 0; t <= 12; t++) { const a = t / 12 * Math.PI / 2; pts.push([11 - 6.6 * (1 - Math.cos(a)), 1.2 + 12.2 * Math.sin(a), 11 - 6.6 * (1 - Math.cos(a))]); }
    F.m(MAT.metal, P.black).tube(pts, 0.42, 0.36, { seg: 6, caps: 0 }).rod(4.4, 13.4, 4.4, 4.4, 12.4, 4.4, 0.3, { seg: 5 });
    glowShade(F, 4.4, 4.4, [[8.6, 3.7], [9.6, 3.6], [11.2, 2.9], [12.2, 1.7], [12.7, 0.01]], [[8.7, 3.4], [9.6, 3.3], [11.0, 2.6], [11.9, 1.4], [12.3, 0.01]], MAT.gloss, P.black);
    F.m(MAT.light, 0xFFF2D0).sphere(4.4, 9.5, 4.4, 1.1, 1.2, 1.1, { seg: 6 });
    F.m(MAT.gloss, P.black); F.far(8, 0, 8, 14, 1.3, 14); F.far(10.4, 1.3, 10.4, 11.6, 7.5, 11.6); F.far(5, 7.5, 5, 11, 13.4, 11); F.far(0.7, 8.6, 0.7, 8.1, 12.7, 8.1);
    F.shadow(7.5, 7.5, 14.5, 14.5);
  });

  // ---------------------------------------------------------------- the pieces: block type → model and its two colours
  // (vary: the model's variant from the anchor's bits — a row's neighbours, a lantern's hanging; kind = PROP_FURN0 + the
  // name's index in the mesher's list)
  const row = (j) => j & 3, one = (j) => j & 1;
  Object.assign(FDEF, {
    vm_curtain: { model: 'curtain', a: 0xE8E2D4 }, vx_curtain: { model: 'curtain', a: 0xE8E2D4 }, vx_curtain_grey: { model: 'curtain', a: 0x8A8E96 },
    vm_fridge: { model: 'fridge' }, vx_fridge: { model: 'fridge' }, vm_kitchen_fridge_french: { model: 'fridge:fr' },
    vm_dishwasher: { model: 'dishwasher', a: 0xF2F2EE }, vm_range_hood: { model: 'hood' }, vm_kitchen_hood_island: { model: 'hood:island', a: 0x1C1E22 },
    vx_art_warm: { model: 'vart:warm' }, vx_art_cool: { model: 'vart:cool' }, vx_art_gold: { model: 'vart:gold' },
    vm_art_abstract: { model: 'art:abstract' }, vm_art_landscape: { model: 'art:landscape' }, vm_art_photo: { model: 'art:photo' },
    vm_mirror: { model: 'mirror:floor' }, vm_mirror_round: { model: 'mirror:round' }, vx_mirror: { model: 'vmirror' },
    vm_desk: { model: 'desk' }, vx_tech_desk: { model: 'tdesk' }, vx_school_desk: { model: 'sdesk', a: 0x3F6AC0 },
    vm_wardrobe: { model: 'wardrobe' }, vm_wardrobe_walnut: { model: 'wardrobe:walnut' }, vx_wardrobe: { model: 'vwardrobe:lacquer', a: 0xF2F2EE }, vx_wardrobe_walnut: { model: 'vwardrobe:wood', a: 0x6A4426 },
    vx_chandelier: { model: 'vchandelier' }, vx_lantern: { model: 'lantern', a: 0xFFD27A, vary: one }, vx_lantern_crystal: { model: 'lantern', a: 0xC08AFF, vary: one },
    vx_pendant: { model: 'vpendant', a: 0x1C1E22 }, vx_pendant_brass: { model: 'vpendant', a: 0xC8A048 }, vx_sconce: { model: 'sconce' }, vx_floorlamp: { model: 'vfloorlamp' },
    vx_nightstand: { model: 'nightstand' }, vx_bookshelf: { model: 'vbooks:l', a: 0xF2F2EE }, vx_bookshelf_walnut: { model: 'vbooks:w', a: 0x6A4426 },
    vx_tall_plant: { model: 'vplant', a: 0xF2F2EE }, vx_tall_plant_black: { model: 'vplant', a: 0x1C1E22 }, vx_vanity: { model: 'vvanity' }, vx_upper_cabinet: { model: 'vupper', a: 0xF2F2EE, vary: row },
    vx_toilet: { model: 'vtoilet' }, vx_kitchen_island: { model: 'vcounter:p', a: 0xF2F2EE, vary: row }, vx_kitchen_island_dark: { model: 'vcounter:p', a: 0x2E3136, vary: row },
    vx_kitchen_sink: { model: 'vcounter:s', a: 0xF2F2EE, vary: row }, vx_kitchen_hob: { model: 'vcounter:h', a: 0xF2F2EE, vary: row },
    vx_coffee_table: { model: 'vcoffee:glass' }, vx_coffee_table_marble: { model: 'vcoffee:marble' }, vx_bathtub: { model: 'vtub', vary: row }, vx_bench: { model: 'vbench', a: 0xA87A48 },
    vx_dining_table: { model: 'vdtable:w', a: 0x6A4426, b: 0x1C1E22, vary: row }, vx_dining_table_white: { model: 'vdtable:m', a: 0xEAEAEC, b: 0xF2F2EE, vary: row },
    vx_dining_chair: { model: 'vdchair', a: 0xD8D0C0, b: 0x1C1E22 }, vx_dining_chair_teal: { model: 'vdchair', a: 0x2F9C98, b: 0xC8A048 }, vx_tv_wall: { model: 'vtvwall', vary: row },
    vx_stool: { model: 'vstool', a: 0x3A6AD8 }, vx_stool_orange: { model: 'vstool', a: 0xFF7A1A }, vx_urn: { model: 'urn', a: 0xB4B0A6 }, vx_urn_white: { model: 'urn', a: 0xF2F2EE },
    vx_tech_planter: { model: 'tplanter' }, vx_potplant: { model: 'potplant' },
    vm_sideboard: { model: 'sideboard' }, vm_dresser: { model: 'dresser' }, vm_bench: { model: 'bench' }, vm_dining_bench: { model: 'dbench' }, vm_wall_shelf: { model: 'wallshelf' }, vm_kitchen_shelf: { model: 'kshelf' },
    vm_office_chair: { model: 'ochair' }, vm_vanity: { model: 'vanity' }, vm_toilet: { model: 'toilet' }, vm_bathtub: { model: 'bathtub' }, vm_shower: { model: 'shower' }, vm_bed_single: { model: 'bed1' },
    vm_bunk_bed: { model: 'bunk' }, vm_fireplace: { model: 'fireplace' }, vm_piano: { model: 'piano' }, vm_lounger: { model: 'lounger' }, vm_coat_rack: { model: 'coatrack' }, vm_laundry_basket: { model: 'laundry' },
    vm_towel_rail: { model: 'towelrail' }, vm_toy_box: { model: 'toybox' }, vm_washer: { model: 'washer' }, vm_sculpture: { model: 'sculpture' },
    vm_plant_palm_concrete: { model: 'palmpot', a: 0xB4B0A6 }, vm_plant_palm_terracotta: { model: 'palmpot', a: 0xB0633C },
    vm_garden_chair: { model: 'gchair' }, vm_garden_table: { model: 'gtable' }, vm_outdoor_sofa: { model: 'osofa' }, vm_fire_pit: { model: 'firepit' }, vm_parasol: { model: 'parasol' },
    vm_nova_pad: { model: 'novapad' }, vx_fountain: { model: 'fountain' }, vx_garden_lamp: { model: 'glamp' }, vx_arc_lamp: { model: 'varclamp' },
    vx_stove: { model: 'vstove' }, vx_counter: { model: 'vkcounter', a: 0xB08A5A }, vx_shelf: { model: 'vbooks:w', a: 0x8A5E32 }, vx_locker: { model: 'locker', a: 0xB4BEC8 },
  });
  for (const [k, col, pil] of [['charcoal', 0x3A3D44, 0xE8D8B8], ['cream', 0xEDE6D6, 0x3A3D44], ['taupe', 0xA89482, 0xF2F2EE], ['white', 0xECEEF2, 0xFF8A2A]]) FDEF['vx_sofa_corner_' + k] = { model: 'vcorner', a: col, b: pil, vary: one };
  // a piece with a vary rule takes its variant from the anchor's bits (facing >> 2); the others as props.js says
  const baseKey = PR.furnKey;
  PR.furnKey = function (kind, facing) { const d = PR.furnDef(kind); if (d && d.vary) return d.model + ':' + d.vary((facing | 0) >> 2); return baseKey(kind, facing); };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

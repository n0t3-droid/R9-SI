// ============================================================================
// Model builders for non-cube shapes. All coordinates in 1/16 block units.
// Facing index order: 0 north(-z) 1 east(+x) 2 south(+z) 3 west(-x)
// ============================================================================
(function (VR) {
  'use strict';
  const MD = VR.MODEL, R = VR.R, T = R.tex;
  const { box, quad, rotY, rotX, flipY, cross } = MD;

  // Generic rotation around an axis through origin (1/16 units) by degrees
  function rotate(faces, axis, deg, ox, oy, oz) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    ox /= 16; oy /= 16; oz /= 16;
    return faces.map(f => {
      const p = f.p.slice();
      for (let i = 0; i < 12; i += 3) {
        let x = p[i] - ox, y = p[i + 1] - oy, z = p[i + 2] - oz;
        if (axis === 'x') { const ny = y * c - z * s, nz = y * s + z * c; y = ny; z = nz; }
        else if (axis === 'y') { const nx = x * c + z * s, nz = -x * s + z * c; x = nx; z = nz; }
        else { const nx = x * c - y * s, ny = x * s + y * c; x = nx; y = ny; }
        p[i] = x + ox; p[i + 1] = y + oy; p[i + 2] = z + oz;
      }
      return Object.assign({}, f, { p, cull: -1 });
    });
  }
  MD.rotate = rotate;
  const cat = (...a) => [].concat(...a);
  MD.cat = cat;
  const withFlags = (faces, flags) => faces.map(f => Object.assign({}, f, { flags: (f.flags || 0) | flags }));
  MD.withFlags = withFlags;
  const withLayer = (faces, layer) => faces.map(f => Object.assign({}, f, { layer }));
  MD.withLayer = withLayer;
  const withTint = (faces, tint) => faces.map(f => Object.assign({}, f, { tint }));
  MD.withTint = withTint;

  // Face-flag bits carried into vertex flags (see mesher)
  const FF = VR.FFLAG = { WAVE: 1, WAVELEAF: 2, EMIT: 4, NOSHADE: 8, WATER: 16, LAVA: 32, PORTAL: 64, STARS: 128 };

  // ---------------- doors / trapdoors / gates ----------------
  VR.doorModel = function (p, tex) {
    // base: facing east → closed panel at west edge
    let b;
    if (!p.open) b = [0, 0, 0, 3, 16, 16];
    else b = p.hinge === 0 ? [0, 0, 0, 16, 16, 3] : [0, 0, 13, 16, 16, 16];
    return rotY(box(b, tex), p.facing - 1);
  };
  VR.trapdoorModel = function (p, tex) {
    let f;
    if (!p.open) f = p.half ? box([0, 13, 0, 16, 16, 16], tex) : box([0, 0, 0, 16, 3, 16], tex);
    else f = rotY(box([0, 0, 13, 16, 16, 16], tex), p.facing);
    return f;
  };
  VR.gateModel = function (p, tex) {
    let f;
    if (!p.open) {
      f = cat(box([0, 5, 7, 2, 16, 9], tex), box([14, 5, 7, 16, 16, 9], tex),
        box([2, 6, 7, 14, 9, 9], tex), box([2, 12, 7, 14, 15, 9], tex),
        box([6, 9, 7, 8, 12, 9], tex), box([8, 9, 7, 10, 12, 9], tex));
    } else {
      f = cat(box([0, 5, 7, 2, 16, 9], tex), box([14, 5, 7, 16, 16, 9], tex),
        box([0, 6, 1, 2, 9, 7], tex), box([0, 12, 1, 2, 15, 7], tex), box([0, 9, 1, 2, 12, 3], tex),
        box([14, 6, 1, 16, 9, 7], tex), box([14, 12, 1, 16, 15, 7], tex), box([14, 9, 1, 16, 12, 3], tex));
    }
    return rotY(f, p.facing);
  };
  // ---------------- buttons / plates / levers ----------------
  VR.buttonModel = function (p, tex) {
    const d = p.powered ? 1 : 2;
    let f;
    if (p.face === 0) f = rotY(box([5, 0, 6, 11, d, 10], tex), p.facing);
    else if (p.face === 2) f = rotY(box([5, 16 - d, 6, 11, 16, 10], tex), p.facing);
    else f = rotY(box([5, 6, 16 - d, 11, 10, 16], tex), p.facing);
    return f;
  };
  VR.plateModel = function (p, tex) {
    return box([1, 0, 1, 15, p.powered ? 0.5 : 1, 15], tex);
  };
  VR.leverModel = function (p, baseTex, handleTex) {
    const huv = { 2: [7, 6, 9, 8], 3: [7, 6, 9, 8], 4: [7, 6, 9, 16], 5: [7, 6, 9, 16], 0: [7, 6, 9, 16], 1: [7, 6, 9, 16] };
    const base = cat(box([5, 0, 4, 11, 3, 12], baseTex, { cull: false }),
      rotate(box([7, 1, 7, 9, 11, 9], handleTex, { uv: huv, cull: false }), 'x', p.powered ? 40 : -40, 8, 1, 8));
    if (p.face === 0) return rotY(base, p.facing);
    if (p.face === 2) return rotY(flipY(base), p.facing);
    return rotY(rotX(base, 1), p.facing - 2);
  };

  // ---------------- torches ----------------
  // face: 0 floor, 1..4 wall facing (n,e,s,w) → torch leans toward facing, attached to opposite block
  VR.torchModel = function (face, tex) {
    const uv = { 2: [7, 6, 9, 8], 3: [7, 14, 9, 16], 0: [7, 6, 9, 16], 1: [7, 6, 9, 16], 4: [7, 6, 9, 16], 5: [7, 6, 9, 16] };
    const fl = VR.FFLAG.EMIT * 0;
    let f = box([7, 0, 7, 9, 10, 9], tex, { uv, cull: false, flags: fl });
    if (face === 0) return f;
    // wall torch: base model faces east (attached to west block)
    f = box([-1, 3.5, 7, 1, 13.5, 9], tex, { uv, cull: false, flags: fl });
    f = rotate(f, 'z', -22.5, 0, 3.5, 8);
    return rotY(f, (face - 1) - 1);
  };
  // ---------------- lanterns ----------------
  VR.lanternModel = function (hanging, tex) {
    const o = hanging ? 1 : 0;
    const f = cat(
      box([5, 0 + o, 5, 11, 7 + o, 11], tex, { cull: false, uv: { 0: [0, 2, 6, 9], 1: [0, 2, 6, 9], 4: [0, 2, 6, 9], 5: [0, 2, 6, 9], 2: [0, 9, 6, 15], 3: [0, 9, 6, 15] } }),
      box([6, 7 + o, 6, 10, 9 + o, 10], tex, { cull: false, uv: { 0: [1, 0, 5, 2], 1: [1, 0, 5, 2], 4: [1, 0, 5, 2], 5: [1, 0, 5, 2], 2: [1, 10, 5, 14], 3: [1, 10, 5, 14] } })
    );
    if (hanging) {
      f.push(quad([[6.5, 16, 8], [6.5, 10, 8], [9.5, 10, 8], [9.5, 16, 8]], tex, [11, 1, 14, 7], 4, { double: true }));
      f.push(quad([[8, 16, 9.5], [8, 10, 9.5], [8, 10, 6.5], [8, 16, 6.5]], tex, [11, 1, 14, 7], 0, { double: true }));
    } else {
      f.push(quad([[6.5, 11, 8], [6.5, 9, 8], [9.5, 9, 8], [9.5, 11, 8]], tex, [11, 10, 14, 12], 4, { double: true }));
    }
    return f;
  };
  VR.chainModel = function (axis, tex) {
    let f = [
      quad([[6.5, 16, 8], [6.5, 0, 8], [9.5, 0, 8], [9.5, 16, 8]], tex, [0, 0, 3, 16], 4, { double: true }),
      quad([[8, 16, 9.5], [8, 0, 9.5], [8, 0, 6.5], [8, 16, 6.5]], tex, [3, 0, 6, 16], 0, { double: true }),
    ];
    if (axis === 1) f = rotate(f, 'z', 90, 8, 8, 8);
    else if (axis === 2) f = rotate(f, 'x', 90, 8, 8, 8);
    return f;
  };
  // ---------------- flat / thin ----------------
  VR.carpetModel = (tex, h) => box([0, 0, 0, 16, h || 1, 16], tex);
  VR.layerModel = (layers, tex) => box([0, 0, 0, 16, layers * 2, 16], tex);
  VR.ladderModel = function (facing, tex) {
    // facing north → attached to the south block → plane near z=16
    return rotY([quad([[0, 16, 15.2], [0, 0, 15.2], [16, 0, 15.2], [16, 16, 15.2]], tex, [0, 0, 16, 16], 5, { double: true })], facing);
  };
  // bitmask faces: 1 north 2 east 4 south 8 west 16 up 32 down; plane offset d
  VR.faceSheetModel = function (mask, tex, d, opts) {
    d = d === undefined ? 0.8 : d;
    const f = [];
    const o = Object.assign({ double: true }, opts || {});
    if (mask & 1) f.push(quad([[16, 16, d], [16, 0, d], [0, 0, d], [0, 16, d]], tex, [0, 0, 16, 16], 4, o));
    if (mask & 4) f.push(quad([[0, 16, 16 - d], [0, 0, 16 - d], [16, 0, 16 - d], [16, 16, 16 - d]], tex, [0, 0, 16, 16], 5, o));
    if (mask & 2) f.push(quad([[16 - d, 16, 16], [16 - d, 0, 16], [16 - d, 0, 0], [16 - d, 16, 0]], tex, [0, 0, 16, 16], 1, o));
    if (mask & 8) f.push(quad([[d, 16, 0], [d, 0, 0], [d, 0, 16], [d, 16, 16]], tex, [0, 0, 16, 16], 0, o));
    if (mask & 16) f.push(quad([[0, 16 - d, 0], [0, 16 - d, 16], [16, 16 - d, 16], [16, 16 - d, 0]], tex, [0, 0, 16, 16], 3, o));
    if (mask & 32) f.push(quad([[0, d, 16], [0, d, 0], [16, d, 0], [16, d, 16]], tex, [0, 0, 16, 16], 2, o));
    return f;
  };
  // flat ground pieces (leaf litter, petals, wildflowers): count 1..4 quadrants
  VR.groundCoverModel = function (count, facing, tex) {
    const qs = [[0, 0, 8, 8], [8, 0, 16, 8], [8, 8, 16, 16], [0, 8, 8, 16]];
    const f = [];
    for (let i = 0; i < count; i++) {
      const [x0, z0, x1, z1] = qs[i];
      f.push(quad([[x0, 0.6, z0], [x0, 0.6, z1], [x1, 0.6, z1], [x1, 0.6, z0]], tex, [x0, z0, x1, z1], 2, { double: true }));
    }
    return rotY(f, facing);
  };
  // ---------------- beds, chests, cake, candles ----------------
  VR.bedModel = function (p, top, side, end) {
    // base: facing north, head part at north
    let f = box([0, 3, 0, 16, 9, 16], { top, bottom: side, side });
    if (p.part === 1) f = f.filter(x => x.dir !== 4); else f = f.filter(x => x.dir !== 5);
    if (p.part === 1) f = cat(f, box([0, 0, 0, 3, 3, 3], side), box([13, 0, 0, 16, 3, 3], side));
    else f = cat(f, box([0, 0, 13, 3, 3, 16], side), box([13, 0, 13, 16, 3, 16], side));
    return rotY(f, p.facing);
  };
  VR.chestModel = function (facing, top, side, front, latch) {
    let f = cat(box([1, 0, 1, 15, 14, 15], { top, bottom: top, side, 5: front }),
      box([7, 7, 0, 9, 11, 1], latch || front, { uv: { 5: [1, 1, 3, 5], 0: [0, 1, 1, 5], 1: [0, 1, 1, 5], 2: [1, 0, 3, 1], 3: [1, 0, 3, 1] } }));
    return rotY(f, facing);
  };
  VR.cakeModel = function (bites, top, side, inner, bottom) {
    const x0 = 1 + bites * 2;
    const t = { top, bottom, side, 1: bites ? inner : side };
    return box([x0, 0, 1, 15, 8, 15], t);
  };
  VR.candleModel = function (count, lit, tex) {
    const pos = [[[7, 7]], [[5, 7], [9, 8]], [[5, 8], [8, 6], [9, 9]], [[5, 5], [9, 5], [5, 9], [9, 8]]][count - 1];
    const hs = [[6], [5, 6], [5, 6, 3], [6, 4, 5, 3]][count - 1];
    const f = [];
    pos.forEach(([x, z], i) => {
      const h = hs[i];
      f.push(...box([x, 0, z, x + 2, h, z + 2], tex, { cull: false, uv: { 2: [0, 6, 2, 8], 3: [0, 14, 2, 16], 0: [0, 16 - h, 2, 16], 1: [2, 16 - h, 4, 16], 4: [4, 16 - h, 6, 16], 5: [6, 16 - h, 8, 16] } }));
      f.push(quad([[x + 0.5, h + 1.5, z + 1], [x + 0.5, h, z + 1], [x + 1.5, h, z + 1], [x + 1.5, h + 1.5, z + 1]], tex, lit ? [13, 0, 14, 2] : [14, 0, 15, 2], 4, { double: true, flags: lit ? VR.FFLAG.EMIT : 0 }));
    });
    return f;
  };
  // ---------------- rails ----------------
  // shape: 0 ns, 1 ew, 2 asc_e, 3 asc_w, 4 asc_n, 5 asc_s, 6 se, 7 sw, 8 nw, 9 ne
  VR.railModel = function (shape, straight, curve) {
    const y = 1;
    const flat = (tex) => [quad([[0, y, 0], [0, y, 16], [16, y, 16], [16, y, 0]], tex, [0, 0, 16, 16], 2, { double: true })];
    if (shape === 0) return flat(straight);
    if (shape === 1) return rotY(flat(straight), 1);
    if (shape >= 2 && shape <= 5) {
      // ascending toward direction
      const up = [quad([[0, 17, 0], [0, 1, 16], [16, 1, 16], [16, 17, 0]], straight, [0, 0, 16, 16], 2, { double: true })]; // rises to north
      const q = { 4: 0, 2: 1, 5: 2, 3: 3 }[shape];
      return rotY(up, q);
    }
    const c = flat(curve); // curve connecting south & east (se)
    return rotY(c, { 6: 0, 7: 1, 8: 2, 9: 3 }[shape]);
  };
  // ---------------- misc machines/decor ----------------
  VR.anvilModel = function (facing, top, side) {
    const f = cat(box([2, 0, 2, 14, 4, 14], side), box([4, 4, 3, 12, 5, 13], side), box([6, 5, 4, 10, 10, 12], side), box([3, 10, 0, 13, 16, 16], { top, bottom: side, side }));
    return rotY(f, facing + 1);
  };
  VR.cauldronModel = function (side, inside, top, bottom, fluidTex, level, fluidFlags) {
    const f = cat(box([0, 3, 0, 16, 16, 2], { side, top }), box([0, 3, 14, 16, 16, 16], { side, top }), box([0, 3, 2, 2, 16, 14], { side, top }), box([14, 3, 2, 16, 16, 14], { side, top }),
      box([2, 3, 2, 14, 4, 14], { top: inside, bottom, side: inside }),
      box([0, 0, 0, 4, 3, 2], side), box([0, 0, 2, 2, 3, 4], side), box([12, 0, 0, 16, 3, 2], side), box([14, 0, 2, 16, 3, 4], side),
      box([0, 0, 14, 4, 3, 16], side), box([0, 0, 12, 2, 3, 14], side), box([12, 0, 14, 16, 3, 16], side), box([14, 0, 12, 16, 3, 14], side));
    if (fluidTex >= 0 && level > 0) {
      const y = 4 + level * 3.66;
      f.push(Object.assign(quad([[2, y, 2], [2, y, 14], [14, y, 14], [14, y, 2]], fluidTex, [2, 2, 14, 14], 2), { flags: fluidFlags || 0, layer: fluidFlags & VR.FFLAG.WATER ? 2 : undefined }));
    }
    return f;
  };
  VR.hopperModel = function (facing, outside, inside, top) {
    let f = cat(box([0, 10, 0, 16, 16, 16], { top, side: outside, bottom: outside }), box([4, 4, 4, 12, 10, 12], outside));
    if (facing === 4 || facing < 0) f = cat(f, box([6, 0, 6, 10, 4, 10], outside));
    else f = cat(f, rotY(box([6, 4, 0, 10, 8, 4], outside), facing));
    return f;
  };
  VR.beaconModel = function (glass, core, base) {
    return cat(MD.withLayer(box([0, 0, 0, 16, 16, 16], glass), 2), MD.withFlags(box([3, 3, 3, 13, 13, 13], core, { cull: false }), VR.FFLAG.EMIT), box([2, 0.1, 2, 14, 3, 14], base, { cull: false }));
  };
  VR.campfireModel = function (facing, lit, log, litLog, fire) {
    const l = lit ? litLog : log;
    let f = cat(box([1, 0, 0, 5, 4, 16], l), box([11, 0, 0, 15, 4, 16], l), box([0, 3, 11, 16, 7, 15], log), box([0, 3, 1, 16, 7, 5], log), box([5, 0, 0, 11, 1, 16], lit ? litLog : log));
    f = rotY(f, facing);
    if (lit) f = cat(f, withFlags(cross(fire, { inset: 2 }), VR.FFLAG.EMIT));
    return f;
  };
  VR.bellModel = function (facing, body, frame) {
    const f = cat(box([6.5, 11, 1, 9.5, 14, 15], frame), box([7, 0, 1, 9, 13, 3], frame), box([7, 0, 13, 9, 13, 15], frame),
      box([5, 4, 5, 11, 11, 11], body, { cull: false }), box([4, 3, 4, 12, 5, 12], body, { cull: false }));
    return rotY(f, facing);
  };
  VR.lecternModel = function (facing, top, side, base) {
    const f = cat(box([0, 0, 0, 16, 2, 16], base), box([4, 2, 4, 12, 13, 12], side), rotate(box([0, 12, 2, 16, 15, 14], { top, side, bottom: side }, { cull: false }), 'x', -22.5, 8, 13.5, 8));
    return rotY(f, facing);
  };
  VR.grindstoneModel = function (facing, side, round, pivot) {
    return rotY(cat(box([4, 4, 2, 12, 16, 14], { side, 0: round, 1: round }, { cull: false }), box([2, 0, 6, 4, 13, 10], pivot), box([12, 0, 6, 14, 13, 10], pivot)), facing);
  };
  VR.stonecutterModel = function (facing, top, side, bottom, saw) {
    return rotY(cat(box([0, 0, 0, 16, 9, 16], { top, side, bottom }), [quad([[1, 16, 8], [1, 9, 8], [15, 9, 8], [15, 16, 8]], saw, [1, 0, 15, 7], 4, { double: true })]), facing + 1);
  };
  VR.potModel = function (tex, plantTex, plantTint) {
    const f = cat(box([5, 0, 5, 11, 6, 11], tex, { cull: false, uv: { 2: [5, 5, 11, 11] } }));
    if (plantTex >= 0) f.push(...cross(plantTex, { y0: 4, h: 12, inset: 3, tint: plantTint }));
    return f;
  };
  VR.pistonHeadModel = function (facing6, face, side) {
    let f = cat(box([0, 12, 0, 16, 16, 16], { top: face, bottom: face, side }), box([6, -4, 6, 10, 12, 10], side, { cull: false, uv: { 0: [0, 0, 16, 4], 1: [0, 0, 16, 4], 4: [0, 0, 16, 4], 5: [0, 0, 16, 4] } }));
    return orient6(f, facing6);
  };
  VR.pistonBaseExtended = function (facing6, top, side, bottom, inner) {
    const f = box([0, 0, 0, 16, 12, 16], { top: inner, bottom, side }, { uv: { 0: [0, 4, 16, 16], 1: [0, 4, 16, 16], 4: [0, 4, 16, 16], 5: [0, 4, 16, 16] } });
    return orient6(f, facing6);
  };
  // orient an "up-facing" model to facing6 (0 n,1 e,2 s,3 w,4 up,5 down)
  function orient6(f, facing6) {
    if (facing6 === 4) return f;
    if (facing6 === 5) return rotX(f, 2);
    // up → north: rotX by -1 (3)
    return rotY(rotX(f, 3), facing6);
  }
  VR.orient6 = orient6;
  VR.rodModel = function (facing6, tex, base) {
    const f = cat(box([7, 1, 7, 9, 16, 9], tex, { cull: false, uv: { 2: [0, 0, 2, 2], 3: [0, 0, 2, 2], 0: [0, 0, 2, 15], 1: [0, 0, 2, 15], 4: [0, 0, 2, 15], 5: [0, 0, 2, 15] } }),
      box([6, 0, 6, 10, 1, 10], base !== undefined ? base : tex, { uv: { 2: [2, 2, 6, 6], 3: [2, 2, 6, 6], 0: [2, 6, 6, 7], 1: [2, 6, 6, 7], 4: [2, 6, 6, 7], 5: [2, 6, 6, 7] } }));
    return orient6(f, facing6);
  };
  VR.repeaterModel = function (p, base, torch, isComparator) {
    let f = box([0, 0, 0, 16, 2, 16], base);
    const tuv = { 2: [7, 6, 9, 8], 0: [7, 6, 9, 11], 1: [7, 6, 9, 11], 4: [7, 6, 9, 11], 5: [7, 6, 9, 11] };
    const tb = (x, z) => box([x, 2, z, x + 2, 7, z + 2], torch, { uv: tuv, cull: false, flags: 0 });
    if (!isComparator) f = cat(f, tb(7, 2), tb(7, 6 + 2 * (p.delay || 0)));
    else f = cat(f, tb(7, 2), tb(4, 11), tb(10, 11));
    return rotY(f, p.facing);
  };
  VR.dripModel = function (tex) { return cross(tex, { inset: 3 }); };
  VR.fanModel = function (tex) {
    return [
      quad([[0, 8, 0], [8, 0, 6], [8, 0, 10], [0, 8, 16]], tex, [0, 0, 16, 8], 2, { double: true }),
      quad([[16, 8, 16], [8, 0, 10], [8, 0, 6], [16, 8, 0]], tex, [0, 0, 16, 8], 2, { double: true }),
      quad([[0, 8, 16], [6, 0, 8], [10, 0, 8], [16, 8, 16]], tex, [0, 8, 16, 16], 2, { double: true }),
      quad([[16, 8, 0], [10, 0, 8], [6, 0, 8], [0, 8, 0]], tex, [0, 8, 16, 16], 2, { double: true }),
    ];
  };
  // ---------------- stairs: precompute (facing, half, shape) ----------------
  // shapes: 0 straight, 1 inner_left, 2 inner_right, 3 outer_left, 4 outer_right
  VR.stairsFaces = function (tex6) {
    const res = [];
    for (let facing = 0; facing < 4; facing++) for (let half = 0; half < 2; half++) for (let sh = 0; sh < 5; sh++) {
      let f = box([0, 0, 0, 16, 8, 16], tex6);
      if (sh === 0) f = cat(f, box([0, 8, 0, 16, 16, 8], tex6));
      else if (sh === 1) f = cat(f, box([0, 8, 0, 16, 16, 8], tex6), box([0, 8, 8, 8, 16, 16], tex6));
      else if (sh === 2) f = cat(f, box([0, 8, 0, 16, 16, 8], tex6), box([8, 8, 8, 16, 16, 16], tex6));
      else if (sh === 3) f = cat(f, box([0, 8, 0, 8, 16, 8], tex6));
      else f = cat(f, box([8, 8, 0, 16, 16, 8], tex6));
      f = rotY(f, facing);
      if (half) f = flipY(f);
      res.push(f);
    }
    return res;
  };
  // ---------------- fences / walls / panes parts ----------------
  VR.fenceParts = function (tex) {
    const post = box([6, 0, 6, 10, 16, 10], tex);
    const arms = [];
    for (let d = 0; d < 4; d++) arms.push(rotY(cat(box([7, 12, 0, 9, 15, 6], tex, { cull: false }), box([7, 6, 0, 9, 9, 6], tex, { cull: false })), d));
    return { post, arms };
  };
  VR.wallParts = function (tex) {
    const post = box([4, 0, 4, 12, 16, 12], tex);
    const low = [], tall = [];
    for (let d = 0; d < 4; d++) { low.push(rotY(box([5, 0, 0, 11, 14, 4], tex), d)); tall.push(rotY(box([5, 0, 0, 11, 16, 4], tex), d)); }
    const lowC = [], tallC = [];
    for (let d = 0; d < 4; d++) { lowC.push(rotY(box([5, 0, 0, 11, 14, 8], tex), d)); tallC.push(rotY(box([5, 0, 0, 11, 16, 8], tex), d)); }
    return { post, low, tall, lowC, tallC };
  };
  VR.paneParts = function (tex, edge) {
    const t = { side: tex, top: edge, bottom: edge };
    const post = box([7, 0, 7, 9, 16, 9], t);
    const arms = [];
    for (let d = 0; d < 4; d++) arms.push(rotY(box([7, 0, 0, 9, 16, 7], t), d));
    return { post, arms };
  };
})(VR);

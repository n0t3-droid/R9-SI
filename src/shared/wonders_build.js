// ============================================================================
// ✨ The eight wonders (wonders.js lists them and their sites): generators on
// the Forge kit, each a grid like any Forge structure (lot-local u, v; the
// front — the entrance — at v = 0; grid row 0 + dy = the ground row, F − 1).
// Every one has a clear way in from the front edge and a glowing heart at its
// centre (meta.heart, y relative to the floor F) — standing within four
// blocks of it is the discovery. Light for the night (lanterns, crystals,
// glowing stone), colour (Vollton, stained glass, gold, crystal), and only
// existing blocks. Empty space above the levelled rows is left to the world
// (keep), so a wonder's ops stay small; whatever a person walks through above
// those rows is carved air.
// ============================================================================
(function (VR) {
  'use strict';
  const W = VR.Wonders, Forge = VR.Forge; if (!W || !Forge || !Forge.kit) return;
  const LEAF = { persistent: 1, distance: 1 };               // leaves that never wither
  const inDisc = (dx, dz, r) => dx * dx + dz * dz <= r * r + r * 0.9;
  // helpers on a kit: discs, rings, cylinders, carving, lamps
  function helpers(K) {
    const H = {
      disc(cx, cz, r, y, name, props) { const R = Math.ceil(r) + 1; for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) if (inDisc(x, z, r)) K.set(cx + x, y, cz + z, name, props); },
      ring(cx, cz, r, y, name, props) { const R = Math.ceil(r) + 1; for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) if (inDisc(x, z, r) && !inDisc(x, z, r - 1)) K.set(cx + x, y, cz + z, name, props); },
      cyl(cx, cz, r, y0, y1, name, props) { for (let y = y0; y <= y1; y++) H.disc(cx, cz, r, y, name, props); },
      carve(x0, y0, z0, x1, y1, z1) { K.box(x0, y0, z0, x1, y1, z1, 0); },
      // a two-high lamppost (post + lamp head)
      post(x, y, z, name) { K.set(x, y, z, name || 'vx_lamppost', { head: 0 }); K.set(x, y + 1, z, name || 'vx_lamppost', { head: 1 }); },
      // a tapering crystal spire: discs shrinking from r0 to a point over h rows, leaning a little, a cluster on its tip
      spire(x, z, y0, h, r0, mat, tip, lean, band) {
        let top = y0;
        for (let t = 0; t < h; t++) {
          const f = t / h, r = r0 * Math.pow(1 - f, 0.85) + 0.35, ox = Math.round((lean ? lean[0] : 0) * f * f), oz = Math.round((lean ? lean[1] : 0) * f * f);
          H.disc(x + ox, z + oz, r, y0 + t, band && t % 7 === 3 ? band : mat);
          top = y0 + t;
          if (t === h - 1 && tip) K.set(x + ox, top + 1, z + oz, tip, { facing: 4, size: 1 });
        }
        return top;
      },
      // a crystal: a prism of radius r for most of its height, then a point; tilted (lean = offset at the top)
      crystal(x, z, y0, h, r, mat, tip, lean) {
        let ox = 0, oz = 0;
        for (let t = 0; t < h; t++) {
          const fr = t / h, rr = fr < 0.7 ? r : r * Math.max(0.12, 1 - (fr - 0.7) / 0.3);
          ox = Math.round((lean ? lean[0] : 0) * fr); oz = Math.round((lean ? lean[1] : 0) * fr);
          H.disc(x + ox, z + oz, rr, y0 + t, mat);
        }
        if (tip) K.set(x + ox, y0 + h, z + oz, tip, { facing: 4, size: 1 });
        return y0 + h;
      },
      // a cluster: a tall crystal and two or three smaller ones leaning out from it
      cluster(x, z, y0, h, r, mat, tip, rng, out) {
        H.crystal(x, z, y0, h, r, mat, tip, [out[0] * 2, out[1] * 2]);
        const n = 2 + rng.int(2);
        for (let k = 0; k < n; k++) { const a = Math.atan2(out[1], out[0]) + (k - (n - 1) / 2) * 1.1 + (rng.next() - 0.5) * 0.4, d = r + 1.2; H.crystal(x + Math.round(Math.cos(a) * d), z + Math.round(Math.sin(a) * d), y0, Math.round(h * (0.35 + rng.next() * 0.25)), Math.max(1, r * 0.55), mat, tip, [Math.round(Math.cos(a) * h * 0.18), Math.round(Math.sin(a) * h * 0.18)]); }
      },
      // the cells of a discrete circle of radius r, 4-connected, in order around it (a path a person can walk)
      circle(cx, cz, r) {
        const out = [], seen = new Set();
        const N = Math.max(16, Math.round(2 * Math.PI * r * 4));
        let last = null;
        for (let k = 0; k <= N; k++) {
          const a = k / N * Math.PI * 2, x = cx + Math.round(Math.sin(a) * r), z = cz - Math.round(Math.cos(a) * r);
          if (last && last[0] === x && last[1] === z) continue;
          if (last && last[0] !== x && last[1] !== z) { const mid = [x, last[1]], key = mid[0] + ',' + mid[1]; if (!seen.has(key)) { seen.add(key); out.push(mid); } }
          const key = x + ',' + z; if (seen.has(key)) { last = [x, z]; continue; }
          seen.add(key); out.push([x, z]); last = [x, z];
        }
        return out;
      },
    };
    return H;
  }
  // the facing of a step from (x0, z0) to (x1, z1): 0 north (−v), 1 east (+u), 2 south (+v), 3 west (−u)
  const faceOf = (dx, dz) => (dz < 0 ? 0 : dx > 0 ? 1 : dz > 0 ? 2 : 3);
  const meta = (K, o) => Object.assign({ doors: [[o.door, 0, 0]], floors: [K.dy + 1], anchor: [o.door, 0] }, o.m);

  // ---------------------------------------------------------------- 💎 Kristallkathedrale
  // a glass nave on quartz piers, a pointed glass vault, a rose window over the portal, an apse; violet, azure and rose
  // crystal spires all around (the tallest behind the apse), a crystal garden; inside, the heart: a light on a geode
  W.GENS.kristall = function (P, env, rng) {
    const LW = 45, LD = 58, dy = -1, K = Forge.kit(LW, 96, LD, dy), H = helpers(K), cx = 22;
    const g0 = 0, f = 1;                                                  // ground row, feet row
    const n0 = 15, n1 = 29, v0 = 10, v1 = 46;                             // the nave (u, v)
    // the grounds: lawn, a white forecourt with an amethyst inlay, a ring path, crystal gardens
    K.box(0, g0, 0, LW - 1, g0, LD - 1, 'grass_block');
    K.box(cx - 3, g0, 0, cx + 3, g0, v0, 'smooth_quartz'); for (let v = 0; v < v0; v += 2) K.set(cx, g0, v, 'amethyst_block');
    for (let v = 6; v <= 54; v++) for (let u = 9; u <= 35; u++) { const edge = u <= 10 || u >= 34 || v <= 7 || v >= 53; if (edge) K.set(u, g0, v, 'quartz_bricks'); }
    const glass = ['purple_stained_glass', 'magenta_stained_glass', 'light_blue_stained_glass', 'blue_stained_glass'];
    // ---- the nave: piers every four, a quartz plinth, coloured glass between (blue at the foot to magenta at the head)
    const eave = 16;
    for (let v = v0; v <= v1; v++) for (const u of [n0, n1]) {
      const pier = (v - v0) % 4 === 0;
      for (let y = f; y < eave; y++) {
        if (pier) K.set(u, y, v, 'quartz_pillar', { axis: 0 });
        else if (y <= f + 1) K.set(u, y, v, 'quartz_bricks');
        else { const k = Math.min(3, Math.floor((y - f - 2) / 3.5)); K.set(u, y, v, [glass[3], glass[2], glass[0], glass[1]][k]); }
      }
      K.set(u, eave, v, pier ? 'chiseled_quartz_block' : 'quartz_bricks');
      if (pier) { K.set(u + (u === n0 ? -1 : 1), f, v, 'quartz_bricks'); K.set(u + (u === n0 ? -1 : 1), f + 1, v, 'quartz_stairs', { facing: u === n0 ? 1 : 3, half: 0 }); }   // buttress feet
    }
    // ---- the vault: a pointed roof of coloured glass between quartz ribs, a crystal ridge
    const half = (n1 - n0) / 2, roofY = (d) => eave + Math.floor((half + 0.5 - d) * 1.35);
    for (let v = v0; v <= v1; v++) {
      const rib = (v - v0) % 4 === 0;
      for (let u = n0; u <= n1; u++) {
        const d = Math.abs(u - cx), y = roofY(d);
        K.set(u, y, v, rib ? 'quartz_pillar' : glass[(Math.floor((v - v0) / 4) + (d > 3 ? 1 : 0)) & 1], rib ? { axis: 2 } : undefined);
        if (d < half && !rib) K.set(u, y - 1 < eave ? eave : y, v, K.get(u, y, v));
        for (let yy = f; yy < y; yy++) if (u > n0 && u < n1) K.air(u, yy, v);
      }
      if (rib) { K.set(cx, roofY(0) + 1, v, 'violet_crystal_cluster', { facing: 4, size: 1 }); }
    }
    // the floor: white quartz, an amethyst aisle, purple carpet
    K.box(n0 + 1, g0, v0, n1 - 1, g0, v1, 'smooth_quartz');
    for (let v = v0; v <= v1; v++) { K.set(cx - 2, g0, v, 'amethyst_block'); K.set(cx + 2, g0, v, 'amethyst_block'); }
    // ---- the front: a gable wall, the pointed portal, a rose window of coloured glass
    for (let u = n0; u <= n1; u++) { const top = roofY(Math.abs(u - cx)) + 2; for (let y = f; y <= top; y++) K.set(u, y, v0, 'quartz_bricks'); K.set(u, top, v0, 'chiseled_quartz_block'); }
    K.set(cx, roofY(0) + 3, v0, 'violet_crystal_block'); K.set(cx, roofY(0) + 4, v0, 'violet_crystal_cluster', { facing: 4, size: 1 });
    for (let y = f; y <= f + 8; y++) { const w = y <= f + 4 ? 2 : y <= f + 6 ? 1 : 0; for (let u = cx - w - 1; u <= cx + w + 1; u++) K.set(u, y, v0, 'amethyst_block'); if (y <= f + 7) for (let u = cx - w; u <= cx + w; u++) K.air(u, y, v0); }
    for (const du of [-4, 4]) { for (let y = f; y <= f + 6; y++) K.set(cx + du, y, v0 - 1, 'quartz_pillar', { axis: 0 }); K.set(cx + du, f + 7, v0 - 1, 'vx_lantern_crystal'); }
    const rr = 5, ry = f + 14;
    for (let y = ry - rr; y <= ry + rr; y++) for (let u = cx - rr; u <= cx + rr; u++) { const d = Math.hypot(u - cx, y - ry); if (d > rr + 0.4) continue; K.set(u, y, v0, d > rr - 0.6 ? 'chiseled_quartz_block' : d < 1.2 ? 'light_blue_stained_glass' : ['magenta_stained_glass', 'purple_stained_glass', 'blue_stained_glass'][Math.min(2, Math.floor(d - 1.2))]); }
    K.set(cx, ry, v0, 'vx_crystal_violet');
    // ---- the apse: a half ring of glass bays behind the nave, a glass half-dome
    const ar = 7;
    for (let v = v1; v <= v1 + ar + 1; v++) for (let u = cx - ar - 1; u <= cx + ar + 1; u++) {
      const d = Math.hypot(u - cx, v - v1); if (v === v1 && Math.abs(u - cx) < ar) continue;
      if (d > ar + 0.5) continue;
      if (d > ar - 0.6) { for (let y = f; y < eave; y++) K.set(u, y, v, y <= f + 1 ? 'quartz_bricks' : ((u + v) % 4 === 0 ? 'quartz_pillar' : glass[y < f + 7 ? 2 : 0])); K.set(u, eave, v, 'quartz_bricks'); }
      else { K.set(u, g0, v, 'smooth_quartz'); for (let y = f; y < eave; y++) K.air(u, y, v); }
    }
    for (let y = eave; y <= eave + ar; y++) { const r = Math.sqrt(Math.max(0, ar * ar - (y - eave) * (y - eave))); for (let v = v1 + 1; v <= v1 + ar; v++) for (let u = cx - ar; u <= cx + ar; u++) { const d = Math.hypot(u - cx, v - v1); if (d <= r + 0.5 && d > r - 0.7) K.set(u, y, v, (u + y) % 3 ? 'magenta_stained_glass' : 'purple_stained_glass'); } }
    // ---- the spires: two over the portal, two at the back corners, the great one behind the apse, small ones along the walls
    // (clusters: a tall prism with a point, two or three smaller ones leaning out of its foot)
    H.cluster(n0 - 5, v0 - 1, f, 44 + rng.int(6), 2.6, 'violet_crystal_block', 'violet_crystal_cluster', rng, [-1, -1]);
    H.cluster(n1 + 5, v0 - 1, f, 44 + rng.int(6), 2.6, 'violet_crystal_block', 'violet_crystal_cluster', rng, [1, -1]);
    H.cluster(n0 - 4, v1 + 2, f, 32 + rng.int(6), 2.2, 'rose_crystal_block', 'rose_crystal_cluster', rng, [-1, 1]);
    H.cluster(n1 + 4, v1 + 2, f, 32 + rng.int(6), 2.2, 'rose_crystal_block', 'rose_crystal_cluster', rng, [1, 1]);
    H.crystal(cx, v1 + ar + 3, f, 80 + rng.int(6), 3.6, 'azure_crystal_block', 'azure_crystal_cluster', [0, 2]);
    for (const [du, dv, h] of [[-4, 1, 46], [4, 1, 50], [0, 4, 38]]) H.crystal(cx + du, v1 + ar + 3 + dv, f, h + rng.int(6), 2, du ? 'violet_crystal_block' : 'rose_crystal_block', du ? 'violet_crystal_cluster' : 'rose_crystal_cluster', [du * 2, 3]);
    for (let v = v0 + 4; v < v1; v += 8) for (const u of [n0 - 4, n1 + 4]) H.crystal(u, v + (u < cx ? 0 : 4), f, 12 + rng.int(10), 1.3, rng.pick(['violet_crystal_block', 'azure_crystal_block', 'rose_crystal_block']), 'violet_crystal_cluster', [u < cx ? -3 : 3, 0]);
    // the crystal garden: clusters in the lawn, lamps along the ring path
    for (let k = 0; k < 70; k++) { const u = rng.int(LW), v = rng.int(LD); if (K.get(u, g0, v) === Forge.st('grass_block') && K.get(u, f, v) === 0xFFFF) K.set(u, f, v, rng.pick(['violet_crystal_cluster', 'azure_crystal_cluster', 'rose_crystal_cluster']), { facing: 4, size: rng.int(2) }); }
    for (const [u, v] of [[9, 6], [35, 6], [9, 30], [35, 30], [9, 54], [35, 54], [cx - 4, 2], [cx + 4, 2]]) H.post(u, f, v, 'vx_lamppost_crystal');
    // ---- inside: crystal lanterns on quartz posts along the aisle, the heart at the crossing under a hanging light
    for (let v = v0 + 3; v < v1 - 1; v += 4) for (const u of [cx - 4, cx + 4]) { K.set(u, f, v, 'quartz_pillar', { axis: 0 }); K.set(u, f + 1, v, 'vx_lantern_crystal'); }
    const hv = 33, hy = f + 1;
    H.disc(cx, hv, 2.4, g0, 'amethyst_block'); K.set(cx, g0, hv, 'chiseled_quartz_block');
    K.set(cx, f, hv, 'chiseled_quartz_block'); K.set(cx, hy, hv, 'beacon');
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.set(cx + a, f, hv + b, 'violet_crystal_cluster', { facing: 4, size: 1 });
    for (let y = hy + 4; y < roofY(0); y++) K.set(cx, y, hv, 'iron_chain', { axis: 0 }); K.set(cx, hy + 3, hv, 'vx_lantern_crystal');
    return Object.assign(K.grid, { meta: meta(K, { door: cx, m: { name: 'Kristallkathedrale', heart: [cx, hy + dy, hv], top: K.sy - 1 + dy } }) });
  };

  // ---------------------------------------------------------------- 🌈 Regenbogenbrücke
  // seven bands of coloured glass in an arch over a reflecting pool, a seven-lane rainbow staircase over its back, a
  // glowing soffit under it; at the top of the rainbow, the heart
  W.GENS.regenbogen = function (P, env, rng) {
    const LW = 17, LD = 62, dy = -3, g0 = 2, f = 3, cu = 8;
    // (an apex of 18 over 54: where the arch grows steeper than a stair, the walk has already met it — the stairs
    // start at the lot's front edge on the ground)
    const span = 54, apex = 18, vc = (LD - 1) / 2, R = (span * span / 4 + apex * apex) / (2 * apex), yc = g0 + apex - R;
    const K = Forge.kit(LW, g0 + apex + 12, LD, dy), H = helpers(K);
    // the grounds: lawn, white paths at both ends, the pool under the arch (dark bed, two deep, lily pads, lights)
    K.box(0, 0, 0, LW - 1, g0, LD - 1, 'grass_block'); K.box(0, 0, 0, LW - 1, g0 - 1, LD - 1, 'dirt');
    for (let v = 0; v < LD; v++) for (let u = 4; u <= 12; u++) K.set(u, g0, v, 'smooth_quartz');
    const p0 = 15, p1 = LD - 16;
    for (let v = p0 - 1; v <= p1 + 1; v++) for (let u = 1; u <= LW - 2; u++) {
      const rim = v === p0 - 1 || v === p1 + 1 || u === 1 || u === LW - 2;
      if (rim) { K.set(u, g0, v, 'smooth_quartz'); continue; }
      K.set(u, 0, v, (u + v) % 9 === 0 ? 'tide_lantern' : 'vollton_navy'); K.set(u, 1, v, 'water'); K.set(u, g0, v, 'water');
      if (rng.chance(0.06) && (u < 4 || u > 12)) K.set(u, f, v, 'lily_pad');
    }
    // ---- the arch: radially, seven bands of glass (red outside … violet inside) and a glowing soffit
    const bands = ['red_stained_glass', 'orange_stained_glass', 'yellow_stained_glass', 'lime_stained_glass', 'light_blue_stained_glass', 'blue_stained_glass', 'purple_stained_glass'];
    const top = new Int32Array(LD).fill(-1);
    for (let v = 0; v < LD; v++) for (let y = g0; y < K.sy; y++) {
      const d = Math.hypot(v - vc, (y + 0.5 - yc) * 1.0), k = Math.floor(R - d);
      if (d > R || k > 7) continue;
      for (let u = 4; u <= 12; u++) K.set(u, y, v, k < 7 ? bands[k] : (u === 4 || u === 12 || (v + y) % 3 === 0 ? 'neon_white' : 'purple_stained_glass'));
      if (y > top[v]) top[v] = y;
    }
    // ---- the walk over it: the 1-step envelope of the arch's back — a staircase onto the rainbow, seven coloured lanes
    const lanes = ['vollton_signal_red', 'vollton_orange', 'vollton_lemon', 'vollton_emerald', 'vollton_sky', 'vollton_cobalt', 'vollton_violet'];
    const wk = new Int32Array(LD);
    for (let v = 0; v < LD; v++) { let m = g0; for (let q = 0; q < LD; q++) if (top[q] >= 0) m = Math.max(m, top[q] - Math.abs(v - q)); wk[v] = m; }
    for (let v = 0; v < LD; v++) {
      // (a cell one higher than the one before it is a stair — you step up onto it — in both directions)
      const y = wk[v], up = v > 0 && wk[v - 1] < y, down = v + 1 < LD && wk[v + 1] < y;
      for (let u = 5; u <= 11; u++) {
        const lane = lanes[u - 5];
        for (let yy = Math.max(g0 + 1, top[v] + 1); yy < y; yy++) K.set(u, yy, v, 'quartz_bricks');   // the stringer under the steps
        if (y <= g0) continue;
        if (up || down) { K.set(u, y, v, lane + '_stairs', { facing: up ? 2 : 0, half: 0 }); K.air(u, y + 1, v); K.air(u, y + 2, v); K.air(u, y + 3, v); }
        else { K.set(u, y, v, lane); K.air(u, y + 1, v); K.air(u, y + 2, v); K.air(u, y + 3, v); }
      }
      if (y > g0) for (const u of [4, 12]) { K.set(u, y + 1, v, v % 6 === 0 ? 'quartz_pillar' : 'glass_rail'); if (v % 6 === 0) K.set(u, y + 2, v, 'vx_lantern'); for (let yy = Math.max(g0 + 1, top[v] + 1); yy <= y; yy++) K.set(u, yy, v, 'quartz_bricks'); }
    }
    // the heart: at the top of the rainbow, between two crystal lanterns
    const hv = Math.round(vc), hy = wk[hv] + 1;
    K.set(cu, hy, hv, 'beacon'); K.set(cu - 2, hy, hv, 'vx_lantern_crystal'); K.set(cu + 2, hy, hv, 'vx_lantern_crystal');
    // lamps at both ends, flowers
    for (const v of [1, LD - 2]) { H.post(2, f, v, 'vx_lamppost_crystal'); H.post(LW - 3, f, v, 'vx_lamppost_crystal'); }
    for (let k = 0; k < 24; k++) { const u = rng.chance(0.5) ? rng.int(3) : LW - 1 - rng.int(3), v = rng.int(LD); if (K.get(u, g0, v) === Forge.st('grass_block')) K.set(u, f, v, rng.pick(['vx_flowerbed_roses', 'vx_flowerbed_tulips', 'pink_petals', 'vx_bush']), { count: 3 }); }
    let topRow = 0; for (let y = 0; y < K.sy; y++) for (let i = 0; i < LW * LD; i++) if (K.grid.blocks[y * LW * LD + i] !== 0xFFFF && K.grid.blocks[y * LW * LD + i] !== 0) topRow = y;
    return Object.assign(K.grid, { meta: meta(K, { door: cu, m: { name: 'Regenbogenbrücke', heart: [cu, hy + dy, hv], top: topRow + dy } }) });
  };

  // ---------------------------------------------------------------- 🔭 Sternwarte
  // a white drum on a round terrace, a midnight-blue dome with golden stars and a glass slit, a portico; inside, a
  // star-map floor (glowing stars, golden lines), the telescope, and the heart at the centre of the map
  W.GENS.sternwarte = function (P, env, rng) {
    const LW = 41, LD = 45, dy = -1, g0 = 0, f = 1, cx = 20, cz = 25;
    const K = Forge.kit(LW, 40, LD, dy), H = helpers(K);
    const R = 9, T = 15, drumTop = f + 2 + 11, domeR = 10;
    K.box(0, g0, 0, LW - 1, g0, LD - 1, 'grass_block');
    // the terrace: two steps, paved with dark stone and a golden rim; a path to it
    H.cyl(cx, cz, T, g0, g0, 'vollton_graphite'); H.cyl(cx, cz, T - 1, f, f, 'vollton_anthracite'); H.ring(cx, cz, T - 1, f, 'gold_block'); H.cyl(cx, cz, T - 2, f + 1, f + 1, 'smooth_quartz');
    K.box(cx - 2, g0, 0, cx + 2, g0, cz - T, 'smooth_quartz');
    for (let k = 0; k < 2; k++) for (let u = cx - 2; u <= cx + 2; u++) { K.set(u, f + k, cz - T + k, 'smooth_quartz_stairs', { facing: 2, half: 0 }); K.air(u, f + k + 1, cz - T + k); K.air(u, f + k + 2, cz - T + k); }
    // the drum: white quartz with gold bands, tall glass windows between pilasters
    for (let y = f + 2; y <= drumTop; y++) for (let z = cz - R; z <= cz + R; z++) for (let x = cx - R; x <= cx + R; x++) {
      const d = Math.hypot(x - cx, z - cz); if (d > R + 0.5) continue;
      if (d > R - 0.6) { const a = Math.atan2(z - cz, x - cx), bay = Math.round(a / (Math.PI / 8)), pil = Math.abs(a - bay * Math.PI / 8) < 0.12; K.set(x, y, z, y === drumTop ? ((x + z) % 3 === 0 ? 'ochre_mire_light' : 'gold_block') : y === f + 2 ? 'quartz_bricks' : pil || y % 5 === 0 ? 'quartz_pillar' : (y >= f + 4 && y <= drumTop - 2 ? 'light_blue_stained_glass' : 'quartz_bricks'), pil ? { axis: 0 } : undefined); }
      else K.air(x, y, z);
    }
    // the star-map floor: midnight blue, stars that glow, golden lines between them
    H.disc(cx, cz, R - 0.6, f + 1, 'vollton_navy');
    const stars = [];
    for (let k = 0; k < 18; k++) { const a = rng.next() * Math.PI * 2, d = 1.5 + rng.next() * (R - 2.5), x = cx + Math.round(Math.cos(a) * d), z = cz + Math.round(Math.sin(a) * d); stars.push([x, z]); K.set(x, f + 1, z, k % 3 ? 'neon_white' : 'ochre_mire_light'); }
    for (let k = 0; k + 1 < stars.length; k += 2) { const [x0, z0] = stars[k], [x1, z1] = stars[k + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)); for (let i = 1; i < n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), z = Math.round(z0 + (z1 - z0) * i / n); if (K.get(x, f + 1, z) === Forge.st('vollton_navy')) K.set(x, f + 1, z, 'gold_block'); } }
    // the dome: midnight blue with golden stars (a few that glow), a slit of glass toward the front, a golden finial
    const db = drumTop + 1;
    for (let y = db; y <= db + domeR; y++) {
      const r = Math.sqrt(Math.max(0, domeR * domeR - (y - db) * (y - db)));
      for (let z = cz - domeR; z <= cz + domeR; z++) for (let x = cx - domeR; x <= cx + domeR; x++) {
        const d = Math.hypot(x - cx, z - cz); if (d > r + 0.5) continue;
        if (d > r - 1.1 || y === db + domeR) {
          const slit = Math.abs(x - cx) <= 1 && z < cz;
          K.set(x, y, z, slit ? 'light_blue_stained_glass' : (x * 7 + y * 13 + z * 5) % 11 === 0 ? 'ochre_mire_light' : (x * 3 + y * 11 + z * 17) % 9 === 0 ? 'gold_block' : 'vollton_navy');
        } else K.air(x, y, z);
      }
    }
    K.set(cx, db + domeR + 1, cz, 'gold_block'); K.set(cx, db + domeR + 2, cz, 'light_rod', { facing: 4 });
    // the portico: four columns, a gold-trimmed lintel, the door opening; lamps
    for (const du of [-3, -1, 1, 3]) for (let y = f + 2; y <= f + 7; y++) K.set(cx + du, y, cz - R - 2, 'quartz_pillar', { axis: 0 });
    K.box(cx - 4, f + 8, cz - R - 3, cx + 4, f + 8, cz - R, 'quartz_bricks'); K.box(cx - 4, f + 9, cz - R - 3, cx + 4, f + 9, cz - R, 'gold_block');
    K.box(cx - 3, f + 1, cz - R - 3, cx + 3, f + 1, cz - R, 'smooth_quartz');
    for (let z = cz - R - 1; z <= cz - R + 1; z++) for (let u = cx - 1; u <= cx + 1; u++) for (let y = f + 2; y <= f + 5; y++) K.air(u, y, z);
    K.set(cx - 2, f + 6, cz - R - 3, 'vx_lantern'); K.set(cx + 2, f + 6, cz - R - 3, 'vx_lantern');
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, x = cx + Math.round(Math.cos(a) * (R - 1.5)), z = cz + Math.round(Math.sin(a) * (R - 1.5)); if (z > cz - R + 2) { K.set(x, f + 2, z, 'quartz_pillar', { axis: 0 }); K.set(x, f + 3, z, 'vx_lantern'); } }
    // the telescope: a brass tube on a black pier, aimed through the slit
    K.set(cx, f + 2, cz + 2, 'black_metal'); K.set(cx, f + 3, cz + 2, 'black_metal');
    for (let i = 0; i < 9; i++) { const z = cz + 2 - i, y = f + 4 + Math.round(i * 0.9); K.set(cx, y, z, i === 8 ? 'light_blue_stained_glass' : 'cut_copper'); if (i < 6) K.set(cx, y + 1, z, 'cut_copper'); }
    // the heart: the brightest star at the centre of the map
    K.set(cx, f + 1, cz, 'gold_block'); K.set(cx, f + 2, cz, 'beacon');
    for (const [a, b] of [[-1, 0], [1, 0], [0, -1]]) K.set(cx + a, f + 2, cz + b, 'vm_deco_globe_brass', { facing: 2, part: 0 });
    // the garden: lamps on the terrace, hedges, an armillary-ish globe by the path
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, x = cx + Math.round(Math.cos(a) * (T - 2)), z = cz + Math.round(Math.sin(a) * (T - 2)); if (Math.abs(x - cx) > 2 || z > cz) H.post(x, f + 2, z, 'vx_lamppost_black'); }
    for (let v = 1; v < cz - T; v += 3) { K.set(cx - 3, f, v, 'vx_hedge'); K.set(cx + 3, f, v, 'vx_hedge'); }
    H.post(cx - 4, f, 1, 'vx_lamppost_black'); H.post(cx + 4, f, 1, 'vx_lamppost_black');
    return Object.assign(K.grid, { meta: meta(K, { door: cx, m: { name: 'Sternwarte', heart: [cx, f + 2 + dy, cz], top: db + domeR + 2 + dy } }) });
  };

  // ---------------------------------------------------------------- 🌳 Riesenbaum
  // a giant tree on great roots, a spiral stair around its trunk to lantern-lit platforms, branches into a canopy of
  // green and blossom, glowing mushrooms and fireflies between the roots; inside its foot, a hollow with the heart
  W.GENS.riesenbaum = function (P, env, rng) {
    const LW = 57, LD = 57, dy = -1, g0 = 0, f = 1, cx = 28, cz = 30;
    const K = Forge.kit(LW, 96, LD, dy), H = helpers(K);
    K.box(0, g0, 0, LW - 1, g0, LD - 1, 'grass_block');
    const LOG = 'oak_log', trunkTop = 64;
    const rAt = (y) => (y < 6 ? 6.2 - y * 0.15 : 5.3 - (y - 6) * 0.042);
    // the trunk
    for (let y = f; y <= trunkTop; y++) { H.disc(cx, cz, rAt(y), y, LOG, { axis: 0 }); for (let k = 0; k < 3; k++) { const a = ((y * 7 + k * 13) % 31) / 31 * Math.PI * 2, r = rAt(y) - 0.3; K.set(cx + Math.round(Math.cos(a) * r), y, cz + Math.round(Math.sin(a) * r), 'jungle_log', { axis: 0 }); } }
    // the roots: eight arches out from the foot, down into the ground
    // (two wide, arching from high up the trunk down into the ground, the front one left open for the way in)
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + Math.PI / 8 + (rng.next() - 0.5) * 0.25, L = 10 + rng.int(5), H0 = 8 + rng.int(3);
      for (let t = 0; t <= L; t++) {
        const d = 4.5 + t, y = f + Math.max(0, Math.round(H0 * Math.pow(1 - t / L, 1.6)) - 1);
        for (const w of [-0.5, 0.5]) { const x = cx + Math.round(Math.cos(a) * d - Math.sin(a) * w), z = cz + Math.round(Math.sin(a) * d + Math.cos(a) * w); for (let yy = f; yy <= y; yy++) K.set(x, yy, z, LOG, { axis: Math.abs(Math.cos(a)) > 0.7 ? 1 : 2 }); }
      }
    }
    // the hollow at the foot: a round room, an arched way in at the front, moss, glowing mushrooms, the heart
    const hr = 3;
    for (let y = f; y <= f + 5; y++) H.disc(cx, cz, y >= f + 4 ? hr - (y - f - 3) * 0.8 : hr, y, 0);
    H.disc(cx, cz, hr, g0, 'moss_block');
    for (let z = cz - 7; z <= cz - hr; z++) for (let u = cx - 1; u <= cx + 1; u++) { K.set(u, g0, z, 'moss_block'); K.air(u, f, z); K.air(u, f + 1, z); if (u === cx) K.air(u, f + 2, z); }
    K.set(cx, f, cz, 'moss_block'); K.set(cx, f + 1, cz, 'verdant_mire_light');
    for (const [a, b] of [[-2, 0], [2, 0], [0, 2], [-1, 2], [1, 2]]) K.set(cx + a, f, cz + b, 'lumishroom');
    K.set(cx - 2, f + 3, cz + 1, 'lantern', { hanging: 1 }); K.set(cx + 2, f + 3, cz + 1, 'lantern', { hanging: 1 });
    // round windows of coloured glass in the bark, lit from the hollow
    for (const [a, col] of [[Math.PI * 0.5, 'lime_stained_glass'], [Math.PI * 0.9, 'yellow_stained_glass'], [Math.PI * 0.1, 'orange_stained_glass'], [Math.PI * 1.3, 'light_blue_stained_glass'], [Math.PI * 1.7, 'magenta_stained_glass']]) {
      for (let d = hr + 0.6; d <= rAt(f + 2) + 0.4; d += 0.5) { const x = cx + Math.round(Math.cos(a) * d), z = cz + Math.round(Math.sin(a) * d); for (let y = f + 1; y <= f + 3; y++) if (K.get(x, y, z) !== 0) K.set(x, y, z, col); }
    }
    // a path of moss and stones to the hollow, lanterns on posts
    for (let v = 0; v <= cz - 7; v++) for (let u = cx - 1; u <= cx + 1; u++) K.set(u, g0, v, (u + v) % 3 ? 'dirt_path' : 'moss_block');
    for (let v = 2; v < cz - 8; v += 6) { K.set(cx - 3, f, v, 'oak_fence'); K.set(cx - 3, f + 1, v, 'lantern'); K.set(cx + 3, f, v, 'oak_fence'); K.set(cx + 3, f + 1, v, 'lantern'); }
    // the spiral stair around the trunk: two wide, from the front of the roots up to the top platform, a railing
    const plats = [20, 38, 56], stairR = 7.5, ring = H.circle(cx, cz, stairR), ringO = H.circle(cx, cz, stairR + 1);
    let start = ring.findIndex(([x, z]) => x === cx + 1 && z < cz); if (start < 0) start = 0;
    const N = ring.length, stairs = [];
    let y = f;
    for (let k = 0; y < plats[plats.length - 1]; k++) {
      const [x, z] = ring[(start + k) % N], [nx, nz] = ring[(start + k + 1) % N];
      stairs.push([x, y, z, faceOf(nx - x, nz - z)]);
      y++;
    }
    const outerOf = (x, z) => { let best = null, bd = 9; for (const [ox, oz] of ringO) { const d = Math.abs(ox - x) + Math.abs(oz - z); if (d < bd) { bd = d; best = [ox, oz]; } } return best; };
    for (const [x, yy, z, fc] of stairs) {
      K.set(x, yy, z, 'oak_stairs', { facing: fc, half: 0 });
      const o = outerOf(x, z); if (o) { K.set(o[0], yy, o[1], 'oak_stairs', { facing: fc, half: 0 }); }
      for (let k = 1; k <= 3; k++) { K.air(x, yy + k, z); if (o) K.air(o[0], yy + k, o[1]); }
      if (yy > f + 1) { K.set(x, yy - 1, z, 'oak_planks'); if (o) K.set(o[0], yy - 1, o[1], 'oak_planks'); }
    }
    // the platforms: plank rings around the trunk with a fence and lanterns (an opening where the stair comes up)
    for (const py of plats) {
      const r0 = rAt(py) + 0.6, r1 = stairR + 4;
      for (let z = cz - Math.ceil(r1); z <= cz + Math.ceil(r1); z++) for (let x = cx - Math.ceil(r1); x <= cx + Math.ceil(r1); x++) {
        const d = Math.hypot(x - cx, z - cz); if (d < r0 || d > r1 + 0.5) continue;
        if (stairs.some(([sx, sy, sz]) => sx === x && sz === z && sy > py - 3 && sy < py)) continue;
        K.set(x, py, z, 'deck_wood'); K.air(x, py + 1, z); K.air(x, py + 2, z); K.air(x, py + 3, z);
        if (d > r1 - 0.6) { K.set(x, py + 1, z, 'oak_fence'); if ((x + z) % 7 === 0) K.set(x, py + 2, z, 'lantern'); }
      }
    }
    for (const [x, yy, z] of stairs) for (let k = 1; k <= 3; k++) if (K.get(x, yy + k, z) !== 0 && !stairs.some(s => s[0] === x && s[2] === z && s[1] === yy + k)) K.air(x, yy + k, z);
    // the branches and the canopy: green with blossom, glow berries and lanterns hanging
    const leaf = (x, yy, z, kind) => { const s = K.get(x, yy, z); if (s === 0xFFFF || s === 0) K.set(x, yy, z, kind, LEAF); };
    // a leaf crown; under its rim, lanterns and glow berries hang (lights in the canopy at night)
    const blob = (x0, y0, z0, r, kinds) => {
      const R0 = Math.ceil(r);
      // (a few glowing blossoms in its outer shell: pale lights all through the canopy at night)
      for (let yy = -R0; yy <= R0; yy++) for (let z = -R0; z <= R0; z++) for (let x = -R0; x <= R0; x++) { const d = Math.hypot(x, yy * 1.35, z), e = r + (rng.next() - 0.5) * 1.2; if (d > e) continue; const kind = kinds[(Math.abs(x * 3 + yy * 5 + z * 7)) % kinds.length]; if (d > e - 1.3 && rng.next() < 0.035) { const s0 = K.get(x0 + x, y0 + yy, z0 + z); if (s0 === 0xFFFF || s0 === 0) K.set(x0 + x, y0 + yy, z0 + z, 'pearl_mire_light'); } else leaf(x0 + x, y0 + yy, z0 + z, kind); }
      for (let k = 0; k < 10; k++) {
        const a = rng.next() * Math.PI * 2, d = r * (0.45 + rng.next() * 0.4), x = x0 + Math.round(Math.cos(a) * d), z = z0 + Math.round(Math.sin(a) * d);
        let yy = y0; while (yy > y0 - R0 - 1 && K.get(x, yy - 1, z) !== 0xFFFF) yy--;
        if (K.get(x, yy - 1, z) !== 0xFFFF || K.get(x, yy, z) === 0xFFFF) continue;
        if (k % 3 === 0) K.set(x, yy - 1, z, 'lantern', { hanging: 1 });
        else for (let q = 1; q <= 2 + (k & 1) && K.get(x, yy - q, z) === 0xFFFF; q++) K.set(x, yy - q, z, 'glow_berry_vine', { berries: 1, tip: q === 2 + (k & 1) ? 1 : 0 });
      }
    };
    const KINDS = ['cherry_leaves', 'oak_leaves', 'flowering_azalea_leaves', 'cherry_leaves', 'oak_leaves', 'cherry_leaves', 'azalea_leaves'];
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2 + rng.next() * 0.5, by = 42 + (k % 3) * 7 + rng.int(4), L = 12 + rng.int(5);
      let ex = cx, ez = cz, ey = by;
      for (let t = 0; t <= L; t++) { ex = cx + Math.round(Math.cos(a) * (3 + t)); ez = cz + Math.round(Math.sin(a) * (3 + t)); ey = by + Math.round(t * 0.55); if (ex < 2 || ez < 2 || ex > LW - 3 || ez > LD - 3) break; K.set(ex, ey, ez, LOG, { axis: Math.abs(Math.cos(a)) > 0.7 ? 1 : 2 }); K.set(ex, ey + 1, ez, LOG, { axis: Math.abs(Math.cos(a)) > 0.7 ? 1 : 2 }); }
      blob(ex, ey + 2, ez, 6 + rng.int(3), KINDS);
      for (let h = 0; h < 4; h++) { const hx = ex + rng.int(7) - 3, hz = ez + rng.int(7) - 3; let yy = ey - 2; while (yy > ey - 6 && K.get(hx, yy, hz) === 0xFFFF) yy--; if (yy > ey - 6 && K.get(hx, yy - 1, hz) === 0xFFFF) K.set(hx, yy - 1, hz, 'lantern', { hanging: 1 }); }
    }
    blob(cx, trunkTop + 6, cz, 11, KINDS); blob(cx + 5, trunkTop + 2, cz - 4, 7, KINDS); blob(cx - 6, trunkTop + 1, cz + 3, 7, KINDS);
    for (let k = 0; k < 40; k++) { const x = 6 + rng.int(LW - 12), z = 6 + rng.int(LD - 12); let yy = 90; while (yy > 30 && K.get(x, yy, z) === 0xFFFF) yy--; const s = K.get(x, yy, z); if (yy > 30 && s !== 0xFFFF && /leaves/.test(VR.R.types[VR.R.T.type[s]] ? VR.R.types[VR.R.T.type[s]].name : '')) { let y2 = yy - 1; while (K.get(x, y2, z) !== 0xFFFF && y2 > yy - 12) y2--; for (let q = 0; q < 3 && K.get(x, y2 - q, z) === 0xFFFF; q++) K.set(x, y2 - q, z, 'glow_berry_vine', { berries: 1, tip: q === 2 ? 1 : 0 }); } }
    // the forest floor: glowing mushrooms and fireflies between the roots, glow lichen on the bark, ferns
    for (let k = 0; k < 60; k++) { const a = rng.next() * Math.PI * 2, d = 6 + rng.next() * 14, x = cx + Math.round(Math.cos(a) * d), z = cz + Math.round(Math.sin(a) * d); if (K.get(x, f, z) === 0xFFFF && K.get(x, g0, z) === Forge.st('grass_block')) K.set(x, f, z, k % 3 === 0 ? 'lumishroom' : k % 3 === 1 ? 'firefly_bush' : 'fern'); }
    for (let k = 0; k < 30; k++) { const a = rng.next() * Math.PI * 2, yy = f + 6 + rng.int(40), r = rAt(yy) + 0.9, x = cx + Math.round(Math.cos(a) * r), z = cz + Math.round(Math.sin(a) * r); if (K.get(x, yy, z) === 0xFFFF) K.set(x, yy, z, 'glow_lichen', { faces: 63 }); }
    let topRow = 0; for (let yy = K.sy - 1; yy >= 0 && !topRow; yy--) for (let i = 0; i < LW * LD; i++) if (K.grid.blocks[yy * LW * LD + i] !== 0xFFFF) { topRow = yy; break; }
    return Object.assign(K.grid, { meta: meta(K, { door: cx, m: { name: 'Riesenbaum', heart: [cx, f + 1 + dy, cz], top: topRow + dy, platforms: plats.map(p => p + dy) } }) });
  };

  // ---------------------------------------------------------------- 🗼 Wolkenleuchtturm
  // a red-and-white tower on a rock wreathed in clouds, a stair up through it, a gallery, the lantern room with the
  // great light (the heart; the game turns a beam around it at night)
  W.GENS.wolkenturm = function (P, env, rng) {
    const LW = 37, LD = 41, dy = -1, g0 = 0, f = 1, cx = 18, cz = 22;
    const rockTop = f + 7, towerTop = rockTop + 46, K = Forge.kit(LW, towerTop + 14, LD, dy), H = helpers(K);
    K.box(0, g0, 0, LW - 1, g0, LD - 1, 'grass_block');
    // the rock: a rough mound of stone and moss
    // (layered: rough stone with moss, a grassy top with flowers and boulders)
    for (let y = f; y <= rockTop; y++) { const t = (y - f) / (rockTop - f), r = 13 - t * 6.5; for (let z = cz - 14; z <= cz + 14; z++) for (let x = cx - 14; x <= cx + 14; x++) { const d = Math.hypot(x - cx, z - cz) + (VR.M.hash2(x, z, 77) % 100) / 45; if (d > r) continue; const topHere = d > r - 1 || y === rockTop; K.set(x, y, z, topHere && K.get(x, y + 1, z) === 0xFFFF && y > f + 2 ? 'grass_block' : (x + y * 3 + z) % 7 === 0 ? 'mossy_cobblestone' : (x * y + z) % 5 ? 'andesite' : 'stone'); } }
    for (let z = cz - 14; z <= cz + 14; z++) for (let x = cx - 14; x <= cx + 14; x++) for (let y = rockTop; y > f; y--) { if (K.get(x, y, z) !== Forge.st('grass_block')) continue; if (K.get(x, y + 1, z) === 0xFFFF && (x * 5 + z * 3) % 7 === 0) K.set(x, y + 1, z, (x + z) % 3 ? 'oxeye_daisy' : 'cornflower'); break; }
    // the way up the rock: stone steps from the front path (the top step level with the landing), a landing at the door
    const w0 = cx - 1, w1 = cx + 1, sv1 = cz - 7;
    for (let v = 0; v <= sv1; v++) {
      const y = rockTop - (sv1 - v);
      for (let u = w0; u <= w1; u++) {
        if (y >= f) { K.set(u, y, v, 'stone_brick_stairs', { facing: 2, half: 0 }); for (let yy = f; yy < y; yy++) K.set(u, yy, v, 'stone_bricks'); }
        else K.set(u, g0, v, 'gravel');
        for (let k = 1; k <= 3; k++) K.air(u, Math.max(y, g0) + k, v);
      }
      if (y >= f && v % 3 === 0) { for (const u of [w0 - 1, w1 + 1]) { for (let yy = f; yy <= y; yy++) K.set(u, yy, v, 'stone_bricks'); K.set(u, y + 1, v, 'vx_lantern'); } }
    }
    for (let v = sv1 + 1; v <= cz - 4; v++) for (let u = w0; u <= w1; u++) { K.set(u, rockTop, v, 'stone_bricks'); for (let k = 1; k <= 3; k++) K.air(u, rockTop + k, v); }
    // the tower: round, red and white bands, little windows climbing round it, a door at the front
    const TR = 4.5;
    for (let y = rockTop + 1; y <= towerTop; y++) for (let z = cz - 5; z <= cz + 5; z++) for (let x = cx - 5; x <= cx + 5; x++) {
      const d = Math.hypot(x - cx, z - cz); if (d > TR + 0.5) continue;
      if (d > TR - 0.7) { const band = Math.floor((y - rockTop - 1) / 6) & 1, win = (y - rockTop) % 6 === 3 && Math.abs(Math.atan2(z - cz, x - cx) - ((y * 0.37) % (Math.PI * 2) - Math.PI)) < 0.35; K.set(x, y, z, win ? 'light_blue_stained_glass' : band ? 'vollton_signal_red' : 'vollton_white'); }
      else K.air(x, y, z);
    }
    H.disc(cx, cz, TR - 0.7, rockTop, 'smooth_stone');
    K.air(cx, rockTop + 1, cz - 4); K.air(cx, rockTop + 2, cz - 4); K.air(cx, rockTop + 1, cz - 5); K.air(cx, rockTop + 2, cz - 5);
    K.set(cx - 1, rockTop + 3, cz - 5, 'vx_lantern'); K.set(cx + 1, rockTop + 3, cz - 5, 'vx_lantern');
    // the stair: a spiral round a central post up to the lantern room's floor
    const steps = K.spiral(cx, rockTop, cz, towerTop - rockTop, 'stone_brick_stairs', null, 'stone_bricks');
    for (const [x, y, z] of steps) if (K.get(x, y - 1, z) === 0 && y - 1 > rockTop) K.set(x, y - 1, z, 'stone_bricks');
    for (let y = rockTop + 6; y < towerTop; y += 8) K.set(cx, y, cz, 'lantern');   // lights on the post (the post holds them)
    // the gallery: a ring platform with a railing; the lantern room: glass round the light, a red cap, a golden finial
    const gy = towerTop;
    H.disc(cx, cz, TR + 2, gy, 'smooth_stone'); H.ring(cx, cz, TR + 2, gy + 1, 'vx_railing_black'); H.ring(cx, cz, TR + 2, gy - 1, 'vollton_signal_red');
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = cx + Math.round(Math.cos(a) * (TR + 2)), z = cz + Math.round(Math.sin(a) * (TR + 2)); K.set(x, gy + 2, z, 'vx_lantern'); }
    for (const [x, y, z] of steps) if (y >= gy - 2) K.air(x, gy, z);
    steps.forEach(([x, y, z], i) => { if (y === gy) K.set(x, y, z, 'stone_brick_stairs', { facing: [1, 1, 2, 2, 3, 3, 0, 0][i & 7], half: 0 }); });
    for (let y = gy + 1; y <= gy + 5; y++) H.ring(cx, cz, TR - 0.5, y, y === gy + 5 ? 'neon_white' : 'glass');
    K.air(cx, gy + 1, cz - 4); K.air(cx, gy + 2, cz - 4); K.air(cx + 4, gy + 1, cz); K.air(cx + 4, gy + 2, cz);
    for (let y = gy + 1; y <= gy + 4; y++) H.disc(cx, cz, TR - 1.6, y, 0);
    K.set(cx, gy, cz, 'gold_block'); K.set(cx, gy + 1, cz, 'beacon'); K.set(cx, gy + 2, cz, 'light_panel'); K.set(cx, gy + 3, cz, 'beacon');
    for (const [a, b] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) K.set(cx + a, gy + 2, cz + b, 'vx_lantern_crystal');
    for (let k = 0; k < 4; k++) H.disc(cx, cz, TR - 0.5 - k * 1.3, gy + 6 + k, 'vollton_signal_red');
    K.set(cx, gy + 10, cz, 'gold_block'); K.set(cx, gy + 11, cz, 'light_rod', { facing: 4 });
    // the clouds: soft white puffs round the upper tower
    const puff = (x0, y0, z0, r) => { for (let y = -2; y <= 2; y++) for (let z = -Math.ceil(r); z <= Math.ceil(r); z++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) { const d = Math.hypot(x, y * 2.2, z); if (d > r || Math.hypot(x0 + x - cx, z0 + z - cz) < TR + 2.6) continue; if (K.get(x0 + x, y0 + y, z0 + z) === 0xFFFF) K.set(x0 + x, y0 + y, z0 + z, 'white_wool'); } };
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + rng.next(), d = 8 + rng.next() * 6, y = rockTop + 26 + rng.int(14); puff(cx + Math.round(Math.cos(a) * d), y, cz + Math.round(Math.sin(a) * d), 3 + rng.next() * 2.5); }
    // lamps round the rock, a little cove of flowers
    for (const [x, z] of [[cx - 10, cz - 6], [cx + 10, cz - 6], [cx - 10, cz + 8], [cx + 10, cz + 8]]) { let y = rockTop; while (y > f && K.get(x, y, z) === 0xFFFF) y--; H.post(x, y + 1, z, 'vx_lamppost'); }
    return Object.assign(K.grid, { meta: meta(K, { door: cx, m: { name: 'Wolkenleuchtturm', heart: [cx, gy + 1 + dy, cz], top: gy + 11 + dy, beam: [cx, gy + 2 + dy, cz] } }) });
  };

  // ---------------------------------------------------------------- 🌿 Labyrinthgarten
  // a hedge maze (a perfect one: every way leads somewhere, exactly one to the middle), lamps at the corners, a
  // flower garden round a fountain at its heart, a lookout pavilion over each front corner
  W.GENS.labyrinth = function (P, env, rng) {
    const LW = 61, LD = 61, dy = -1, g0 = 0, f = 1, C = 15, S = 4, mid = 30;
    const K = Forge.kit(LW, 18, LD, dy), H = helpers(K);
    K.box(0, g0, 0, LW - 1, g0, LD - 1, 'grass_block');
    // the maze on 15 × 15 cells (3 path + 1 hedge), the middle 3 × 3 cells a garden
    const open = new Uint8Array(C * C * 4), seen = new Uint8Array(C * C), plaza = (i, j) => i >= 6 && i <= 8 && j >= 6 && j <= 8;
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) if (plaza(i, j)) seen[j * C + i] = 1;
    const stack = [[7, 0]]; seen[7] = 1;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1], nb = [];
      for (let d = 0; d < 4; d++) { const a = i + DIRS[d][0], b = j + DIRS[d][1]; if (a >= 0 && b >= 0 && a < C && b < C && !seen[b * C + a]) nb.push(d); }
      if (!nb.length) { stack.pop(); continue; }
      const d = nb[rng.int(nb.length)], a = i + DIRS[d][0], b = j + DIRS[d][1];
      open[(j * C + i) * 4 + d] = 1; open[(b * C + a) * 4 + ((d + 2) & 3)] = 1; seen[b * C + a] = 1; stack.push([a, b]);
    }
    // two ways into the garden (from the front and from the back): openings in its ring
    open[(5 * C + 7) * 4 + 2] = 1; open[(9 * C + 7) * 4 + 0] = 1;
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) if (plaza(i, j)) for (let d = 0; d < 4; d++) { const a = i + DIRS[d][0], b = j + DIRS[d][1]; if (plaza(a, b)) open[(j * C + i) * 4 + d] = 1; }
    open[(5 * C + 7) * 4 + 2] = 1; open[(6 * C + 7) * 4 + 0] = 1; open[(9 * C + 7) * 4 + 0] = 1; open[(8 * C + 7) * 4 + 2] = 1;
    // the hedges: everything a hedge, then the cells and their open sides carved
    const hedge = (x, z) => { for (let y = f; y <= f + 2; y++) K.set(x, y, z, y === f + 2 && (x + z) % 9 === 0 ? 'flowering_azalea_leaves' : 'vx_hedge', y === f + 2 && (x + z) % 9 === 0 ? LEAF : undefined); };
    for (let z = 0; z < LD; z++) for (let x = 0; x < LW; x++) hedge(x, z);
    const pathAt = (x, z) => { K.set(x, g0, z, (x * 7 + z * 3) % 11 === 0 ? 'moss_block' : 'gravel'); for (let y = f; y <= f + 3; y++) K.air(x, y, z); };
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
      const x0 = 1 + i * S, z0 = 1 + j * S;
      for (let z = z0; z < z0 + 3; z++) for (let x = x0; x < x0 + 3; x++) pathAt(x, z);
      if (open[(j * C + i) * 4 + 1]) for (let z = z0; z < z0 + 3; z++) pathAt(x0 + 3, z);
      if (open[(j * C + i) * 4 + 2]) for (let x = x0; x < x0 + 3; x++) pathAt(x, z0 + 3);
    }
    for (let x = 29; x <= 31; x++) pathAt(x, 0);                         // the way in at the front
    for (let x = 29; x <= 31; x++) pathAt(x, LD - 1);                    // and out at the back
    // the garden: clear the 3 × 3 cells, a lawn with flower beds, paths, the fountain, lamps
    for (let z = 25; z <= 35; z++) for (let x = 25; x <= 35; x++) { K.set(x, g0, z, 'grass_block'); for (let y = f; y <= f + 3; y++) K.air(x, y, z); }
    for (let z = 25; z <= 35; z++) for (let x = 25; x <= 35; x++) { const d = Math.hypot(x - mid, z - mid); if (d >= 4.5 && d <= 5.6 || Math.abs(x - mid) <= 1 || Math.abs(z - mid) <= 1) K.set(x, g0, z, 'smooth_quartz'); }
    for (const [x, z] of [[26, 26], [34, 26], [26, 34], [34, 34]]) { K.set(x, f, z, rng.pick(['vx_flowerbed_roses', 'vx_flowerbed_tulips', 'vx_flowerbed'])); H.post(x + (x < mid ? -1 : 1), f, z + (z < mid ? -1 : 1), 'vx_lamppost_crystal'); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = mid + Math.round(Math.cos(a) * 3.8), z = mid + Math.round(Math.sin(a) * 3.8); if (Math.abs(x - mid) > 1 && Math.abs(z - mid) > 1) K.set(x, f, z, 'pink_petals', { count: 3 }); }
    // the fountain: a quartz basin (radius 3), water, a pedestal with the heart; jets of light in the water
    H.ring(mid, mid, 3, f, 'smooth_quartz_slab', { type: 0 }); H.disc(mid, mid, 2.2, g0, 'tide_lantern'); H.disc(mid, mid, 2.2, f, 'water');
    K.set(mid, f, mid, 'chiseled_quartz_block'); K.set(mid, f + 1, mid, 'tide_lantern');
    for (const [a, b] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) K.set(mid + a, g0, mid + b, 'sunstone');
    // lamps at some of the maze's corners (on the hedge tops), a crystal light at every dead end
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
      if (plaza(i, j)) continue;
      const x0 = 1 + i * S, z0 = 1 + j * S, ways = [0, 1, 2, 3].filter(d => open[(j * C + i) * 4 + d]).length;
      if (ways === 1) K.set(x0 + 1, f, z0 + 1, 'vx_lantern_crystal');
      if ((i + j * 3) % 5 === 0) K.set(x0 + 3, f + 3, z0 + 3, 'vx_garden_lamp');
    }
    // more light for the night: a crystal lamp on the north-west corner of every third or fourth cell (the corner is
    // beside the way, never on its middle — the paths stay open)
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) if (!plaza(i, j) && (i * 2 + j * 3) % 4 === 0) K.set(1 + i * S, f, 1 + j * S, 'vx_lantern_crystal');
    // the rotunda over the fountain: eight white columns, a ring, a dome of gold and glass, a crystal light on top —
    // seen from outside the maze, where its heart is
    const RR = 5;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, x = mid + Math.round(Math.cos(a) * RR), z = mid + Math.round(Math.sin(a) * RR); K.set(x, g0, z, 'smooth_quartz'); for (let y = f; y <= f + 6; y++) K.set(x, y, z, 'quartz_pillar', { axis: 0 }); }
    H.ring(mid, mid, RR, f + 7, 'chiseled_quartz_block'); H.ring(mid, mid, RR + 0.6, f + 7, 'chiseled_quartz_block');
    for (let y = f + 8; y <= f + 12; y++) { const r = RR * Math.sqrt(Math.max(0, 1 - Math.pow((y - f - 7) / 5.5, 2))); H.ring(mid, mid, r, y, (y & 1) ? 'gold_block' : 'yellow_stained_glass'); }
    K.set(mid, f + 13, mid, 'gold_block'); K.set(mid, f + 14, mid, 'vx_lantern_crystal');
    for (let y = f + 4; y <= f + 6; y++) K.set(mid, y + 5, mid, 'iron_chain', { axis: 0 }); K.set(mid, f + 8, mid, 'lantern', { hanging: 1 });
    // the lookouts: an open pavilion over each front corner — posts, a deck over the hedges, a stair up its side,
    // a railing, a little roof and a lantern
    for (const sx of [0, 1]) {
      const x0 = sx ? LW - 6 : 1, z0 = 1;
      for (let z = z0; z <= z0 + 4; z++) for (let x = x0; x <= x0 + 4; x++) { K.set(x, g0, z, 'oak_planks'); for (let y = f; y <= f + 3; y++) K.air(x, y, z); }
      for (const [a, b] of [[0, 0], [4, 0], [0, 4], [4, 4]]) K.col(x0 + a, z0 + b, f, f + 7, 'stripped_oak_log', { axis: 0 });
      K.box(x0, f + 4, z0, x0 + 4, f + 4, z0 + 4, 'oak_planks');
      for (let x = x0; x <= x0 + 4; x++) for (const z of [z0, z0 + 4]) if (x > x0 && x < x0 + 4) K.set(x, f + 5, z, 'oak_fence');
      for (let z = z0 + 1; z < z0 + 4; z++) K.set(sx ? x0 : x0 + 4, f + 5, z, 'oak_fence');
      // the stair: up along the inner side, from the maze's front path
      const sxx = sx ? x0 + 4 : x0, dir = 2;
      for (let k = 0; k < 4; k++) { K.set(sxx, f + k, z0 + k, 'oak_stairs', { facing: dir, half: 0 }); for (let q = 1; q <= 3; q++) if (f + k + q <= f + 3 || q === 1) K.air(sxx, f + k + q, z0 + k); }
      K.air(sxx, f + 4, z0 + 1); K.air(sxx, f + 4, z0 + 2); K.air(sxx, f + 4, z0 + 3);
      for (let k = 0; k < 3; k++) K.box(x0 - 1 + k, f + 8 + k, z0 - 1 + k, x0 + 5 - k, f + 8 + k, z0 + 5 - k, 'vollton_terracotta');
      K.set(x0 + 2, f + 7, z0 + 2, 'lantern', { hanging: 1 });
    }
    // topiary balls on the hedge tops here and there
    for (let k = 0; k < 18; k++) { const i = rng.int(C), j = rng.int(C); if (plaza(i, j)) continue; const x = 4 + i * S, z = 4 + j * S; if (x >= LW - 1 || z >= LD - 1) continue; K.set(x, f + 3, z, rng.chance(0.3) ? 'flowering_azalea_leaves' : 'azalea_leaves', LEAF); }
    return Object.assign(K.grid, { meta: meta(K, { door: mid, m: { name: 'Labyrinthgarten', heart: [mid, f + 1 + dy, mid], top: f + 14 + dy } }) });
  };

  // ---------------------------------------------------------------- ☀️ Sonnenpyramide
  // eight tiers of sandstone with terracotta and turquoise bands and golden edges, twin stairs up the front to a
  // golden shrine with a glowing sun disc, between them the portal: a lit corridor to the chamber of the heart
  W.GENS.pyramide = function (P, env, rng) {
    const LW = 51, LD = 57, dy = -1, g0 = 0, f = 1, cx = 25, cz = 33, half = 22, tiers = 8, TH = 3;
    const topY = f + tiers * TH, K = Forge.kit(LW, topY + 18, LD, dy), H = helpers(K);
    K.box(0, g0, 0, LW - 1, g0, LD - 1, 'sand'); K.box(cx - 7, g0, 0, cx + 7, g0, cz - half, 'smooth_sandstone');
    for (let v = 0; v < cz - half; v += 2) { K.set(cx - 7, g0, v, 'vollton_turquoise'); K.set(cx + 7, g0, v, 'vollton_turquoise'); }
    // the tiers
    for (let t = 0; t < tiers; t++) {
      const hw = half - Math.round(t * 2.2), y0 = f + t * TH;
      for (let y = y0; y < y0 + TH; y++) for (let z = cz - hw; z <= cz + hw; z++) for (let x = cx - hw; x <= cx + hw; x++) {
        const edge = Math.max(Math.abs(x - cx), Math.abs(z - cz)) === hw;
        K.set(x, y, z, !edge ? 'sandstone' : y === y0 + TH - 1 ? ((x + z) % 4 === 0 ? 'ochre_mire_light' : 'gold_block') : y === y0 + 1 ? (t & 1 ? 'vollton_turquoise' : 'orange_terracotta') : (x + z) % 2 ? 'cut_sandstone' : 'smooth_sandstone');
      }
    }
    // twin stairs up the front face (beside the portal), five wide each, from the plaza to the top
    // (the last step is level with the top platform; one lower for every cell out toward the plaza)
    const front = cz - half, th = half - Math.round((tiers - 1) * 2.2), need = topY - f, vTop = cz - th;
    for (const [s0, s1] of [[cx - 9, cx - 4], [cx + 4, cx + 9]]) for (let k = 0; k <= need; k++) {
      const y = f + k, v = vTop - 1 - need + k;
      if (v < 1) continue;
      for (let u = s0; u <= s1; u++) { K.set(u, y, v, 'smooth_sandstone_stairs', { facing: 2, half: 0 }); for (let yy = f; yy < y; yy++) { const c = K.get(u, yy, v); if (c === 0xFFFF || c === 0) K.set(u, yy, v, 'sandstone'); } for (let q = 1; q <= 3; q++) K.air(u, y + q, v); }
      // the balustrades: a sandstone kerb with braziers every four steps
      for (const u of [s0 - 1, s1 + 1]) { for (let yy = f; yy <= y; yy++) { const c = K.get(u, yy, v); if (c === 0xFFFF || c === 0) K.set(u, yy, v, 'cut_sandstone'); } if (k % 4 === 0) K.set(u, y + 1, v, 'campfire', { facing: 2, lit: 1 }); }
    }
    // the top: the platform and the golden shrine with its sun disc facing the front
    K.box(cx - th, topY, cz - th, cx + th, topY, cz + th, 'smooth_sandstone');
    for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) K.col(cx + a, cz + b, topY + 1, topY + 4, 'chiseled_sandstone');
    for (let k = 0; k < 4; k++) K.box(cx - 3 + k, topY + 5 + k, cz - 3 + k, cx + 3 - k, topY + 5 + k, cz + 3 - k, 'gold_block');
    const sy = topY + 13;
    for (let y = sy - 4; y <= sy + 4; y++) for (let u = cx - 4; u <= cx + 4; u++) { const d = Math.hypot(u - cx, y - sy); if (d <= 4.4) K.set(u, y, cz, d > 3.4 ? 'gold_block' : 'sunstone'); }
    for (let y = topY + 9; y < sy - 4; y++) K.set(cx, y, cz, 'gold_block');
    // the portal and the corridor: lit with lanterns, golden bands, into the chamber at the centre
    const ch = 5, chY = f;
    for (let v = 1; v <= cz - ch; v++) for (let u = cx - 1; u <= cx + 1; u++) { K.set(u, g0, v, v % 3 ? 'smooth_sandstone' : 'gold_block'); for (let y = f; y <= f + 3; y++) K.air(u, y, v); }
    for (let v = front; v <= cz - ch; v++) { for (const u of [cx - 2, cx + 2]) for (let y = f; y <= f + 3; y++) K.set(u, y, v, y === f + 2 && v % 4 === 0 ? 'vx_lantern' : (y === f + 3 ? 'chiseled_sandstone' : 'cut_sandstone')); for (let u = cx - 2; u <= cx + 2; u++) K.set(u, f + 4, v, 'cut_sandstone'); }
    for (const du of [-3, 3]) for (let y = f; y <= f + 5; y++) K.set(cx + du, y, front - 1, y === f + 5 ? 'gold_block' : 'chiseled_sandstone');
    K.box(cx - 3, f + 6, front - 1, cx + 3, f + 6, front - 1, 'gold_block'); K.set(cx - 3, f + 7, front - 1, 'campfire', { facing: 2, lit: 1 }); K.set(cx + 3, f + 7, front - 1, 'campfire', { facing: 2, lit: 1 });
    // the chamber: golden walls with turquoise, a light ceiling, rays of gold on the floor, the sun stone heart
    for (let z = cz - ch; z <= cz + ch; z++) for (let x = cx - ch; x <= cx + ch; x++) {
      const edge = Math.max(Math.abs(x - cx), Math.abs(z - cz)) === ch;
      K.set(x, g0, z, Math.abs(x - cx) === Math.abs(z - cz) || x === cx || z === cz ? 'gold_block' : 'smooth_sandstone');
      for (let y = chY; y <= chY + 6; y++) K.set(x, y, z, edge ? (y === chY + 2 ? 'vollton_turquoise' : y === chY + 6 ? 'gold_block' : 'cut_sandstone') : (y === chY + 6 ? ((x + z) % 2 ? 'ochre_mire_light' : 'chiseled_sandstone') : 0));
    }
    for (let u = cx - 1; u <= cx + 1; u++) for (let y = f; y <= f + 3; y++) K.air(u, y, cz - ch);
    K.set(cx, f, cz, 'gold_block'); K.set(cx, f + 1, cz, 'sunstone');
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.set(cx + a, f, cz + b, 'amber_crystal_cluster', { facing: 4, size: 1 });
    for (const [a, b] of [[-ch + 1, -ch + 1], [ch - 1, -ch + 1], [-ch + 1, ch - 1], [ch - 1, ch - 1]]) K.set(cx + a, f, cz + b, 'vx_lantern');
    // the plaza: palms and braziers
    for (const [x, z] of [[4, 4], [LW - 5, 4], [4, LD - 5], [LW - 5, LD - 5]]) { if (VR.VillageGen && VR.VillageGen.palm) VR.VillageGen.palm((xx, yy, zz, s) => K.set(xx, yy - 64, zz, s), x, f + 64, z, 7); }
    for (const x of [cx - 7, cx + 7]) { K.set(x, f, 2, 'chiseled_sandstone'); K.set(x, f + 1, 2, 'campfire', { facing: 2, lit: 1 }); }
    return Object.assign(K.grid, { meta: meta(K, { door: cx, m: { name: 'Sonnenpyramide', heart: [cx, f + 1 + dy, cz], top: sy + 4 + dy } }) });
  };

  // ---------------------------------------------------------------- 🌙 Mondtempel
  // a ring of white columns round a round, dark reflecting pool, a frieze of lavender and ice, blue lanterns hanging
  // between the columns, a crescent moon of light standing in the water at the back, a causeway of stepping stones out
  // to the island in the middle: the moonstone heart
  W.GENS.mondtempel = function (P, env, rng) {
    const LW = 45, LD = 55, dy = -2, g0 = 1, f = 2, cx = 22, cz = 30;
    const K = Forge.kit(LW, 36, LD, dy), H = helpers(K);
    K.box(0, 0, 0, LW - 1, g0, LD - 1, 'grass_block'); K.box(0, 0, 0, LW - 1, 0, LD - 1, 'dirt');
    const PR = 12, CR = 16, SR = 19, fl = f + 2;                 // pool, columns, platform radius; the temple's feet row
    // the platform: two round white steps, a marble floor with a ring of lavender
    for (let z = cz - SR - 1; z <= cz + SR + 1; z++) for (let x = cx - SR - 1; x <= cx + SR + 1; x++) {
      const d = Math.hypot(x - cx, z - cz); if (d > SR + 1.5) continue;
      const out = (dd) => { const a = Math.atan2(z - cz, x - cx); return Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 3 : 1) : (Math.sin(a) > 0 ? 0 : 2); };
      if (d > SR + 0.5) K.set(x, f, z, 'marble_white_stairs', { facing: out(d), half: 0 });
      else { K.set(x, f, z, 'marble_white'); K.set(x, f + 1, z, d > SR - 0.5 ? 'marble_white_stairs' : (d > CR + 1.5 && d < CR + 2.5) || (d > PR + 0.6 && d < PR + 1.6) ? 'vollton_lavender' : 'floor_marble', d > SR - 0.5 ? { facing: out(d), half: 0 } : undefined); }
    }
    // the pool: a dark blue bed two deep, little lights under the water round its rim, a white rim
    for (let z = cz - PR; z <= cz + PR; z++) for (let x = cx - PR; x <= cx + PR; x++) {
      const d = Math.hypot(x - cx, z - cz); if (d > PR + 0.5) continue;
      if (d > PR - 0.6) { K.set(x, f + 1, z, 'chiseled_quartz_block'); continue; }
      K.set(x, f - 1, z, d > PR - 1.6 && (x + z) % 3 === 0 ? 'tide_lantern' : 'vollton_navy'); K.set(x, f, z, 'water'); K.set(x, f + 1, z, 'water');
    }
    // the columns: sixteen round the pool, an architrave ring with a frieze, blue lanterns hanging between them
    const NC = 16, cols = [];
    for (let k = 0; k < NC; k++) { const a = k / NC * Math.PI * 2 + Math.PI / NC, x = cx + Math.round(Math.cos(a) * CR), z = cz + Math.round(Math.sin(a) * CR); cols.push([x, z]); K.set(x, fl, z, 'chiseled_quartz_block'); for (let y = fl + 1; y <= fl + 8; y++) K.set(x, y, z, 'quartz_pillar', { axis: 0 }); }
    for (let z = cz - CR - 1; z <= cz + CR + 1; z++) for (let x = cx - CR - 1; x <= cx + CR + 1; x++) {
      const d = Math.hypot(x - cx, z - cz); if (d > CR + 1.5 || d < CR - 1.5) continue;
      K.set(x, fl + 9, z, 'chiseled_quartz_block'); K.set(x, fl + 10, z, (Math.round(Math.atan2(z - cz, x - cx) * 8) & 1) ? 'vollton_lavender' : 'vollton_ice_blue'); K.set(x, fl + 11, z, 'smooth_quartz_slab', { type: 0 });
      if (d > CR - 0.5 && d < CR + 0.5 && !cols.some(([a, b]) => a === x && b === z) && (x + z) % 2 === 0) { K.set(x, fl + 8, z, 'iron_chain', { axis: 0 }); K.set(x, fl + 7, z, 'spirit_lantern', { hanging: 1 }); }
    }
    for (const [x, z] of cols) K.set(x, fl + 12, z, 'spirit_lantern');
    // the gate at the front: two tall columns, a lintel with a little crescent of light; the way to it
    const gz = cz - CR;
    for (let x = cx - 2; x <= cx + 2; x++) for (let y = fl; y <= fl + 8; y++) if (Math.abs(x - cx) < 2) K.air(x, y, gz);
    for (const du of [-2, 2]) { K.set(cx + du, fl, gz, 'chiseled_quartz_block'); for (let y = fl + 1; y <= fl + 13; y++) K.set(cx + du, y, gz, 'quartz_pillar', { axis: 0 }); }
    K.box(cx - 3, fl + 14, gz, cx + 3, fl + 14, gz, 'chiseled_quartz_block');
    for (const [a, b] of [[-1, 0], [0, 1], [1, 0], [-1, 2], [1, 2], [0, -1]]) K.set(cx + a, fl + 15 + b, gz, 'light_panel');
    for (let z = 0; z < cz - SR - 1; z++) for (let u = cx - 2; u <= cx + 2; u++) K.set(u, g0, z, u === cx - 2 || u === cx + 2 ? 'vollton_lavender' : 'smooth_quartz');
    // the causeway: white stepping stones over the water from the gate to the island
    for (let z = cz - PR; z < cz - 2; z++) for (let u = cx - 1; u <= cx + 1; u++) K.set(u, f + 1, z, (z & 1) || u === cx ? 'marble_white' : 'water');
    // the island and the moonstone heart, little blue lights round it
    H.disc(cx, cz, 2.6, f + 1, 'marble_white'); H.disc(cx, cz, 2.6, f, 'marble_white');
    K.set(cx, fl, cz, 'chiseled_quartz_block'); K.set(cx, fl + 1, cz, 'tide_lantern');
    for (const [a, b] of [[-2, 0], [2, 0], [0, 2]]) K.set(cx + a, fl, cz + b, 'spirit_lantern');
    // the crescent moon at the back, standing in the water: light panels with a bright rim
    const mz = cz + PR - 3, my = fl + 10, mr = 7;
    for (let y = my - mr; y <= my + mr; y++) for (let x = cx - mr; x <= cx + mr; x++) { const d1 = Math.hypot(x - cx, y - my), d2 = Math.hypot(x - cx - 3.2, y - my - 1.6); if (d1 <= mr + 0.3 && d2 > mr - 0.4) K.set(x, y, mz, d1 > mr - 0.9 || d2 < mr + 0.6 ? 'tide_lantern' : 'light_panel'); }
    for (let y = fl; y < my - mr + 2; y++) K.set(cx - 3, y, mz, 'quartz_pillar', { axis: 0 });
    // lamps outside, pale flowers
    for (const [x, z] of [[cx - 4, 2], [cx + 4, 2], [2, cz], [LW - 3, cz], [cx - 14, 8], [cx + 14, 8]]) H.post(x, f, z, 'vx_lamppost_crystal');
    for (let k = 0; k < 40; k++) { const x = rng.int(LW), z = rng.int(LD); if (K.get(x, g0, z) === Forge.st('grass_block') && K.get(x, f, z) === 0xFFFF) K.set(x, f, z, rng.pick(['lily_of_the_valley', 'allium', 'azure_bluet', 'vx_bush', 'oxeye_daisy'])); }
    return Object.assign(K.grid, { meta: meta(K, { door: cx, m: { name: 'Mondtempel', heart: [cx, fl + 1 + dy, cz], top: fl + 17 + dy } }) });
  };
})(VR);

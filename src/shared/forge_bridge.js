// ============================================================================
// 🌉 Brücke and 🧱 Mauer / Zaun / Hecke — the two linear types that read the
// ground: a bridge keeps its deck level and drops piers, abutments and tower
// legs onto whatever is below (the placer samples the terrain under the lot);
// a wall steps with the ground segment by segment.
// Bridge kinds: Balken (a girder on piers every twelve), Bogen (segmental
// arches per bay, filled spandrels, an upside-down-stair intrados), Hänge
// (two portal towers, a catenary main cable of chains with hangers every two,
// anchorages at both ends). Road decks have an asphalt centre line and kerbs,
// footpaths planks or pavers; railings on both edges, lamps every eight.
// Styles: Stahl, Stein, Holz, Beton. Walls: stone / brick / sandstone with
// pillars and a gate, picket or iron fences, hedges.
// ============================================================================
(function (VR) {
  'use strict';
  const Forge = VR.Forge; if (!Forge || !Forge.kit) return;
  const B = {
    stahl: { name: 'Stahl', pier: 'concrete_smooth', girder: 'black_metal', deck: 'asphalt', path: 'paver_grey', rail: 'vx_railing_black', lamp: 'vx_lamppost_black', tower: 'black_metal', cable: 'iron_chain', arch: 'concrete_smooth', ring: 'concrete_smooth_stairs', kerb: 'paver_grey' },
    stein: { name: 'Stein', pier: 'stone_bricks', girder: 'stone_bricks', deck: 'granite_paver', path: 'paver_grey', rail: 'stone_brick_wall', lamp: 'vx_lamppost', tower: 'stone_bricks', cable: 'iron_chain', arch: 'stone_bricks', ring: 'stone_brick_stairs', kerb: 'stone_bricks' },
    holz: { name: 'Holz', pier: 'oak_log', pierPr: { axis: 0 }, girder: 'oak_planks', deck: 'deck_wood', path: 'deck_wood', rail: 'oak_fence', lamp: 'vx_lamppost', tower: 'oak_log', towerPr: { axis: 0 }, cable: 'iron_chain', arch: 'oak_planks', ring: 'oak_stairs', kerb: 'oak_planks' },
    beton: { name: 'Beton', pier: 'concrete_smooth', girder: 'concrete_smooth', deck: 'asphalt', path: 'paver_grey', rail: 'glass_rail', lamp: 'vx_lamppost_black', tower: 'concrete_smooth', cable: 'iron_chain', arch: 'concrete_smooth', ring: 'concrete_smooth_stairs', kerb: 'concrete_smooth' },
  };
  Forge.register({
    id: 'bridge', icon: '🌉', name: 'Brücke', en: 'Bridge', level: false, terrain: true, sh: 1,
    params: [
      { k: 'l', label: 'Länge', min: 10, max: 120, def: 40, dim: true },
      { k: 'w', label: 'Breite', min: 3, max: 9, def: 5, dim: true },
      { k: 'k', label: 'Bauart', min: 0, max: 2, def: 0, names: ['Balken', 'Bogen', 'Hängebrücke'] },
      { k: 'r', label: 'Deck', min: 0, max: 1, def: 1, names: ['Fußweg', 'Straße'] },
      { k: 'm', label: 'Laternen', min: 0, max: 1, def: 1 },
    ],
    styles: Object.keys(B).map(id => ({ id, name: B[id].name })),
    lot: (P) => [P.params.w, P.params.l],
    title: (P) => ['Balkenbrücke', 'Bogenbrücke', 'Hängebrücke'][P.params.k],
    describe: (P) => [P.params.l + ' lang', P.params.w + ' breit', P.params.r ? 'Straße' : 'Fußweg'].concat(P.params.m ? ['Laternen'] : []),
  }, function (P, env) {
    const { l, w, k, r, m } = P.params, S = B[P.style] || B.stahl;
    const G = (u, v) => Math.max(-env.depth, Math.min(-1, Math.round(env.ground(u, v))));
    let minG = -1; for (let v = 0; v < l; v++) for (let x = 0; x < w; x++) minG = Math.min(minG, G(x, v));
    const towerH = k === 2 ? Math.max(8, Math.min(24, Math.round(l / 6) + 2)) : 0, archH = k === 1 ? Math.max(3, Math.min(10, Math.round(l / 8))) : 0;
    const dy = Math.max(-env.depth, minG), deck = -dy, K = Forge.kit(w, deck + 4 + towerH, l, dy);
    const pierMat = (x, y, v) => K.set(x, y, v, S.pier, S.pierPr);
    // ---- the deck: a girder row under it, the surface, kerbs and the centre line, the railings, lamps
    for (let v = 0; v < l; v++) for (let x = 0; x < w; x++) {
      const edge = x === 0 || x === w - 1;
      let mat = r ? S.deck : S.path, pr;
      if (r && w >= 5 && edge) mat = S.kerb;
      else if (r && w >= 5 && S.deck === 'asphalt' && x === (w >> 1) && (v & 1)) { mat = 'asphalt_dash'; pr = { axis: 2 }; }
      K.set(x, deck, v, mat, pr);
      K.set(x, deck - 1, v, S.girder);
      if (edge) K.set(x, deck + 1, v, m && v % 8 === 4 ? S.lamp : S.rail);
    }
    // three rows of headroom over the deck (a branch or a bank in the way is cut back; the railings stay)
    for (let v = 0; v < l; v++) for (let x = 0; x < w; x++) {
      const edge = x === 0 || x === w - 1; if (edge && Math.round(env.ground(x, v)) < 1) continue;
      for (let y = deck + 1; y <= deck + 3; y++) if (!(y === deck + 1 && edge)) K.air(x, y, v);
    }
    // the ends: a step up from the bank onto the deck, abutments filled to the ground
    for (let x = 0; x < w; x++) { K.set(x, deck, 0, r ? S.deck : S.path); K.set(x, deck, l - 1, r ? S.deck : S.path); }
    for (const v of [0, 1, l - 2, l - 1]) for (let x = 0; x < w; x++) for (let y = deck - 1; y >= deck + G(x, v) + 1; y--) pierMat(x, y, v);
    // ---- the structure under the deck
    if (k === 0) {
      // Balken: piers every twelve (two columns at the edges, a cross wall between them)
      const n = Math.max(1, Math.round((l - 4) / 12)), pitch = (l - 4) / (n + 1);
      for (let i = 1; i <= n; i++) {
        const v = Math.round(2 + pitch * i);
        for (let x = 1; x < w - 1; x++) for (let y = deck - 2; y >= deck + G(x, v) + 1; y--) pierMat(x, y, v);
        for (let x = 0; x < w; x++) if (deck - 2 >= deck + G(x, v) + 1 && (K.get(x, deck - 2, v) === K.KEEP || K.get(x, deck - 2, v) === 0)) K.set(x, deck - 2, v, S.pier, S.pierPr);   // the cap beam
      }
    } else if (k === 1) {
      // Bogen: segmental arches between piers, spandrels filled, the intrados rounded with upside-down stairs
      const bays = Math.max(1, Math.round(l / 16)), span = l / bays;
      for (let b = 0; b < bays; b++) {
        const v0 = b * span, v1 = (b + 1) * span, vc = (v0 + v1) / 2, half = (v1 - v0) / 2;
        for (let v = Math.max(0, Math.floor(v0)); v < Math.min(l, Math.ceil(v1)); v++) {
          const t = (v + 0.5 - vc) / half, h = archH * (1 - t * t), bot = Math.round(deck - 1 - archH + h);   // the lowest solid row at this v
          for (let x = 0; x < w; x++) {
            const gy = deck + G(x, v) + 1;
            for (let y = deck - 2; y >= Math.max(bot, gy); y--) K.set(x, y, v, S.arch);
            if (x > 0 && x < w - 1 && S.ring && bot - 1 >= gy && bot > deck - 1 - archH) {
              const tl = ((v - 0.5 - vc) / half), hl = archH * (1 - tl * tl), botL = Math.round(deck - 1 - archH + hl);
              if (botL < bot && v > 0) K.set(x, bot - 1, v, S.ring, { facing: 0, half: 1 });
              const tr = ((v + 1.5 - vc) / half), hr = archH * (1 - tr * tr), botR = Math.round(deck - 1 - archH + hr);
              if (botR < bot && v < l - 1 && K.get(x, bot - 1, v) === K.KEEP) K.set(x, bot - 1, v, S.ring, { facing: 2, half: 1 });
            }
          }
        }
        // the pier between two bays goes to the ground
        if (b < bays - 1) { const pv = Math.round(v1) - 1; for (let x = 0; x < w; x++) for (let y = deck - 2; y >= deck + G(x, pv) + 1; y--) pierMat(x, y, pv); for (let x = 0; x < w; x++) for (let y = deck - 2; y >= deck + G(x, pv + 1) + 1; y--) pierMat(x, y, pv + 1); }
      }
    } else {
      // Hängebrücke: two portal towers, the main cables, hangers, anchorages
      const tv = [Math.round(l / 4), Math.round(3 * l / 4)], topY = deck + towerH;
      for (const v of tv) for (const x of [0, 1, w - 2, w - 1]) for (let y = deck + G(x, v) + 1; y <= topY; y++) K.set(x, y, v, S.tower, S.towerPr);
      for (const v of tv) { for (let x = 0; x < w; x++) { K.set(x, topY, v, S.tower, S.towerPr); K.set(x, deck + Math.round(towerH / 2), v, S.tower, S.towerPr); } K.set(0, topY + 1, v, 'vx_lamppost_tech'); K.set(w - 1, topY + 1, v, 'vx_lamppost_tech'); }
      // the cable: a parabola from tower top to tower top with its low point two over the deck, straight runs to the anchorages
      const cable = (x, v) => {
        let y;
        if (v >= tv[0] && v <= tv[1]) { const t = (v - tv[0]) / (tv[1] - tv[0]) * 2 - 1; y = deck + 2 + (towerH - 2) * t * t; }
        else if (v < tv[0]) { const t = v / tv[0]; y = deck + 1 + (towerH - 1) * t; }
        else { const t = (l - 1 - v) / (l - 1 - tv[1]); y = deck + 1 + (towerH - 1) * t; }
        return Math.round(y);
      };
      for (const x of [0, w - 1]) {
        let prev = null;
        for (let v = 0; v < l; v++) {
          const y = cable(x, v);
          K.set(x, y, v, S.cable, { axis: prev !== null && Math.abs(y - prev) > 1 ? 0 : 2 });
          if (prev !== null) { const lo = Math.min(prev, y), hi = Math.max(prev, y); for (let yy = lo + 1; yy < hi; yy++) K.set(x, yy, v, S.cable, { axis: 0 }); }
          if (v % 2 === 0 && !tv.includes(v) && v > 1 && v < l - 2) for (let yy = deck + 2; yy < y; yy++) K.set(x, yy, v, S.cable, { axis: 0 });   // hangers
          prev = y;
        }
        for (const v of [0, l - 1]) for (let y = deck + 1; y <= deck + 2; y++) K.set(x, y, v, S.pier, S.pierPr);   // anchorages
      }
    }
    K.grid.meta = { name: ['Balkenbrücke', 'Bogenbrücke', 'Hängebrücke'][k], doors: [[w >> 1, 1, 0]], floors: [0], top: deck + 2 + towerH + dy, lot: [w, l], anchor: [w >> 1, 0], deck: 0 };
    return K.grid;
  });

  // ---------------------------------------------------------------- 🧱 Mauer / Zaun / Hecke
  const WS = {
    stein: { name: 'Stein', body: 'stone_bricks', top: 'stone_brick_wall', pillar: 'stone_bricks', cap: 'stone_brick_slab', fence: 'iron_bars', post: 'stone_bricks', lamp: 'vx_lamppost' },
    backstein: { name: 'Backstein', body: 'bricks', top: 'brick_wall', pillar: 'bricks', cap: 'brick_slab', fence: 'iron_bars', post: 'bricks', lamp: 'vx_lamppost_black' },
    holz: { name: 'Holz', body: 'oak_planks', top: 'oak_fence', pillar: 'oak_log', pillarPr: { axis: 0 }, cap: 'oak_slab', fence: 'vx_fence_wood', post: 'oak_fence', lamp: 'vx_lamppost' },
    metall: { name: 'Metall', body: 'black_metal', top: 'iron_bars', pillar: 'black_metal', cap: 'charcoal_panel', fence: 'iron_bars', post: 'black_metal', lamp: 'vx_lamppost_black' },
    sandstein: { name: 'Sandstein', body: 'sandstone', top: 'sandstone_wall', pillar: 'smooth_sandstone', cap: 'smooth_sandstone_slab', fence: 'iron_bars', post: 'smooth_sandstone', lamp: 'vx_lamppost' },
  };
  Forge.register({
    id: 'wall', icon: '🧱', name: 'Mauer/Zaun', en: 'Wall/fence', level: false, terrain: true, sh: 1,
    params: [
      { k: 'l', label: 'Länge', min: 4, max: 120, def: 24, dim: true },
      { k: 'h', label: 'Höhe', min: 1, max: 6, def: 3, dim: true },
      { k: 'k', label: 'Art', min: 0, max: 2, def: 0, names: ['Mauer', 'Zaun', 'Hecke'] },
      { k: 'g', label: 'Tor', min: 0, max: 1, def: 1 },
    ],
    styles: Object.keys(WS).map(id => ({ id, name: WS[id].name })),
    lot: (P) => [3, P.params.l],
    title: (P) => ['Mauer', 'Zaun', 'Hecke'][P.params.k],
    describe: (P) => [P.params.l + ' lang', P.params.h + ' hoch'].concat(P.params.g ? ['mit Tor'] : []),
  }, function (P, env) {
    const { l, h, k, g } = P.params, S = WS[P.style] || WS.stein;
    // the ground under every segment, down into a valley or up a hill (the placer samples 40 over and 48 under the floor)
    const G = (v) => Math.max(-env.depth, Math.min(40, Math.round(env.ground(1, v))));
    let minG = 99, maxG = -99; for (let v = 0; v < l; v++) { minG = Math.min(minG, G(v)); maxG = Math.max(maxG, G(v)); }
    const dy = minG + 1, K = Forge.kit(3, maxG - minG + h + 3, l, dy), X = 1;
    const gate = g && l >= 8 ? [(l >> 1) - 1, l >> 1] : [];
    // a wall or hedge steps like a real one on a slope: level runs between pillars, a new run every six and wherever the
    // ground has moved two from where the run began; each run is h over its highest ground, so the top never zigzags
    const run = new Int16Array(l), runTop = []; let r0 = 0;
    for (let v = 0; v < l; v++) { if (v > 0 && (v - r0 >= 6 || Math.abs(G(v) - G(r0)) >= 2 || gate.includes(v) !== gate.includes(v - 1))) r0 = v; run[v] = r0; }
    for (let v = 0; v < l; v++) runTop[run[v]] = Math.max(runTop[run[v]] === undefined ? -99 : runTop[run[v]], G(v) + 1 + h);   // exclusive top, world rows
    const topAt = (v) => runTop[run[v]] - dy;
    for (let v = 0; v < l; v++) {
      const base = G(v) + 1 - dy, pillar = k !== 2 && (run[v] === v || v === l - 1 || gate.includes(v - 1) || gate.includes(v + 1));
      if (gate.includes(v)) { K.set(X, base, v, 'oak_fence_gate', { facing: 1, open: 0 }); if (k === 0 && h >= 3) for (let y = base + 2; y < base + h; y++) K.set(X, y, v, S.body); continue; }
      if (k === 2) { for (let y = base; y < topAt(v); y++) K.set(X, y, v, 'vx_hedge'); continue; }
      if (k === 1) {
        if (pillar) { for (let y = base; y < base + Math.max(2, h); y++) K.set(X, y, v, S.post, S.pillarPr); K.set(X, base + Math.max(2, h), v, v % 12 === 0 ? S.lamp : S.cap, v % 12 === 0 ? undefined : { type: 0 }); }
        else for (let y = base; y < base + Math.max(1, h - 1); y++) K.set(X, y, v, y === base && S.fence === 'vx_fence_wood' ? S.fence : S.fence === 'vx_fence_wood' ? 'oak_fence' : S.fence);
        continue;
      }
      if (pillar) {
        // a pillar stands one over the higher of the two runs it joins, a lamp on every other one
        const pt = Math.max(topAt(v), v > 0 ? topAt(v - 1) : 0, v < l - 1 && !gate.includes(v + 1) ? topAt(v + 1) : 0) + 1, lamp = h >= 2 && (v % 12 === 0 || v === l - 1);
        for (let y = base; y < pt; y++) K.set(X, y, v, S.pillar, S.pillarPr);
        K.set(X, pt, v, lamp ? S.lamp : S.cap, lamp ? undefined : { type: 0 });
      } else { const tp = topAt(v); for (let y = base; y < tp - 1; y++) K.set(X, y, v, S.body); K.set(X, tp - 1, v, h > 1 ? S.top : S.body); }
    }
    K.grid.meta = { name: ['Mauer', 'Zaun', 'Hecke'][k], doors: gate.length ? [[X, G(gate[0]) + 1, gate[0]]] : [], floors: [], top: h + 2 + maxG, lot: [3, l], anchor: [1, 0] };
    return K.grid;
  });
})(VR);

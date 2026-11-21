// ============================================================================
// v-flora · VR.Flora — plants grown from small seeded L-systems (docs/superpowers/plans/2026-11-05-v-flora.md).
// Biology as inspiration, our own grammars: a bud (A) at a branch's end grows into a short internode (F) and new buds
// at a branching angle, each new bud rolled by about the golden angle (137.5°, the phyllotaxis of many plants) so the
// branches spread round the axis; the rules are stochastic (weights) and seeded, so a seed gives the same plant every
// time, and two seeds give two plants of one species. A 3D turtle reads the string into segments (the wood) and
// blossom balls / hanging chains (the bloom); a voxeliser turns them into cells of three kinds (1 wood, 2 blossom,
// 3 green leaf). The generator (gen_land.js, vgen 17) writes the cells as ordinary blocks (logs, blossom leaves): no
// model, no new GL program — Very Low draws them as it draws every leaf.
// Pure (node, test/flora.js): expand · turtle · cells · grow · SPECIES · plant.
//   turtle symbols  F forward (draws) · f forward (no wood) · + − yaw · & ^ pitch · / \ roll · [ ] push / pop ·
//                   ! thinner · ' shorter · B a blossom ball · L a green leaf ball · H a hanging chain of blossom ·
//                   D droop (the heading bends toward the ground) · A/X/Y buds (no drawing; the final rule may turn
//                   them into blossom)
// ============================================================================
(function (VR) {
  'use strict';
  const FL = VR.Flora = VR.Flora || {};
  const DEG = Math.PI / 180;
  // a small seeded stream of its own (mulberry32): the plant never draws from the caller's stream
  function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  FL.rnd = rnd;
  // rules: { A: 'string' | [[weight, 'string'], …] }; n iterations; then `fin` (the same form) once; capped at `cap`
  // symbols (a runaway grammar stops growing; it never hangs)
  FL.expand = function (axiom, rules, n, seed, fin, cap) {
    const r = rnd(seed), CAP = cap || 6000;
    const pick = (rule) => {
      if (typeof rule === 'string') return rule;
      let sum = 0; for (const w of rule) sum += w[0];
      let u = r() * sum; for (const w of rule) { u -= w[0]; if (u <= 0) return w[1]; }
      return rule[rule.length - 1][1];
    };
    let s = axiom;
    const pass = (tab) => { let o = ''; for (let i = 0; i < s.length; i++) { const c = s[i], rule = tab[c]; o += rule ? pick(rule) : c; if (o.length > CAP) return o.slice(0, CAP); } return o; };
    for (let k = 0; k < n; k++) { s = pass(rules); if (s.length >= CAP) break; }
    if (fin) s = pass(fin);
    return s;
  };
  // the turtle: o { len, w (the trunk's radius), angle, pitch, roll (degrees), jit (0…1: the angles' jitter),
  //   wr, lr (the thinning and shortening factors), br (the blossom ball's radius), lb (the leaf ball's), chain
  //   [min, max] (a hanging chain's cells), droop (degrees a D bends) } → { segs: [x0,y0,z0,x1,y1,z1,r], balls:
  //   [x,y,z,r,kind], chains: [x,y,z,n] }
  FL.turtle = function (str, o, seed) {
    const r = rnd(seed ^ 0x9e3779b9);
    const jit = o.jit === undefined ? 0.25 : o.jit;
    let px = 0, py = 0, pz = 0, H = [0, 1, 0], L = [1, 0, 0], U = [0, 0, 1], w = o.w || 0.5, len = o.len || 1, depth = 0;
    const stack = [], segs = [], balls = [], chains = [];
    const rot = (a, b, ang) => {   // rotate vectors a and b round their common normal by ang
      const c = Math.cos(ang), s = Math.sin(ang);
      const na = [a[0] * c + b[0] * s, a[1] * c + b[1] * s, a[2] * c + b[2] * s], nb = [b[0] * c - a[0] * s, b[1] * c - a[1] * s, b[2] * c - a[2] * s];
      a[0] = na[0]; a[1] = na[1]; a[2] = na[2]; b[0] = nb[0]; b[1] = nb[1]; b[2] = nb[2];
    };
    const j = (deg) => (deg + (r() - 0.5) * 2 * jit * deg) * DEG;
    const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; };
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      switch (c) {
        case 'F': case 'f': case 'G': {
          const l = len * (1 + (r() - 0.5) * jit * 0.6);
          const nx = px + H[0] * l, ny = py + H[1] * l, nz = pz + H[2] * l;
          if (c === 'F') segs.push([px, py, pz, nx, ny, nz, w]);
          else if (c === 'G') segs.push([px, py, pz, nx, ny, nz, 0, 3]);   // (t-trees2: a leafy strand — a frond, a twig of needles)
          px = nx; py = ny; pz = nz;
          break;
        }
        case '+': rot(H, L, j(o.angle)); break;
        case '-': rot(H, L, -j(o.angle)); break;
        case '&': rot(H, U, j(o.pitch || o.angle)); break;
        case '^': rot(H, U, -j(o.pitch || o.angle)); break;
        case '/': rot(L, U, j(o.roll || 137.5)); break;
        case '\\': rot(L, U, -j(o.roll || 137.5)); break;
        case '!': w *= o.wr || 0.7; break;
        case '\'': len *= o.lr || 0.85; break;
        case 'D': {   // droop: bend the heading toward the ground by `droop` degrees (gravitropism of the thin twigs)
          const d = (o.droop || 25) * DEG;
          H[1] -= Math.sin(d); norm(H);
          break;
        }
        case '[': stack.push([px, py, pz, H.slice(), L.slice(), U.slice(), w, len, depth]); depth++; break;
        case ']': { const s = stack.pop(); if (s) { [px, py, pz] = s; H = s[3]; L = s[4]; U = s[5]; w = s[6]; len = s[7]; depth = s[8]; } break; }
        case 'B': balls.push([px, py, pz, (o.br || 1.6) * (0.85 + r() * 0.35), 2]); break;
        case 'L': balls.push([px, py, pz, (o.lb || 1.2) * (0.85 + r() * 0.3), 3]); break;
        case 'H': { const ch = o.chain || [2, 4]; chains.push([px, py, pz, ch[0] + Math.floor(r() * (ch[1] - ch[0] + 1))]); break; }
        default: break;
      }
    }
    return { segs, balls, chains };
  };
  // the cells of a shape: a Map of 'x,y,z' → kind (1 wood · 2 blossom · 3 leaf), relative to the foot. Wood wins over
  // everything; a blossom ball's shell is ragged (a hash per cell), its inside carries a little green (o.green)
  const H3 = (x, y, z, s) => { let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x85ebca6b) ^ (s | 0); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 12; return ((h >>> 0) & 0xffff) / 65536; };
  FL.cells = function (shape, o, seed) {
    const out = new Map(), green = o.green === undefined ? 0.12 : o.green;
    out.axis = new Map();   // a wood cell's log axis (0 up, 1 along x, 2 along z): its segment's main direction
    let segAxis = 0;
    const put = (x, y, z, k) => { const key = x + ',' + y + ',' + z, cur = out.get(key); if (cur === 1) return; if (cur === 2 && k === 3) return; out.set(key, k); if (k === 1) out.axis.set(key, segAxis); };
    for (const s of shape.balls) {
      const [bx, by, bz, br, kind] = s, R = Math.ceil(br);
      const cx = Math.round(bx), cy = Math.round(by), cz = Math.round(bz);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        const x = cx + dx, y = cy + dy, z = cz + dz, ex = x - bx, ey = (y - by) * 1.25, ez = z - bz;
        const d = Math.sqrt(ex * ex + ey * ey + ez * ez) / br;
        if (d > 1.05) continue;
        const h = H3(x, y, z, seed);
        if (br >= 1.9 && d > 0.72 && h < 0.3) continue;   // a ragged shell (big balls only: a small one would fall apart into loose cubes — the first pictures)
        put(x, y, z, kind === 2 && d < 0.75 && h > 1 - green ? 3 : kind);
      }
    }
    for (const c of shape.chains) {
      const x = Math.round(c[0]), z = Math.round(c[2]); let y = Math.round(c[1]) - 1;
      for (let k = 0; k < c[3]; k++, y--) put(x, y, z, 2);
    }
    for (const s of shape.segs) {
      const [x0, y0, z0, x1, y1, z1, rr] = s, l = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.max(1, Math.ceil(l / 0.35));
      if (s[7] === 3) { for (let k = 0; k <= n; k++) { const t = k / n; put(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), Math.round(z0 + (z1 - z0) * t), 3); } continue; }
      const ax = Math.abs(x1 - x0), ay = Math.abs(y1 - y0), az = Math.abs(z1 - z0);
      segAxis = ay >= ax * 0.8 && ay >= az * 0.8 ? 0 : ax >= az ? 1 : 2;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
        if (rr < 0.75) { put(Math.round(x), Math.round(y), Math.round(z), 1); continue; }
        const R = Math.ceil(rr);
        for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) if (dx * dx + dz * dz <= rr * rr + 0.2) put(Math.round(x) + dx, Math.round(y), Math.round(z) + dz, 1);
      }
    }
    return out;
  };

  // ---------------------------------------------------------------- the species (our own names and grammars)
  //  wood / blossom / leaf: block names (blossom may be a list: the ball's cells mix them by a hash)
  FL.SPECIES = {
    // Wolkenkirsche: a short trunk, three to four scaffold limbs at a wide angle, an umbrella of pink clouds
    wolkenkirsche: { kind: 'tree', axiom: 'FFF[&A]/[&A]/A', n: 3, rules: { A: [[0.55, "!'F[&FA]/[&FA]/[&A]"], [0.45, "!'F[&FA]/[&A]"]] }, fin: { A: 'B' },
      t: { len: 1.25, w: 0.9, angle: 30, pitch: 36, jit: 0.3, wr: 0.62, lr: 0.82, br: 2.1 }, wood: 'cherry_log', blossom: ['cherry_leaves', 'bloom_rose_leaves'], leaf: 'oak_leaves', h: [7, 11] },
    // Schneeschleier: an upright leader with short side shoots, a tall white oval
    schneeschleier: { kind: 'tree', axiom: 'FFA', n: 4, rules: { A: [[0.6, "F[&'!B]/[&'!FB]/'A"], [0.4, "F[&'!FB]/'A"]] }, fin: { A: 'FB' },
      t: { len: 1.15, w: 0.6, angle: 28, pitch: 30, jit: 0.3, wr: 0.7, lr: 0.9, br: 1.7 }, wood: 'birch_log', blossom: ['bloom_snow_leaves'], leaf: 'birch_leaves', green: 0.18, h: [7, 11] },
    // Lilaschirm: arching limbs that bend down, violet chains hanging from every tip (a wisteria-like habit)
    lilaschirm: { kind: 'tree', axiom: 'FFFF[&A]/[&A]/[&A]', n: 2, rules: { A: [[0.6, "'!FD[&FDA]/[&FDA]"], [0.4, "'!FD[&FDA]"]] }, fin: { A: 'LHfH' },
      t: { len: 1.5, w: 0.7, angle: 30, pitch: 48, jit: 0.25, wr: 0.65, lr: 0.85, lb: 1.3, droop: 22, chain: [2, 4] }, wood: 'oak_log', blossom: ['bloom_lilac_leaves'], leaf: 'oak_leaves', h: [6, 12] },
    // Sonnenregen: a small golden tree, its chains shorter and denser
    sonnenregen: { kind: 'tree', axiom: 'FFF[&A]/[&A]/[&A]', n: 2, rules: { A: [[0.5, "'!F[&FA]/[&FA]/[&A]"], [0.5, "'!F[&FA]/[&A]"]] }, fin: { A: 'BH' },
      t: { len: 1.2, w: 0.6, angle: 30, pitch: 40, jit: 0.3, wr: 0.65, lr: 0.82, br: 1.15, droop: 18, chain: [2, 4] }, wood: 'birch_log', blossom: ['bloom_gold_leaves'], leaf: 'birch_leaves', green: 0.2, h: [5, 9] },
    // the flowering shrubs: no trunk, green twigs (leaf cells) fanning out of the ground, blossom on the tips
    rosenbusch: { kind: 'shrub', axiom: '[&A]/[&A]/[&A]/A', n: 1, rules: { A: [[0.6, "F[&B]/[&FB]"], [0.4, "FB"]] }, fin: { A: 'B' },
      t: { len: 1.1, w: 0.3, angle: 30, pitch: 40, jit: 0.35, br: 1.5 }, wood: 'oak_leaves', blossom: ['bloom_rose_leaves'], leaf: 'oak_leaves', green: 0.25, h: [2, 4] },
    schneebusch: { kind: 'shrub', axiom: '[&A]/[&A]/[&A]', n: 1, rules: { A: [[0.6, "F[&B]/FB"], [0.4, "FFB"]] }, fin: { A: 'B' },
      t: { len: 1.1, w: 0.3, angle: 26, pitch: 36, jit: 0.35, br: 1.45 }, wood: 'oak_leaves', blossom: ['bloom_snow_leaves'], leaf: 'oak_leaves', green: 0.3, h: [2, 4] },
    lilabusch: { kind: 'shrub', axiom: '[&A]/[&A]/[&A]/A', n: 1, rules: { A: [[0.5, "F[&B]/[&B]"], [0.5, "FB"]] }, fin: { A: 'B' },
      t: { len: 1.05, w: 0.3, angle: 30, pitch: 40, jit: 0.35, br: 1.45 }, wood: 'oak_leaves', blossom: ['bloom_lilac_leaves'], leaf: 'oak_leaves', green: 0.25, h: [2, 4] },
    // Traumbaum: the wonder spot's giant — a thick trunk, four limbs, one more generation, a crown of pink and white
    // (the first pictures: a thin trunk under a ball — a lollipop; now a stout trunk, wide limbs, an umbrella like the
    // Wolkenkirsche's, pink with patches of deep rose and white)
    traumbaum: { kind: 'giant', axiom: 'FFFF[&A]/[&A]/[&A]/[&A]', n: 4, rules: { A: [[0.6, "!'F[&FA]/[&FA]/[&A]"], [0.4, "!'F[&FA]/[&A]"]] }, fin: { A: 'B' },
      t: { len: 2.0, w: 2.4, angle: 30, pitch: 42, jit: 0.25, wr: 0.62, lr: 0.8, br: 3.0 }, wood: 'cherry_log', blossom: ['bloom_snow_leaves', 'cherry_leaves', 'cherry_leaves', 'bloom_rose_leaves'], leaf: 'oak_leaves', h: [14, 24] },
  };
  // t-trees2 (vgen 18; the owner, 21 Nov: „die Bäume sehen wirklich nicht schön aus" — a new look for every tree): the
  // green trees grown the same way — a trunk that tapers, scaffold limbs rolled by the golden angle, the crown a cloud of
  // leaf clusters with air between them (not one ball), the needles' whorls narrowing to a point. GEN.TREES plants them
  // in a writer flagged t18 (gen_common.js), so every caller of the old builders gets the new trees in a vgen-18 world.
  Object.assign(FL.SPECIES, {
    // Kronenbaum: the meadow's broadleaf — a stout trunk, three to four limbs, a crown of a dozen leaf clusters
    kronenbaum: { kind: 'tree', axiom: 'FFF[&A]/[&A]/[&A]/[^FFL]', n: 3, rules: { A: [[0.55, "!'F[&FA]/[&L]/[&FA]"], [0.45, "!'F[&FA]/[&FL]"]] }, fin: { A: 'L' },
      t: { len: 1.3, w: 0.9, angle: 32, pitch: 38, jit: 0.3, wr: 0.62, lr: 0.8, lb: 1.75 }, wood: 'oak_log', blossom: ['oak_leaves'], leaf: 'oak_leaves', h: [8, 12] },
    // Großkrone: the old lone oak — a thick trunk, wide low limbs, one generation more, a broad dome of clusters
    grosskrone: { kind: 'tree', axiom: 'FFFF[&A]/[&A]/[&A]/[&A]/[^FFFL]', n: 4, rules: { A: [[0.6, "!'F[&FA]/[&FL]/[&A]"], [0.4, "!'F[&FA]/[&A]"]] }, fin: { A: 'L' },
      t: { len: 1.5, w: 1.5, angle: 30, pitch: 44, jit: 0.25, wr: 0.62, lr: 0.8, lb: 1.9 }, wood: 'oak_log', blossom: ['oak_leaves'], leaf: 'oak_leaves', h: [11, 16] },
    // Hängebirke: a slender white stem, short side shoots that droop, small clusters hanging along them
    haengebirke: { kind: 'tree', axiom: 'FFFA', n: 6, rules: { A: [[0.55, "F[&&!GGDGDGL]/[&&!GGDGL]/[&&!GDGL]/'A"], [0.45, "F[&&!GGDGDGL]/[&&!GDGL]/'A"]] }, fin: { A: 'FLL' },
      t: { len: 1.1, w: 0.5, angle: 26, pitch: 24, jit: 0.3, wr: 0.7, lr: 0.9, lb: 1.2, droop: 26, roll: 120 }, wood: 'birch_log', blossom: ['birch_leaves'], leaf: 'birch_leaves', h: [9, 14] },
    // Tannenspitz: the spruce — a straight leader, a whorl of drooping branches every step, each shorter toward the top
    tannenspitz: { kind: 'tree', cone: { h: [11, 15], rb: [3.6, 4.6], y0: 2 }, wood: 'spruce_log', blossom: ['spruce_leaves'], leaf: 'spruce_leaves', h: [12, 18] },
    // Bergkiefer: the pine — a long bare stem, a flat-topped crown of a few clusters high up
    bergkiefer: { kind: 'tree', axiom: 'FFFFFFF[&A]/[&A]/[&A]/[&A]/[^L]', n: 2, rules: { A: [[0.6, "!'F[&GL]/[&FL]/[^L]"], [0.4, "!'F[&FL]"]] }, fin: { A: 'L' },
      t: { len: 1.25, w: 0.5, angle: 30, pitch: 62, jit: 0.3, wr: 0.7, lr: 0.85, lb: 1.5 }, wood: 'spruce_log', blossom: ['spruce_leaves'], leaf: 'spruce_leaves', h: [11, 16] },
    // Dunkelkrone: the dark oak — short, very stout, a low dense roof of big clusters
    dunkelkrone: { kind: 'tree', axiom: 'FF[&A]/[&A]/[&A]/[&A]/[^FL]', n: 3, rules: { A: [[0.6, "!'F[&FL]/[&A]/[&FA]"], [0.4, "!'F[&FA]/[&L]"]] }, fin: { A: 'L' },
      t: { len: 1.3, w: 1.4, angle: 30, pitch: 52, jit: 0.25, wr: 0.65, lr: 0.82, lb: 2.0 }, wood: 'dark_oak_log', blossom: ['dark_oak_leaves'], leaf: 'dark_oak_leaves', h: [7, 11] },
    // Urwaldriese: the jungle giant — a tall trunk, a high umbrella of clusters, vines hanging from the limbs
    urwaldriese: { kind: 'tree', axiom: 'FFFFFFFFF[&A]/[&A]/[&A]/[&A]/[^L]', n: 2, rules: { A: [[0.6, "!F[&FFLH]/[&FA]/[&FL]"], [0.4, "!F[&FFLH]/[&FA]"]] }, fin: { A: 'LH' },
      t: { len: 1.5, w: 1.1, angle: 30, pitch: 66, jit: 0.25, wr: 0.62, lr: 0.82, lb: 2.2, chain: [3, 6] }, wood: 'jungle_log', blossom: ['jungle_leaves'], leaf: 'jungle_leaves', h: [16, 26] },
    // Urwaldbaum: the jungle's own — a bent trunk, a few clusters, a vine or two
    urwaldbaum: { kind: 'tree', axiom: 'FFFF[&A]/[&A]/[^FL]', n: 2, rules: { A: [[0.6, "!'F[&FLH]/[&FA]"], [0.4, "!'F[&L]"]] }, fin: { A: 'L' },
      t: { len: 1.3, w: 0.5, angle: 30, pitch: 46, jit: 0.3, wr: 0.7, lr: 0.85, lb: 1.6, chain: [2, 4] }, wood: 'jungle_log', blossom: ['jungle_leaves'], leaf: 'jungle_leaves', h: [8, 13] },
    // Schirmakazie: the savanna's — a forked stem leaning out, a wide flat roof of low clusters
    schirmakazie: { kind: 'tree', axiom: 'FF[&&FFA]/[&&FFA]', n: 2, rules: { A: [[0.6, "'^F[&GL]/[&FL]/[^L]"], [0.4, "'^F[&FL]/[^L]"]] }, fin: { A: 'L' },
      t: { len: 1.3, w: 0.5, angle: 30, pitch: 22, jit: 0.25, wr: 0.75, lr: 0.85, lb: 1.8 }, wood: 'acacia_log', blossom: ['acacia_leaves'], leaf: 'acacia_leaves', h: [6, 9] },
  });
  FL.GREEN = ['kronenbaum', 'grosskrone', 'haengebirke', 'tannenspitz', 'bergkiefer', 'dunkelkrone', 'urwaldriese', 'urwaldbaum', 'schirmakazie'];
  FL.TREES = ['wolkenkirsche', 'schneeschleier', 'lilaschirm', 'sonnenregen'];
  FL.SHRUBS = ['rosenbusch', 'schneebusch', 'lilabusch'];
  // a species' plant for a seed: its cells (cached per species and seed: the generator asks for the same tree from each
  // of the chunks it reaches into) and its bounds { x0, x1, y0, y1, z0, z1 }
  // the blossom's colour comes in patches (a value noise over cells of 3, a little jitter): the first Traumbaum's crown,
  // its pink and white mixed cell by cell, read as a checkerboard
  const patch = (x, y, z, s) => {
    const fx = x / 3, fy = y / 3, fz = z / 3, ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz), tx = fx - ix, ty = fy - iy, tz = fz - iz;
    const sm = (t) => t * t * (3 - 2 * t), u = sm(tx), v = sm(ty), w = sm(tz);
    let a = 0;
    for (let k = 0; k < 8; k++) { const dx = k & 1, dy = (k >> 1) & 1, dz = k >> 2; a += H3(ix + dx, iy + dy, iz + dz, s) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w); }
    a = (a - 0.5) * 1.9 + 0.5 + (H3(x, y, z, s ^ 0x77) - 0.5) * 0.12;
    return Math.min(0.999, Math.max(0, a));
  };
  // t-trees2 · a conifer's cells (a cone, not a grammar: the spruce's silhouette is its whole character): the trunk to
  // the top; whorls every second layer as ragged discs whose radius falls from rb at the crown's foot to a point, a
  // smaller disc between them (the serrated edge), the outer ring of every whorl drooping a cell (the branches' tips
  // bend down), the tip three cells over the trunk. o {h: [min, max], rb: [min, max], y0} → the cells Map (FL.cells')
  FL.coneCells = function (o, seed) {
    const r = rnd(seed ^ 0x51ed), out = new Map(); out.axis = new Map();
    const H = o.h[0] + Math.floor(r() * (o.h[1] - o.h[0] + 1)), rb = o.rb[0] + r() * (o.rb[1] - o.rb[0]), y0 = o.y0 || 2, top = H + 1;
    const put = (x, y, z, k) => { const key = x + ',' + y + ',' + z, cur = out.get(key); if (cur === 1) return; out.set(key, k); if (k === 1) out.axis.set(key, 0); };
    for (let y = 0; y < H; y++) put(0, y, 0, 1);
    const ph = r() * 6.283;
    for (let y = top - 1; y >= y0; y--) {
      const u = (top - y) / (top - y0), whorl = ((top - y) & 1) === 0, rr = Math.max(1.05, rb * Math.pow(u, 0.92) * (whorl ? 1 : 0.6) + (whorl ? 0.35 : 0.2));
      const R = Math.ceil(rr);
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        const a = Math.atan2(dz, dx), wob = 1 + 0.16 * Math.sin(a * 5 + ph + y * 1.7), d = Math.hypot(dx, dz) / wob;
        if (d > rr) continue;
        if (d > rr - 0.9 && H3(dx, y, dz, seed) < 0.22) continue;   // (a ragged rim)
        put(dx, y, dz, 3);
        if (whorl && d > rr - 1.1 && d > 1.5 && y > y0) put(dx, y - 1, dz, 3);   // the tips droop
      }
    }
    for (let k = 0; k < 2; k++) put(0, top + k, 0, 3);
    return out;
  };
  const CACHE = new Map();
  FL.grow = function (name, seed) {
    const key = name + ':' + (seed >>> 0);
    let p = CACHE.get(key); if (p) return p;
    const S = FL.SPECIES[name]; if (!S) return null;
    const str = S.cone ? '' : FL.expand(S.axiom, S.rules, S.n, seed, S.fin);
    const cells = S.cone ? FL.coneCells(S.cone, seed) : FL.cells(FL.turtle(str, S.t, seed), S, seed);
    const list = [];   // [dx, dy, dz, kind, mix] — sorted for a stable write order
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0, z0 = 0, z1 = 0;
    for (const [k, kind] of cells) {
      const a = k.split(','), x = +a[0], y = +a[1], z = +a[2];
      if (y < 0) continue;   // nothing below the foot (a droop never digs in)
      list.push([x, y, z, kind, patch(x, y, z, seed ^ 0x51), kind === 1 ? (cells.axis.get(k) | 0) : 0]);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    list.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]);
    p = { name, seed: seed >>> 0, list, b: { x0, x1, y0, y1, z0, z1 }, len: str.length };
    if (CACHE.size > 600) CACHE.clear();
    CACHE.set(key, p);
    return p;
  };
  // plant a grown species into a writer (a chunk's ColumnWriter or the land's ops: w.set / w.get / w.ok): the wood
  // through anything soft (leaves, plants: mode 1), the bloom only into air and plants; the ground under the trunk
  // becomes dirt. st(name, props) → state (VR.R.S); leafState(name) for leaf blocks.
  FL.plant = function (w, name, x, y, z, seed, st, leafState) {
    const p = FL.grow(name, seed); if (!p) return null;
    const S = FL.SPECIES[name], R = VR.R;
    const woodL = S.kind === 'shrub' ? leafState(S.wood) : 0, woodA = [0, 1, 2].map(a => st(S.wood, { axis: a }));
    const bl = S.blossom.map(n => R.byName[n] ? leafState(n) : leafState('cherry_leaves')), lf = leafState(S.leaf);
    const ok = w.ok ? (px, py, pz) => w.ok(px, py, pz) : () => true;
    for (const c of p.list) {
      const px = x + c[0], py = y + c[1], pz = z + c[2];
      if (!ok(px, py, pz)) continue;
      const cur = w.get ? w.get(px, py, pz) : 0;
      if (c[3] === 1) {
        const wood = woodL || woodA[c[5]];
        if (w.place) w.place(px, py, pz, wood, 1); else w.set(px, py, pz, wood);
      } else {
        if (cur > 0 && !(R.T.flags[cur] & (VR.F.PLANT | VR.F.REPLACE))) continue;
        w.set(px, py, pz, c[3] === 3 ? lf : bl[Math.floor(c[4] * bl.length) % bl.length]);
      }
    }
    return p;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

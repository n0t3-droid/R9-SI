// ============================================================================
// Tiere zum Liebhaben (u-wild2; docs/superpowers/plans/2026-11-02-u-wild2.md) — the game side. The rules are in
// src/shared/wildbond.js (VR.WildBond); Companions owns one VR.WildHeart (companions.heart). Balanced and up, switch
// wildHeart (⚙ Bild · Dinge & Effekte); Very Low and Low: nothing attached, nothing drawn, nothing thought (update()
// returns at its first line between the once-a-second checks).
//   LOOK  each animal of the six kinds gets one of four coat variants (Young's cells, baked into its voxel colours;
//         one variant built per 0.4 s at most), big eyes with a catchlight and a closed-eye head for blinks; babies are
//         0.62× with a 1.3× head and a fluffy shell; ears and tails on springs (they lag the body's turns and stops)
//   LIFE  a spawned group becomes a mother and 1–3 babies in a line; grazers lift their heads as you pass; curious ones
//         come and sniff when you stand still; shy ones hide under a tree and peek; at dusk they lie down, in rain
//         they go under a tree; finches hop and peck on the grass and take off as you come (drawn here, not mobs)
//   BOND  hold its food and wait: it comes, sniffs, eats from your hand (hearts); trust grows; a trusting one follows
//         a while; a friend becomes a 🐾 companion (its treat) or visits your door by day; V pets it
// Cost: the animals think by distance (WildBond.thinkEvery: 0.25 s near … never beyond 48 blocks), the steering
// between thinks is a few multiplications; ≤ 6 finches; no new shader, no new draw pass (the creatures' vox program).
// ============================================================================
(function (VR) {
  'use strict';
  const B = VR.WildBond, M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (!B || !M || !Grid) return;
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const angDiff = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'wildHeart', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.wildHeart', tip: 'g.set.wildHeart.tip', cost: 'low', def: true });

  // ---------------------------------------------------------------- the looks (built once per variant)
  // the eyes of each kind in its head grid: [x, y, z, grow dx, grow dz] — each eye grows to two by two voxels
  const EYES = {
    glimmer_deer: [[1, 3, 3, 0, -1], [4, 3, 3, 0, -1]],
    moss_boar: [[1, 4, 0, 1, 0], [6, 4, 0, -1, 0]],
    bloom_sheep: [[1, 3, 0, -1, 0], [4, 3, 0, 1, 0]],
    glimmer_fox: [[2, 4, 4, 0, 1, 1], [6, 4, 4, 0, 1, 1]],   // (6th: the catchlight's cell — up front when the eye grows backward)
    moss_cat: [[2, 4, 1, -1, 0], [5, 4, 1, 1, 0]],
    crystal_pup: [[2, 5, 1, -1, 0], [5, 5, 1, 1, 0]],
  };
  // f-wild3: soft eyes — per kind [pupil row (the upper, in the lid's shadow), iris (the lower, warm)]
  const IRIS = {
    glimmer_deer: [0x1e120c, 0x4a2c18], moss_boar: [0x180e08, 0x3e2614], bloom_sheep: [0x140c08, 0x6a4818],
    glimmer_fox: [0x1a0e08, 0x6a3a12], moss_cat: [0x1a2210, 0x8aa830], crystal_pup: [0x141830, 0x2a3c80],
  };
  const GLINT = 0xfff6e8;   // (a warm catchlight: the sky in a wet eye, half a voxel, off-centre in the upper row)
  // the pattern's colour: light spots on a fawn, light stripes on a piglet, dark tabby stripes, …
  const INK = { glimmer_deer: 'light', bloom_sheep: 'dark', moss_boar: 'light', glimmer_fox: 'light', moss_cat: 'dark', crystal_pup: 'dark' };
  const COATED = ['body', 'head', 'tail'];
  const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const cdist = (a, b) => { const A = rgb(a), Bc = rgb(b); return Math.abs(A[0] - Bc[0]) + Math.abs(A[1] - Bc[1]) + Math.abs(A[2] - Bc[2]); };
  const hash = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const each = (g, fn) => { for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const v = g.get(x, y, z); if (v) fn(x, y, z, v); } };
  const dominant = (g) => {
    const n = new Map(); let best = 0, bc = 0xffffff;
    each(g, (x, y, z, v) => { if ((v >> 24) & 1) return; const c = v & 0xffffff, q = c & 0xf0f0f0, k = (n.get(q) || 0) + 1; n.set(q, k); if (k > best) { best = k; bc = c; } });
    return bc;
  };
  const clone = (g) => { const c = new Grid(g.sx, g.sy, g.sz, g.ox, g.oy, g.oz); c.c.set(g.c); return c; };
  const grow = (g) => { const c = new Grid(g.sx + 2, g.sy + 2, g.sz + 2, g.ox + 1, g.oy + 1, g.oz + 1); each(g, (x, y, z, v) => { c.c[c.i(x + 1, y + 1, z + 1)] = v; }); return c; };
  const filled = (g, x, y, z) => g.in(x, y, z) && g.get(x, y, z) !== 0;
  const DIRS = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]];
  // kind's model, variant v, baby or not: coated, soft-eyed (head: open with the glint's cell cut out, glint: that
  // cell in half voxels with its catchlight, head_o: open from afar, head_h: half lid, head_c: shut), a baby's fluff
  function build(kind, v, baby) {
    const def = M[kind](), spec = B.coatSpec(kind, v, baby), K = B.KINDS[kind];
    if (!def || !spec) return def;
    const body = def.parts.body && def.parts.body.grid, base = body ? dominant(body) : 0;
    const eyes = EYES[kind] || [], head = def.parts.head && def.parts.head.grid;
    const eyeCells = new Set();
    if (head) for (const e of eyes) for (const [dx, dy, dz] of [[0, 0, 0], [0, 1, 0], [e[3], 0, e[4]], [e[3], 1, e[4]]]) for (let k = 0; k < 3; k++) eyeCells.add((e[0] + dx) + ',' + (e[1] + dy) + ',' + (e[2] + dz + k));
    // the coat, mapped over each part (u along it, v around its long axis: WildBond.bodyUV), painted crisp
    const uv = [0, 0];
    for (const name of COATED) {
      const pr = def.parts[name]; if (!pr) continue;
      const g = pr.grid;
      let cx = 0, cy = 0, n = 0; each(g, (x, y) => { cx += x + 0.5; cy += y + 0.5; n++; });
      const C = { cx: cx / (n || 1), cy: cy / (n || 1), z0: name === 'head' ? -7 : name === 'tail' ? -11 : 0, su: K.su || 1 };
      each(g, (x, y, z, val) => {
        if ((val >> 24) & 1) return;
        if (name === 'head' && eyeCells.has(x + ',' + y + ',' + z)) return;
        const c = val & 0xffffff; if (cdist(c, base) > 90) return;
        B.bodyUV(x + 0.5, y + 0.5, z + 0.5, C, uv);
        const t = K.ring ? B.sampleUV(spec.tex, uv[1], uv[0]) : B.sampleUV(spec.tex, uv[0], uv[1]);   // (a tabby's stripes run around it)
        g.set(x, y, z, B.paint(c, t / 255, spec), 0);
      });
    }
    if (head) {
      const col = IRIS[kind] || IRIS.glimmer_deer, glint = new Grid(head.sx * 2, head.sy * 2, head.sz * 2, head.ox * 2, head.oy * 2, head.oz * 2);
      const far = clone(head), half = clone(head), shut = clone(head);
      def.eyes = [];
      const hc = [0, 0]; let hn = 0; each(head, (x, y, z) => { hc[0] += x + 0.5; hc[1] += z + 0.5; hn++; }); hc[0] /= hn || 1; hc[1] /= hn || 1;
      for (const e of eyes) {
        const cells = [[e[0], e[1], e[2]], [e[0], e[1] + 1, e[2]], [e[0] + e[3], e[1], e[2] + e[4]], [e[0] + e[3], e[1] + 1, e[2] + e[4]]];
        // (a round face: a cell that is not there is looked for one deeper)
        const at = cells.map(([x, y, z0]) => { let z = z0; while (!filled(head, x, y, z) && z < z0 + 2) z++; return filled(head, x, y, z) ? [x, y, z] : null; });
        if (!at[0]) continue;
        const above = head.get(e[0], e[1] + 2, e[2]) & 0xffffff || base, lid = B.mix(above, 0x000000, 0.12), lash = B.mix(lid, 0x000000, 0.4);
        const ok = at.filter(Boolean);
        for (const [x, y, z] of ok) {
          const top = y === e[1] + 1;
          for (const g of [head, far, half]) g.set(x, y, z, top && g === half ? lid : top ? col[0] : col[1], 0);
          shut.set(x, y, z, top ? lid : lash, 0);
          // a soft brow: the fur over the eye a little darker (it frames it, the eye looks set in, not stuck on)
          if (top && filled(head, x, y + 1, z) && cdist(head.get(x, y + 1, z) & 0xffffff, base) < 120) for (const g of [head, far, half, shut]) g.set(x, y + 1, z, B.mix(g.get(x, y + 1, z) & 0xffffff, 0x000000, 0.14), 0);
        }
        // the catchlight: in the upper row, the cell toward +x (the same side on every eye: one light), the half voxel
        // facing out, upper, the half toward the eye's middle — one eighth of the cell; the cell itself moves to glint
        const tops = ok.filter(c => c[1] === e[1] + 1); if (!tops.length) { def.eyes.push({ cells: ok, iris: col[1], top: e[1] + 1, rows: 2 }); continue; }
        const gc = tops.reduce((a, c) => (c[0] > a[0] || (c[0] === a[0] && c[2] < a[2]) ? c : a));
        let out = [0, 0, -1], ob = -1e9;   // (out: the open side most away from the head's middle)
        for (const D of DIRS) if (!filled(head, gc[0] + D[0], gc[1], gc[2] + D[2])) { const sc = (gc[0] + 0.5 - hc[0]) * D[0] + (gc[2] + 0.5 - hc[1]) * D[2]; if (sc > ob) { ob = sc; out = D; } }
        const other = tops.find(c => c !== gc) || gc;
        const hx = out[0] ? (out[0] > 0 ? 1 : 0) : other[0] < gc[0] ? 0 : other[0] > gc[0] ? 1 : 0, hz = out[2] ? (out[2] > 0 ? 1 : 0) : other[2] < gc[2] ? 0 : 1;
        for (let a = 0; a < 2; a++) for (let b2 = 0; b2 < 2; b2++) for (let c = 0; c < 2; c++) glint.set(gc[0] * 2 + a, gc[1] * 2 + b2, gc[2] * 2 + c, a === hx && b2 === 1 && c === hz ? GLINT : col[0], 0);
        head.c[head.i(gc[0], gc[1], gc[2])] = 0;
        def.eyes.push({ cells: ok, iris: col[1], top: e[1] + 1, rows: 2 });
      }
      const pv = def.parts.head.pivot;
      def.parts.glint = { grid: glint, pivot: pv };
      def.parts.head_o = { grid: far, pivot: pv };
      def.parts.head_h = { grid: half, pivot: pv };
      def.parts.head_c = { grid: shut, pivot: pv };
      def.layout.glint = def.layout.head_o = def.layout.head_h = def.layout.head_c = def.layout.head;
      def.glintScale = 0.5;
    }
    // a baby's fluff: a soft lighter shell on its back and flanks
    if (baby && body) {
      const g = grow(body), out = [];
      each(g, (x, y, z, val) => {
        if ((val >> 24) & 1 || y < g.sy * 0.45) return;
        for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0]]) if (!filled(g, x + dx, y + dy, z + dz) && hash(x, y, z, dx + 3) < 0.4) out.push([x + dx, y + dy, z + dz, B.mix(val & 0xffffff, 0xffffff, 0.22)]);
      });
      for (const o of out) g.set(o[0], o[1], o[2], o[3], 0);
      def.parts.body = { grid: g, pivot: def.parts.body.pivot };
    }
    return def;
  }
  const vkey = (kind, v, baby) => 'wh:' + kind + ':' + v + ':' + (baby ? 1 : 0);
  for (const kind in B.KINDS) if (M[kind]) for (let v = 0; v < B.VARIANTS; v++) for (const baby of [false, true]) M[vkey(kind, v, baby)] = () => build(kind, v, baby);

  // the finch (our own): a round rose-brown bird with a cream breast, a blue-grey cap, a little orange bill
  M.wh_finch = () => {
    const part = (sx, sy, sz, pv, fn) => { const g = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(g); return { grid: g, pivot: [0, 0, 0] }; };
    const back = 0xa8684a, breast = 0xf6dcc0, cap = 0x6a7a9a, bill = 0xf0902a, eye = 0x141018, wing = 0x7a4a36, tip = 0x3a2a26;
    return {
      h: 0.3, w: 0.15, parts: {
        body: part(5, 5, 7, [2, 1, 3], (g) => {
          g.ell(2.5, 2.4, 3.5, 2.4, 2.2, 3.0, (x, y, z) => (y <= 1 || (z <= 2 && y <= 2) ? breast : back));
          g.box(1, 3, 1, 3, 4, 2, cap); g.box(2, 2, 0, 2, 2, 0, bill); g.set(1, 3, 1, eye); g.set(3, 3, 1, eye);
          g.box(2, 2, 6, 2, 3, 6, tip);
        }),
        wing_l: part(1, 3, 4, [1, 2, 1], (g) => { g.box(0, 0, 0, 0, 2, 3, wing); g.box(0, 0, 3, 0, 1, 3, tip); }),
        wing_r: part(1, 3, 4, [0, 2, 1], (g) => { g.box(0, 0, 0, 0, 2, 3, wing); g.box(0, 0, 3, 0, 1, 3, tip); }),
      },
      layout: { body: [0, 0, 0], wing_l: [-2.6, 1.2, 0], wing_r: [2.6, 1.2, 0] },
      gait: 'wings',
    };
  };

  // which head is drawn (f-wild3): open near (with its glint), open from afar (no glint: one draw call less), half lid, shut
  const HIDE_OPEN = { head_o: true, head_h: true, head_c: true }, HIDE_FAR = { head: true, glint: true, head_h: true, head_c: true };
  const HIDE_HALF = { head: true, head_o: true, glint: true, head_c: true }, HIDE_SHUT = { head: true, head_o: true, head_h: true, glint: true };
  const GLINT_D2 = 12 * 12;   // (the catchlight is drawn within 12 blocks of you; beyond it is below a pixel)
  const ZERO6 = () => [0, 0, 0, 0, 0, 0, 1];
  const put = (v, rx, ry, rz, ox, oy, oz, s) => { v[0] = rx; v[1] = ry; v[2] = rz; v[3] = ox; v[4] = oy; v[5] = oz; v[6] = s; return v; };

  class WildHeart {
    constructor(g, meta) {
      this.g = g;
      this.on = false; this.chk = 0; this.built = new Set(); this.queue = []; this.buildT = 0;
      this.friends = B.deserialize(meta && meta.wildBonds);
      this.birds = []; this.birdT = 3;
      // what a finch may land on (f-wild3): a leaf or a fence top, loaded, not far above it (WildBond.finchTakeoff)
      this.bw = {
        top: (x, z) => { const w = this.g.world; return w && w.isLoaded(x, z) ? w.topAt(x, z) : -1e9; },
        perch: (x, z) => { const w = this.g.world; if (!w || !w.isLoaded(x, z)) return false; const b = w.getBlock(x, w.topAt(x, z), z); return !!b && (!!(VR.R.T.flags[b] & VR.F.LEAVES) || VR.R.T.shape[b] === VR.SHAPE.FENCE); },
      };
      this.still = 0; this.pspeed = 0; this.attachT = 0; this.visitT = 5; this.visitor = null;
      this.out = [0, 0, 0];
      this.cost = { thinks: 0, ms: 0 };
      if (VR.Ctx && VR.Ctx.hooks && VR.Ctx.hooks.near && !VR.Ctx.hooks.near.wh) {
        // V pets every animal of ours within reach (the 🐾 companions' own row already lists theirs)
        const hook = (gg, eye, dir) => {
          const H = gg.companions && gg.companions.heart; if (!H || !H.on || !gg.entities || !dir) return null;
          let best = null, bd = 0.94;   // (the one nearest the aim, within 6 blocks)
          for (const m of gg.entities.mobs) {
            if (!m.wh || m.dead || m.def.companion) continue;
            const dx = m.pos[0] - eye[0], dy = m.pos[1] + m.h * 0.4 * (m.wscale || 1) - eye[1], dz = m.pos[2] - eye[2], d = Math.hypot(dx, dy, dz);
            if (d > 6 || d < 0.01) continue;
            const c = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / d; if (c > bd) { bd = c; best = m; }
          }
          return best ? { kind: 'pet', name: '', pos: [best.pos[0], best.pos[1] + best.h * 0.5 * (best.wscale || 1), best.pos[2]], r: Math.max(0.35, best.w), ref: best } : null;
        };
        VR.Ctx.hooks.near.push(hook); VR.Ctx.hooks.near.wh = true;
      }
    }
    tierOn() { const g = this.g, S = g.settings; if (!S || S.wildHeart === false) return false; return !!(VR.Wild && VR.Wild.tierOf ? VR.Wild.tierOf(S) >= 2 : true); }
    // ---------------------------------------------------------------- per frame (Companions.update)
    update(dt) {
      if (!this.on) { this.chk -= dt; if (this.chk > 0) return; this.chk = 1; if (!(this.on = this.tierOn())) return; }
      else { this.chk -= dt; if (this.chk <= 0) { this.chk = 1; if (!(this.on = this.tierOn())) { this.detach(); return; } } }
      const g = this.g, p = g.player, ent = g.entities; if (!p || !ent) return;
      const hs = Math.hypot(p.vel[0], p.vel[2]);
      this.pspeed = hs; this.still = hs < 0.35 && p.onGround !== false ? this.still + dt : 0;
      this.now = (this.now || 0) + dt;
      // the variants: at most one built every 0.4 s
      this.buildT -= dt;
      if (this.queue.length && this.buildT <= 0) { const k = this.queue.shift(); if (!this.built.has(k)) { VR.getVoxModel(g.renderer.gl, k); this.built.add(k); } this.buildT = 0.4; }
      // new animals get their heart (twice a second); their models follow when built
      this.attachT -= dt;
      if (this.attachT <= 0) {
        this.attachT = 0.5;
        for (const m of ent.mobs) {
          if (!m.wh && !m.dead && B.isKind(m.kind)) this.attach(m);
          if (m.wh && !m.vkey) { const k = vkey(m.kind, m.wh.v, m.wh.baby); if (this.built.has(k)) m.vkey = k; else if (this.queue.indexOf(k) < 0) this.queue.push(k); }
        }
      }
      // feeding: an animal sniffing your hand eats after a moment
      const held = p.inv && p.inv.held ? p.inv.held.id : null;
      this.held = held;
      for (const m of ent.mobs) {
        const h = m.wh; if (!h || m.dead) continue;
        h.wig = Math.max(0, h.wig - dt);
        if (h.bond) B.tick(h.bond, dt);
        if (h.mode === 'sniff' && held && B.takes(m.kind, held)) {
          const dx = m.pos[0] - p.pos[0], dz = m.pos[2] - p.pos[2];
          if (dx * dx + dz * dz < 4.4) { h.eatT += dt; if (h.eatT >= B.EAT_WAIT) { h.eatT = 0; this.eat(m); } } else h.eatT = 0;
        } else h.eatT = 0;
      }
      this.visits(dt);
      this.birdsTick(dt);
    }
    attach(m) {
      const r = ((m.id * 2654435761) >>> 0);
      m.wh = { v: r % B.VARIANTS, baby: false, mom: null, mode: null, thinkT: (r % 100) / 400, blinkT: 1 + (r % 300) / 100, bl: 0, sT: { x: 0, v: 0 }, sE: { x: 0, v: 0 }, ly: m.yaw, lt: -1, wig: 0, eatT: 0, bond: null, cover: null, coverT: 0, hp: ZERO6(), pb: ZERO6(), pt: ZERO6(), pel: ZERO6(), per: ZERO6(), legs: [ZERO6(), ZERO6(), ZERO6(), ZERO6()], look: 0, wt: [0, 0, 0] };
      return m.wh;
    }
    detach() {
      const ent = this.g.entities;
      if (ent) for (const m of ent.mobs) if (m.wh) { m.wh = null; m.vkey = null; m.wscale = 0; m.whide = null; }
      this.birds.length = 0;
    }
    // a spawned group (entities.trySpawn): a mother and her babies, now and then
    group(list) {
      if (!this.on || !list || list.length < 2) return;
      const m0 = list[0]; if (!B.isKind(m0.kind) || !B.KINDS[m0.kind].family || Math.random() > 0.6) return;
      this.family(m0, list.slice(1, 4));
    }
    family(mom, kids) {
      const hm = mom.wh || this.attach(mom);
      let ahead = mom;
      for (const k of kids) {
        const h = k.wh || this.attach(k);
        h.baby = true; h.mom = ahead; k.vkey = null; k.wscale = 0.62;
        ahead = k;
      }
      hm.kids = kids.length;
    }
    // ---------------------------------------------------------------- the AI (entities.ai asks; true: we steer)
    steer(ent, m, dt, d2, A) {
      const h = m.wh; if (!this.on || !h) return false;
      h.thinkT -= dt;
      if (h.thinkT <= 0) {
        const every = B.thinkEvery(d2);
        if (every === Infinity) { h.thinkT = 2; h.mode = null; return false; }
        h.thinkT = every; this.cost.thinks++;
        this.think(m, h, d2);
      }
      const g = this.g, p = g.player, wt = h.wt;
      let go = false;
      switch (h.mode) {
        case 'follow': {
          const mom = h.mom;
          if (!mom || mom.dead) { h.mode = null; return false; }
          B.follow(m.pos, mom.pos, mom.yaw, this.out);
          wt[0] = this.out[0]; wt[1] = this.out[1]; wt[2] = this.out[2] * 0.55; go = wt[2] > 0;
          break;
        }
        case 'approach': {
          const dx = m.pos[0] - p.pos[0], dz = m.pos[2] - p.pos[2], d = Math.hypot(dx, dz) || 1;
          wt[0] = p.pos[0] + dx / d * 1.0; wt[1] = p.pos[2] + dz / d * 1.0; wt[2] = 0.32; go = d > 1.5;   // (it stops ~1.6 blocks off: within sniffing reach)
          break;
        }
        case 'trail': {
          const d = Math.sqrt(d2);
          if (d > 3) { const yaw = p.yaw || 0; B.lineSlot(p.pos[0], p.pos[2], yaw, 2.2, this.out); wt[0] = this.out[0]; wt[1] = this.out[1]; wt[2] = d > 8 ? 1.5 : 0.9; go = true; }
          break;
        }
        case 'hide': case 'shelter': case 'restgo': case 'visit': {
          const c = h.cover; if (!c) { h.mode = h.mode === 'restgo' ? 'rest' : null; break; }
          const dx = c[0] - m.pos[0], dz = c[1] - m.pos[2];
          if (dx * dx + dz * dz < 0.5) { h.mode = h.mode === 'hide' ? 'peek' : h.mode === 'visit' ? 'wait' : 'rest'; break; }
          wt[0] = c[0]; wt[1] = c[1]; wt[2] = h.mode === 'hide' ? 1.3 : h.mode === 'visit' ? 0.75 : 0.6; go = true;
          break;
        }
        case 'flee': {
          wt[0] = m.pos[0] + (m.pos[0] - p.pos[0]); wt[1] = m.pos[2] + (m.pos[2] - p.pos[2]); wt[2] = 1.5; go = true;
          break;
        }
        case 'alert': case 'sniff': case 'peek': case 'wait': case 'rest': case 'stay': break;
        default: return false;
      }
      A.wt = go ? wt : null;
      if (!go && h.mode !== 'rest' && h.mode !== 'follow') {
        // standing: it turns to look at you
        const dx = p.pos[0] - m.pos[0], dz = p.pos[2] - m.pos[2];
        if (h.mode !== 'stay' && dx * dx + dz * dz < 400) m.yaw += angDiff(Math.atan2(-dx, -dz) - m.yaw) * Math.min(1, dt * (h.mode === 'alert' ? 1.2 : 3));
      }
      return true;
    }
    think(m, h, d2) {
      const g = this.g, p = g.player, E = g.env && g.env.E, K = B.KINDS[m.kind];
      const night = E ? E.night || 0 : 0, rain = E ? E.rain || 0 : 0;
      if (h.visit) { this.thinkVisit(m, h); return; }
      const trust = h.bond ? B.levelOf(h.bond.fed) : 0;
      const food = !!(this.held && B.takes(m.kind, this.held));
      const settle = B.settle({ night, rain });
      if (settle && !(food && trust >= 1)) {
        if (h.baby && h.mom && !h.mom.dead) { const md = Math.hypot(h.mom.pos[0] - m.pos[0], h.mom.pos[2] - m.pos[2]); h.mode = md > 2.2 ? 'follow' : 'rest'; return; }
        if (h.mode === 'rest' || h.mode === 'restgo' || h.mode === 'shelter') { if (h.mode === 'shelter' && settle === 'rest') h.mode = 'rest'; return; }
        h.cover = this.coverNear(m.pos[0], m.pos[2], settle === 'shelter' ? 10 : 7);
        h.mode = h.cover ? (settle === 'shelter' ? 'shelter' : 'restgo') : 'rest';
        return;
      }
      if (h.mode === 'rest' || h.mode === 'restgo' || h.mode === 'shelter') h.mode = null;
      const d = Math.sqrt(d2);
      const a = B.react(m.kind, { d, speed: this.pspeed, still: this.still, food, trust });
      if (h.bond && B.follows(h.bond) && a !== 'sniff') { h.mode = 'trail'; return; }
      if (h.baby && h.mom && !h.mom.dead && a !== 'sniff' && a !== 'approach') { h.mode = 'follow'; return; }
      if (m.line || m.herd) { if (a === 'alert' || a === 'sniff' || a === 'approach') { h.mode = a === 'approach' && food ? 'approach' : a === 'approach' ? 'alert' : a; } else h.mode = null; return; }
      if (a === 'hide') { if (!h.cover || this.now > h.coverT) { h.cover = this.coverNear(m.pos[0], m.pos[2], 9, p.pos); h.coverT = this.now + 8; } h.mode = h.cover ? 'hide' : 'flee'; return; }
      if (a === 'peek') { h.mode = h.mode === 'peek' || h.mode === 'hide' ? 'peek' : 'alert'; return; }
      if (a === 'none') { h.mode = h.mode === 'alert' && Math.random() < 0.5 ? 'alert' : null; return; }
      if (a === 'approach' && K.temper === 'calm' && !food) { h.mode = 'alert'; return; }
      h.mode = a;
    }
    // a place under a tree (leaves over open ground) near (x, z), away from `from` if given: [x+0.5, z+0.5] or null
    coverNear(x, z, R, from) {
      const w = this.g.world, Rr = VR.R, F = VR.F; if (!w) return null;
      let best = null, bs = -1e9;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, r = 3 + (k % 4) * (R - 3) / 3;
        const cx = Math.floor(x + Math.cos(a) * r), cz = Math.floor(z + Math.sin(a) * r);
        if (!w.isLoaded(cx, cz)) continue;
        const top = w.topAt(cx, cz), tb = w.getBlock(cx, top, cz);
        if (!(Rr.T.flags[tb] & F.LEAVES)) continue;
        for (let y = top - 1; y > top - 10; y--) {
          const b = w.getBlock(cx, y, cz), f = Rr.T.flags[b];
          if (!b || (f & F.LEAVES)) continue;
          if ((f & F.SOLID) && !(f & F.FLUID)) {
            const above = w.getBlock(cx, y + 1, cz), a2 = w.getBlock(cx, y + 2, cz);
            if ((!above || !(Rr.T.flags[above] & F.SOLID)) && (!a2 || !(Rr.T.flags[a2] & F.SOLID))) {
              const s = from ? Math.hypot(cx - from[0], cz - from[2]) - r * 0.3 : -r;
              if (s > bs) { bs = s; best = [cx + 0.5, cz + 0.5]; }
            }
          }
          break;
        }
      }
      return best;
    }
    // ---------------------------------------------------------------- bonds
    eat(m) {
      const g = this.g, p = g.player, h = m.wh, K = B.KINDS[m.kind];
      if (!h.bond) h.bond = B.bond(m.kind, (m.id * 7919) | 0);
      if (!B.feed(h.bond, this.now)) return;
      const held = p.inv && p.inv.held;
      const comp = g.companions, name = T('g.mob.' + m.kind);
      // a 🐾 kind with its treat, at the third treat: it becomes your companion (Companions.tame: the treat, the name)
      if (h.bond.state === 'friend' && K.pet && comp && VR.Pets && VR.Pets.KINDS[m.kind] && held && held.id === VR.Pets.KINDS[m.kind].treat && !m.pet) { comp.tame(m, p); return; }
      if (held && !p.creative && p.inv.consumeHeld) p.inv.consumeHeld(1);
      if (comp) comp.hearts(m, h.bond.state === 'friend' ? 9 : 5);
      h.wig = 1.4;
      if (g.audio) g.audio.play('pet');
      if (h.bond.state === 'friend') {
        if (!this.friends.includes(h.bond)) { if (this.friends.length >= B.MAX) this.friends.shift(); h.bond.nextVisit = this.now + 60; this.friends.push(h.bond); }
        if (g.ui) g.ui.toast(T('g.wh.friend', { name }), T('g.wh.friendSub'), 'egg_' + m.kind);
      } else if (g.ui) g.ui.hint(T(h.bond.state === 'trusting' ? 'g.wh.trust' : 'g.wh.ate', { name }), 3200);
    }
    // V (and a click): a pat — hearts and a happy wiggle for one that knows you, a shy hop for one that does not
    pat(m) {
      const h = m.wh; if (!h || !this.on) return false;
      const g = this.g, comp = g.companions;
      if ((h.bond && h.bond.fed >= 1) || h.visit || h.baby) { h.wig = 1.4; if (comp) comp.hearts(m, 3); if (m.vel) m.vel[1] = Math.max(m.vel[1], 2.6); if (g.audio) g.audio.play('pet'); return true; }
      const K = B.KINDS[m.kind];
      if (g.ui) g.ui.hint(T('g.wh.shy', { name: T('g.mob.' + m.kind), food: VR.itemName ? VR.itemName(K.food[0]) : K.food[0] }), 4200);
      if (m.ai) m.ai.flee = 1.2;
      return true;
    }
    // ---------------------------------------------------------------- visits (a friend at your door)
    homeOf() { const p = this.g.player, h = p && (p.spawnBed || p.spawn); return Array.isArray(h) && h.length >= 3 ? h : null; }
    visits(dt) {
      this.visitT -= dt; if (this.visitT > 0) return;
      this.visitT = 2;
      const g = this.g, p = g.player, home = this.homeOf(), E = g.env && g.env.E;
      if (this.visitor && (this.visitor.dead || !this.visitor.wh || !this.visitor.wh.visit)) this.visitor = null;
      if (!home || !this.friends.length) return;
      const atHome = Math.hypot(p.pos[0] - home[0], p.pos[2] - home[2]) < 24;
      const day = !E || (E.night || 0) < 0.3;
      for (const f of this.friends) if (B.visitDue(f, { now: this.now, day, atHome, visiting: !!this.visitor })) { this.visit(f, home); break; }
    }
    visit(f, home) {
      const g = this.g, w = g.world, ent = g.entities; if (!ent || !w) return null;
      for (let k = 0; k < 16; k++) {
        const a = Math.random() * Math.PI * 2, x = Math.floor(home[0] + Math.cos(a) * 14), z = Math.floor(home[2] + Math.sin(a) * 14);
        if (!w.isLoaded(x, z)) continue;
        const top = w.topAt(x, z);
        if (!(VR.R.T.flags[w.getBlock(x, top, z)] & VR.F.SOLID) || Math.abs(top - home[1]) > 8) continue;
        let clear = true;   // (a straight walk to the door: no wall in the way)
        for (let s = 1; s < 8 && clear; s++) { const sx = Math.floor(x + (home[0] + 1.5 - x) * s / 8), sz = Math.floor(z + (home[2] + 1.5 - z) * s / 8), b = w.getBlock(sx, Math.floor(home[1]), sz); if (b && (VR.R.T.flags[b] & VR.F.SOLID)) clear = false; }
        if (!clear) continue;
        const m = ent.summon(f.kind, x + 0.5, top + 1, z + 0.5); if (!m) return null;
        const h = this.attach(m);
        h.bond = f; h.visit = { stay: B.VISIT_STAY, home, hearts: 0 };
        h.cover = [home[0] + 1.5, home[2] + 1.5]; h.mode = 'visit';
        B.visited(f, this.now, Math.random());
        this.visitor = m;
        if (g.ui) g.ui.hint(T('g.wh.visit', { name: T('g.mob.' + f.kind) }), 4200);
        return m;
      }
      return null;
    }
    thinkVisit(m, h) {
      const p = this.g.player, V = h.visit;
      if (h.mode === 'wait') {
        V.stay -= h.thinkT;
        const d = Math.hypot(p.pos[0] - m.pos[0], p.pos[2] - m.pos[2]);
        if (d < 4 && (V.hearts -= h.thinkT) <= 0) { V.hearts = 6; h.wig = 1.4; if (this.g.companions) this.g.companions.hearts(m, 4); }
        if (V.stay <= 0) { h.visit = null; h.mode = null; }
      } else if (h.mode !== 'visit') h.mode = 'visit';
    }
    // ---------------------------------------------------------------- the pose (entities.pose / Companions.poseOf)
    pose(m, t, P) {
      const h = m.wh; if (!h || !this.on) return P;
      const dt = h.lt < 0 ? 0 : Math.min(0.25, t - h.lt); h.lt = t;
      // blinks (every 2–6 s: half lid, shut, half lid — WildBond.lid), a content half-lid while petted or eating
      h.blinkT -= dt;
      if (h.blinkT <= 0) { h.bl = B.BLINK; h.blinkT = 2 + hash(m.id, Math.floor(t), 0, 1) * 4; }
      h.bl = Math.max(0, h.bl - dt);
      const rest = h.mode === 'rest';
      if (m.vkey) {   // (the heads come with the variant)
        const lid = B.lid(h.bl, rest, h.wig > 0 || h.eatT > 0.3), pp = this.g.player && this.g.player.pos;
        const far = !pp || (m.pos[0] - pp[0]) ** 2 + (m.pos[1] - pp[1]) ** 2 + (m.pos[2] - pp[2]) ** 2 > GLINT_D2;
        m.whide = lid === 'shut' ? HIDE_SHUT : lid === 'half' ? HIDE_HALF : far ? HIDE_FAR : HIDE_OPEN;
      } else m.whide = null;
      // springs: the tail swings out of a turn, the ears flop when the head moves
      const yr = dt > 0 ? angDiff(m.yaw - h.ly) / dt : 0; h.ly = m.yaw;
      const wig = h.wig > 0 ? Math.sin(t * 16) * 0.5 : 0;
      B.spring(h.sT, Math.max(-0.8, Math.min(0.8, -yr * 0.35)) + wig, 9, 0.3, dt);
      const hp0 = P.head ? P.head[0] : 0;
      // the head: alert (up, toward you), sniffing (down, nodding), peeking (up and down), resting (down)
      let hx = hp0, hy = P.head ? P.head[1] : 0;
      const mode = h.mode;
      if (mode === 'alert' || mode === 'wait') { hx = 0.22; hy = Math.sin(t * 0.7 + m.id) * 0.25; }
      else if (mode === 'sniff') hx = -0.35 + Math.sin(t * 10 + m.id) * 0.09;
      else if (mode === 'peek') hx = Math.sin(t * 1.3 + m.id) > 0.3 ? 0.28 : -0.25;
      else if (mode === 'approach') hx = -0.12 + Math.sin(t * 6) * 0.04;
      else if (rest) { hx = -0.5; hy = 0.5; }
      B.spring(h.sE, (hx - (h.phx || hx)) * 3 + (m.walkAmt || 0) * Math.sin((m.walk || 0) * 6) * 0.18, 12, 0.25, dt); h.phx = hx;
      const hs = h.baby ? 1.3 : 1;
      P.head = put(h.hp, hx, hy, 0, 0, h.baby ? 0.6 : 0, 0, hs);
      P.head_c = P.head_h = P.head_o = P.head;
      if (P.tail || m.def.companion || m.kind === 'moss_cat' || m.kind === 'glimmer_fox' || m.kind === 'crystal_pup') {
        const tl = P.tail || [0, 0, 0];
        P.tail = put(h.pt, tl[0] || 0, (tl[1] || 0) + h.sT.x, tl[2] || 0, tl[3] || 0, tl[4] || 0, tl[5] || 0, 1);
      }
      const el = P.ear_l || [0, 0, 0], er = P.ear_r || [0, 0, 0];
      P.ear_l = put(h.pel, (el[0] || 0) - h.sE.x, el[1] || 0, (el[2] || 0) + h.sE.x * 0.5, 0, h.baby ? 0.6 : 0, 0, hs);
      P.ear_r = put(h.per, (er[0] || 0) - h.sE.x, er[1] || 0, (er[2] || 0) - h.sE.x * 0.5, 0, h.baby ? 0.6 : 0, 0, hs);
      // lying down (dusk): legs folded, the body lowered; a happy wiggle rolls the body
      if (rest) {
        const L = h.legs; P.leg_fl = put(L[0], 1.4, 0, 0, 0, 0, 0, 1); P.leg_fr = put(L[1], 1.4, 0, 0, 0, 0, 0, 1); P.leg_bl = put(L[2], -1.4, 0, 0, 0, 0, 0, 1); P.leg_br = put(L[3], -1.4, 0, 0, 0, 0, 0, 1);
        const dn = m.kind === 'glimmer_deer' ? -5.5 : m.kind === 'bloom_sheep' ? -4.5 : -3;   // (long legs: lower)
        P.body = put(h.pb, 0, 0, 0, 0, dn, 0, 1);
        P.head[4] += dn;
        P.ear_l[4] += dn; P.ear_r[4] += dn;
        if (P.tail) P.tail[4] += dn;
      } else if (h.wig > 0 || P.body) {
        const b = P.body || [0, 0, 0];
        P.body = put(h.pb, b[0] || 0, b[1] || 0, (b[2] || 0) + wig * 0.25, b[3] || 0, b[4] || 0, b[5] || 0, 1);
      }
      const q = P.head; P.glint = put(h.pg || (h.pg = ZERO6()), q[0], q[1], q[2], q[3], q[4], q[5], q[6] * 0.5);   // (half-voxel cells)
      return P;
    }
    // ---------------------------------------------------------------- finches (hop, peck, take off)
    birdsTick(dt) {
      const g = this.g, p = g.player, w = g.world, E = g.env && g.env.E;
      const day = !E || (E.night || 0) < 0.3;
      const L = this.birds;
      this.birdT -= dt;
      if (!L.length && day && this.birdT <= 0 && w && VR.DimReg && VR.DimReg.actorsHome && VR.DimReg.actorsHome(g.dim)) {
        this.birdT = 8;
        const a = Math.random() * Math.PI * 2, d = 9 + Math.random() * 8;
        const x = Math.floor(p.pos[0] + Math.cos(a) * d), z = Math.floor(p.pos[2] + Math.sin(a) * d);
        if (w.isLoaded(x, z) && VR.GEN && w.getBlock(x, w.topAt(x, z), z) === VR.GEN.S().grass) this.flock(x + 0.5, z + 0.5, 4 + Math.floor(Math.random() * 3));
      }
      for (let i = L.length - 1; i >= 0; i--) {
        const b = L[i];
        b.t -= dt; b.flap += dt;
        const dx = b.x - p.pos[0], dz = b.z - p.pos[2], d2 = dx * dx + dz * dz;
        if (b.st === 'hop' || b.st === 'perch') {
          b.calm = Math.max(0, (b.calm || 0) - dt);
          if ((d2 < 20 || (d2 < 64 && this.pspeed > 4)) && !(b.calm > 0)) {
            // f-wild3: a short arc to a leaf or a fence top near (or the grass further off) — after three scares it leaves
            if ((b.flights || 0) < 3) { B.finchTakeoff(b, p.pos[0], p.pos[2], this.bw, Math.random); continue; }
            const d = Math.sqrt(d2) || 1; b.st = 'leave'; b.vx = dx / d * 4.5 + (Math.random() - 0.5); b.vz = dz / d * 4.5 + (Math.random() - 0.5); b.vy = 4 + Math.random() * 1.5; b.yaw = Math.atan2(-b.vx, -b.vz); continue;
          }
          if (b.st === 'perch') {
            // sitting: it looks about and preens now and then
            if (b.t <= 0) { b.t = 0.6 + Math.random() * 1.6; if (Math.random() < 0.6) b.yaw += (Math.random() - 0.5) * 1.8; else b.peck = 0.25; }
          } else if (b.air) { b.vy -= 22 * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt; if (b.y <= b.gy) { b.y = b.gy; b.air = false; b.vy = 0; } }
          else if (b.t <= 0) {
            b.t = 0.5 + Math.random() * 1.4;
            if (Math.random() < 0.6) { const a = b.yaw + (Math.random() - 0.5) * 1.6; b.yaw = a; b.vx = -Math.sin(a) * 0.9; b.vz = -Math.cos(a) * 0.9; b.vy = 3.4; b.air = true; const top = w.topAt(Math.floor(b.x + b.vx * 0.3), Math.floor(b.z + b.vz * 0.3)); b.gy = top + 1; }
            else b.peck = 0.35;
          }
          b.peck = Math.max(0, (b.peck || 0) - dt);
        } else if (b.st === 'fly') B.finchFly(b, dt);
        else {
          b.vy = Math.max(-0.5, b.vy - dt * 2.2); b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
          if (d2 > 1600) { L.splice(i, 1); if (!L.length) this.birdT = 20; continue; }
        }
        if (d2 > 3600) { L.splice(i, 1); if (!L.length) this.birdT = 12; }
      }
    }
    flock(x, z, n) {
      const w = this.g.world; this.birds.length = 0;
      for (let i = 0; i < n; i++) {
        const bx = x + (Math.random() - 0.5) * 3, bz = z + (Math.random() - 0.5) * 3, top = w.topAt(Math.floor(bx), Math.floor(bz));
        this.birds.push({ x: bx, y: top + 1, z: bz, gy: top + 1, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28, st: 'hop', t: Math.random(), flap: Math.random() * 3, air: false, peck: 0, id: i, P: { body: [0, 0, 0], wing_l: [0, 0, 0], wing_r: [0, 0, 0] } });
      }
    }
    draw(ent, r, p, cam, t) {
      if (!this.on || !this.birds.length) return;
      const model = VR.getVoxModel(r.gl, 'wh_finch'); if (!model) return;
      const pos = this.bpos || (this.bpos = [0, 0, 0]), opts = this.bopts || (this.bopts = { scale: 1.35, shade: 0 });
      for (const b of this.birds) {
        const dx = b.x - cam.x, dz = b.z - cam.z; if (dx * dx + dz * dz > 80 * 80) continue;
        const P = b.P, fly = b.st === 'fly' || b.st === 'leave' || b.air, beat = b.st === 'leave' || b.air || (b.st === 'fly' && b.beat);
        const f = beat ? Math.sin(b.flap * 38) * 1.1 : 0.0;   // (6 Hz beats; spread and still when it glides in)
        P.wing_l[2] = beat ? -0.4 - f : fly ? -1.25 : -0.1; P.wing_r[2] = beat ? 0.4 + f : fly ? 1.25 : 0.1;
        P.body[0] = b.peck > 0 ? -0.5 : fly ? Math.max(-0.35, Math.min(0.45, (b.vy || 0) * 0.12)) : 0;
        pos[0] = b.x; pos[1] = b.y + (fly ? 0 : 0.02); pos[2] = b.z;
        ent.drawModel(r, p, model, pos, cam, b.yaw, P, ent.lightAt(b.x, b.y + 0.3, b.z), opts);
      }
    }
    // ---------------------------------------------------------------- the save (meta.wildBonds)
    beforeSave(meta) { const s = B.serialize(this.friends); if (s.length) meta.wildBonds = s; else delete meta.wildBonds; }
  }
  VR.WildHeart = WildHeart;
  WildHeart.vkey = vkey;
})(VR);

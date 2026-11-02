// ============================================================================
// v-light · Lichtpfützen (plan docs/superpowers/plans/2026-11-02-v-light.md): nights that glow — real pools of warm
// light from the lanterns, fires, windows and fairy lights, and from the lights that move (a villager's lantern, the
// festival's fire and fireworks, the fairies' glows, the lamp in the player's hand).
// Our own implementation of a top-down light field (the idea of 2D light fields / radiance propagation on a grid from
// recent graphics research): a 128 × 128 grid of 1 m cells round the camera, toroidal (a cell's place is its world
// coordinate mod 128 — the window moves without shifting a byte), built incrementally:
//   · the scan   a few rows of columns a frame (LF.ROWS): per column a 32-bit mask of the opaque blocks in a band round
//                the eye and its brightest light-giving block (R.T.emit) — the whole window in 128 / ROWS frames
//   · the stamp  every light into the grid: a disc of radius R, cells in order of distance, each cell's visibility its
//                parent's (the cell one step back toward the light) times its own openness at the light's height — a
//                ray cast on the grid in one pass (walls cast shadows; glass, fences, leaves pass the light; the wall's
//                own cell is lit, its far side not). Falloff 1 / (1 + k d²), tapered to 0 at R
//   · static     the scanned lights restamped into a back buffer a few dozen a frame, swapped when complete
//   · moving     the frame's moving lights (≤ LF.DMAX) stamped over a copy of the static grid every frame
//   · packed     RGBA8: rgb √(L′ / LMAX) with L′ = L / (1 + L / LMAX) (a soft ceiling), a the lights' mean height (over Y0, 48 m) — one 64 KB upload a frame
// The shaders (terrain, props, furniture, the voxel models, the people) sample it at their place (one bilinear tap)
// and add it to the lamps' light: soft coloured light, a vertical falloff from the lights' height, a hemispheric cosine.
// Very Low and Low: off (their programs unchanged, nothing runs). Balanced: off by default (switchable). High and up: on.
// The switch: Bild · Licht & Schatten → „Lichtpfützen" (lfPools). Pure here (node: test/lightfield.js); the GL side,
// the moving lights and the villagers' lanterns: lightfield_gl.js.
// ============================================================================
(function (VR) {
  'use strict';
  const LF = VR.LField = VR.LField || {};
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  // ---------------------------------------------------------------- the switch
  LF.SW = ['lfPools'];
  const OFF = { lfPools: false };
  const TIERS = { potato: OFF, low: OFF, balanced: OFF, high: { lfPools: true }, ultra: { lfPools: true }, ultraLite: { lfPools: true } };
  LF.defaults = (preset) => Object.assign({}, TIERS[preset] || OFF);
  LF.off = () => Object.assign({}, OFF);
  LF.ROWS_SET = [{ key: 'lfPools', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lfPools', tip: 'g.set.lfPools.tip', cost: 'mid', def: false }];
  LF.key = (q) => (q && q.lfPools ? '1' : '0');
  LF.q = OFF;
  LF.use = function (q) { LF.q = q || OFF; return LF.q; };
  // the programs that read the field: the terrain (opaque, cutout, its z-prepass colour pass), the props, the furniture,
  // the voxel models (the lanterns, the animals, the folk's voxel self) and the smooth people
  LF.PROGS = { terrain: 1, terrainCut: 1, terrainCutZ: 1, prop: 1, furn: 1, vox: 1, voxInst: 1, folk: 1, folkSun: 1 };
  LF.definesFor = (name, q) => ((q || LF.q).lfPools && LF.PROGS[name] ? ['LFIELD'] : []);
  LF.hook = function (name, defines) {
    const extra = LF.definesFor(name);
    if (!extra.length) return defines || [];
    return (defines || []).concat(extra.filter(d => !(defines || []).includes(d)));
  };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => LF.hook(name, prev ? prev(name, defines) : (defines || [])); }

  // ---------------------------------------------------------------- the constants
  LF.N = 128; LF.HALF = 64; LF.BAND = 32; LF.BELOW = 12;
  LF.ROWS = 2;       // columns scanned a frame: 2 rows of 128 (the window in 64 frames, ~1 s)
  LF.STAMPS = 24;    // static lights restamped a frame (only while the scan sees a change)
  LF.LMAX = 1.15;    // (f-polish8: 0.9 → 1.15, the pools read) the packed range (√-encoded) and the soft ceiling L / (1 + L / LMAX): under a full lamp's own light (1.35)
  LF.HSPAN = 48;     // the height channel's span over Y0 (m)
  LF.DMAX = 32;      // moving lights a frame
  // the light: gain per emit level 15, falloff k (1/m²), radius R (m) of a block light and of a moving one; the shader's
  // strength, vertical falloff (1/m², past 1.5 m) and the fade at the window's edge (m)
  // cube: a full glowing cube's share (a neon band, a lit floor line, a glowing block — its own glow and the voxel light
  // already light its place; the field is for the lamps, the lanterns, the fires, the windows' light)
  LF.K = { gain: 1.25, k: 0.07, R: 14, Rd: 11, str: 1.0, kv: 0.05, fade0: 50, fade1: 60, cube: 0.25, minLv: 8,
    // f-polish8: the point lights (lamps, lanterns, fires) ×point; a light ≤ low m over its ground a tighter disc (×lowR)
    // and a steeper falloff (k ×lowK): round pools along a fence; the fairy places' glowing models ×fairy
    point: 1.6, low: 2, lowR: 0.55, lowK: 6, fairy: 1.8, window: 1.0 };
  LF.MAXL = 192;     // the brightest merged lights kept in a window (a neon city summed to an even lift otherwise)
  LF.LW = 8;         // a light in the list: x y z r g b, k× (the falloff), dir (0 all round; 1 … 4 a window's outward side)

  // ---------------------------------------------------------------- what a light is to the field (f-polish8)
  // point: lamps, lanterns, torches, fires, bulbs, the glowing mushrooms and crystal clusters — the pools; none: strips,
  // neon, LED lines and coves, floor lines, panels, light bars, screens, holo things, consoles, lava, the glowing ores and
  // crystal blocks — their own glow and the voxel light light their place; window: a glowing window — its light falls
  // outward on the side open to the sky; plain: everything else (a full glowing cube ¼ as before)
  LF.KIND = { none: 0, plain: 1, point: 2, window: 3 };
  const RX_NONE = /neon|strip|_line|led_|_led|cove|light_bar|slit|trim|panel|hangar|screen|holo|_pad|tread|console|mediawall|ledbed|_ore|forcefield|conduit|portal|gate|veil|aether|obsidian|heart|glowspar|exo_crystal|crystal_block|sunstone|mire_light|reactor|thruster|runic|lightning_rod|turret|helm|_desk|railing|dome_glass|selfcheckout|shop_sign|promo|_tv|pc_rgb|booth|charger|fridge|freezer|vending|aquarium|hottub|pergola|fountain|lava|magma|ice_crystal|hex_light|stn_clamp|ferry_dock|launch_beacon|beacon_red/;
  const RX_WIN = /window/;
  const RX_POINT = /lantern|lamp|torch|fire|bulb|pendant|chandelier|sconce|bollard|jack_o|_spot|candles|beacon|stove|pizzaoven|fire_pit|firetable|stall_tall|globe|uplight|cauldron|glow_berry|lumishroom|crystal_cluster|vx_crystal|swingarm|updown|arc_lamp/;
  LF.kindName = (n) => (!n ? LF.KIND.plain : RX_WIN.test(n) ? LF.KIND.window : RX_NONE.test(n) ? LF.KIND.none : RX_POINT.test(n) ? LF.KIND.point : LF.KIND.plain);
  LF.kindTable = function (T) {
    if (T.lfKind && T.lfKind.length === T.emit.length) return T.lfKind;
    const n = T.emit.length, out = new Uint8Array(n), types = VR.R && VR.R.types;
    for (let s = 0; s < n; s++) { if (!T.emit[s]) continue; const t0 = types && types[T.type[s]]; out[s] = LF.kindName(t0 && t0.name); }
    return (T.lfKind = out);
  };
  LF.kindOf = (T, s) => LF.kindTable(T)[s];
  const N = LF.N, NN = N * N, M = N - 1, OPQ = 2;   // (VR.F.OPAQUE is 1 << 1: registry.js)

  // ---------------------------------------------------------------- the disc's order (a ray cast in one pass)
  // offsets within radius R, sorted by distance; each one's parent the cell one step back toward the centre
  const discs = {};
  LF.disc = function (R) {
    if (discs[R]) return discs[R];
    const L = [];
    for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) { const d = Math.hypot(x, z); if (d <= R) L.push([x, z, d]); }
    L.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    const at = new Map(); L.forEach((o, i) => at.set(o[0] + ',' + o[1], i));
    const n = L.length, ox = new Int8Array(n), oz = new Int8Array(n), par = new Int32Array(n), dist = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [x, z, d] = L[i]; ox[i] = x; oz[i] = z; dist[i] = d;
      if (i === 0) { par[i] = -1; continue; }
      const s = (d - 1) / d; let px = Math.round(x * s), pz = Math.round(z * s);
      let j = at.get(px + ',' + pz);
      if (j === undefined || j >= i) { px = x - Math.sign(x); pz = z - Math.sign(z); j = at.get(px + ',' + pz); }
      par[i] = j === undefined ? 0 : j;
    }
    return (discs[R] = { n, ox, oz, par, dist, vis: new Float32Array(n) });
  };
  // the falloff a distance d (JS mirror of the stamp; the node test checks its shape)
  LF.fall = (d, R, k) => { const t = 1 - (d / R) * (d / R); return t <= 0 ? 0 : (t * t) / (1 + k * d * d); };

  // ---------------------------------------------------------------- the field
  LF.Field = function () {
    this.mask = new Uint32Array(NN);           // opaque blocks over base (bit b: y = base + b)
    this.base = new Int32Array(NN);
    this.tx = new Int32Array(NN).fill(0x7fffffff); this.tz = new Int32Array(NN).fill(0x7fffffff);   // the world column scanned there
    this.em = new Uint16Array(NN); this.emY = new Int32Array(NN);   // its brightest light (packed rgb 4:4:4) and height
    this.front = new Float32Array(NN * 4); this.back = new Float32Array(NN * 4);   // rgb, Σ h·lum
    this.work = new Float32Array(NN * 4);
    this.out = new Uint8Array(NN * 4);
    // the lights of the rebuild under way: the scanned cells merged 2 × 2 (a neon wall's thousand blocks a quarter as
    // many lights — their light summed, their place the light-weighted mean), x y z r g b each
    this.L = new Float32Array((NN >> 2) * LF.LW); this.nList = 0; this.li = 0;
    this.dirty = true; this.fresh = true; this.lastDyn = 0;
    this.touchT = new Int32Array(NN); this.prevT = new Int32Array(NN); this.nTouch = 0; this.nPrev = 0; this.mark = new Uint32Array(NN); this.gen = 1; this.hs = 255 / LF.HSPAN;
    this.row = 0; this.cx = 0; this.cz = 0; this.cy = 0; this.Y0 = 0;
    this.started = false; this.swapped = 0; this.dyn = new Float32Array(LF.DMAX * 7); this.nDyn = 0;
    this.stats = { scan: 0, stamps: 0, swaps: 0, lights: 0, dyn: 0 };
    this.lut = new Uint8Array(1024); for (let i = 0; i < 1024; i++) this.lut[i] = Math.round(255 * Math.sqrt(i / 1023));
  };
  const FP = LF.Field.prototype;
  // the window's centre (the camera's cell); a jump (16 m or more) clears the field: its cells are another place's
  FP.center = function (x, y, z) {
    const cx = Math.floor(x), cz = Math.floor(z), cy = Math.floor(y);
    const jump = !this.started || Math.abs(cx - this.cx) > 16 || Math.abs(cz - this.cz) > 16 || Math.abs(cy - this.cy) > 16;
    this.cx = cx; this.cz = cz; this.cy = cy;
    if (jump) { this.started = true; this.front.fill(0); this.back.fill(0); this.tx.fill(0x7fffffff); this.nList = 0; this.li = 0; this.swapped++; this.dirty = this.fresh = true; }
    return jump;
  };
  // the world coordinate in the window for a toroidal index (x0 = the window's low edge)
  const inWin = (i, lo) => lo + ((i - lo) & M);
  // scan rows of columns: col(cx, cz) the world's ready chunk column (world.col) or null; T the block tables (R.T)
  FP.scan = function (col, T, rows) {
    const flags = T.flags, emit = T.emit, kinds = LF.kindTable(T), x0 = this.cx - LF.HALF, z0 = this.cz - LF.HALF, yb = this.cy - LF.BELOW;
    let n = 0;
    for (let r = 0; r < rows; r++) {
      const rr = this.row; this.row = (this.row + 1) & M;
      const z = inWin(rr, z0);
      let c = null, ccx = 0x7fffffff;
      for (let ii = 0; ii < N; ii++) {
        const x = inWin(ii, x0), i = rr * N + ii, kx = x >> 4;
        if (kx !== ccx) { ccx = kx; c = col(kx, z >> 4); }
        const moved = this.tx[i] !== x || this.tz[i] !== z || this.base[i] !== yb;
        this.tx[i] = x; this.tz[i] = z; this.base[i] = yb;
        let m = 0, e = 0, ey = 0, eb = 0;
        if (c && c.blocks) {
          const B = c.blocks, H = c.H || (B.length >> 8), lc = ((z & 15) << 4) | (x & 15);
          for (let b = 0; b < LF.BAND; b++) {
            const y = yb + b; if (y < 0 || y >= H) continue;
            const s = B[(y << 8) | lc]; if (!s) continue;
            if (flags[s] & OPQ) m |= (1 << b);
            const em = emit[s];
            if (em) { const kd = kinds[s]; if (kd) { const lv = Math.max((em >> 8) & 15, (em >> 4) & 15, em & 15) * ((flags[s] & OPQ) ? 1 : 2) * (kd === 2 ? 2 : 1); if (lv > eb) { eb = lv; e = (em & 0xfff) | (kd << 12) | ((flags[s] & OPQ) ? 0x8000 : 0); ey = y; } } }   // (a lamp, a torch, a lantern before a glowing cube in the same column; f-polish8: its kind in bits 12–13, strips not at all)
          }
        }
        if (moved ? (m || e || this.mask[i] || this.em[i]) : (this.mask[i] !== (m >>> 0) || this.em[i] !== e || this.emY[i] !== ey)) this.dirty = true;   // (a change: the lights again)
        this.mask[i] = m >>> 0; this.em[i] = e; this.emY[i] = ey; n++;
      }
    }
    this.stats.scan = n;
    return n;
  };
  // open at the cell i for a light at height y (no word of it — a stale cell, outside the band — is open)
  FP.open = function (i, wx, wz, y) {
    if (this.tx[i] !== wx || this.tz[i] !== wz) return 1;
    const b = y - this.base[i];
    if (b < 0 || b >= LF.BAND) return 1;
    return (this.mask[i] >>> b) & 1 ? 0 : 1;
  };
  // stamp one light (world x, y, z; rgb at the source) into the buffer A, radius R
  // (f-polish8: km the falloff's k ×; dir 1 … 4 a window's outward side (+x −x +z −z): the cells behind it unlit)
  const DIRX = [0, 1, -1, 0, 0], DIRZ = [0, 0, 0, 1, -1];
  FP.stamp = function (A, lx, ly, lz, r, g, b, R, rec, km, dir) {
    const D = LF.disc(R), vis = D.vis, ox = D.ox, oz = D.oz, par = D.par, dist = D.dist, k = LF.K.k * (km || 1), ddx = DIRX[dir | 0], ddz = DIRZ[dir | 0];
    const x0 = this.cx - LF.HALF, z0 = this.cz - LF.HALF, ix = Math.floor(lx), iz = Math.floor(lz), iy = Math.floor(ly);
    const lum = r + g + b; if (lum <= 0) return;
    for (let j = 0; j < D.n; j++) {
      const wx = ix + ox[j], wz = iz + oz[j];
      if (wx < x0 || wx >= x0 + N || wz < z0 || wz >= z0 + N) { vis[j] = 0; continue; }
      const i = (wz & M) * N + (wx & M);
      const vp = j === 0 ? 1 : vis[par[j]];
      if (vp <= 0 || ox[j] * ddx + oz[j] * ddz < 0) { vis[j] = 0; continue; }
      const f = LF.fall(dist[j], R, k) * vp;
      const q = i * 4;
      A[q] += r * f; A[q + 1] += g * f; A[q + 2] += b * f; A[q + 3] += ly * lum * f;
      if (rec && this.mark[i] !== this.gen) { this.mark[i] = this.gen; this.touchT[this.nTouch++] = i; }
      vis[j] = j === 0 ? 1 : vp * this.open(i, wx, wz, iy);
    }
  };
  // the static lights: a rebuild a slice at a time — the list gathered from the scanned cells (merged 2 × 2), stamped
  // STAMPS a frame into the back buffer, swapped in whole (returns true on a swap). Nothing changed since the last pass
  // (the scan saw the same blocks): nothing to do
  LF.radius = (r, g, b) => { const lv = Math.min(30, Math.max(r, g, b) * 15 / LF.K.gain); return Math.max(5, Math.min(16, Math.round(5 + 9 * Math.sqrt(lv / 15)))); };
  // the ground under a light: its height over the highest opaque block below it in its column (the band's), 99 none
  FP.overGround = function (i, y) {
    const b = y - this.base[i]; if (b <= 0 || b > LF.BAND) return 99;
    const m = this.mask[i] & (b >= 32 ? 0xffffffff : ((1 << b) >>> 0) - 1);
    return m ? b - (31 - Math.clz32(m)) : 99;
  };
  // a cell open to the sky above height y (no opaque block from y up to the band's top): outside
  FP.skyOpen = function (i, wx, wz, y) {
    if (this.tx[i] !== wx || this.tz[i] !== wz) return false;
    const b = y - this.base[i]; if (b < 0 || b >= LF.BAND) return false;
    return (this.mask[i] >>> b) === 0;
  };
  // a window's outward side (1 … 4: +x −x +z −z), 0 none open to the sky
  FP.outward = function (wx, wz, y) {
    for (let d = 1; d <= 4; d++) {
      const nx = wx + DIRX[d], nz = wz + DIRZ[d], j = (nz & M) * N + (nx & M);
      if (this.skyOpen(j, nx, nz, y)) { const bx = wx - DIRX[d], bz = wz - DIRZ[d], k = (bz & M) * N + (bx & M); if (!this.skyOpen(k, bx, bz, y)) return d; }
    }
    return 0;
  };
  FP.rebuild = function (budget) {
    const K = LF.K, x0 = this.cx - LF.HALF, z0 = this.cz - LF.HALF, gk = K.gain / 15, L = this.L, LW = LF.LW;
    if (this.li >= this.nList) {
      if (!this.dirty) return false;
      this.dirty = false;
      // a new pass: the lights the window holds now, 2 × 2 cells (toroidal pairs: even world coordinates first)
      let n = 0;
      for (let bz = z0 & ~1; bz < z0 + N; bz += 2) for (let bx = x0 & ~1; bx < x0 + N; bx += 2) {
        let sr = 0, sg = 0, sb = 0, sx = 0, sy = 0, sz = 0, sw = 0, lw = 0, wd = 0;
        for (let k = 0; k < 4; k++) {
          const wx = bx + (k & 1), wz = bz + (k >> 1);
          if (wx < x0 || wx >= x0 + N || wz < z0 || wz >= z0 + N) continue;
          const i = (wz & M) * N + (wx & M), e = this.em[i];
          if (!e || this.tx[i] !== wx || this.tz[i] !== wz) continue;
          // (run 3: a hangar's thousand faint panel lights flooded the meadow — a light under level 8 is decoration, its
          // place lit by the voxel light alone; the rest weighted by (level / 15)²: the lamps, the lanterns, the fires count)
          const lv = Math.max((e >> 8) & 15, (e >> 4) & 15, e & 15); if (lv < K.minLv) continue;
          const kd = (e >> 12) & 3, ey = this.emY[i];
          // (f-polish8: a point light ×point, a window full and outward, a plain glowing cube ¼)
          const kk = kd === 2 ? K.point : kd === 3 ? K.window : ((e & 0x8000) ? K.cube : 1);
          const ck = kk * (lv / 15) * (lv / 15), r = ((e >> 8) & 15) * gk * ck, g = ((e >> 4) & 15) * gk * ck, b = (e & 15) * gk * ck, w = r + g + b;
          let px = wx + 0.5, pz = wz + 0.5;
          if (kd === 3) { const d = this.outward(wx, wz, ey); if (d) { px += DIRX[d] * 1.0; pz += DIRZ[d] * 1.0; if (!wd) wd = d; } }
          else if (this.overGround(i, ey) <= K.low) lw += w;
          sr += r; sg += g; sb += b; sx += px * w; sy += (ey + 0.5) * w; sz += pz * w; sw += w;
        }
        if (sw <= 0) continue;
        const o = n++ * LW; L[o] = sx / sw; L[o + 1] = sy / sw; L[o + 2] = sz / sw; L[o + 3] = sr; L[o + 4] = sg; L[o + 5] = sb; L[o + 6] = lw > sw * 0.5 ? 1 : 0; L[o + 7] = wd;
      }
      // (f-polish8: more than MAXL — the brightest kept: a threshold from the sorted weights, the list compacted in place)
      if (n > LF.MAXL) {
        const W = this.wts || (this.wts = new Float32Array(NN >> 2));
        for (let j = 0; j < n; j++) W[j] = L[j * LW + 3] + L[j * LW + 4] + L[j * LW + 5];
        const Ws = W.subarray(0, n).slice().sort(), thr = Ws[n - LF.MAXL];
        let m = 0;
        for (let j = 0; j < n && m < LF.MAXL; j++) { if (W[j] < thr) continue; if (m !== j) for (let c = 0; c < LW; c++) L[m * LW + c] = L[j * LW + c]; m++; }
        this.stats.cut = n - m; n = m;
      }
      this.nList = n; this.li = 0; this.back.fill(0); this.stats.lights = n;
      if (!n) { const t = this.front; this.front = this.back; this.back = t; this.stats.swaps++; this.swapped++; return true; }
    }
    const end = Math.min(this.nList, this.li + budget);
    for (; this.li < end; this.li++) {
      const o = this.li * LW, low = L[o + 6] > 0, R0 = LF.radius(L[o + 3], L[o + 4], L[o + 5]);
      this.stamp(this.back, L[o], L[o + 1], L[o + 2], L[o + 3], L[o + 4], L[o + 5], low ? Math.max(4, Math.round(R0 * K.lowR)) : R0, false, low ? K.lowK : 1, L[o + 7]);
    }
    this.stats.stamps = end;
    if (this.li >= this.nList) { const t = this.front; this.front = this.back; this.back = t; this.stats.swaps++; this.swapped++; return true; }
    return false;
  };
  // the frame's moving lights: add(x, y, z, r, g, b, R) up to DMAX
  FP.clearDyn = function () { this.nDyn = 0; };
  FP.add = function (x, y, z, r, g, b, R) {
    if (this.nDyn >= LF.DMAX || !(r + g + b > 0.002)) return false;
    const dx = x - this.cx, dz = z - this.cz; if (dx * dx + dz * dz > 62 * 62) return false;
    const o = this.nDyn++ * 7, D = this.dyn; D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = r; D[o + 4] = g; D[o + 5] = b; D[o + 6] = Math.max(2, Math.min(24, Math.round(R || LF.K.Rd)));
    return true;
  };
  // the picture: static + moving, packed (the field's base height Y0 = the eye's − 16)
  // (only the moving lights changed: the cells they lit the frame before and light now — restored from the static
  // grid, restamped, repacked — not the whole grid: their touch lists)
  FP.packCell = function (i) {
    const A = this.work, out = this.out, lut = this.lut, q = i * 4, r = A[q], g = A[q + 1], b = A[q + 2], l = r + g + b;
    if (l < 1e-4) { out[q] = out[q + 1] = out[q + 2] = out[q + 3] = 0; return; }
    // a soft ceiling (L / (1 + L / LMAX)): a street of lamps sums to a glow, never to white
    const S = LF.LMAX, s = 1023 / S, kr = r / (1 + r / S), kg = g / (1 + g / S), kb = b / (1 + b / S);
    out[q] = lut[Math.min(1023, (kr * s) | 0)]; out[q + 1] = lut[Math.min(1023, (kg * s) | 0)]; out[q + 2] = lut[Math.min(1023, (kb * s) | 0)];
    out[q + 3] = clamp(((A[q + 3] / l - this.Y0) * this.hs) | 0, 0, 255);
  };
  FP.compose = function (force) {
    const Y0 = this.cy - 16, full = force || this.fresh || this.swapped !== this.composedAt || Y0 !== this.Y0;
    // (nothing new — no swap since the last picture, no moving light now or then: the picture of before stands)
    if (!full && this.nDyn === 0 && this.nPrev === 0) return null;
    this.fresh = false; this.lastDyn = this.nDyn; this.composedAt = this.swapped; this.Y0 = Y0; this.hs = 255 / LF.HSPAN;
    const A = this.work, D = this.dyn, F = this.front, P = this.prevT;
    if (full) A.set(F);
    else for (let k = 0; k < this.nPrev; k++) { const q = P[k] * 4; A[q] = F[q]; A[q + 1] = F[q + 1]; A[q + 2] = F[q + 2]; A[q + 3] = F[q + 3]; }
    this.gen = (this.gen + 1) >>> 0 || 1; this.nTouch = 0;
    for (let j = 0; j < this.nDyn; j++) { const o = j * 7; this.stamp(A, D[o], D[o + 1], D[o + 2], D[o + 3], D[o + 4], D[o + 5], D[o + 6], true); }
    this.stats.dyn = this.nDyn;
    let n = 0;
    if (full) { for (let i = 0; i < NN; i++) this.packCell(i); n = NN; }
    else { for (let k = 0; k < this.nPrev; k++) this.packCell(P[k]); for (let k = 0; k < this.nTouch; k++) this.packCell(this.touchT[k]); n = this.nPrev + this.nTouch; }
    this.stats.packed = n;
    const t = this.prevT; this.prevT = this.touchT; this.touchT = t; this.nPrev = this.nTouch; this.nTouch = 0;
    return this.out;
  };
  // the fairy places at night: their glowing models (the giant mushrooms, the lamps, the crystals, the pool) — models,
  // not blocks, so the scan does not see them: the nearest eight cast their colour on the moss (f-polish8: ×K.fairy,
  // radius 12 — they read as pools now)
  LF.FAIRY = { fy_shroom_0: [0.3, 0.95, 0.85], fy_shroom_1: [0.65, 0.45, 1.0], fy_shroom_2: [1.0, 0.5, 0.75], fy_lamp: [1.0, 0.8, 0.45], fy_tree: [1.0, 0.75, 0.4], fy_pool: [0.45, 0.85, 1.0], fy_crystal_0: [0.5, 0.8, 1.0], fy_crystal_1: [0.8, 0.55, 1.0], fy_crystal_2: [1.0, 0.6, 0.8], fy_garden: [0.9, 0.8, 1.0] };
  LF.fairyLights = function (FS, f, nt, t) {
    if (!FS || !FS.sites || !(nt > 0.3)) return 0;
    let n = 0;
    for (const st of FS.sites) {
      if (!st.parts || n >= 8) continue;
      const dx = st.x - f.cx, dz = st.z - f.cz; if (dx * dx + dz * dz > 80 * 80) continue;
      for (const m of st.parts) {
        if (n >= 8) break;
        const c = LF.FAIRY[m.m]; if (!c || !m.pos) continue;
        const ex = m.pos[0] - f.cx, ez = m.pos[2] - f.cz; if (ex * ex + ez * ez > 56 * 56) continue;
        const h = (m.o && m.o.h) || 1.5, k = 0.9 * nt * LF.K.fairy * (0.9 + 0.1 * Math.sin(t * 1.3 + n));
        if (f.add(m.pos[0], m.pos[1] + h * 0.6, m.pos[2], c[0] * k, c[1] * k, c[2] * k, 12)) n++;
      }
    }
    return n;
  };
  // decode a packed cell (the node test; the GLSL does the same)
  LF.decode = function (out, i, Y0) {
    const q = i * 4, d = (v) => (v / 255) * (v / 255) * LF.LMAX;
    return { r: d(out[q]), g: d(out[q + 1]), b: d(out[q + 2]), h: Y0 + out[q + 3] / 255 * LF.HSPAN };
  };

  // ---------------------------------------------------------------- the GLSL (COMMON, under #ifdef LFIELD)
  // lfLight(rel, n): rel the place relative to the camera, n its normal — the field's light there (rgb, linear)
  // u_lfO: xy the camera's x, z mod 128, z the camera's y − Y0, w the strength (0: none this frame)
  LF.glslCommon = () => `
#ifdef LFIELD
// v-light · Lichtpfützen (lightfield.js): the light field round the eye — 128 × 128 m, toroidal, rgb √-encoded, a the height
uniform sampler2D u_lf;
uniform vec4 u_lfO;
uniform vec4 u_lfK;   // x LMAX, y the height span, z the vertical falloff, w the fade's start (its end + 10)
// sky: the place's sky light (0 indoors … 1 outdoors) — indoors the voxel light already lights the room: a third there
vec3 lfLight(vec3 rel, vec3 n, float sky) {
  if (u_lfO.w <= 0.0) return vec3(0.0);
  float dh = length(rel.xz);
  float fade = 1.0 - smoothstep(u_lfK.w, u_lfK.w + 10.0, dh);
  if (fade <= 0.0) return vec3(0.0);
  vec4 t = texture(u_lf, (rel.xz + n.xz * 0.45 + u_lfO.xy) * (1.0 / 128.0));
  vec3 c = t.rgb * t.rgb * u_lfK.x;
  float dy = t.a * u_lfK.y - (rel.y + u_lfO.z);   // the lights' height over this place
  float ady = max(abs(dy) - 1.5, 0.0);
  float fy = clamp((dy + 0.5) * 0.5, -1.0, 1.0);   // 1: the light above, −1: below
  float lam = clamp(0.55 + 0.45 * n.y * fy + 0.25 * (1.0 - abs(n.y)), 0.0, 1.0);
  float out_ = mix(0.3, 1.0, smoothstep(0.35, 0.85, sky));
  return c * (lam * fade * out_ * u_lfO.w / (1.0 + u_lfK.z * ady * ady));
}
#endif
`;
  // the JS mirror of lfLight's shape (node test): the vertical falloff and the hemispheric cosine
  LF.shade = function (dy, ny, sky) {
    const ady = Math.max(Math.abs(dy) - 1.5, 0), fy = clamp((dy + 0.5) * 0.5, -1, 1);
    const t = clamp((sky === undefined ? 1 : sky) - 0.35, 0, 0.5) / 0.5, out = 0.3 + 0.7 * t * t * (3 - 2 * t);
    return clamp(0.55 + 0.45 * ny * fy + 0.25 * (1 - Math.abs(ny)), 0, 1) * out / (1 + LF.K.kv * ady * ady);
  };
})(VR);

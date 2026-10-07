// ============================================================================
// Blueprints — every catalogue villa as an item, and the player's own R9 Studio
// design of it when there is one (★). Holding a blueprint shows where the lot
// goes: the front (street side, orange) faces you, R turns it, F flips through
// the facades. Right click levels the ground the way a town does it (filled up
// to the yard, hills cut back, a stepped verge around the lot — only natural
// blocks are cut there) and lays the house down block by block; Z or /undo
// takes the whole thing back. Each house is built once per design and facade
// in a worker (flat lot, lot-local cells, the builder's last write per cell)
// and cached here. Creative and Zen Builder only.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F;
  const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];   // = the lot builder's
  const FRONT = [[0, -1], [1, 0], [0, 1], [-1, 0]];                                            // street side of a lot turned r
  const REACH = 120, MARGIN = 3, DEPTH = 48, CLEAR = 80;
  // a piece changing more cells than SLICE_MAX is built in slices of SLICE_STEP, one every SLICE_T seconds (bottom up):
  // a 30-storey tower is ~50 000 cells — on a slow PC one bulk edit of that stalls a frame, ten slices of it do not
  const SLICE_MAX = 16000, SLICE_STEP = 8000, SLICE_T = 0.05;
  // natural blocks (the verge may cut or cover them) and ground (what a house can stand on)
  let NAT = null, GROUND = null;
  function tables() {
    if (NAT) return;
    NAT = new Uint8Array(R.types.length); GROUND = new Uint8Array(R.types.length);
    const ROCK = /^(stone|andesite|granite|diorite|tuff|deepstone|deepslate|calcite|dripstone_block|basalt|smooth_basalt|blackstone|netherrack|end_stone)$/;
    for (const t of R.types) {
      if (!t || !t.name) continue;
      const nat = t.cat === 'nature' || /^Natural/.test(t.group || '') || ROCK.test(t.name) || /_log$|_stem$|_leaves$/.test(t.name);
      NAT[t.id] = nat ? 1 : 0;
      const s = t.defaultState, fl = R.T.flags[s];
      GROUND[t.id] = (fl & F.SOLID) && (fl & F.FULL) && !(fl & F.LEAVES) && !/_log$|_stem$|_wood$/.test(t.name) ? 1 : 0;
    }
  }

  class Blueprints {
    constructor(gad) {
      this.gad = gad; this.g = gad.g;
      this.cache = new Map(); this.pending = new Set();
      this.rot = 0; this.variant = {}; this.at = null;
      this.names();
    }
    plan() { const VG = VR.VillageGen; return VG && VG.plan2; }
    hint(t, ms) { this.g.ui.hint(t, ms || 2400); }
    // item names carry a star while the player's own design replaces the house
    names() {
      const P = this.plan(); if (!P) return;
      P.CATALOGUE.forEach((c, i) => { const it = VR.ITEMS['blueprint_' + i]; if (it) it.name = 'Blueprint · ' + c.name + (VR.Custom && VR.Custom.houseFor(i) ? ' ★' : ''); });
    }
    // the Studio saved new designs: every cached house is stale
    reset() { this.cache.clear(); this.pending.clear(); this.names(); }
    // the facades a house offers: every skin, plain and mirrored (a design has exactly its own)
    variants(i) {
      const P = this.plan(), cat = P && P.CATALOGUE[i]; if (!cat) return [];
      if (VR.Custom && VR.Custom.houseFor(i)) return [{ custom: true }];
      const skins = cat.skins.filter((s, k, a) => a.indexOf(s) === k), out = [];
      for (const mirror of [false, true]) for (const skin of skins) out.push({ skin, mirror });
      return out;
    }
    key(i) {
      const vs = this.variants(i), n = vs.length, vi = n ? ((this.variant[i] || 0) % n + n) % n : 0, h = VR.Custom && VR.Custom.houseFor(i);
      return { k: i + ':' + vi + ':' + (h ? h.t || 1 : 0), v: vs[vi] || {}, n, vi };
    }
    // the built house for blueprint i (null while the worker builds it)
    get(i) {
      const K = this.key(i), c = this.cache.get(K.k); if (c) return c;
      if (!this.pending.has(K.k) && this.g.pool) {
        this.pending.add(K.k);
        const msg = { type: 'blueprint', index: i, seed: 7 };
        if (!K.v.custom) { msg.skin = K.v.skin; msg.mirror = K.v.mirror; }
        this.g.pool.direct(0, msg, null, (m) => {
          this.pending.delete(K.k);
          if (m.type !== 'blueprint' || m.error) { this.hint('Blueprint failed: ' + (m.error || m.msg || '?'), 3000); return; }
          m.variant = K.vi; m.variants = K.n;
          this.cache.set(K.k, m);
        });
      }
      return null;
    }

    // ---------------------------------------------------------------- where it goes
    locate(p, bp) {
      const g = this.g, w = g.world, e = p.eyePos(), d = p.lookDir();
      const hit = VR.PHYS.raycast((x, y, z) => w.getBlock(x, y, z), e[0], e[1], e[2], d[0], d[1], d[2], REACH);
      if (!hit) return null;
      const ax = hit.x + VR.DX[hit.face], ay = hit.y + VR.DY[hit.face], az = hit.z + VR.DZ[hit.face];
      // the street side faces the player (from the target back to the eye), R turns it further
      const bx = Math.sin(p.yaw), bz = Math.cos(p.yaw);
      let best = 0, bd = -9; for (let r = 0; r < 4; r++) { const dd = FRONT[r][0] * bx + FRONT[r][1] * bz; if (dd > bd) { bd = dd; best = r; } }
      const r = (best + this.rot) & 3;
      const W = bp.lot[0], D = bp.lot[1], q = ROT[r](W >> 1, 0), ox = ax - q[0], oz = az - q[1];
      const rect = (u0, v0, u1, v1) => { const a = ROT[r](u0, v0), b = ROT[r](u1, v1); return [ox + Math.min(a[0], b[0]), oz + Math.min(a[1], b[1]), ox + Math.max(a[0], b[0]), oz + Math.max(a[1], b[1])]; };
      const [x0, z0, x1, z1] = rect(0, 0, W - 1, D - 1);
      const at = { bp, r, ox, oz, F: ay, x0, z0, x1, z1, rect, ok: true, why: '' };
      // can it go here? loaded ground all around, inside the world's height, nobody standing on the lot
      if (ay - DEPTH < 1 || ay + bp.top + 8 >= VR.MAXY) { at.ok = false; at.why = 'Too high or too low for this house'; }
      else {
        outer: for (let cz = (z0 - MARGIN) >> 4; cz <= (z1 + MARGIN) >> 4; cz++) for (let cx = (x0 - MARGIN) >> 4; cx <= (x1 + MARGIN) >> 4; cx++) {
          const c = w.col(cx, cz); if (!c || !c.ready) { at.ok = false; at.why = 'The ground there is still loading — get closer'; break outer; }
        }
      }
      const P = p.pos;
      if (at.ok && P[0] >= x0 - 0.3 && P[0] <= x1 + 1.3 && P[2] >= z0 - 0.3 && P[2] <= z1 + 1.3 && P[1] > ay - 4 && P[1] < ay + bp.top + 2) { at.ok = false; at.why = 'You are standing on the lot — step back'; }
      return at;
    }

    // ---------------------------------------------------------------- per frame while a blueprint is held
    input(input, p, hdef, lmb, rmb) {
      const g = this.g, i = hdef.house | 0;
      const bp = this.get(i);
      this.at = bp ? this.locate(p, bp) : null;
      if (!g.ui.typing) {
        if (input.hit('KeyR')) { this.rot = (this.rot + 1) & 3; g.audio.play('click'); }
        if (input.hit('KeyF')) { const n = this.variants(i).length; if (n > 1) { this.variant[i] = ((this.variant[i] || 0) + 1) % n; g.audio.play('click'); } else this.hint('Your own design has one facade — change it in R9 Studio', 2200); }
        if (input.hit('KeyZ')) this.gad.undo();
      }
      if (rmb) this.build(p, i);
      return lmb || rmb || input.mouse.down[0] || input.mouse.down[2];
    }
    hud(hdef) {
      const P = this.plan(), i = hdef.house | 0, cat = P && P.CATALOGUE[i]; if (!cat) return null;
      const K = this.key(i), bp = this.cache.get(K.k), own = K.v.custom;
      const facade = own ? '<span style="color:#ffd27a">★ your R9 Studio design</span>' : `facade ${K.vi + 1}/${K.n}${bp ? ' · ' + bp.skin + (bp.mirror ? ' · mirrored' : '') : ''}`;
      const at = this.at, where = !bp ? 'drawing up the plan…' : !at ? 'look at the ground' : at.ok ? `${cat.lot[0]}×${cat.lot[1]} lot · ${bp.top + 1} high` : `<span style="color:#ff8a8a">${at.why}</span>`;
      return `<b>BLUEPRINT</b> · ${cat.name} · ${facade} · ${where}<br><small>RMB build · R turn · F facade · Z undo${this.g.player.creative ? '' : ' · <b>Creative / Zen only</b>'}</small>`;
    }
    outlines(out) {
      const at = this.at; if (!at) return;
      const bp = at.bp, ok = at.ok, c = ok ? [0.35, 0.95, 1, 0.9] : [1, 0.32, 0.3, 0.9];
      const add = (r4, y0, y1, col) => out.push({ x: r4[0], y: y0, z: r4[1], boxes: [[0, 0, 0, r4[2] - r4[0] + 1, y1 - y0, r4[3] - r4[1] + 1]], color: col, xray: true });
      add([at.x0, at.z0, at.x1, at.z1], at.F - 0.02, at.F + 0.06, c);                                        // the lot
      const [hu, hv, hw, hd] = bp.house;
      add(at.rect(hu, hv, hu + hw - 1, hv + hd - 1), at.F, at.F + bp.top + 1, [c[0], c[1], c[2], 0.55]);         // the house
      add(at.rect(0, -1, bp.lot[0] - 1, -1), at.F - 0.02, at.F + 0.3, ok ? [1, 0.72, 0.25, 0.95] : c);           // the street side
    }

    // ---------------------------------------------------------------- build it
    build(p, i) {
      const g = this.g, at = this.at;
      if (!at) return;
      if (!p.creative) { this.hint('Blueprints build in Creative or Zen Builder', 2600); return; }
      if (!at.ok) { this.hint(at.why, 2200); return; }
      const t0 = performance.now(), n = this.buildAt(at);
      if (!n) { this.hint('Already standing here', 1600); return; }
      g.audio.place(R.byName.stone.defaultState);
      g.particles && g.particles.spark && g.particles.spark(at.ox + 0.5, at.F + 1, at.oz + 0.5, [0.5, 0.9, 1], 30, 4);
      const P = this.plan(), name = P.CATALOGUE[i].name;
      this.hint(`${name}${at.bp.custom ? ' ★' : ''} built · ${n.toLocaleString()} blocks · Z or /undo takes it back`, 3200);
      g.codex && g.codex.event && g.codex.event('blueprint');
      this.lastMs = performance.now() - t0;
    }
    // level the ground under a lot and lay the house down (at: a placement from locate() or a Studio plan);
    // returns how many blocks changed (all of it one undo step)
    buildAt(at) {
      const { list, undo } = this.planAt(at);
      if (!list.length) return 0;
      this.gad.applyEdit(list, undo);
      return list.length;
    }
    // the highest ground block of a column between two heights (−1 below yLo when there is none)
    groundAt(x, z, yHi, yLo) { tables(); const w = this.g.world, T = R.T; for (let y = yHi; y >= yLo; y--) { const s = w.getBlock(x, y, z); if (s && GROUND[T.type[s]]) return y; } return yLo - 1; }
    // the changes a placement makes (and how to undo them), without applying them: { list, undo }
    planAt(at) {
      const g = this.g, w = g.world, T = R.T;
      tables();
      const bp = at.bp, r = at.r, F0 = at.F;
      // a box over the lot + verge (+ whatever the house puts outside its lot) and DEPTH below … CLEAR above the floor
      let ux0 = -MARGIN, uz0 = -MARGIN, ux1 = bp.lot[0] - 1 + MARGIN, uz1 = bp.lot[1] - 1 + MARGIN;
      const ops = bp.ops;
      for (let k = 0; k < ops.length; k += 4) { if (ops[k] < ux0) ux0 = ops[k]; if (ops[k] > ux1) ux1 = ops[k]; if (ops[k + 2] < uz0) uz0 = ops[k + 2]; if (ops[k + 2] > uz1) uz1 = ops[k + 2]; }
      const B = at.rect(ux0, uz0, ux1, uz1), BX = B[2] - B[0] + 1, BZ = B[3] - B[1] + 1, Y0 = F0 - DEPTH, BY = DEPTH + Math.max(CLEAR, bp.top + 6);
      const box = new Int32Array(BX * BY * BZ).fill(-1);
      const bi = (x, y, z) => ((y - Y0) * BZ + (z - B[1])) * BX + (x - B[0]);
      const inBox = (x, y, z) => x >= B[0] && x <= B[2] && z >= B[1] && z <= B[3] && y >= Y0 && y < Y0 + BY;
      const put = (x, y, z, s) => { if (inBox(x, y, z)) box[bi(x, y, z)] = s; };
      const dirt = R.byName.dirt.defaultState, grass = R.byName.grass_block.defaultState;
      const tid = (s) => T.type[s];
      const ground = (x, z, yHi, yLo) => { for (let y = yHi; y >= yLo; y--) { const s = w.getBlock(x, y, z); if (s && GROUND[tid(s)]) return y; } return yLo - 1; };
      // the highest thing standing on a column from y up (gaps of 4+ air end it)
      const reach = (x, z, y, max) => { let last = y - 1, gap = 0; for (let yy = y; yy < max; yy++) { if (w.getBlock(x, yy, z)) { last = yy; gap = 0; } else if (++gap >= 4) break; } return last; };
      const topOf = (s) => { const n = s && R.types[tid(s)].name; return n === 'sand' || n === 'red_sand' || n === 'snow_block' || n === 'podzol' || n === 'mycelium' ? s : grass; };
      // 1 · the lot: filled up to the yard, everything from the floor up cleared (the house writes its own ground);
      //     where the lot stands more than two blocks over the land its edge is a stacked-stone retaining wall
      const wallS = (R.byName.stacked_stone || R.byName.cobblestone).defaultState;
      for (let v = 0; v < bp.lot[1]; v++) for (let u = 0; u < bp.lot[0]; u++) {
        const q = ROT[r](u, v), x = at.ox + q[0], z = at.oz + q[1];
        const gy = ground(x, z, F0 + 60, F0 - DEPTH), edge = u === 0 || v === 0 || u === bp.lot[0] - 1 || v === bp.lot[1] - 1;
        const fillS = edge && F0 - 1 - gy > 2 ? wallS : dirt;
        for (let y = Math.max(gy + 1, F0 - DEPTH); y <= F0 - 1; y++) put(x, y, z, fillS);
        // (the piece's own volume up to 24 rows, above that whatever still stands there — a 160-high tower does not
        // read 160 rows of open sky per column: the planning of it stays a few milliseconds on the main thread)
        const top = Math.max(F0 + Math.min(bp.top + 2, 24), Math.min(F0 + CLEAR - 1, reach(x, z, F0, F0 + CLEAR)));
        for (let y = F0; y <= top; y++) put(x, y, z, 0);
      }
      // 2 · the verge: ring k may sit k−1 above or below the yard. Small steps of natural ground are filled up or cut
      //     back to that band (a soft slope); a big drop keeps the retaining wall; a big hill is cut back one ring and
      //     held by a stacked-stone wall in the second ring. Only natural blocks are ever touched out here.
      const natCol = (x, z, y0, y1) => { for (let y = y0; y <= y1; y++) { const s = w.getBlock(x, y, z); if (s && !NAT[tid(s)]) return false; } return true; };
      for (let k = 1; k <= MARGIN; k++) {
        const lo = F0 - 1 - (k - 1), hi = F0 - 1 + (k - 1);
        for (let x = at.x0 - k; x <= at.x1 + k; x++) for (let z = at.z0 - k; z <= at.z1 + k; z++) {
          if (x > at.x0 - k && x < at.x1 + k && z > at.z0 - k && z < at.z1 + k) continue;
          const gy = ground(x, z, F0 + 40, F0 - DEPTH), gs = w.getBlock(x, gy, z);
          if (gy < lo) {
            if (lo - gy > 3 || !natCol(x, z, gy + 1, lo)) continue;
            for (let y = gy + 1; y < lo; y++) put(x, y, z, dirt);
            put(x, lo, z, topOf(gs));
          } else if (gy > hi) {
            const big = gy - hi > 4;
            if (big && k === 3) continue;
            if (big && k === 2) {
              // the wall that holds the hill back: the ring's natural face from the yard up, stacked stone
              for (let y = F0 - 1; y <= Math.min(gy, F0 + 7); y++) { const s = w.getBlock(x, y, z); if (s && NAT[tid(s)] && GROUND[tid(s)]) put(x, y, z, wallS); }
              continue;
            }
            const floor = big ? F0 - 1 : hi;
            let gap = 0;
            for (let y = floor + 1; y < F0 + CLEAR; y++) { const s = w.getBlock(x, y, z); if (!s) { if (++gap >= 4) break; continue; } gap = 0; if (!NAT[tid(s)]) break; put(x, y, z, 0); }
            const hs = w.getBlock(x, floor, z); if (hs && NAT[tid(hs)] && GROUND[tid(hs)]) put(x, floor, z, topOf(gs));
          }
        }
      }
      // 3 · the house (rotated onto the lot); air in the plan clears
      for (let k = 0; k < ops.length; k += 4) {
        const q = ROT[r](ops[k], ops[k + 2]), s = ops[k + 3];
        put(at.ox + q[0], F0 + ops[k + 1], at.oz + q[1], s ? VR.Custom.rotState(s, r) : 0);
      }
      // what actually changes (and how to undo it)
      const list = [], undo = [];
      for (let y = 0; y < BY; y++) for (let z = 0; z < BZ; z++) for (let x = 0; x < BX; x++) {
        const s = box[(y * BZ + z) * BX + x]; if (s < 0) continue;
        const X = B[0] + x, Y = Y0 + y, Z = B[1] + z;
        if (Y < 0 || Y >= VR.MAXY) continue;
        const old = w.getBlock(X, Y, Z); if (old === s) continue;
        list.push([X, Y, Z, s]); undo.push([X, Y, Z, old]);
      }
      return { list, undo };
    }
    // the changes of a piece laid down as it is (no levelling): models, bridges, walls, shuttles
    opsAt(bp, r, ox, oz, F) {
      const w = this.g.world, list = [], undo = [];
      for (let k = 0; k < bp.ops.length; k += 4) {
        const q = ROT[r](bp.ops[k], bp.ops[k + 2]), x = ox + q[0], y = F + bp.ops[k + 1], z = oz + q[1], s = bp.ops[k + 3] ? VR.Custom.rotState(bp.ops[k + 3], r) : 0;
        if (y < 0 || y >= VR.MAXY) continue;
        const old = w.getBlock(x, y, z); if (old === s) continue;
        list.push([x, y, z, s]); undo.push([x, y, z, old]);
      }
      return { list, undo };
    }

    // ---------------------------------------------------------------- plans from the R9 Studio's World mode
    // localStorage 'r9si.plans.<world id>': houses and furniture the player planned in the Studio. A pending piece is
    // built once its ground (lot + verge) is loaded — right away when it is near — then marked built for the Studio.
    plansKey() { const m = this.g.meta; return m && m.id && !m.guest ? 'r9si.plans.' + m.id : null; }
    loadPlans() {
      const k = this.plansKey(); this.plans = [];
      if (!k) return;
      try { const d = JSON.parse(localStorage.getItem(k) || 'null'); this.plans = d && Array.isArray(d.plans) ? d.plans : []; } catch (e) { this.plans = []; }
    }
    markPlan(id, status) {
      const k = this.plansKey(); if (!k) return;
      try {
        const d = JSON.parse(localStorage.getItem(k) || 'null') || { v: 1, plans: [] };
        for (const q of d.plans || []) if (q.id === id) { q.status = status; q.builtAt = Date.now(); }
        d.t = Date.now(); localStorage.setItem(k, JSON.stringify(d));
      } catch (e) { /* storage full or blocked: it stays built in this world anyway */ }
    }
    // the built piece of a plan (house variant or design, or a furniture model), cached like the blueprints
    planPiece(pl) {
      if (pl.kind === 'forge') return this.forgePiece(pl);
      if (pl.kind === 'model') {
        const VM = VR.VM, md = VM && VM.MODELS[pl.name]; if (!md) return null;
        const key = 'm:' + pl.name; let c = this.cache.get(key); if (c) return c;
        const cells = []; VM.put((u, y, v, nm, pr) => { const t = R.byName[nm]; cells.push(u, y, v, t ? t.state(Object.assign(t.decode(t.defaultState), pr || {})) : 0); }, 0, 0, 0, pl.name, 0);
        let W = 1, D = 1, top = 0; for (let k = 0; k < cells.length; k += 4) { W = Math.max(W, cells[k] + 1); D = Math.max(D, cells[k + 2] + 1); top = Math.max(top, cells[k + 1]); }
        c = { ops: Int32Array.from(cells), lot: [W, D], house: [0, 0, W, D], top, bottom: 0, model: true };
        this.cache.set(key, c); return c;
      }
      const h = VR.Custom && VR.Custom.houseFor(pl.index), key = 'p:' + pl.index + ':' + (h ? 'c' + (h.t || 1) : pl.skin + ':' + (pl.mirror ? 1 : 0));
      const c = this.cache.get(key); if (c) return c;
      if (!this.pending.has(key) && this.g.pool) {
        this.pending.add(key);
        const msg = { type: 'blueprint', index: pl.index, seed: 7 };
        if (!h) { if (pl.skin) msg.skin = pl.skin; msg.mirror = !!pl.mirror; }
        this.g.pool.direct(0, msg, null, (m) => { this.pending.delete(key); if (m.type === 'blueprint' && !m.error) this.cache.set(key, m); });
      }
      return null;
    }
    // a Forge structure (🏭): rebuilt from its DNA in a worker; the ones that read the ground (bridges, walls) get the
    // terrain under their rotated lot sampled here first, so their piers and bases land on the real land
    forgePiece(pl) {
      const Fg = VR.Forge; if (!Fg || !pl.dna) { pl.failed = true; return null; }
      const meta = Fg.meta(pl.dna); if (!meta) { pl.failed = true; return null; }
      const key = 'f:' + (meta.terrain ? pl.id + ':' : '') + pl.dna;
      const c = this.cache.get(key); if (c) return c;
      if (!this.pending.has(key) && this.g.pool) {
        this.pending.add(key);
        const msg = { type: 'forge', dna: pl.dna }, tr = [];
        if (meta.terrain) {
          const r = (pl.r | 0) & 3, W = meta.lot[0], D = meta.lot[1], gr = new Int16Array(W * D);
          for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) { const q = ROT[r](u, v), gy = this.groundAt(pl.ox + q[0], pl.oz + q[1], pl.F + 40, pl.F - DEPTH); gr[v * W + u] = gy >= pl.F - DEPTH ? gy - pl.F : 99; }
          msg.ground = gr; msg.W = W; msg.D = D; tr.push(gr.buffer);
        }
        this.g.pool.direct(0, msg, tr, (m) => { this.pending.delete(key); if (m.type === 'forge' && !m.error) this.cache.set(key, m); else { pl.failed = true; this.hint('Forge: ' + (m.error || m.msg || '?'), 3000); } });
      }
      return null;
    }
    // the lot of a plan before its piece exists (a Forge plan knows it from its DNA): [W, D] or null
    planLot(pl) { if (pl.kind === 'forge') { const m = VR.Forge && VR.Forge.meta(pl.dna); return m ? m.lot : null; } return null; }
    tickPlans(dt) {
      if (this.slices) { this.tickSlices(dt); return; }
      this.planT = (this.planT || 0) - dt; if (this.planT > 0) return;
      this.planT = 0.5;
      if (!this.plans) this.loadPlans();
      const g = this.g, w = g.world; if (!w || g.state !== 'play') return;
      for (const pl of this.plans) {
        if (pl.status !== 'pending' || pl.failed) continue;
        const r = (pl.r | 0) & 3;
        const rect = (u0, v0, u1, v1) => { const a = ROT[r](u0, v0), b = ROT[r](u1, v1); return [pl.ox + Math.min(a[0], b[0]), pl.oz + Math.min(a[1], b[1]), pl.ox + Math.max(a[0], b[0]), pl.oz + Math.max(a[1], b[1])]; };
        const colsReady = (W, D, M) => { const [x0, z0, x1, z1] = rect(0, 0, W - 1, D - 1); for (let cz = (z0 - M - 16) >> 4; cz <= (z1 + M + 16) >> 4; cz++) for (let cx = (x0 - M - 16) >> 4; cx <= (x1 + M + 16) >> 4; cx++) { const c = w.col(cx, cz); if (!c || !c.ready) return false; } return true; };
        // a Forge piece is built from the ground under it: the ground has to be there before the worker is asked
        const pre = this.planLot(pl); if (pre && !colsReady(pre[0], pre[1], MARGIN)) continue;
        const bp = this.planPiece(pl); if (!bp) { if (pl.kind === 'model' && !(VR.VM && VR.VM.MODELS[pl.name])) pl.failed = true; continue; }
        const W = bp.lot[0], D = bp.lot[1], direct = bp.model || (pl.kind === 'forge' && !bp.level);
        const [x0, z0, x1, z1] = rect(0, 0, W - 1, D - 1), M = direct ? 0 : MARGIN;
        if (!colsReady(W, D, M)) continue;
        if (pl.F - DEPTH < 1 || pl.F + bp.top + 8 >= VR.MAXY) { pl.failed = true; continue; }
        const { list, undo } = direct ? this.opsAt(bp, r, pl.ox, pl.oz, pl.F) : this.planAt({ bp, r, ox: pl.ox, oz: pl.oz, F: pl.F, x0, z0, x1, z1, rect, ok: true });
        const P = this.plan(), name = pl.kind === 'model' ? ((VR.VM.MODELS[pl.name] || {}).display || pl.name) : pl.kind === 'forge' ? (bp.name || 'Forge') : (P && P.CATALOGUE[pl.index] ? P.CATALOGUE[pl.index].name : 'House');
        // a big one goes in slices, bottom up, a few thousand cells per tick — the frame stays smooth, Z takes it all back
        if (list.length > SLICE_MAX) { list.sort((a, b) => a[1] - b[1]); this.slices = { pl, name, list, undo, at: 0, t: 0, w }; pl.status = 'building'; return; }
        if (list.length) this.gad.applyEdit(list, undo);
        this.planDone(pl, name, list.length, list.length ? undo : null);
        break;   // one piece per half second keeps the frame smooth
      }
    }
    // the slices of a big piece: one chunk per tick, the undo of all of them as one step at the end
    tickSlices(dt) {
      const S = this.slices, g = this.g, w = g.world;
      if (S.w !== w) { this.slices = null; return; }     // another world now: that one rebuilds the plan when it is back
      if (!w || g.state !== 'play') return;
      S.t -= dt; if (S.t > 0) return;
      S.t = SLICE_T;
      const end = Math.min(S.list.length, S.at + SLICE_STEP), chunk = S.list.slice(S.at, end);
      if (chunk.length) { w.bulkSet(chunk, false); for (const [x, y, z, s] of chunk) this.gad.noteBlock(x, y, z, s); }
      S.at = end;
      if (S.at < S.list.length) return;
      this.slices = null;
      this.gad.applyEdit([], S.undo);
      this.planDone(S.pl, S.name, S.list.length, S.undo);
    }
    planDone(pl, name, n, undo) {
      const g = this.g;
      pl.status = 'built';
      if (this.lastForge && this.lastForge.id === pl.id) this.lastForge.undo = undo || null;   // (/bau höher takes exactly this back)
      // (the plans may have been read again meanwhile — the Studio handed over more: that copy is built too)
      if (this.plans) for (const q of this.plans) if (q.id === pl.id) q.status = 'built';
      this.markPlan(pl.id, 'built');
      if (g.player && g.player.unstick) g.player.unstick();
      if (g.ui && g.ui.toast) g.ui.toast('R9 Studio', `${name} gebaut · ${n.toLocaleString('de-DE')} Blöcke`);
    }

    // ---------------------------------------------------------------- edits from the R9 Studio's Werkbank (v0.35)
    // Batches of block changes (VR.Edits) the player made in the Studio's view of this world: each one is built as soon
    // as its columns are loaded — at once when the world is open — with the game's undo, then marked built for the Studio.
    editWorld() { const m = this.g.meta; return m && m.id && !m.guest ? m.id : null; }
    tickEdits(dt) {
      this.editT = (this.editT || 0) - dt; if (this.editT > 0) return;
      this.editT = 0.25;
      const E = VR.Edits, id = this.editWorld(), g = this.g, w = g.world;
      if (!E || !id || !w || g.state !== 'play') return;
      const ids = E.list(id); if (!ids.length) return;
      const done = new Set(E.done(id));
      let n = 0, nb = 0;
      for (const bid of ids) {
        if (done.has(bid)) continue;
        const b = E.ls.get(E.batchKey(id, bid)); if (!b) continue;
        let ready = true;
        for (const [cx, cz] of E.columns(b)) { const c = w.col(cx, cz); if (!c || !c.ready) { ready = false; break; } }
        if (!ready) continue;
        const list = [], undo = [];
        for (const [x, y, z, s] of E.unpack(b)) { const old = w.getBlock(x, y, z); if (old === s) continue; list.push([x, y, z, s]); undo.push([x, y, z, old]); }
        if (list.length) this.gad.applyEdit(list, undo);
        E.markDone(id, bid);
        n += list.length; nb++;
        if (n > 60000) break;    // a big one per quarter second keeps the frame smooth
      }
      if (!nb) return;
      // built where you stand? you step out to the nearest free spot instead of being stuck in it
      if (g.player && g.player.unstick) g.player.unstick();
      // into the save right away (the Studio reads the world from it)
      clearTimeout(this.editSave); this.editSave = setTimeout(() => { if (g.world === w && w.saveAll) w.saveAll(); }, 800);
      if (n && g.ui && g.ui.toast) g.ui.toast('R9 Studio', VR.I18N ? VR.I18N.tx('g.studio.edits', { n: n.toLocaleString() }, '{n} Blöcke aus der Werkbank', '{n} blocks from the Werkbank') : n + ' blocks from the Werkbank');
    }

    // ---------------------------------------------------------------- /haus [n]
    command(a) {
      const g = this.g, p = g.player, P = this.plan(), say = (t, c) => g.ui.chatLine(t, c || '#cfe6ff');
      if (!P) { say('No house catalogue in this build.', '#ff8a8a'); return true; }
      const list = P.CATALOGUE.map((c, i) => `${i} ${c.name}${VR.Custom && VR.Custom.houseFor(i) ? ' ★' : ''}`).join(' · ');
      if (!a[0]) { say('Houses: ' + list); say('/haus <n> puts its blueprint in your hand — RMB builds it where you look (★ = your R9 Studio design).'); return true; }
      const q = a.join(' ').toLowerCase();
      let i = /^\d+$/.test(q) ? +q : P.CATALOGUE.findIndex(c => c.name.toLowerCase().indexOf(q) >= 0);
      if (!(i >= 0 && i < P.CATALOGUE.length)) { say('Unknown house. ' + list, '#ff8a8a'); return true; }
      if (!p.creative) { say('Blueprints build in Creative or Zen Builder.', '#ff8a8a'); return true; }
      const id = 'blueprint_' + i, inv = p.inv;
      let k = inv.slots.findIndex((s, j) => j < 9 && s && s.id === id);
      if (k < 0) { k = inv.slots.findIndex((s, j) => j < 9 && !s); if (k < 0) k = inv.sel; inv.slots[k] = { id, n: 1 }; }
      inv.sel = k; inv.changed = true;
      this.get(i);
      say(`Blueprint · ${P.CATALOGUE[i].name}${VR.Custom && VR.Custom.houseFor(i) ? ' ★' : ''} in hand — RMB builds it where you look, R turns it, F changes the facade.`);
      return true;
    }
    // ---------------------------------------------------------------- /bau <wish> · /forge <wish> (🏭 without the Studio)
    // "/bau Hochhaus 30 Stockwerke Glas" puts a Forge plan where you look (the front toward you) — the game builds it
    // like a plan from the Studio (levelled, in slices, one Z); "/bau höher", "/bau mehr Glas", "/bau aus Stein" take the
    // last one back (while it is the newest change) and build it changed on the same spot; the Studio sees them as plans
    forgeCommand(a) {
      const g = this.g, p = g.player, Fg = VR.Forge, say = (t, c) => g.ui.chatLine(t, c || '#cfe6ff');
      const T = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : en);
      const text = a.join(' ').trim();
      if (!Fg) { say('No Forge in this build.', '#ff8a8a'); return true; }
      if (!this.plans) this.loadPlans();
      if (!text) { say(T('g.forge.help', null, '🏭 /bau <Wunsch> — „/bau Hochhaus 30 Stockwerke Glas“, „/bau Hängebrücke 60 lang“, „/bau Burg mit Bergfried“ · danach „/bau höher“, „/bau mehr Glas“, „/bau aus Stein“', '🏭 /bau <wish> — “/bau skyscraper 30 floors glass”, “/bau suspension bridge 60 long”, “/bau castle with keep” · then “/bau taller”, “/bau more glass”, “/bau stone”')); return true; }
      if (!p.creative) { say(T('g.forge.creative', null, 'Die Forge baut in Kreativ und Zen.', 'The Forge builds in Creative and Zen Builder.'), '#ff8a8a'); return true; }
      const last = this.lastForge && this.plans && this.plans.find(q => q.id === this.lastForge.id), named = Fg.typeOf(Fg.norm(text));
      let dna = named ? Fg.fromText(text) : null, again = null;
      if (!dna && last) { dna = Fg.tweak(last.dna, text); again = last; }
      if (!dna) { say(T('g.forge.what', null, 'Sag, was es sein soll: Hochhaus, Haus, Brücke, Turm, Halle, Burg, Stadion, Raumschiff, Park oder Mauer.', 'Say what it should be: high-rise, house, bridge, tower, hall, castle, stadium, spaceship, park or wall.'), '#ff8a8a'); return true; }
      let pl;
      if (again) {
        if (again.dna === dna) { say(T('g.forge.same', null, 'Das ändert nichts — sag „höher“, „breiter“, „mehr Glas“, „aus Stein“ … oder etwas Neues: „/bau Brücke 40 lang“.', 'That changes nothing — say “taller”, “wider”, “more glass”, “stone” … or something new: “/bau bridge 40 long”.')); return true; }
        // the last one goes (one Z, while nothing changed since), the changed one takes its place
        const u = this.gad.wand.undo;
        if (again.status === 'built' && !(this.lastForge.undo && u[u.length - 1] === this.lastForge.undo)) { say(T('g.forge.moved', null, 'Seit der letzten Forge hat sich etwas geändert — sag ein neues Ganzes: „/bau Hochhaus …“', 'Something changed since the last Forge build — say a whole new wish: “/bau skyscraper …”'), '#ff8a8a'); return true; }
        if (this.slices && this.slices.pl.id === again.id) { say(T('g.forge.busy', null, 'Noch im Bau — gleich.', 'Still building — a moment.')); return true; }
        if (again.status === 'built') this.gad.undo();
        pl = Object.assign({}, again, { id: 'f' + Date.now().toString(36), dna, status: 'pending', t: Date.now() });
        this.plans = this.plans.filter(q => q.id !== again.id); this.storePlans((ps) => ps.filter(q => q.id !== again.id));
      } else {
        const meta = Fg.meta(dna), at = this.locate(p, { lot: meta.lot, top: 40 });
        if (!at) { say(T('g.forge.look', null, 'Schau auf den Boden, wo es stehen soll.', 'Look at the ground where it should stand.'), '#ff8a8a'); return true; }
        if (!at.ok) { say(at.why, '#ff8a8a'); return true; }
        pl = { id: 'f' + Date.now().toString(36), kind: 'forge', dna, ox: at.ox, oz: at.oz, F: at.F, r: at.r, status: 'pending', t: Date.now() };
      }
      this.plans.push(pl); this.storePlans((ps) => ps.concat([pl]));
      this.lastForge = { id: pl.id, dna, undo: null };
      this.planT = 0;
      say('🏭 ' + Fg.describe(dna) + ' — ' + T('g.forge.building', null, 'wird gebaut', 'building') + ' · ' + dna, '#9fe8c4');
      return true;
    }
    // the plans of this world in the browser's storage, changed by fn (the Studio reads them: built pieces show there)
    storePlans(fn) {
      const k = this.plansKey(); if (!k) return;
      try { const d = JSON.parse(localStorage.getItem(k) || 'null') || { v: 1, world: this.g.meta.id, plans: [] }; d.plans = fn(d.plans || []); d.t = Date.now(); localStorage.setItem(k, JSON.stringify(d)); } catch (e) { /* storage full: built in this world anyway */ }
    }
  }
  VR.Blueprints = Blueprints;
})(VR);

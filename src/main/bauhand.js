// ============================================================================
// 🖐 Bauhand (W2, spec 2026-10-07 §4): one key, B — or the 🖐 button bottom
// right. On top the card of what you look at (its actions: ✏️ Bearbeiten,
// 🖐 Nehmen, ☆ Favorit and whatever another module adds with
// VR.Bauhand.addAction), below it the ring: „✨ Neu…" (the wizard), eight
// slots of your ★ favourites, the newest first — or the starter set (Bank,
// Laterne, Apfelbaum, Blumenbeet, Zaun, Bungalow) while you have none — and
// „▸ alle". Pictures only; the name shows under the slot you point at.
// States: closed → open (the mouse is free, the world keeps running) →
// holding (the ring away; a strip above the hotbar: „Klick setzt · Rad dreht ·
// Z zurück · Esc weg"; a ghost at the crosshair: the lot, its footprint
// glowing, the height, ✓ or ✕ with one reason) → placed (the thing is built at
// once through a plan in r9si.plans.<world>, Z takes it back; it stays in
// hand) → closed on Esc / ✕ / B. A block goes into the hotbar instead: blocks
// stay the game's own (right click places, left click takes away).
// Both mouse buttons place while holding (the left one never breaks then), the
// wheel and R turn it (the hotbar does not scroll), Enter places, Z undoes.
// Creative and Zen in your own world; Survival shows the card and „Zen
// einschalten", a friend's world the blocks only, a vehicle ignores B.
// VR.Bauhand: open() · close() · hold(ding) · putAway() · place() · undo() ·
// rotate(d) · target() · addAction({id, icon, label, when(t), run(t), order})
// → remove · ringList(ctx) · kindOf(ding) · holding ({ding, kind, rot, name})
// A target: {kind: 'block'|'model'|'plan', ding, name, x, y, z, face, state, plan?}
// ============================================================================
(function (VR) {
  'use strict';
  const BH = VR.Bauhand = { state: 'closed', holding: null, actions: [] };
  const R = VR.R, F = VR.F, KEEP = 0xffff;
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];   // = blueprints.js
  const FRONT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const D = () => VR.Ding;
  const game = () => VR.game;
  const hasDoc = typeof document !== 'undefined';

  // ---------------------------------------------------------------- the starter set: the ring is never empty
  // (Apfelbaum and Laterne are the Genie's, made once on first use and kept as Bauteile; Blumenbeet is three flower
  // beds; Zaun a fence from the Forge that follows the ground; Bungalow the catalogue's villa)
  const STARTER = [
    { id: 'm:vm_bench', icon: '🪑', label: ['bh.st.bank', 'Bank', 'Bench'] },
    { id: 'g:lamp', icon: '🏮', genie: { type: 'lamp', size: 9 }, label: ['bh.st.laterne', 'Laterne', 'Lantern'] },
    { id: 'g:tree', icon: '🍎', genie: { type: 'tree', size: 14, feats: { apple: true } }, label: ['bh.st.apfelbaum', 'Apfelbaum', 'Apple tree'] },
    { id: 'p:starter_beet', icon: '🌷', bed: true, label: ['bh.st.beet', 'Blumenbeet', 'Flower bed'] },
    { id: 'f:wall:l12,holz,k1#7', icon: '🪵', label: ['bh.st.zaun', 'Zaun', 'Fence'] },
    { id: 'h:6', icon: '🏡', label: ['bh.st.bungalow', 'Bungalow', 'Bungalow'] },
  ];
  BH.STARTER = STARTER;
  const starterName = (s) => tx(s.label[0], null, s.label[1], s.label[2]);

  // ---------------------------------------------------------------- what a Ding becomes in the hand
  // block → the hotbar; house · model · forge · piece → a plan the game builds
  BH.kindOf = function (id) {
    const d = D() && D().parse(id); if (!d) return null;
    return { b: 'block', m: 'model', h: 'house', f: 'forge', p: 'piece', k: 'piece', g: 'piece' }[d.kind] || null;
  };
  // the ring: eight slots of ★ favourites (newest first, only what a hand can hold), the starter set while there are
  // none; a friend's world: blocks only. → {slots: [{id, name, starter}], more, all, starter}
  BH.ringList = function (ctx) {
    ctx = ctx || {};
    const Dg = D(), favs = VR.Favs ? VR.Favs.list() : [], seen = new Set(), all = [];
    for (const f of favs) {
      let id = Dg ? Dg.fromFav(f) : null; if (!id || seen.has(id)) continue;
      const k = id[0];
      if ((k === 'k' || k === 'g') && !ctx.guest) { const pc = pieceOfProject(id); if (!pc) continue; id = pc; }
      if (!/^[bmhfp]:/.test(id)) continue;
      if (k === 'b' && !(VR.itemDef ? VR.itemDef(id.slice(2)) : true)) continue;
      if (ctx.guest && id[0] !== 'b') continue;
      seen.add(id); all.push({ id, name: Dg ? Dg.name(id) : id, starter: false });
    }
    if (!all.length) {
      if (ctx.guest) { const out = ['b:oak_planks', 'b:glass', 'b:stone_bricks', 'b:lantern', 'b:oak_fence', 'b:poppy'].filter(id => R && R.byName[id.slice(2)]).map(id => ({ id, name: Dg ? Dg.name(id) : id, starter: true })); return { slots: out, more: false, all: out, starter: true }; }
      const out = STARTER.map(s => ({ id: s.id, name: starterName(s), starter: true, icon: s.icon }));
      return { slots: out, more: false, all: out, starter: true };
    }
    return { slots: all.slice(0, 8), more: all.length > 8, all, starter: false };
  };
  // a Baukasten house or a Genie thing (a project) is held as the Bauteil the wizard kept with it
  function pieceOfProject(id) {
    try { const d = JSON.parse(localStorage.getItem('r9si.projects') || 'null'), p = d && d.items && d.items[id.slice(2)]; return p && p.piece ? 'p:' + String(p.piece).replace(/^p:/, '') : null; } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- the piece behind a Ding (lot, height, cells)
  // → {lot:[W, D], top, bottom, level, terrain, model, ops, name} or null while it is made (the worker, the Genie)
  const forgeCache = new Map();
  function pieceFor(ding) {
    const g = game(), blue = g && g.gadgets && g.gadgets.blue, d = D().parse(ding); if (!d || !blue) return null;
    if (d.kind === 'h') { const bp = blue.get(+d.key); return bp ? { lot: bp.lot, top: bp.top, bottom: bp.bottom || 0, level: true, house: bp.house, ops: bp.ops, name: D().name(ding) } : null; }
    if (d.kind === 'm') { const bp = blue.planPiece({ kind: 'model', name: d.key }); return bp ? Object.assign({ level: false, name: D().name(ding) }, bp) : null; }
    if (d.kind === 'p') { const bp = blue.libPiece({ kind: 'piece', piece: ding }); return bp ? Object.assign({}, bp, { name: bp.name }) : null; }
    if (d.kind === 'f') {
      const dna = d.key; let c = forgeCache.get(dna);
      if (c) return c.ready ? c : null;
      c = { ready: false }; forgeCache.set(dna, c);
      if (forgeCache.size > 24) forgeCache.delete(forgeCache.keys().next().value);
      g.pool.direct(0, { type: 'forge', dna }, null, (m) => {
        if (m.type !== 'forge' || m.error) { forgeCache.delete(dna); return; }
        Object.assign(c, { ready: true, lot: m.lot, top: m.top, bottom: m.bottom || 0, level: !!m.level, terrain: !!m.terrain, ops: m.ops, name: m.name, house: m.house });
      });
      return null;
    }
    return null;
  }
  BH.pieceFor = pieceFor;

  // ---------------------------------------------------------------- the ghost: where it would go, and can it
  const NATURAL = /grass|dirt|podzol|mycelium|sand|gravel|clay|stone|andesite|granite|diorite|deepslate|tuff|calcite|snow|ice|_log$|_leaves$|_stem$|mushroom|fern|flower|poppy|dandelion|tulip|bush|sapling|moss|mud|water|terracotta$|basalt|blackstone|netherrack|vine|lily|kelp|seagrass|coral|cactus|pumpkin|melon|bamboo|sugar_cane|roots|short_grass|tall_grass/;
  let natTab = null;
  const natural = (s) => { if (!s) return true; if (!natTab) { natTab = new Uint8Array(R.types.length); for (const t of R.types) if (t && t.name && (t.cat === 'nature' || NATURAL.test(t.name))) natTab[t.id] = 1; } return !!natTab[R.T.type[s]]; };
  // in the way of a piece laid down as it is: anything solid that is not a plant or snow
  const blocking = (s) => !!s && !!(R.T.flags[s] & F.SOLID) && !(R.T.flags[s] & F.REPLACE) && !(R.T.flags[s] & F.FLUID);
  BH.ghost = null;
  let ghostKey = '', ghostCheck = null;
  function computeGhost(g, p) {
    const H = BH.holding; if (!H || H.kind === 'block') return null;
    const blue = g.gadgets && g.gadgets.blue; if (!blue) return null;
    const bp = pieceFor(H.ding);
    if (!bp) return { ok: false, why: 'prep', prep: true };
    const w = g.world, e = p.eyePos(), dir = p.lookDir();
    const hit = VR.PHYS.raycast((x, y, z) => w.getBlock(x, y, z), e[0], e[1], e[2], dir[0], dir[1], dir[2], 120);
    if (!hit || hit.face === 3) return { ok: false, why: 'ground', bp };
    const lotBased = !!bp.level || H.kind === 'house';
    let at;
    if (lotBased) {
      blue.rot = H.rot & 3;
      at = blue.locate(p, { lot: bp.lot, top: Math.max(4, bp.top | 0) });
      if (!at) return { ok: false, why: 'ground', bp };
      at.lotBased = true;
    } else {
      // laid down as it is: on the floor you point at (its front toward you), or against the wall you point at (its
      // back to the wall, standing on the floor below)
      const ax = hit.x + VR.DX[hit.face], ay = hit.y + VR.DY[hit.face], az = hit.z + VR.DZ[hit.face];
      const bx = Math.sin(p.yaw), bz = Math.cos(p.yaw);
      let best = 0, bd = -9; for (let r = 0; r < 4; r++) { const dd = FRONT[r][0] * bx + FRONT[r][1] * bz; if (dd > bd) { bd = dd; best = r; } }
      const r = (best + H.rot) & 3, W = bp.lot[0], Dd = bp.lot[1], side = hit.face !== 2;
      const q = side ? ROT[r](W >> 1, Dd - 1) : ROT[r](W >> 1, 0);
      let Fy = ay;
      if (side) { for (let k = 0; k < 10 && Fy > 1; k++) { if (blocking(w.getBlock(ax, Fy - 1, az))) break; Fy--; } }
      const ox = ax - q[0], oz = az - q[1];
      const rect = (u0, v0, u1, v1) => { const a = ROT[r](u0, v0), b = ROT[r](u1, v1); return [ox + Math.min(a[0], b[0]), oz + Math.min(a[1], b[1]), ox + Math.max(a[0], b[0]), oz + Math.max(a[1], b[1])]; };
      const [x0, z0, x1, z1] = rect(0, 0, W - 1, Dd - 1);
      at = { bp, r, ox, oz, F: Fy, x0, z0, x1, z1, rect, ok: true, why: '' };
      for (let cz = (z0 - 1) >> 4; cz <= (z1 + 1) >> 4 && at.ok; cz++) for (let cx = (x0 - 1) >> 4; cx <= (x1 + 1) >> 4; cx++) { const c = w.col(cx, cz); if (!c || !c.ready) { at.ok = false; at.why = 'loading'; break; } }
      if (at.ok && (Fy + (bp.bottom || 0) < 1 || Fy + bp.top + 4 >= VR.MAXY)) { at.ok = false; at.why = 'high'; }
      const P = p.pos;
      if (at.ok && P[0] >= x0 - 0.3 && P[0] <= x1 + 1.3 && P[2] >= z0 - 0.3 && P[2] <= z1 + 1.3 && P[1] > Fy - 2 && P[1] < Fy + bp.top + 1) { at.ok = false; at.why = 'step'; }
    }
    // the reason in the Bauhand's words (Blueprints.locate says it in the blueprint's)
    if (!at.ok && lotBased) { const T = (k) => (VR.I18N ? VR.I18N.t(k) : k); at.why = at.why === T('g.bp.loading') ? 'loading' : at.why === T('g.bp.tooHigh') ? 'high' : 'step'; }
    at.bp = bp; at.kind = H.kind;
    // blocks in the way (looked at once per spot and turn: a few thousand cells, not every frame)
    if (at.ok) {
      const key = [H.ding, at.ox, at.oz, at.F, at.r].join(',');
      if (key !== ghostKey) { ghostKey = key; ghostCheck = inTheWay(w, at, bp, lotBased, H.kind); }
      if (ghostCheck) { at.ok = false; at.why = 'full'; }
    }
    return at;
  }
  // a lot that is levelled may go over hills and trees, not over what someone built; a piece laid down as it is needs
  // its own cells free (its foundation rows below the floor may go into the ground)
  function inTheWay(w, at, bp, lotBased, kind) {
    if (bp.terrain) return false;   // (a bridge, a wall: they follow the land)
    const r = at.r & 3;
    if (lotBased) {
      const W = bp.lot[0], Dd = bp.lot[1], top = Math.min(bp.top + 1, 18), step = W * Dd > 600 ? 2 : 1;
      let built = 0, n = 0;
      for (let v = 0; v < Dd; v += step) for (let u = 0; u < W; u += step) {
        const q = ROT[r](u, v), x = at.ox + q[0], z = at.oz + q[1];
        for (let y = at.F; y <= at.F + top; y += 2) { const s = w.getBlock(x, y, z); n++; if (s && !natural(s)) built++; }
      }
      return built > Math.max(6, n * 0.01);
    }
    const ops = bp.ops; if (!ops) return false;
    const stride = Math.max(1, Math.floor(ops.length / 4 / 6000));
    for (let k = 0; k < ops.length; k += 4 * stride) {
      if (!ops[k + 3] || ops[k + 1] < 0) continue;
      const q = ROT[r](ops[k], ops[k + 2]);
      if (blocking(w.getBlock(at.ox + q[0], at.F + ops[k + 1], at.oz + q[1]))) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- the ghost, drawn (Gadgets.outlines)
  // the lot (solid cyan when it fits, dashed red when not), its footprint as a glowing grid, the height as a box,
  // the front edge in orange (it faces you)
  function ghostOutlines(out, g) {
    const at = BH.ghost; if (!at || !at.bp || at.prep || at.why === 'ground') return;
    const bp = at.bp, ok = at.ok, t = (g.time || 0), pulse = 0.62 + 0.3 * Math.sin(t * 5.2);
    const col = ok ? [0.32, 0.96, 1, pulse] : [1, 0.3, 0.28, 0.95];
    // (in the lot's own frame: X0, F, Z0 is 0, 0, 0 — small numbers stay exact on the GPU)
    const W = at.x1 - at.x0 + 1, Dd = at.z1 - at.z0 + 1, h = Math.max(1, (bp.top | 0) + 1);
    const ln = [], seg = (ax, ay, az, bx, by, bz) => { ln.push(ax, ay, az, bx, by, bz); };
    const dashed = (ax, ay, az, bx, by, bz) => { const L = Math.hypot(bx - ax, by - ay, bz - az), n = Math.max(1, Math.round(L / 1.2)); for (let i = 0; i < n; i += 2) { const a = i / n, b = Math.min(1, (i + 1) / n); seg(ax + (bx - ax) * a, ay + (by - ay) * a, az + (bz - az) * a, ax + (bx - ax) * b, ay + (by - ay) * b, az + (bz - az) * b); } };
    const L = ok ? seg : dashed, y = 0.04;
    // the lot, the four posts, the top
    L(0, y, 0, W, y, 0); L(W, y, 0, W, y, Dd); L(W, y, Dd, 0, y, Dd); L(0, y, Dd, 0, y, 0);
    L(0, y, 0, 0, h, 0); L(W, y, 0, W, h, 0); L(W, y, Dd, W, h, Dd); L(0, y, Dd, 0, h, Dd);
    L(0, h, 0, W, h, 0); L(W, h, 0, W, h, Dd); L(W, h, Dd, 0, h, Dd); L(0, h, Dd, 0, h, 0);
    const O = { x: at.x0, y: at.F, z: at.z0, boxes: [] };
    out.push(Object.assign({}, O, { lines: ln, color: col, xray: true }));
    if (!ok) return;
    // the footprint: a glowing grid on the floor (every block on small things, every few on a big lot)
    const gl = [], step = Math.max(1, Math.ceil(Math.max(W, Dd) / 24)), gy = 0.03;
    for (let u = step; u < W; u += step) gl.push(u, gy, 0, u, gy, Dd);
    for (let v = step; v < Dd; v += step) gl.push(0, gy, v, W, gy, v);
    if (gl.length) out.push(Object.assign({}, O, { lines: gl, color: [0.32, 0.96, 1, pulse * 0.42], xray: false }));
    // the front (the side that faces you) in orange: where the lot's row v = −1 lies
    const fr = at.rect ? at.rect(0, -1, bp.lot[0] - 1, -1) : null;
    if (fr) {
      const fy = 0.08, fl = [];
      if (fr[0] === fr[2]) { const fx = fr[0] < at.x0 ? 0 : W; fl.push(fx, fy, 0, fx, fy, Dd); }
      else { const fz = fr[1] < at.z0 ? 0 : Dd; fl.push(0, fy, fz, W, fy, fz); }
      out.push(Object.assign({}, O, { lines: fl, color: [1, 0.72, 0.25, 0.95], xray: true }));
    }
  }

  // ---------------------------------------------------------------- placing: a plan, built at once (Z takes it back)
  const newId = () => 'bh' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);
  BH.last = null;
  BH.place = function () {
    const g = game(), H = BH.holding, at = BH.ghost; if (!g || !H || H.kind === 'block') return null;
    if (!at || !at.ok) { chipShake(); if (g.audio) g.audio.tone && g.audio.tone(220, 0.06, 0.12, 'triangle'); return null; }
    const blue = g.gadgets.blue, d = D().parse(H.ding);
    const pl = { id: newId(), ox: at.ox, oz: at.oz, F: at.F, r: at.r & 3, status: 'pending', t: Date.now(), from: 'hand', ding: H.ding };
    if (d.kind === 'h') { const K = blue.key(+d.key); Object.assign(pl, { kind: 'house', index: +d.key }); if (K && K.v && !K.v.custom) { pl.skin = K.v.skin; pl.mirror = !!K.v.mirror; } }
    else if (d.kind === 'm') Object.assign(pl, { kind: 'model', name: d.key });
    else if (d.kind === 'f') Object.assign(pl, { kind: 'forge', dna: d.key });
    else Object.assign(pl, { kind: 'piece', piece: H.ding });
    if (H.from === 'wizard') pl.wiz = true;
    if (!blue.plans) blue.loadPlans();
    blue.plans.push(pl);
    const kept = blue.storePlans((ps) => ps.concat([pl]));
    BH.last = { id: pl.id, name: H.name, undo: null, sliced: false, kept };
    const res = blue.tryBuild(pl);
    if (res === 'sliced') { BH.last.sliced = true; toast(tx('bh.toast.building', { n: H.name }, '{n} entsteht …', '{n} is being built …')); }
    else if (res === 'wait' || res === 'skip') toast(tx('bh.toast.building', { n: H.name }, '{n} entsteht …', '{n} is being built …'));
    else if (res === 'failed') { toast(tx('bh.why.full', null, 'Kein Platz hier — such eine freie Stelle', 'No room here — find a free spot'), true); blue.removePlan(pl.id); BH.last = null; return null; }
    // the sound of it: the material, and a soft „pling" on top
    const st = R.byName.stone.defaultState;
    if (g.audio) { g.audio.place && g.audio.place(st); pling(g); }
    if (g.particles && g.particles.spark) g.particles.spark((at.x0 + at.x1 + 1) / 2, at.F + 1, (at.z0 + at.z1 + 1) / 2, [0.45, 0.95, 1], 26, 4);
    if (!kept) toast(tx('bh.toast.full', null, '⚠ Gebaut, aber nicht gemerkt — Browser-Speicher voll', '⚠ Built, but not kept — browser storage full'), true);
    hintDone('ring'); hintAfterPlace();
    return pl;
  };
  function pling(g) {
    const A = g.audio; if (!A || !A.ctx || !A.tone) return;
    const t = A.ctx.currentTime; A.tone(1046.5, 0.07, 0.5, 'sine', true, t + 0.02); A.tone(1568, 0.05, 0.6, 'sine', true, t + 0.09);
  }
  // the game built a plan of the hand (now or after its slices): the toast says what and how many
  function onBuilt(pl, name, n, undo) {
    if (BH.last && BH.last.id === pl.id) { BH.last.undo = undo || null; BH.last.sliced = false; BH.last.n = n; }
    if (pl.from === 'hand' && pl.replaces) toast(tx('wiz.hereToast', { n: name }, '🔁 {n} steht jetzt dort · Z nimmt es zurück', '🔁 {n} stands there now · Z takes it back'));
    else if (pl.from === 'hand') {
      const big = n > 400;
      toast(big ? tx('bh.toast.built', { n: name, b: n.toLocaleString(VR.I18N && VR.I18N.locale ? VR.I18N.locale() : 'de-DE') }, '✓ {n} gebaut · {b} Blöcke', '✓ {n} built · {b} blocks') : tx('bh.toast.set', { n: name }, '✓ {n} gesetzt · Z nimmt es zurück', '✓ {n} placed · Z takes it back'));
    }
    if (pl.wiz) hintWizThing();
  }
  // Z: exactly that placement goes back (a sliced build still running stops and goes back too); the plan leaves
  BH.undo = function () {
    const g = game(); if (!g || !g.gadgets) return false;
    const gad = g.gadgets, blue = gad.blue, L = BH.last, U = gad.wand.undo;
    if (L && L.sliced && blue.slices && blue.slices.pl.id === L.id) {
      blue.cancelSlices(L.id); blue.removePlan(L.id); BH.last = null;
      toast(tx('bh.toast.undo', { n: L.name }, '⟲ {n} weg', '⟲ {n} gone')); g.audio && g.audio.play('pop'); hintDone('undo'); return true;
    }
    if (L && L.undo && U[U.length - 1] === L.undo) {
      U.pop(); g.world.bulkSet(L.undo, false); for (const [x, y, z, s] of L.undo) gad.noteBlock(x, y, z, s);
      blue.removePlan(L.id); BH.last = null;
      if (L.replaces && blue.setStatus) blue.setStatus(L.replaces, 'built');   // (🔁: the old one stands again)
      if (g.player && g.player.unstick) g.player.unstick();
      toast(tx('bh.toast.undo', { n: L.name }, '⟲ {n} weg', '⟲ {n} gone')); g.audio && g.audio.play('pop'); hintDone('undo'); return true;
    }
    if (L && !L.undo && blue.plans && blue.plans.some(q => q.id === L.id && q.status === 'pending')) { blue.removePlan(L.id); BH.last = null; toast(tx('bh.toast.undo', { n: L.name }, '⟲ {n} weg', '⟲ {n} gone')); return true; }
    if (U.length) { gad.undo(); hintDone('undo'); return true; }
    toast(tx('bh.toast.noUndo', null, 'Nichts zurückzunehmen', 'Nothing to take back'));
    return false;
  };
  BH.rotate = function (d) { const H = BH.holding; if (!H) return; H.rot = ((H.rot + (d || 1)) % 4 + 4) % 4; ghostKey = ''; const g = game(); if (g && g.audio) g.audio.play('click'); stripText(); };

  // ---------------------------------------------------------------- what you look at, and what can be done with it
  BH.target = function () {
    const g = game(), p = g && g.player; if (!p) return null;
    const t = p.target; if (!t) return null;
    const s = t.state, ty = R.types[R.T.type[s]]; if (!ty) return null;
    const base = { x: t.x, y: t.y, z: t.z, face: t.face, state: s };
    // a thing the hand (or the Studio, or the wizard) set: its plan's box holds the block
    const blue = g.gadgets && g.gadgets.blue;
    if (blue && blue.plans) {
      for (let i = blue.plans.length - 1; i >= 0; i--) {
        const pl = blue.plans[i]; if (pl.status !== 'built' || !pl.ding) continue;
        const lot = blue.planLot(pl) || (pl.kind === 'model' || pl.kind === 'house' ? (blue.planPiece(pl) || {}).lot : null); if (!lot) continue;
        const r = (pl.r | 0) & 3, a = ROT[r](0, 0), b = ROT[r](lot[0] - 1, lot[1] - 1), X0 = pl.ox + Math.min(a[0], b[0]), X1 = pl.ox + Math.max(a[0], b[0]), Z0 = pl.oz + Math.min(a[1], b[1]), Z1 = pl.oz + Math.max(a[1], b[1]);
        if (t.x >= X0 && t.x <= X1 && t.z >= Z0 && t.z <= Z1 && t.y >= pl.F - 2 && t.y <= pl.F + 160) return Object.assign(base, { kind: 'plan', ding: pl.ding, name: D().name(pl.ding), plan: pl, wiz: !!pl.wiz });
      }
    }
    if (ty.o && ty.o.vxModel && VR.VM && VR.VM.MODELS[ty.name]) return Object.assign(base, { kind: 'model', ding: 'm:' + ty.name, name: D().name('m:' + ty.name) });
    return Object.assign(base, { kind: 'block', ding: 'b:' + ty.name, name: D().name('b:' + ty.name) });
  };
  // another module's action on the card (the ✏️ live edit, 🎨 Aussehen …): the same id replaces it
  BH.addAction = function (a) {
    if (!a || typeof a.run !== 'function') return () => {};
    const id = a.id || ('a' + BH.actions.length);
    BH.actions = BH.actions.filter(x => x.id !== id);
    const act = Object.assign({ order: 50 }, a, { id });
    BH.actions.push(act); BH.actions.sort((x, y) => (x.order || 0) - (y.order || 0));
    if (BH.state === 'open') renderCard();
    return () => { BH.actions = BH.actions.filter(x => x !== act); if (BH.state === 'open') renderCard(); };
  };
  // the built-in actions: ✏️ the right editor (the Crafter for furniture and houses; the wizard for a ✨ thing), 🖐 a
  // copy into the hand, ☆ favourite
  BH.addAction({ id: 'edit', order: 10, icon: '✏️', label: () => tx('bh.act.edit', null, 'Bearbeiten', 'Edit'),
    when: (t) => !!t && (/^[mh]:/.test(t.ding) || (t.kind === 'plan' && /^[fp]:/.test(t.ding))),
    run: (t) => {
      const g = game(), d = D().parse(t.ding); if (!g || !d) return;
      if (t.kind === 'plan' && (d.kind === 'f' || d.kind === 'p') && VR.Wizard && VR.Wizard.open) { BH.close(); hintDone('change'); VR.Wizard.open({ from: 'game', edit: t.ding, plan: t.plan }); return; }
      BH.close();
      if (!g.openStudio(d.kind === 'm' ? '#craft/m/' + d.key : '#craft/h/' + d.key)) g.ui.hint(tx('bh.noStudio', null, 'Das geht nur in deiner eigenen Welt', 'That works in your own world only'), 2400);
    } });
  BH.addAction({ id: 'take', order: 20, icon: '🖐', label: () => tx('bh.act.take', null, 'Nehmen', 'Take'),
    when: (t) => !!t && !!t.ding && ownWorld() && creative(),
    run: (t) => BH.hold(t.ding) });
  BH.addAction({ id: 'fav', order: 30, icon: '☆', label: (t) => (D().isFav(t.ding) ? '★ ' : '☆ ') + tx('bh.act.fav', null, 'Favorit', 'Favourite'),
    when: (t) => !!t && !!t.ding,
    run: (t) => { D().toggleFav(t.ding); renderCard(); renderRing(); } });

  // ---------------------------------------------------------------- the states
  const ownWorld = () => { const g = game(); return !!(g && g.meta && !g.meta.guest); };
  const creative = () => { const g = game(); return !!(g && g.player && g.player.creative); };
  BH.open = function () {
    const g = game(); if (!g || g.state !== 'play' || !g.player) return false;
    if (BH.state === 'holding') BH.putAway(true);
    BH.state = 'open';
    g.input.releaseLock(); g.input.captured = false;
    ensureDom(); renderCard(); renderRing();
    const el = $('#bauhand'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    setTimeout(() => { if (BH.state !== 'open') return; const f = el.querySelector('.bh-slot[data-k="0"]') || el.querySelector('.bh-new') || el.querySelector('button'); if (f) f.focus({ preventScroll: true }); }, 30);
    hintDone('bauhand'); hintRing();
    return true;
  };
  BH.close = function () {
    const g = game(); if (BH.state === 'open') { const el = $('#bauhand'); if (el) el.classList.remove('on'); hideAll(); }
    BH.state = 'closed';
    if (g && g.state === 'play' && !g.ui.screen && !(VR.Wizard && VR.Wizard.isOpen && VR.Wizard.isOpen())) { g.input.captured = true; g.input.requestLock(); }
    stripShow(false);
    return true;
  };
  // in the hand: a block into the hotbar (the game's own way), everything else as the ghost
  BH.hold = function (ding, o) {
    o = o || {};
    const g = game(), Dg = D(), d = Dg && Dg.parse(ding); if (!g || !d || g.state !== 'play') return false;
    const kind = BH.kindOf(ding); if (!kind) return false;
    // a starter made on first use (the Genie's lantern and apple tree, the flower bed)
    const st = STARTER.find(s => s.id === ding);
    if (st && (st.genie || st.bed)) { const pid = makeStarter(st); if (!pid) { toast(tx('bh.why.prep', null, 'Wird vorbereitet …', 'Getting it ready …')); return false; } return BH.hold(pid, Object.assign({}, o, { name: starterName(st) })); }
    if ((d.kind === 'k' || d.kind === 'g')) { const pc = pieceOfProject(ding); if (!pc) return false; return BH.hold(pc, o); }
    if (!ownWorld() && kind !== 'block') { toast(tx('bh.guest', null, 'In fremden Welten baust du mit Blöcken', 'In other people\'s worlds you build with blocks'), true); return false; }
    if (!creative()) { BH.open(); return false; }
    if (kind === 'block') {
      const item = d.key; if (!(VR.itemDef && VR.itemDef(item))) return false;
      const inv = g.player.inv; inv.slots[inv.sel] = { id: item, n: VR.maxStack ? VR.maxStack(item) : 64 }; inv.changed = true; g.ui.updateHUD(true);
      BH.holding = null; BH.close();
      g.audio && g.audio.play('click');
      blockStrip(Dg.name(ding));
      return true;
    }
    if (BH.state === 'open') { const el = $('#bauhand'); if (el) el.classList.remove('on'); hideAll(); }
    BH.holding = { ding, kind, rot: 0, name: o.name || Dg.name(ding), from: o.from || 'ring' };
    BH.state = 'holding'; BH.ghost = null; ghostKey = '';
    pieceFor(ding);   // (the worker starts on it now)
    g.input.captured = true; g.input.requestLock();
    g.audio && g.audio.play('click');
    stripShow(true);
    return true;
  };
  BH.putAway = function (quiet) {
    BH.holding = null; BH.ghost = null; ghostKey = ''; chip(null);
    if (BH.state === 'holding') BH.state = 'closed';
    stripShow(false);
    if (!quiet) { const g = game(); g && g.audio && g.audio.play('click'); }
    return true;
  };
  BH.toggle = function () { if (BH.state === 'closed') return BH.open(); if (BH.state === 'open') return BH.close(); return BH.putAway(); };

  // ---------------------------------------------------------------- the starters made on first use
  function makeStarter(st) {
    const items = VR.Pack && VR.Pack.libLoad ? VR.Pack.libLoad() : [];
    const have = items.find(it => it && it.starter === st.id); if (have) return 'p:' + have.id;
    let grid = null, origin = null;
    if (st.bed) {
      const beds = ['vx_flowerbed_roses', 'vx_flowerbed', 'vx_flowerbed_tulips'].filter(n => R.byName[n]);
      if (!beds.length) return null;
      const b = new Uint16Array(3 * 1 * 2); for (let i = 0; i < 6; i++) b[i] = R.byName[beds[i % beds.length]].defaultState;
      grid = { sx: 3, sy: 1, sz: 2, blocks: b, dy: 0 }; origin = { kind: 'starter' };
    } else if (st.genie) {
      if (VR.GenieLazy) VR.GenieLazy();
      const B = VR.GenieBrain, G = VR.Genie; if (!B || !G) return null;
      const rc = Object.assign({ colors: {}, feats: {}, count: 1 }, st.genie), m = B.buildModel(rc); if (!m) return null;
      const g = G.raster(Object.assign({ name: starterName(st) }, m), { set: 'all' }); if (!g) return null;
      grid = g; origin = { kind: 'genie', recipe: rc };
    }
    if (!grid || !VR.WizKinds) return null;
    const it = VR.WizKinds.libItem(grid, { name: starterName(st), origin });
    it.starter = st.id;
    const all = [it].concat(items);
    try { localStorage.setItem('r9si.library', JSON.stringify({ v: 1, items: all, t: Date.now() })); } catch (e) { /* full: the plan cannot find it again — so hold nothing */ return null; }
    return 'p:' + it.id;
  }

  // ---------------------------------------------------------------- the DOM: the ring, the card, the strip, the chip, the toast, 🖐
  const $ = (s, r) => (hasDoc ? (r || document).querySelector(s) : null);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function ensureDom() {
    if (!hasDoc || $('#bauhand')) return;
    const root = $('#ui') || document.body;
    const bh = el('div', 'bauhand'); bh.id = 'bauhand'; bh.setAttribute('role', 'dialog');
    bh.innerHTML = `<div class="bh-card" aria-live="polite"></div><div class="bh-ring"><div class="bh-name" aria-hidden="true"></div></div><div class="bh-note"></div><div class="bh-all" hidden></div><button type="button" class="bh-x"></button>`;
    root.appendChild(bh);
    bh.querySelector('.bh-x').onclick = () => BH.close();
    // a click on the empty dark around the ring closes it (not on the card, the ring, the grid)
    bh.addEventListener('mousedown', (e) => { if (e.target === bh) BH.close(); });
    const strip = el('div', 'bh-strip'); strip.id = 'bhStrip'; root.appendChild(strip);
    const ch = el('div', 'bh-chip'); ch.id = 'bhChip'; root.appendChild(ch);
    const to = el('div', 'bh-toast'); to.id = 'bhToast'; to.setAttribute('role', 'status'); root.appendChild(to);
    const btn = el('button', 'bh-btn'); btn.id = 'bhBtn'; btn.type = 'button'; btn.textContent = '🖐'; root.appendChild(btn);
    btn.onclick = () => { BH.toggle(); };
    labels();
  }
  function labels() {
    const b = $('#bhBtn'); if (b) { b.title = tx('bh.btnT', null, 'Bauhand · B', 'Build hand · B'); b.setAttribute('aria-label', b.title); }
    const x = $('#bauhand .bh-x'); if (x) { x.textContent = '✕'; x.title = tx('bh.closeT', null, 'Schließen · Esc', 'Close · Esc'); x.setAttribute('aria-label', x.title); }
    const bh = $('#bauhand'); if (bh) bh.setAttribute('aria-label', tx('bh.title', null, '🖐 Bauhand', '🖐 Build hand'));
  }
  // a Ding's picture for the ring and the card: the game's icon (blocks, furniture), the Bauteil's thumbnail, a
  // picture of the piece (houses, Forge things, Bauteile), else its glyph
  const PICS = new Map();
  function picture(id, size, glyph) {
    const box = el('span', 'bh-pic'); box.textContent = glyph || '◈';
    const g = game(), Dg = D(), d = Dg && Dg.parse(id); if (!d || !g) return box;
    const put = (node) => { box.textContent = ''; box.appendChild(node); box.classList.add('has'); };
    const cached = PICS.get(id + '@' + size); if (cached) { const c = document.createElement('canvas'); c.width = cached.width; c.height = cached.height; c.getContext('2d').drawImage(cached, 0, 0); put(c); return box; }
    if ((d.kind === 'b' || d.kind === 'm') && g.icons && VR.itemDef && VR.itemDef(d.key)) { const c = document.createElement('canvas'); c.width = size; c.height = size; try { g.icons.paint(c, d.key, size); put(c); } catch (e) { /* glyph */ } return box; }
    if (d.kind === 'p') { const it = (VR.Pack && VR.Pack.libLoad ? VR.Pack.libLoad() : []).find(x => x && x.id === d.key); if (it && typeof it.thumb === 'string') { const im = new Image(); im.src = it.thumb; im.alt = ''; im.draggable = false; put(im); return box; } }
    // the piece's own picture, when it is there (the worker builds houses and Forge things; asked again next time)
    const paint = () => {
      const bp = pieceFor(id); if (!bp || !bp.ops || !VR.IsoPic || !g.tex || !g.tex.avgColor) return false;
      if (!BH.texCol) BH.texCol = VR.IsoPic.texColors(g.tex.avgColor);
      const img = VR.IsoPic.render({ ops: bp.ops }, size * 2, size * 2, BH.texCol), cv = VR.IsoPic.toCanvas(img);
      PICS.set(id + '@' + size, cv); if (PICS.size > 80) PICS.delete(PICS.keys().next().value);
      const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0); put(c);
      return true;
    };
    if (!paint()) { let n = 0; const again = () => { if (!box.isConnected && n > 2) return; if (paint() || ++n > 40) return; setTimeout(again, 250); }; setTimeout(again, 120); }
    return box;
  }
  BH.picture = picture;
  const GLYPH = { b: '🧱', m: '🪑', h: '🏠', f: '🏗', p: '🧩', k: '🏠', g: '✨' };
  function renderCard() {
    const card = $('#bauhand .bh-card'); if (!card) return;
    const t = BH.target(), g = game();
    card.innerHTML = '';
    if (!t) { card.classList.add('empty'); return; }
    card.classList.remove('empty');
    const d = D().parse(t.ding), pic = picture(t.ding, 56, GLYPH[d && d.kind] || '◈');
    const txt = el('div', 'bh-ctxt'); txt.appendChild(el('div', 'bh-cname', esc(t.name)));
    const acts = el('div', 'bh-acts');
    for (const a of BH.actions) {
      let ok = false; try { ok = !a.when || a.when(t); } catch (e) { ok = false; }
      if (!ok) continue;
      const b = el('button', 'bh-act'); b.type = 'button'; b.dataset.act = a.id;
      const label = typeof a.label === 'function' ? a.label(t) : a.label;
      b.textContent = (a.id === 'fav' ? '' : (a.icon ? a.icon + ' ' : '')) + label;
      b.onclick = (e) => { e.stopPropagation(); try { a.run(t); } catch (err) { console.warn('Bauhand action', err); } };
      acts.appendChild(b);
    }
    txt.appendChild(acts);
    card.appendChild(pic); card.appendChild(txt);
    void g;
  }
  BH.renderCard = renderCard;
  // the ring: ✨ at the top, the eight slots around, ▸ alle below; the name of the slot you point at in the middle
  function renderRing() {
    const ring = $('#bauhand .bh-ring'), note = $('#bauhand .bh-note'); if (!ring) return;
    const g = game(), guest = !!(g && g.meta && g.meta.guest), surv = !creative();
    for (const b of ring.querySelectorAll('button')) b.remove();
    const nm = ring.querySelector('.bh-name'); nm.textContent = '';
    note.innerHTML = '';
    const bh = $('#bauhand'); bh.classList.toggle('survival', surv); bh.classList.toggle('guest', guest);
    if (surv && !guest) {
      // Survival: the card, a word and the way to Zen — no ring
      note.innerHTML = `<div class="bh-msg">${esc(tx('bh.survival', null, 'Bauen geht im Kreativ- oder Zen-Modus', 'Building works in Creative or Zen mode'))}</div>`;
      const z = el('button', 'bh-zen'); z.type = 'button'; z.textContent = tx('bh.zenOn', null, 'Zen einschalten', 'Switch to Zen');
      z.onclick = () => { const gg = game(); if (!gg || !gg.player) return; gg.player.setMode('zen'); if (gg.meta) gg.meta.mode = 'zen'; gg.saveMeta && gg.saveMeta(); renderRing(); renderCard(); };
      note.appendChild(z);
      return;
    }
    if (guest) note.innerHTML = `<div class="bh-msg">${esc(tx('bh.guest', null, 'In fremden Welten baust du mit Blöcken', 'In other people\'s worlds you build with blocks'))}</div>`;
    const list = BH.ringList({ guest }), n = list.slots.length, R0 = ringRadius();
    bh.style.setProperty('--bh-r', R0 + 'px');
    const place = (b, ang) => { b.style.setProperty('--x', (Math.cos(ang) * R0).toFixed(1) + 'px'); b.style.setProperty('--y', (Math.sin(ang) * R0).toFixed(1) + 'px'); };
    const showName = (t) => { nm.textContent = t || ''; };
    if (!guest) {
      const nw = el('button', 'bh-slot bh-new'); nw.type = 'button'; nw.dataset.k = 'new';
      nw.innerHTML = '<span class="bh-pic glyph">✨</span>';
      const lbl = tx('bh.new', null, 'Neu…', 'New…'); nw.setAttribute('aria-label', '✨ ' + lbl); nw.title = '✨ ' + lbl;
      place(nw, -Math.PI / 2); nw.style.setProperty('--i', 0);
      nw.onmouseenter = nw.onfocus = () => showName('✨ ' + lbl); nw.onmouseleave = nw.onblur = () => showName('');
      nw.onclick = () => { BH.close(); hintDone('undo'); if (VR.Wizard && VR.Wizard.open) VR.Wizard.open({ from: 'game' }); };
      ring.appendChild(nw);
    }
    // the slots: evenly around the ring after ✨ (clockwise from the top right)
    const count = guest ? n : n + 1;
    list.slots.forEach((s, i) => {
      const b = el('button', 'bh-slot' + (s.starter ? ' starter' : '')); b.type = 'button'; b.dataset.k = String(i); b.dataset.ding = s.id;
      const ang = -Math.PI / 2 + (2 * Math.PI) * ((guest ? i : i + 1) / Math.max(count, 6));
      place(b, ang); b.style.setProperty('--i', i + 1);
      const d = D().parse(s.id);
      b.appendChild(picture(s.id, 64, s.icon || GLYPH[d && d.kind] || '◈'));
      const kb = el('kbd', '', String(i + 1)); kb.setAttribute('aria-hidden', 'true'); b.appendChild(kb);
      if (s.starter) b.appendChild(el('span', 'bh-star', '☆'));
      const label = (i + 1) + ' · ' + s.name + (s.starter ? ' · ☆' : '');
      b.setAttribute('aria-label', label); b.title = s.name;
      b.onmouseenter = b.onfocus = () => showName(s.name); b.onmouseleave = b.onblur = () => showName('');
      b.onclick = () => { const gg = game(); gg && gg.audio && gg.audio.play('click'); BH.hold(s.id, { name: s.name }); };
      ring.appendChild(b);
    });
    if (list.more) {
      const al = el('button', 'bh-more'); al.type = 'button'; al.dataset.k = 'all'; al.textContent = tx('bh.all', null, '▸ alle', '▸ all');
      al.onclick = () => renderAll(list.all);
      ring.appendChild(al);
    }
    hideAll();
  }
  BH.renderRing = renderRing;
  const ringRadius = () => { const s = hasDoc ? Math.min(window.innerWidth, window.innerHeight) : 720; return Math.max(118, Math.min(176, s * 0.22)); };
  // ▸ alle: everything a hand can hold, as a grid by kind
  function renderAll(all) {
    const box = $('#bauhand .bh-all'); if (!box) return;
    box.hidden = false; box.innerHTML = '';
    const groups = [['h', '🏠 ' + tx('bh.g.houses', null, 'Häuser', 'Houses')], ['f', '🏗 ' + tx('bh.g.built', null, 'Bauwerke', 'Structures')], ['p', '🧩 ' + tx('bh.g.pieces', null, 'Bauteile', 'Pieces')], ['m', '🪑 ' + tx('bh.g.furn', null, 'Möbel', 'Furniture')], ['b', '🧱 ' + tx('bh.g.blocks', null, 'Blöcke', 'Blocks')]];
    const head = el('div', 'bh-allhead'); head.appendChild(el('b', '', esc(tx('bh.allTitle', null, '★ Alles für die Hand', '★ Everything for the hand'))));
    const back = el('button', 'bh-allx'); back.type = 'button'; back.textContent = tx('bh.back', null, '← Ring', '← Ring'); back.onclick = () => { box.hidden = true; const f = $('#bauhand .bh-slot'); if (f) f.focus({ preventScroll: true }); };
    head.appendChild(back); box.appendChild(head);
    for (const [k, title] of groups) {
      const items = all.filter(s => s.id[0] === k); if (!items.length) continue;
      box.appendChild(el('div', 'bh-gtitle', esc(title)));
      const grid = el('div', 'bh-grid');
      for (const s of items) { const b = el('button', 'bh-gitem'); b.type = 'button'; b.dataset.ding = s.id; b.title = s.name; b.appendChild(picture(s.id, 48, GLYPH[k])); b.appendChild(el('span', 'bh-gname', esc(s.name))); b.onclick = () => BH.hold(s.id, { name: s.name }); grid.appendChild(b); }
      box.appendChild(grid);
    }
    const f = box.querySelector('.bh-gitem'); if (f) f.focus({ preventScroll: true });
  }
  function hideAll() { const box = $('#bauhand .bh-all'); if (box) { box.hidden = true; box.innerHTML = ''; } }

  // the strip above the hotbar while holding: the Ding, the pictograms, ⟲ ↻ ✕ (for a free mouse and fingers)
  let blockStripT = 0;
  function stripShow(on) {
    const s = $('#bhStrip'); if (!s) return;
    const ui = $('#ui'); if (ui) ui.classList.toggle('bh-hold', !!on);
    if (!on) { s.classList.remove('on', 'block'); return; }
    stripText(); s.classList.remove('block'); s.classList.add('on');
  }
  function stripText() {
    const s = $('#bhStrip'), H = BH.holding; if (!s || !H) return;
    const d = D().parse(H.ding);
    s.innerHTML = '';
    const left = el('span', 'bh-shand'); left.appendChild(picture(H.ding, 40, GLYPH[d && d.kind] || '◈')); left.appendChild(el('b', '', esc(H.name))); s.appendChild(left);
    const P = (k, t) => `<span class="bh-p">${k}<span>${esc(t)}</span></span>`;
    s.insertAdjacentHTML('beforeend', `<span class="bh-pictos">${P('<i class="bh-mouse lr"></i>', tx('bh.strip.place', null, 'Klick setzt', 'Click places'))}${P('<i class="bh-mouse wheel"></i>', tx('bh.strip.turn', null, 'Rad dreht', 'Wheel turns'))}${P('<kbd>Z</kbd>', tx('bh.strip.undo', null, 'zurück', 'undo'))}${P('<kbd>Esc</kbd>', tx('bh.strip.away', null, 'weg', 'away'))}</span>`);
    const bt = (txt, title, fn, cls) => { const b = el('button', 'bh-sbtn ' + (cls || '')); b.type = 'button'; b.textContent = txt; b.title = title; b.setAttribute('aria-label', title); b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
    s.appendChild(bt('⟲', tx('bh.undoT', null, 'Zurück · Z', 'Undo · Z'), () => BH.undo()));
    s.appendChild(bt('↻', tx('bh.turnT', null, 'Drehen · R', 'Turn · R'), () => BH.rotate(1)));
    s.appendChild(bt('✕', tx('bh.awayT', null, 'Weglegen · Esc', 'Put away · Esc'), () => BH.putAway(), 'x'));
  }
  // a block in the hotbar: the game's own rule, for a moment
  function blockStrip(name) {
    const s = $('#bhStrip'); if (!s) return;
    s.innerHTML = `<span class="bh-shand"><b>${esc(name)}</b></span><span class="bh-pictos"><span class="bh-p"><i class="bh-mouse r"></i><span>${esc(tx('bh.strip.blockPlace', null, 'Rechtsklick setzt', 'Right click places'))}</span></span><span class="bh-p"><i class="bh-mouse l"></i><span>${esc(tx('bh.strip.blockTake', null, 'Linksklick nimmt weg', 'Left click takes away'))}</span></span></span>`;
    s.classList.add('on', 'block');
    clearTimeout(blockStripT); blockStripT = setTimeout(() => { if (BH.state !== 'holding') s.classList.remove('on', 'block'); }, 5000);
  }
  // the chip at the crosshair: ✓ the name · or ✕ the reason
  let chipText = '';
  const WHY = () => ({
    ground: tx('bh.why.ground', null, 'Zeig auf den Boden', 'Point at the ground'),
    step: tx('bh.why.step', null, 'Tritt einen Schritt zurück', 'Take a step back'),
    full: tx('bh.why.full', null, 'Kein Platz hier — such eine freie Stelle', 'No room here — find a free spot'),
    loading: tx('bh.why.loading', null, 'Boden lädt noch — gleich', 'The ground is still loading — a moment'),
    high: tx('bh.why.high', null, 'Zu hoch für die Welt', 'Too high for the world'),
    prep: tx('bh.why.prep', null, 'Wird vorbereitet …', 'Getting it ready …'),
  });
  function chip(at) {
    const c = $('#bhChip'); if (!c) return;
    const H = BH.holding;
    let t = '', cls = '';
    if (H && at) { if (at.ok) { t = '✓ ' + H.name; cls = 'ok'; } else { t = (at.prep ? '⏳ ' : '✕ ') + (WHY()[at.why] || at.why); cls = at.prep ? 'wait' : 'bad'; } }
    const key = cls + '|' + t;
    if (key === chipText) return;
    chipText = key; c.textContent = t; c.className = 'bh-chip' + (t ? ' on ' + cls : '');
  }
  function chipShake() { const c = $('#bhChip'); if (!c) return; c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
  // the toast (six seconds; kept in the chat log too)
  let toastT = 0;
  function toast(text, warn) {
    const g = game(), t = $('#bhToast'); if (!t) return;
    t.textContent = text; t.className = 'bh-toast on' + (warn ? ' warn' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'bh-toast'; }, 6000);
    if (g && g.ui && g.ui.chatLine) g.ui.chatLine(text, warn ? '#ffcf8a' : '#9fe8c4');
    BH.lastToast = text;
  }
  BH.toast = toast;

  // ---------------------------------------------------------------- 🧭 hints 4–7 (one at a time, never on a timer)
  const H4 = () => ({ text: tx('bh.hint.b', null, 'B = 🖐 Bauhand — setz etwas in deine Welt', 'B = 🖐 build hand — put something into your world'), picto: ['B'] });
  const H5 = () => ({ text: tx('bh.hint.ring', null, 'Tipp auf ein Bild, dann auf den Boden', 'Tap a picture, then the ground'), picto: ['mouse'] });
  const H6 = () => ({ text: tx('bh.hint.undo', null, 'Z nimmt es zurück · ✨ macht Neues', 'Z takes it back · ✨ makes new things'), picto: ['Z'] });
  const H7 = () => ({ text: tx('bh.hint.change', null, 'Drück B darauf — ✏️ ändert es', 'Press B on it — ✏️ changes it'), picto: ['B'] });
  const HN = { bauhand: 'bauhand', ring: 'bhring', undo: 'bhundo', change: 'bhchange' };
  function hintDone(k) { if (VR.Hints) VR.Hints.done(HN[k]); }
  function hintRing() { const Hh = VR.Hints; if (Hh && creative() && ownWorld() && Hh.want(HN.ring)) { if (Hh.current() && Hh.current() !== HN.ring) Hh.dismiss(); Hh.show(HN.ring, H5()); } }
  function hintAfterPlace() { const Hh = VR.Hints; if (!Hh) return; hintDone('ring'); if (Hh.want(HN.undo)) { if (Hh.current()) Hh.dismiss(); Hh.show(HN.undo, H6()); } }
  let wizThingAt = 0;
  function hintWizThing() { wizThingAt = Date.now(); }
  // hint 4: twenty seconds after the fly hint (or the move hint, in Survival) is done; hint 7 when a ✨ thing stands
  let h4From = 0;
  function hintTick() {
    const g = game(), Hh = VR.Hints; if (!g || !Hh || g.state !== 'play' || g.studioOpen || g.ui.screen || g.ui.typing) return;
    const st = Hh.read(), btn = $('#bhBtn');
    const ready = st.done.fly || (st.seen.fly && Hh.current() !== 'fly') || (st.done.move && !creative());
    if (ready && !st.done[HN.bauhand]) { if (!h4From) h4From = Date.now(); if (Date.now() - h4From > 20000 && BH.state === 'closed' && Hh.want(HN.bauhand)) Hh.show(HN.bauhand, H4()); }
    if (btn) btn.classList.toggle('pulse', Hh.current() === HN.bauhand);
    if (wizThingAt && Date.now() - wizThingAt > 1500 && BH.state === 'closed' && !Hh.current() && Hh.want(HN.change)) { wizThingAt = 0; Hh.show(HN.change, H7()); }
  }
  if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { labels(); const Hh = VR.Hints, id = Hh && Hh.current(); const m = { [HN.bauhand]: H4, [HN.ring]: H5, [HN.undo]: H6, [HN.change]: H7 }[id]; if (m && Hh.retext) Hh.retext(m().text); if (BH.state === 'open') { renderRing(); renderCard(); } if (BH.state === 'holding') stripText(); });

  // ---------------------------------------------------------------- hooks into the game
  // B and the keys of the ring and the hand: one dispatcher, before the game's own keys
  BH.keys = function (g) {
    const i = g.input, ui = g.ui;
    if (ui.typing) return false;
    if (i.hit('KeyB')) {
      if (ui.screen || g.studioOpen || (g.gadgets && g.gadgets.controlling) || (VR.Wizard && VR.Wizard.isOpen && VR.Wizard.isOpen())) return false;   // (a menu, the Studio, a vehicle, the wizard: B does nothing)
      BH.toggle(); return true;
    }
    if (BH.state === 'holding') {
      if (ui.screen) return false;
      if (i.hit('Escape')) { BH.putAway(); return true; }
      if (i.hit('KeyZ')) { BH.undo(); return true; }
      if (i.hit('KeyR')) { BH.rotate(1); return true; }
      if (i.hit('Enter') || i.hit('NumpadEnter')) { BH.place(); return true; }
      for (let k = 1; k <= 9; k++) if (i.hit('Digit' + k)) { BH.putAway(true); return false; }   // (the hotbar takes over)
    }
    return false;
  };
  // the ring's keys come straight from the page (no frame later): 1–8, the arrows, Enter, Esc, B
  if (hasDoc) window.addEventListener('keydown', (e) => {
    if (BH.state !== 'open') return;
    const ae = document.activeElement; if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
    const k = e.code, stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (k === 'Escape' || k === 'KeyB') { stop(); BH.close(); return; }
    const slots = [...document.querySelectorAll('#bauhand .bh-ring button, #bauhand .bh-all:not([hidden]) button')].filter(b => b.offsetParent !== null);
    const allOpen = !!document.querySelector('#bauhand .bh-all:not([hidden])');
    if (/^Digit[1-8]$/.test(k) && !allOpen) { const b = document.querySelector(`#bauhand .bh-slot[data-k="${+k.slice(5) - 1}"]`); if (b) { stop(); b.click(); } return; }
    if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') { stop(); const f = ae && ae.tagName === 'BUTTON' && ae.closest && ae.closest('#bauhand') ? ae : slots[0]; if (f && f.click) f.click(); return; }
    if (/^Arrow/.test(k)) {
      stop(); if (!slots.length) return;
      let at = slots.indexOf(ae); if (at < 0) at = 0;
      if (allOpen) { at = (at + (k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1) + slots.length) % slots.length; }
      else if (k === 'ArrowUp') { const nw = document.querySelector('#bauhand .bh-new'); at = nw ? slots.indexOf(nw) : 0; }
      else if (k === 'ArrowDown') { const m = document.querySelector('#bauhand .bh-more'); at = m ? slots.indexOf(m) : at; }
      else at = (at + (k === 'ArrowLeft' ? -1 : 1) + slots.length) % slots.length;
      if (slots[at]) slots[at].focus({ preventScroll: true });
    }
  }, true);
  // Esc in pointer lock: the browser takes the lock away (and keeps the key) — that is the same wish: put it away
  let releasing = false;
  if (hasDoc) document.addEventListener('pointerlockchange', () => { const g = game(); if (!document.pointerLockElement && BH.state === 'holding' && !releasing && g && g.input && g.input.captured && !g.ui.screen) BH.putAway(); releasing = false; });
  function hooks() {
    const G = VR.Game, Gd = VR.Gadgets, P = VR.Player;
    if (G && !G.prototype.__bh) {
      G.prototype.__bh = true;
      const hk = G.prototype.handleKeys;
      G.prototype.handleKeys = function () { if (!this.bauhand) this.bauhand = BH; if (BH.keys(this)) return; return hk.call(this); };
    }
    // while holding: both buttons place, nothing breaks; the ghost follows the crosshair
    if (Gd && !Gd.prototype.__bh) {
      Gd.prototype.__bh = true;
      const up = Gd.prototype.update;
      Gd.prototype.update = function (dt, input, p, hdef) {
        if (BH.state === 'holding' && BH.holding) {
          const g = this.g;
          BH.ghost = computeGhost(g, p); chip(BH.ghost);
          const lmb = input.dragLook ? input.clickAction(0) : input.mouse.clicked[0], rmb = input.dragLook ? input.clickAction(2) : input.mouse.clicked[2];
          if (lmb || rmb) BH.place();
          if (BH.wheel) { BH.rotate(BH.wheel > 0 ? 1 : -1); BH.wheel = 0; }
          return true;
        }
        return up.call(this, dt, input, p, hdef);
      };
      const ol = Gd.prototype.outlines;
      Gd.prototype.outlines = function () { const out = ol.call(this); if (BH.state === 'holding' && BH.ghost) ghostOutlines(out, this.g); return out; };
      const ctor = Gd.prototype.constructor;
      void ctor;
    }
    // the wheel turns the held thing (the hotbar stays)
    if (P && !P.prototype.__bh) {
      P.prototype.__bh = true;
      const ia = P.prototype.interact;
      P.prototype.interact = function (dt, input) {
        if (BH.state === 'holding' && BH.holding && input.mouse.wheel) { BH.wheel = (BH.wheel || 0) + input.mouse.wheel; input.mouse.wheel = 0; }
        return ia.call(this, dt, input);
      };
    }
  }
  hooks();
  // the plans the hand set: their toasts and their undo (Blueprints is made per world: hooked when it is)
  if (VR.Blueprints && !VR.Blueprints.prototype.__bh) {
    VR.Blueprints.prototype.__bh = true;
    VR.Blueprints.prototype.onBuilt = onBuilt;
  }
  // a new world, the title, the Studio over the game: the hand is empty, the ring shut
  if (VR.Game && !VR.Game.prototype.__bhw) {
    VR.Game.prototype.__bhw = true;
    for (const m of ['startWorld', 'startTitle', 'startGuestWorld', 'openStudio']) {
      const f = VR.Game.prototype[m]; if (!f) continue;
      VR.Game.prototype[m] = function () { if (BH.state !== 'closed') { if (BH.state === 'open') BH.close(); else BH.putAway(true); } BH.last = null; return f.apply(this, arguments); };
    }
  }
  // the HUD: 🖐 shows in play (Einfach always; Profi too — it is the one way to the hand without a key)
  if (hasDoc) setInterval(() => {
    const g = game(); if (!g) return;
    ensureDom();
    const btn = $('#bhBtn'); if (!btn) return;
    const on = g.state === 'play' && !g.studioOpen && !g.ui.screen && !g.hideHud && !g.photo && !(VR.Wizard && VR.Wizard.isOpen && VR.Wizard.isOpen());
    btn.classList.toggle('on', on);
    if (BH.state === 'open' && (g.state !== 'play' || g.ui.screen || g.studioOpen)) BH.close();
    if (BH.state === 'holding' && (g.state !== 'play' || g.studioOpen)) BH.putAway(true);
    hintTick();
  }, 250);
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

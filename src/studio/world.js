// ============================================================================
// R9 Studio · Welt — open a saved R9-SI world (the game and the Studio share the
// browser's storage), see the land around where you last stood, and plan what
// goes into it: the catalogue houses (or your ✎ design of one) and furniture —
// your own designs first. Placing is instant: every piece is meshed once and
// then only moved and turned on the GPU, so it glides over the ground; R turns
// it, F changes the facade, a click puts it down. Placed pieces can be picked,
// dragged, turned, cloned (Strg+D, Alt+drag), raised and lowered (Bild ↑/↓),
// nudged (arrow keys) or removed (Entf); Strg+Z / Strg+Y undo and redo.
// "In die Welt übernehmen" hands the plan to the game (localStorage
// 'r9si.plans.<world>'): the game builds every piece — the ground levelled like a
// blueprint does it — as soon as that part of the world is loaded, right away when
// the world is open in the game. The game stays the only writer of the world.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const { S, HOOK, $, $$ } = C;
  const R = VR.R, T = R.T, F = VR.F, VM = VR.VM, PH = VR.PHYS;
  const fmt = C.fmt;
  const N = 9;   // the region: N × N chunks around the player
  const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];   // = the game's lot rotation
  const FRONT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const RCS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const PLAN_KEY = (id) => 'r9si.plans.' + id, DRAFT_KEY = (id) => 'r9si.draft.' + id;
  const WM = VR.StudioWorld = { on: false, store: null, worlds: null, world: null, cols: new Map(), gpu: [], loading: null, meshes: new Map(), plans: [], sel: null, tool: null, ghost: null, rot: 0, undo: [], redo: [], tab: 'houses', hover: null, msg: '' };
  const HOUSES = C.HOUSES, hname = (i) => { const h = HOUSES.find(x => x.i === i); return h ? h.name : 'Haus ' + i; };
  // the name of a plan or tool: a catalogue house, a Forge structure (🏭, by its DNA) or a furniture model
  const nameOf = (p) => p.kind === 'house' ? hname(p.index) : p.kind === 'forge' ? (VR.Forge ? VR.Forge.describe(p.dna, true) : '🏭 ' + p.dna) : ((VM.MODELS[p.name] || {}).display || p.name);
  const lotBased = (p) => p.kind !== 'model';   // houses and Forge structures stand on a lot (the anchor is the front centre)
  const SA = !!C.SA, GAME_URL = window.__R9_GAME_URL || '';

  // ---------------------------------------------------------------- storage: the game's worlds, the plans
  const lsGet = (k) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  async function store() {
    if (WM.store) return WM.store;
    if (!VR.Store) return null;
    const st = new VR.Store(); await st.open(); WM.store = st; return st;
  }
  async function listWorlds() {
    const st = await store(); if (!st) { WM.worlds = []; return; }
    const ws = await st.listWorlds();
    WM.worlds = ws.filter(w => w && w.id && !w.guest).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  }
  const newId = () => 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  function loadPlans() {
    const id = WM.world.id, stored = (lsGet(PLAN_KEY(id)) || { plans: [] }).plans || [], drafts = (lsGet(DRAFT_KEY(id)) || { plans: [] }).plans || [];
    const seen = new Set(stored.map(p => p.id));
    WM.plans = stored.concat(drafts.filter(p => !seen.has(p.id)).map(p => Object.assign(p, { status: 'draft' })));
    WM.committed = JSON.stringify(stored.filter(p => p.status !== 'built'));
  }
  // something the game does not know yet: drafts, or a handed-over piece moved / turned / removed since
  const dirty = () => { if (!WM.world) return false; const cur = WM.plans.filter(p => p.status !== 'built'); return cur.some(p => p.status === 'draft') || JSON.stringify(cur.map(p => Object.assign({}, p, { status: 'pending' }))) !== JSON.stringify(JSON.parse(WM.committed || '[]').map(p => Object.assign({}, p, { status: 'pending' }))); };
  let draftT = 0;
  function saveDrafts() {
    clearTimeout(draftT);
    draftT = setTimeout(() => { if (WM.world && !lsSet(DRAFT_KEY(WM.world.id), { v: 1, plans: WM.plans.filter(p => p.status === 'draft') })) C.full('plans'); }, 250);
  }
  // hand the plan to the game: every unbuilt piece becomes pending; pieces the game already built stay built
  // (quiet: ▶ Spielen does it on the way out) → { n, ok }
  function commit(quiet) {
    if (!WM.world) return { n: 0, ok: true };
    const id = WM.world.id, stored = (lsGet(PLAN_KEY(id)) || { plans: [] }).plans || [];
    const built = new Map(stored.filter(p => p.status === 'built').map(p => [p.id, p]));
    const out = [...built.values()];
    let n = 0, newest = null;
    for (const p of WM.plans) { if (built.has(p.id)) continue; if (p.status === 'built') continue; out.push(Object.assign({}, p, { status: 'pending', t: p.t || Date.now() })); n++; if (!newest || (p.t || 0) >= (newest.t || 0)) newest = p; }
    if (!lsSet(PLAN_KEY(id), { v: 1, world: id, plans: out, t: Date.now() })) { C.full('plans'); C.sys('⚠ Nicht übergeben — der Browser-Speicher ist voll', 'err'); if (!quiet) tip('Nicht übergeben: der Browser-Speicher ist voll', false); return { n: 0, ok: false }; }
    if (n) WM.editT = Date.now();
    lsSet(DRAFT_KEY(id), { v: 1, plans: [] });
    // 📍 the newest piece is where ▶ Spielen takes you
    if (newest && WM.onCommit) { const m = meshFor(newest); if (m) { const L = placeOf(newest, m).lot; WM.onCommit([L[0], newest.F, L[1], L[2], newest.F + Math.max(3, m.top || 8), L[3]], nameOf(newest), lotBased(newest) ? FRONT[newest.r & 3] : null); } }
    loadPlans(); refresh();
    C.sys(n ? `${n} Teil${n === 1 ? '' : 'e'} an die Welt übergeben — das Spiel baut sie, sobald die Gegend geladen ist` : 'Nichts Neues zu übernehmen', 'ok');
    if (!quiet) tip(n ? `✓ Übergeben: ${n} — öffne „${WM.world.name}“ im Spiel` : 'Nichts Neues', true);
    return { n, ok: true };
  }
  // ▶ Spielen takes everything along: the plan's drafts (and pieces moved since) go to the game, the 🎨 Stil preview
  // into the world — for the world open here (with the 📍 landing in front of the newest piece), else from what is
  // stored for that world. → { plans, style, ok }
  WM.keepNow = function (id) {
    const out = { plans: 0, style: 0, ok: true };
    const here = WM.world && (!id || WM.world.id === id);
    if (here) {
      clearTimeout(draftT);
      if (dirty()) { const r = commit(true); out.plans = r.n; if (!r.ok) out.ok = false; }
    } else if (id) {
      const drafts = (lsGet(DRAFT_KEY(id)) || { plans: [] }).plans || [];
      if (drafts.length) {
        const stored = (lsGet(PLAN_KEY(id)) || { plans: [] }).plans || [], seen = new Set(stored.map(p => p.id));
        const add = drafts.filter(p => p && !seen.has(p.id)).map(p => Object.assign({}, p, { status: 'pending', t: p.t || Date.now() }));
        if (add.length && lsSet(PLAN_KEY(id), { v: 1, world: id, plans: stored.concat(add), t: Date.now() })) { lsSet(DRAFT_KEY(id), { v: 1, plans: [] }); out.plans = add.length; }
        else if (add.length) { out.ok = false; C.full('plans'); }
      }
    }
    if (WM.st && WM.st.keepNow) { const r = WM.st.keepNow(here ? null : id); out.style = r.n; if (!r.ok) out.ok = false; }
    return out;
  };
  // the game marks pieces as built (another tab): pick that up
  window.addEventListener('storage', (e) => { if (WM.world && e.key === PLAN_KEY(WM.world.id)) { const keep = WM.sel; loadPlans(); WM.sel = WM.plans.some(p => p.id === keep) ? keep : null; refresh(); } });

  // ---------------------------------------------------------------- the region
  const colAt = (x, z) => WM.cols.get((x >> 4) + ',' + (z >> 4));
  function getBlock(x, y, z) { const c = colAt(x, z); if (!c || y < 0 || y >= c.H) return 0; return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; }
  // the mouse finds ground through leaves and plants; a house stands on ground, never on a tree
  const hitState = (s) => s && (T.flags[s] & (F.SOLID | F.FLUID)) && !(T.flags[s] & (F.REPLACE | F.LEAVES));
  let TREE = null;
  const isGround = (s) => { if (!TREE) { TREE = new Uint8Array(R.types.length); for (const t of R.types) if (t && /_log$|_stem$|_wood$|_hyphae$/.test(t.name)) TREE[t.id] = 1; } return s && (T.flags[s] & (F.SOLID | F.FLUID)) && !(T.flags[s] & (F.LEAVES | F.REPLACE)) && !TREE[T.type[s]]; };
  function groundAt(x, z) {
    const c = colAt(x, z); if (!c) return null;
    for (let y = Math.min(c.H - 1, 400); y > 0; y--) { const s = c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; if (isGround(s)) return y + 1; }
    return 1;
  }
  function regionBox() { const r = WM.region; return r ? [r.cx0 * 16, 0, r.cz0 * 16, (r.cx0 + N) * 16, 512, (r.cz0 + N) * 16] : null; }
  async function openWorld(meta, tab) {
    const st = await store(); if (!st) return;
    const same = WM.world === meta;
    if (WM.world && WM.world !== meta) keepWorld(true);      // the world that was open keeps its view (🕘)
    freeRegion();
    WM.world = meta; WM.sel = null; WM.tool = null; WM.undo = []; WM.redo = []; WM.editT = 0; WM.tab = tab || (same && WM.tab && WM.tab !== 'worlds' ? WM.tab : (WM.benchUI ? 'bench' : 'houses'));
    loadPlans();
    const dim = meta.dim || 'overworld';
    const p = meta.player && meta.player.pos ? meta.player.pos : Array.isArray(meta.worldSpawn) ? meta.worldSpawn : [0, 80, 0];
    const cx0 = (Math.floor(p[0]) >> 4) - (N >> 1), cz0 = (Math.floor(p[2]) >> 4) - (N >> 1);
    WM.region = { cx0, cz0, dim, center: [Math.floor(p[0]) + 0.5, Math.floor(p[1]), Math.floor(p[2]) + 0.5] };
    st.bind(meta.id);
    WM.loading = { done: 0, total: N * N * 2, t0: performance.now(), saved: 0 }; WM.regionT = Date.now();
    const sc = { type: 'world', name: meta.name, gpu: WM.gpu, off: [0, 0, 0], center: WM.region.center.slice(), span: 46, groundY: p[1], noGrid: true, instances: [] };
    C.setScene(sc); S.cam.yaw = 0.62; S.cam.pitch = 0.78; S.cam.dist = 0;
    refresh();
    // saved columns from the game's store (what the player built), the rest comes from the world's generator
    const jobs = []; for (let dz = 0; dz < N; dz++) for (let dx = 0; dx < N; dx++) jobs.push(st.loadColumn(dim, cx0 + dx, cz0 + dz).then(b => b ? { cx: cx0 + dx, cz: cz0 + dz, blocks: b } : null));
    const saved = (await Promise.all(jobs)).filter(Boolean).map(s => ({ cx: s.cx, cz: s.cz, blocks: Uint16Array.from(s.blocks), sv: s.blocks.sv || 0 }));
    WM.loading.saved = saved.length;
    C.sys(`Welt „${meta.name}“ wird geladen …`);
    const opts = { worldType: meta.type === 'flat' ? 'flat' : meta.type, vgen: meta.vgen || 1 };
    const onPart = (m) => {
      if (WM.world !== meta) return;
      if (m.restyle) return;          // (a style preview racing the first read: its own handler takes it)
      for (const c of (m.cols || [])) WM.cols.set(c.cx + ',' + c.cz, { cx: c.cx, cz: c.cz, H: c.blocks.length >> 8, blocks: c.blocks, saved: c.saved, orig: c.orig || null });
      if (m.sections && m.sections.length) for (const g of C.uploadSections(m.sections)) WM.gpu.push(g);
      WM.loading.done = m.done; WM.loading.total = m.total;
      if (WM.loading.done && m.cols && m.cols.length && !WM.hover) { const y = groundAt(Math.floor(WM.region.center[0]), Math.floor(WM.region.center[2])); if (y) { WM.region.center[1] = y; if (S.scene && S.scene.type === 'world') S.scene.center[1] = y; } }
      C.hud();
    };
    const tr = saved.map(s => s.blocks.buffer);
    // the world's style is part of what it looks like (the 🎨 Stil tab changes it and shows it before it goes in)
    WM.style = VR.WorldStyle ? VR.WorldStyle.load(meta.id) : null;
    const fin = await C.callP({ type: 'world_region', dim, seed: meta.seed >>> 0, opts, cx0, cz0, n: N, saved, style: WM.style }, onPart, tr);
    if (WM.world !== meta) return;
    if (fin.type === 'error') { console.error(fin.msg); C.sys('Welt konnte nicht geladen werden', 'err'); WM.loading = null; refresh(); return; }
    onPart(fin);
    WM.loading = null;
    C.sys(`Welt „${meta.name}“ · ${N}×${N} Chunks · ${saved.length} gespeicherte Spalten · ${(fin.ms / 1000).toFixed(1)} s`, 'ok');
    refresh();
    if (PJ() && PJ().get('w:' + meta.id)) PJ().seen('w:' + meta.id);
  }
  function freeRegion() { if (WM.gpu.length) C.freeSections(WM.gpu); WM.gpu.length = 0; WM.cols.clear(); WM.region = null; }

  // ---------------------------------------------------------------- what can be placed, meshed once per variant
  const designOf = (i) => VR.Custom && VR.Custom.houseFor(i);
  function variantOf(it) {
    if (it.kind === 'house') { const d = designOf(it.index); if (d) return { custom: true, stamp: d.t || 1 }; return { skin: it.skin, mirror: !!it.mirror }; }
    if (it.kind === 'forge') return { dna: it.dna };
    const md = VR.CUSTOM && VR.CUSTOM.models && VR.CUSTOM.models[it.name];
    return { stamp: md ? md.t || 1 : 0 };
  }
  const meshKey = (it) => { const v = variantOf(it); return it.kind === 'house' ? `h:${it.index}:${v.custom ? 'c' + v.stamp : v.skin + ':' + (v.mirror ? 1 : 0)}` : it.kind === 'forge' ? `f:${it.dna}` : `m:${it.name}:${v.stamp}`; };
  function meshFor(it) {
    const k = meshKey(it); let m = WM.meshes.get(k);
    if (m) return m.ready ? m : null;
    m = { ready: false }; WM.meshes.set(k, m);
    const v = variantOf(it), msg = it.kind === 'house' ? { type: 'place_mesh', kind: 'house', index: it.index } : it.kind === 'forge' ? { type: 'place_mesh', kind: 'forge', dna: it.dna } : { type: 'place_mesh', kind: 'model', name: it.name };
    if (it.kind === 'house' && !v.custom) { msg.skin = v.skin; msg.mirror = v.mirror; }
    C.call(msg).then((r) => {
      if (r.type !== 'place_mesh') { console.error(r.msg); WM.meshes.delete(k); C.sys('Konnte ' + (it.name || it.index) + ' nicht vorbereiten', 'err'); return; }
      Object.assign(m, { ready: true, gpu: C.uploadSections(r.sections), lot: r.lot, house: r.house, bounds: r.bounds, top: r.top, origin: r.origin, title: r.title, custom: r.custom, skin: r.skin, mirror: r.mirror, ops: r.ops.length / 4, level: r.level, terrain: r.terrain });
      r.sections = null; refresh();
    });
    return null;
  }
  // a catalogue house as a tool: the facade the Architektur view shows for it (or the player's design)
  function houseItem(i) {
    const rec = C.HOUSE.get(i), d = rec && rec.data;
    // (before the Architektur view has built it, the worker picks the facade: the Studio's page has no villa catalogue)
    const PL = VR.VillageGen && VR.VillageGen.plan2, cat = PL && PL.CATALOGUE[i];
    return { kind: 'house', index: i, skin: d ? d.skin : cat ? cat.skins[0] : undefined, mirror: d ? !!d.mirrored : false };
  }
  function cycleFacade(it) {
    if (it.kind !== 'house' || designOf(it.index)) return false;
    const rec = C.HOUSE.get(it.index), skins = rec ? rec.data.skins.filter((v, j, a) => a.indexOf(v) === j) : [it.skin];
    const list = []; for (const mirror of [false, true]) for (const skin of skins) list.push([skin, mirror]);
    const k = list.findIndex(([s, m]) => s === it.skin && m === !!it.mirror);
    const [s, m] = list[(k + 1) % list.length]; it.skin = s; it.mirror = m;
    return true;
  }

  // ---------------------------------------------------------------- plans: geometry
  function placeOf(p, m) {
    const W = m.lot[0], D = m.lot[1], r = p.r & 3;
    const rect = (u0, v0, u1, v1) => { const a = ROT[r](u0, v0), b = ROT[r](u1, v1); return [p.ox + Math.min(a[0], b[0]), p.oz + Math.min(a[1], b[1]), p.ox + Math.max(a[0], b[0]), p.oz + Math.max(a[1], b[1])]; };
    return { W, D, r, rect, lot: rect(0, 0, W - 1, D - 1) };
  }
  function instanceOf(p, m, mul) {
    const r = p.r & 3, h = ROT[r](0.5, 0.5);
    return { gpu: m.gpu, pre: [-m.origin[0], -m.origin[1], -m.origin[2]], rc: RCS[r], t: [p.ox + 0.5 - h[0], p.F, p.oz + 0.5 - h[1]], mul };
  }
  // the anchor (front centre of the lot / the model's corner) and the floor height under it
  function anchorOf(p, m) { if (!lotBased(p)) return [p.ox, p.oz]; const q = ROT[p.r & 3](m.lot[0] >> 1, 0); return [p.ox + q[0], p.oz + q[1]]; }
  function settle(p, m) { const a = anchorOf(p, m), y = groundAt(a[0], a[1]); if (y !== null) p.F = y; }
  function inRegion(p, m) {
    const B = regionBox(); if (!B) return false;
    const L = placeOf(p, m).lot; return L[0] >= B[0] && L[1] >= B[2] && L[2] < B[3] && L[3] < B[5];
  }
  // a new piece for the tool at the hovered ground: the street side faces the camera, R turns it further
  function ghostAt(hit, it, m) {
    const sc = S.scene, cam = C.camFor(sc, S.cam, 1, 1), ax = hit.x + VR.DX[hit.face], az = hit.z + VR.DZ[hit.face];
    const bx = cam.eye[0] - (ax + 0.5), bz = cam.eye[2] - (az + 0.5);
    let best = 0, bd = -1e9; for (let r = 0; r < 4; r++) { const d = FRONT[r][0] * bx + FRONT[r][1] * bz; if (d > bd) { bd = d; best = r; } }
    const r = (best + WM.rot) & 3;
    const p = { kind: it.kind, index: it.index, name: it.name, skin: it.skin, mirror: it.mirror, r, ox: 0, oz: 0, F: hit.y + VR.DY[hit.face] };
    if (it.kind === 'forge') p.dna = it.dna;
    if (lotBased(it)) { const q = ROT[r](m.lot[0] >> 1, 0); p.ox = ax - q[0]; p.oz = az - q[1]; } else { p.ox = ax; p.oz = az; }
    if (hit.face !== 2) settle(p, m);
    return p;
  }

  // ---------------------------------------------------------------- picking
  function rayFromMouse(e) {
    const cv = C.view(), r = cv.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = 1 - ((e.clientY - r.top) / r.height) * 2;
    const cam = C.camFor(S.scene, S.cam, r.width, r.height), eye = cam.eye, tg = cam.target;
    const fw = nrm([tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]]), rt = nrm(crs(fw, [0, 1, 0])), up = crs(rt, fw);
    const th = Math.tan(cam.fov / 2), asp = r.width / r.height;
    return { o: eye, d: nrm([fw[0] + rt[0] * nx * th * asp + up[0] * ny * th, fw[1] + rt[1] * nx * th * asp + up[1] * ny * th, fw[2] + rt[2] * nx * th * asp + up[2] * ny * th]) };
  }
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // DDA through the loaded region (solid ground and water; plants and air pass)
  function pickGround(ray) {
    const B = regionBox(); if (!B) return null;
    const [ox, oy, oz] = ray.o, [dx, dy, dz] = ray.d;
    const e = PH.rayBox(ox, oy, oz, dx, dy, dz, B, 0, 0, 0); if (!e) return null;
    const t0 = Math.max(0, e[0]) + 1e-4;
    let px = ox + dx * t0, py = oy + dy * t0, pz = oz + dz * t0;
    let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz), face = e[1];
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (dx > 0 ? (x + 1 - px) : (px - x)) * tdx, ty = (dy > 0 ? (y + 1 - py) : (py - y)) * tdy, tz = (dz > 0 ? (z + 1 - pz) : (pz - z)) * tdz, t = t0;
    for (let i = 0; i < 4000; i++) {
      if (x < B[0] || z < B[2] || x >= B[3] || z >= B[5] || y < -1 || y > 520) return null;
      const s = getBlock(x, y, z);
      if (hitState(s)) return { x, y, z, face, t, state: s, px: ox + dx * t, py: oy + dy * t, pz: oz + dz * t };
      if (tx < ty && tx < tz) { t = t0 + tx; x += sx; tx += tdx; face = sx > 0 ? 1 : 0; } else if (ty < tz) { t = t0 + ty; y += sy; ty += tdy; face = sy > 0 ? 3 : 2; } else { t = t0 + tz; z += sz; tz += tdz; face = sz > 0 ? 5 : 4; }
    }
    return null;
  }
  // the plan under the mouse (its lot box from below the yard to the roof), nearest first
  function pickPlan(ray) {
    let best = null;
    for (const p of WM.plans) {
      if (p.status === 'built') continue;
      const m = meshFor(p); if (!m) continue;
      const L = placeOf(p, m).lot, box = [L[0], p.F - 1, L[1], L[2] + 1, p.F + m.top + 1, L[3] + 1];
      const h = PH.rayBox(ray.o[0], ray.o[1], ray.o[2], ray.d[0], ray.d[1], ray.d[2], box, 0, 0, 0);
      if (h && (!best || h[0] < best.t)) best = { p, t: h[0] };
    }
    return best;
  }

  // ---------------------------------------------------------------- editing with undo
  const snap = () => JSON.stringify(WM.plans.filter(p => p.status !== 'built'));
  function change(fn, label) {
    const before = snap();
    fn();
    if (snap() === before) return;
    WM.editT = Date.now();
    WM.undo.push(before); if (WM.undo.length > 200) WM.undo.shift(); WM.redo = [];
    saveDrafts(); refresh(); if (label) tip(label, true);
  }
  function restore(json) { const keep = WM.plans.filter(p => p.status === 'built'); WM.plans = keep.concat(JSON.parse(json)); if (WM.sel && !WM.plans.some(p => p.id === WM.sel)) WM.sel = null; saveDrafts(); refresh(); }
  function undo(redo) { const from = redo ? WM.redo : WM.undo, to = redo ? WM.undo : WM.redo; const s = from.pop(); if (!s) return; to.push(snap()); restore(s); tip(redo ? 'Wiederholt' : 'Rückgängig', true); }
  const selPlan = () => WM.plans.find(p => p.id === WM.sel) || null;
  const editable = (p) => p && p.status !== 'built';
  function rotatePlan(p, m) {
    // turn about the lot's middle
    const c0 = ROT[p.r & 3]((m.lot[0] - 1) / 2, (m.lot[1] - 1) / 2), cx = p.ox + c0[0], cz = p.oz + c0[1];
    p.r = (p.r + 1) & 3;
    const c1 = ROT[p.r](((m.lot[0] - 1) / 2), (m.lot[1] - 1) / 2); p.ox = Math.round(cx - c1[0]); p.oz = Math.round(cz - c1[1]);
  }
  function clonePlan(p, m) {
    const q = Object.assign({}, p, { id: newId(), status: 'draft', t: Date.now() }), d = ROT[p.r & 3](m.lot[0] + (p.kind === 'house' ? 2 : 1), 0);
    q.ox += d[0]; q.oz += d[1]; settle(q, m);
    WM.plans.push(q); WM.sel = q.id;
    return q;
  }

  // ---------------------------------------------------------------- per frame: instances for the scene
  function sync() {
    const sc = S.scene; if (!sc || sc.type !== 'world') return;
    const out = [];
    for (const p of WM.plans) {
      // pieces the game built after this region was read are not in its blocks yet: still drawn (greenish)
      if (p.status === 'built' && !(p.builtAt && p.builtAt > (WM.regionT || 0))) continue;
      const m = meshFor(p); if (!m) continue;
      const sel = p.id === WM.sel, mul = p.status === 'built' ? [0.9, 1.04, 0.9] : sel ? [1.28, 1.2, 0.78] : p.status === 'pending' ? [0.86, 0.96, 1.14] : null;
      out.push(instanceOf(p, m, mul));
    }
    if (WM.tool && WM.ghost) { const m = meshFor(WM.tool); if (m) out.push(instanceOf(WM.ghost, m, WM.ghost.ok ? [0.82, 1.06, 1.22] : [1.45, 0.55, 0.5])); }
    if (WM.extraInst) for (const ins of WM.extraInst()) out.push(ins);   // the Werkbank's piece in hand
    sc.instances = out;
  }

  // ---------------------------------------------------------------- input
  let ptr = null;
  HOOK_WRAP('pointer', function (e, type) {
    const cv = C.view();
    if (type === 'down') {
      ptr = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, alt: e.altKey, moved: false, grab: null };
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      // left button on the selected piece: drag it (Alt: drag a clone)
      if (e.button === 0 && !WM.tool) {
        const ray = rayFromMouse(e), hp = pickPlan(ray);
        if (hp && editable(hp.p) && (hp.p.id === WM.sel || e.altKey)) {
          const g = pickGround(ray), m = meshFor(hp.p);
          if (g && m) { const before = snap(); let p = hp.p; if (e.altKey) p = clonePlan(hp.p, m); WM.sel = p.id; ptr.grab = { p, m, dx: p.ox - g.x, dz: p.oz - g.z, before }; }
        }
      }
      return true;
    }
    if (type === 'move') {
      if (!ptr) { hover(e); return true; }
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
      if (!ptr.moved && Math.hypot(dx, dy) < 5) return true;
      ptr.moved = true; ptr.x = e.clientX; ptr.y = e.clientY;
      if (ptr.grab) {
        const g = pickGround(rayFromMouse(e));
        if (g) { const G = ptr.grab; G.p.ox = g.x + G.dx; G.p.oz = g.z + G.dz; settle(G.p, G.m); C.hud(); }
        return true;
      }
      if (ptr.shift || ptr.b === 1) C.CAM.pan(dx, dy);
      else C.CAM.rotate(dx, dy);
      return true;
    }
    if (type === 'up') {
      const p0 = ptr; ptr = null;
      if (p0 && p0.grab) {
        if (p0.moved || p0.alt) { WM.undo.push(p0.grab.before); WM.redo = []; saveDrafts(); refresh(); tip('Verschoben', true); }
        return true;
      }
      if (p0 && !p0.moved) {
        const ray = rayFromMouse(e);
        if (p0.b === 0) {
          // 📍 armed: this spot on the ground is the spawn point
          if (WM.spawnArm) { const g = WM.hover; WM.spawnArm = false; if (g && WM.setSpawn) WM.setSpawn([g.x + 0.5, g.y + 1, g.z + 0.5]); refresh(); }
          else if (WM.tool) {
            const m = meshFor(WM.tool), gp = WM.ghost;
            if (m && gp) { if (!gp.ok) { tip('Bitte innerhalb der geladenen Gegend setzen.', false); return true; } change(() => { const p = Object.assign({}, gp, { id: newId(), status: 'draft', t: Date.now() }); delete p.ok; WM.plans.push(p); WM.sel = p.id; }, (m.title || 'Teil') + ' geplant — weiter setzen oder Esc'); }
          } else { const hp = pickPlan(ray); WM.sel = hp ? hp.p.id : null; refresh(); }
        } else if (p0.b === 2) { if (WM.spawnArm) { WM.spawnArm = false; refresh(); } else if (WM.tool) { WM.tool = null; WM.ghost = null; refresh(); } else if (WM.sel) { WM.sel = null; refresh(); } }
        hover(e);
      }
      return true;
    }
    if (type === 'leave') { WM.hover = null; if (WM.tool) WM.ghost = null; }
    return true;
  });
  function hover(e) {
    const g = pickGround(rayFromMouse(e));
    WM.hover = g;
    if (WM.tool) { const m = meshFor(WM.tool); if (m && g) { const gp = ghostAt(g, WM.tool, m); gp.ok = inRegion(gp, m); WM.ghost = gp; } else WM.ghost = null; }
    C.hud();
  }
  HOOK_WRAP('wheel', function (e) {
    if (e.shiftKey || e.altKey) { rotateCurrent(); return true; }
    return false;
  });
  function rotateCurrent() {
    if (WM.tool) { WM.rot = (WM.rot + 1) & 3; if (WM.hover) { const m = meshFor(WM.tool); if (m) { const gp = ghostAt(WM.hover, WM.tool, m); gp.ok = inRegion(gp, m); WM.ghost = gp; } } return; }
    const p = selPlan(), m = p && meshFor(p); if (!editable(p) || !m) return;
    change(() => rotatePlan(p, m), 'Gedreht');
  }
  HOOK_WRAP('key', function (e, down) {
    const k = e.key.toLowerCase();
    if (!down) { keys[k] = false; return false; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') { undo(e.shiftKey); return true; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { undo(true); return true; }
    if ((e.ctrlKey || e.metaKey) && k === 'd') { const p = selPlan(), m = p && meshFor(p); if (p && m) change(() => clonePlan(p, m), 'Geklont'); return true; }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (k === 'r') { rotateCurrent(); return true; }
    if (k === 'f') {
      if (WM.tool) { if (cycleFacade(WM.tool)) { WM.ghost = null; refresh(); } else tip('Dein Design hat genau eine Fassade', false); return true; }
      const p = selPlan(); if (editable(p) && p.kind === 'house') { if (designOf(p.index)) tip('Dein Design hat genau eine Fassade', false); else change(() => cycleFacade(p), 'Fassade gewechselt'); }
      return true;
    }
    if (k === 'escape') { if (WM.tool) { WM.tool = null; WM.ghost = null; } else WM.sel = null; refresh(); return true; }
    if (k === 'delete' || k === 'backspace') { const p = selPlan(); if (editable(p)) change(() => { WM.plans = WM.plans.filter(q => q !== p); WM.sel = null; }, 'Entfernt'); return true; }
    const p = selPlan();
    if (editable(p) && (k === 'pageup' || k === 'pagedown' || k === '+' || k === '-')) { change(() => { p.F += (k === 'pageup' || k === '+') ? 1 : -1; }, 'Höhe ' + p.F); return true; }
    if (editable(p) && k.startsWith('arrow')) { change(() => { if (k === 'arrowleft') p.ox--; if (k === 'arrowright') p.ox++; if (k === 'arrowup') p.oz--; if (k === 'arrowdown') p.oz++; const m = meshFor(p); if (m && !e.shiftKey) settle(p, m); }); return true; }
    if ('wasdqe'.includes(k) && k.length === 1) { keys[k] = true; return true; }
    return false;
  });
  const keys = {};
  let lastT = performance.now();
  HOOK_WRAP('tick', function () {
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const sc = S.scene;
    if (sc && sc.type === 'world' && (keys.w || keys.a || keys.s || keys.d || keys.q || keys.e)) {
      const sp = Math.max(8, sc.span) * dt * 1.2, fx = -Math.sin(S.cam.yaw), fz = -Math.cos(S.cam.yaw);
      if (keys.w) { sc.center[0] += fx * sp; sc.center[2] += fz * sp; } if (keys.s) { sc.center[0] -= fx * sp; sc.center[2] -= fz * sp; }
      if (keys.a) { sc.center[0] += fz * sp; sc.center[2] -= fx * sp; } if (keys.d) { sc.center[0] -= fz * sp; sc.center[2] += fx * sp; }
      if (keys.e) sc.center[1] += sp; if (keys.q) sc.center[1] -= sp;
    }
    sync();
    return true;
  });

  // ---------------------------------------------------------------- overlay: lots, the selection, the ghost, the region edge
  const box12 = (x0, y0, z0, x1, y1, z1, c, out) => {
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) out.push(...P[a], ...P[b], c[0], c[1], c[2]);
  };
  const rect4 = (L, y, c, out) => { const x0 = L[0], z0 = L[1], x1 = L[2] + 1, z1 = L[3] + 1; out.push(x0, y, z0, x1, y, z0, ...c, x1, y, z0, x1, y, z1, ...c, x1, y, z1, x0, y, z1, ...c, x0, y, z1, x0, y, z0, ...c); };
  HOOK_WRAP('overlay', function (sc, eye, vp) {
    if (sc.type !== 'world') return true;
    const segs = [];
    const B = regionBox(); if (B && WM.region) { const y = WM.region.center[1] - 0.5; rect4([B[0], B[2], B[3] - 1, B[5] - 1], y, [0.25, 0.32, 0.42], segs); }
    for (const p of WM.plans) {
      if (p.status === 'built') continue;
      const m = meshFor(p); if (!m) continue;
      const P = placeOf(p, m), sel = p.id === WM.sel, c = sel ? [1, 0.84, 0.25] : p.status === 'pending' ? [0.45, 0.75, 1] : [0.36, 1, 0.8];
      rect4(P.lot, p.F + 0.03, c, segs);
      if (sel) { box12(P.lot[0], p.F - 1, P.lot[1], P.lot[2] + 1, p.F + m.top + 1, P.lot[3] + 1, c, segs); if (lotBased(p)) rect4(P.rect(0, -1, m.lot[0] - 1, -1), p.F + 0.05, [1, 0.6, 0.2], segs); }
    }
    if (WM.tool && WM.ghost) {
      const m = meshFor(WM.tool); if (m) { const gp = WM.ghost, P = placeOf(gp, m), c = gp.ok ? [0.36, 1, 1] : [1, 0.35, 0.3]; rect4(P.lot, gp.F + 0.04, c, segs); if (lotBased(gp)) rect4(P.rect(0, -1, m.lot[0] - 1, -1), gp.F + 0.06, [1, 0.6, 0.2], segs); }
    }
    C.drawLines(segs, vp, eye, true);
    return true;
  });

  // ---------------------------------------------------------------- left: worlds, then what to place
  HOOK_WRAP('chips', function () {
    const el = $('#chips'); el.innerHTML = '';
    if (!WM.world) return true;
    const own = Object.keys((VR.CUSTOM && VR.CUSTOM.models) || {});
    const nFurn = Object.keys(VM.MODELS).filter(n => !C.isFacade(n)).length;
    const nStyle = WM.styleDraft ? WM.styleDraft.rules.length : WM.style && WM.style.rules ? WM.style.rules.length : 0;
    const tabs = [['bench', '🧰 Werkbank', WM.wb && WM.wb.pendingN ? '⏳' + WM.wb.pendingN : ''], ['houses', 'Häuser', HOUSES.length], ['furn', 'Möbel', own.length ? own.length + ' ✏️ · ' + nFurn : nFurn], ['plan', 'Plan', WM.plans.length], ['style', '🎨 Stil', nStyle || ''], ['worlds', 'Welten', WM.worlds ? WM.worlds.length : '']];
    for (const [id, label, n] of tabs) { if ((id === 'style' && !WM.styleUI) || (id === 'bench' && !WM.benchUI)) continue; const b = document.createElement('button'); b.className = WM.tab === id ? 'on' : ''; b.innerHTML = label + '<b>' + n + '</b>'; b.onclick = () => { if (id === 'worlds') { keepWorld(true); WM.world = null; freeRegion(); C.setScene(null); refresh(); listWorlds().then(refresh); return; } WM.tab = id; refresh(); }; el.appendChild(b); }
    return true;
  });
  HOOK_WRAP('list', function () {
    const el = $('#list'); el.innerHTML = ''; el.classList.remove('palette'); el.classList.add('houses');
    if (!WM.world) {
      const h = document.createElement('div'); h.className = 'grp'; h.textContent = 'Deine Welten'; el.appendChild(h);
      if (!WM.worlds) { const d = document.createElement('div'); d.className = 'note dim'; d.textContent = 'Welten werden gelesen …'; el.appendChild(d); return true; }
      if (!WM.worlds.length) {
        const d = document.createElement('div'); d.className = 'note';
        if (SA) {
          // this Studio is its own page with its own storage: the worlds are in the game's
          d.innerHTML = 'Deine Welten leben im Spiel — dieses Studio ist nicht mit ihm verbunden. Im Spiel: <b>⏸ → 🏗 Bauen</b>, dort setzt du direkt in deine Welt.';
          el.appendChild(d);
          const b = document.createElement('button'); b.className = 'cbtn pri'; b.dataset.act = 'game'; b.textContent = '🎮 Zum Spiel';
          b.onclick = () => { if (VR.StudioBridge) VR.StudioBridge.toGame(b); else if (GAME_URL) window.open(GAME_URL, '_blank', 'noopener'); };
          const r = document.createElement('div'); r.className = 'crow'; r.appendChild(b); el.appendChild(r);
        } else { d.innerHTML = 'Noch keine Welt gespeichert. Lege im Spiel eine Welt an — das Studio im Spiel (⏸ → 🏗 Bauen) sieht dieselben Welten.'; el.appendChild(d); }
        return true;
      }
      for (const w of WM.worlds) {
        const c = document.createElement('div'); c.className = 'card world';
        const pos = w.player && w.player.pos ? w.player.pos.map(v => Math.round(v)).join(' · ') : 'Spawn';
        const plans = (lsGet(PLAN_KEY(w.id)) || { plans: [] }).plans || [], pend = plans.filter(p => p.status === 'pending').length, built = plans.filter(p => p.status === 'built').length;
        c.innerHTML = `<div class="cap"><div class="n">${esc(w.name || 'Welt')}</div><div class="s">${esc(w.type || 'default')} · ${w.mode || ''} · Seed ${w.seed >>> 0}</div><div class="s">zuletzt ${w.lastPlayed ? new Date(w.lastPlayed).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'} · bei ${pos}</div>${pend || built ? `<div class="s">${built} gebaut · ${pend} im Plan</div>` : ''}</div>`;
        c.onclick = () => openWorld(w);
        el.appendChild(c);
      }
      return true;
    }
    const f = S.filter;
    if (WM.tab === 'houses') {
      const CATL = VR.StudioCatalog, favL = VR.Favs ? VR.Favs.list() : [];
      const card = (h) => {
        if (f && !(h.name + ' ' + h.sub).toLowerCase().includes(f)) return;
        const rec = C.HOUSE.get(h.i), own = designOf(h.i);
        const c = document.createElement('div'); c.className = 'card house' + (WM.tool && WM.tool.kind === 'house' && WM.tool.index === h.i ? ' on' : ''); c.dataset.house = h.i;
        if (rec && rec.thumb) { const cc = rec.thumb.cloneNode(true); cc.getContext('2d').drawImage(rec.thumb, 0, 0); cc.className = 'th'; c.appendChild(cc); } else { const ph = document.createElement('div'); ph.className = 'th'; c.appendChild(ph); }
        c.insertAdjacentHTML('beforeend', `<div class="cap"><div class="n">${h.name}${own ? ' <span class="star" title="dein Design">✏️</span>' : ''}</div><div class="s">${own ? 'dein Design' : h.sub}</div></div>`);
        c.onclick = () => { WM.tool = houseItem(h.i); WM.ghost = null; WM.sel = null; meshFor(WM.tool); refresh(); tip('Zeig auf den Boden — Klick setzt, R / ↻ dreht, F / ◐ Fassade, Esc fertig', true); };
        if (CATL && CATL.favButton) c.appendChild(CATL.favButton(C.favHouse(h.i), () => { listSig = ''; refresh(); }));
        const e = document.createElement('button'); e.className = 'editb'; e.textContent = '✏️'; e.title = 'Bearbeiten — im Crafter umbauen'; e.onclick = (ev) => { ev.stopPropagation(); C.editHouse(h.i); }; c.appendChild(e);
        el.appendChild(c);
      };
      const grp = (t) => { const g = document.createElement('div'); g.className = 'grp'; g.textContent = t; el.appendChild(g); };
      // ★ your favourite houses first (the same ★ as in Architektur and in the game's ★ tab)
      const favH = favL.map(id => /^blueprint_(\d+)$/.exec(id)).filter(Boolean).map(m => HOUSES.find(h => h.i === +m[1])).filter(Boolean);
      if (favH.length) { grp('★ Favoriten'); for (const h of favH) card(h); grp('Alle Häuser'); }
      for (const h of HOUSES) card(h);
      return true;
    }
    if (WM.tab === 'furn') {
      const own = Object.keys((VR.CUSTOM && VR.CUSTOM.models) || {}).filter(n => VM.MODELS[n]);
      const all = Object.keys(VM.MODELS).filter(n => !C.isFacade(n) && !own.includes(n));
      const CATL = VR.StudioCatalog;
      const add = (n, star) => {
        const md = VM.MODELS[n]; if (f && !(n + ' ' + md.display).toLowerCase().includes(f)) return;
        const c = document.createElement('div'); c.className = 'card' + (WM.tool && WM.tool.kind === 'model' && WM.tool.name === n ? ' on' : '');
        const th = C.THUMB.get(n); if (th) { const cc = th.cloneNode(true); cc.getContext('2d').drawImage(th, 0, 0); cc.className = 'th'; c.appendChild(cc); } else { const ph = document.createElement('div'); ph.className = 'th'; c.appendChild(ph); thq.push([c, n]); }
        c.insertAdjacentHTML('beforeend', `<div class="cap"><div class="n">${esc(md.display)}${star ? ' <span class="star" title="dein Design">✏️</span>' : ''}</div><div class="s">${md.W}×${md.H}×${md.D}</div></div>`);
        if (CATL && CATL.favButton) c.appendChild(CATL.favButton(n, () => refresh()));
        { const e = document.createElement('button'); e.className = 'editb'; e.textContent = '✏️'; e.title = 'Bearbeiten — im Crafter verschönern'; e.onclick = (ev) => { ev.stopPropagation(); C.editModel(n); }; c.appendChild(e); }
        c.onclick = () => { WM.tool = { kind: 'model', name: n }; WM.ghost = null; WM.sel = null; meshFor(WM.tool); refresh(); tip('Zeig auf den Boden — Klick setzt, R dreht, Esc fertig', true); };
        el.appendChild(c);
      };
      // ★ your favourite pieces first (the same ★ as everywhere: Teile, Crafter, Werkbank, the game)
      const favs = VR.Favs ? VR.Favs.list().filter(n => VM.MODELS[n] && !C.isFacade(n)) : [];
      const grp = (t) => { const g = document.createElement('div'); g.className = 'grp'; g.textContent = t; el.appendChild(g); };
      if (favs.length) { grp('★ Favoriten'); for (const n of favs) add(n, own.includes(n)); }
      if (own.length) { grp('Deine Designs'); for (const n of own) add(n, true); }
      grp('Alle Möbel');
      for (const n of all) add(n, false);
      return true;
    }
    // the plan
    if (!WM.plans.length) { const d = document.createElement('div'); d.className = 'note dim'; d.textContent = 'Noch nichts geplant — links ein Haus wählen und auf den Boden zeigen.'; el.appendChild(d); return true; }
    for (const p of WM.plans) {
      const d = document.createElement('div'); d.className = 'design' + (p.id === WM.sel ? ' on' : '');
      const nm = nameOf(p);
      const st = p.status === 'built' ? '<span class="good">im Spiel gebaut</span>' : p.status === 'pending' ? '<span class="pend">übergeben · wartet aufs Spiel</span>' : 'Entwurf';
      d.innerHTML = `<span class="ic">${p.kind === 'house' ? '◈' : p.kind === 'forge' ? '🏭' : '▣'}</span><span class="n">${esc(nm)}<small>${p.ox} · ${p.F} · ${p.oz} · ${p.r * 90}° · ${st}</small></span>`;
      d.onclick = () => { WM.sel = p.id; const m = meshFor(p); if (m && S.scene) { const L = placeOf(p, m).lot; S.scene.center = [(L[0] + L[2] + 1) / 2, p.F + 2, (L[1] + L[3] + 1) / 2]; } refresh(); };
      el.appendChild(d);
    }
    return true;
  });
  // ★ changed elsewhere (Teile, the Crafter, the game in another tab): the furniture list follows
  if (VR.Favs) VR.Favs.on(() => { if (WM.on && (WM.tab === 'furn' || WM.tab === 'houses')) refresh(); });
  // furniture thumbnails, a couple per frame while the list is open
  const thq = [];
  (function pump() {
    let k = 0;
    while (thq.length && k < 2) {
      const [card, n] = thq.shift(); if (!card.isConnected) continue;
      const th = C.thumbOf ? C.thumbOf(n) : null; if (!th) continue;
      const old = card.querySelector('.th'), cc = th.cloneNode(true); cc.getContext('2d').drawImage(th, 0, 0); cc.className = 'th';
      if (old) old.replaceWith(cc); else card.prepend(cc);
      k++;
    }
    requestAnimationFrame(pump);
  })();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- right: the world, the selection, Übernehmen
  HOOK_WRAP('parts', function () {
    const el = $('#partsBody'); el.innerHTML = ''; el.classList.remove('empty');
    const H = (t, b) => { const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = t + (b !== undefined ? ' <b>' + b + '</b>' : ''); el.appendChild(d); };
    const btn = (label, cls, fn, title) => { const b = document.createElement('button'); b.className = 'cbtn ' + (cls || ''); b.innerHTML = label; if (title) b.title = title; b.onclick = fn; return b; };
    const row = (...bs) => { const r = document.createElement('div'); r.className = 'crow'; for (const b of bs) r.appendChild(b); el.appendChild(r); };
    const note = (html, cls) => { const p = document.createElement('div'); p.className = 'note' + (cls ? ' ' + cls : ''); p.innerHTML = html; el.appendChild(p); };
    if (!WM.world) {
      H('Welt-Modus');
      note('Öffne links eine deiner R9-SI-Welten. Das Studio zeigt die Gegend um deine letzte Position — dort setzt du Häuser und Möbel, drehst, klonst und verschiebst sie: <b>📍 Setzen</b> gibt sie ans Spiel, es baut alles, sobald die Gegend geladen ist.');   // (W1 §6: one word)
      if (!window.__R9_IN_GAME) note('Dieses Studio läuft getrennt vom Spiel und sieht deshalb keine Welten. Im Spiel: <b>⏸ → 🏗 Bauen</b>.', 'warn');
      if (WM.imagine) {
        H('✨ Erschaffen');
        const mk = document.createElement('div'); mk.className = 'wbMake';
        const m = (ic, label, sub, fn, cls) => { const b = document.createElement('button'); b.className = cls || ''; b.innerHTML = `<i>${ic}</i><span>${label}</span><small>${sub}</small>`; b.onclick = fn; mk.appendChild(b); };
        m('🏠', 'Haus', 'Baukasten', () => WM.imagine.open(null, 'house'));
        if (WM.imagine.aiOK) m('✨', 'Genie', 'Foto / Text → 3D', () => WM.imagine.open(null, 'genie'), 'hot');
        m('🖼', 'Bild → 3D', 'Blockbild, Ansichten', () => WM.imagine.open(null, 'flat'));
        el.appendChild(mk);
        note('Auch ohne Welt: als Bauteil behalten oder als .schem / .vox / .json speichern.', 'dim');
      }
      return true;
    }
    const w = WM.world, pend = WM.plans.filter(p => p.status === 'pending').length, drafts = WM.plans.filter(p => p.status === 'draft').length, built = WM.plans.filter(p => p.status === 'built').length;
    H('Welt', esc(w.name));
    const kv = document.createElement('div'); kv.className = 'kv';
    kv.innerHTML = `<span>Art</span><b>${esc(w.type || 'default')} · Seed ${w.seed >>> 0}</b><span>Gegend</span><b>${N} × ${N} Chunks (${N * 16} × ${N * 16} Blöcke)${WM.loading ? ' · lädt ' + Math.round(100 * WM.loading.done / Math.max(1, WM.loading.total)) + ' %' : ''}</b><span>Plan</span><b>${drafts} Entwurf · ${pend} übergeben · ${built} gebaut</b>`;
    el.appendChild(kv);
    const dt = dirty();
    row(btn(`📍 Alle setzen${drafts ? ' (' + drafts + ')' : ''}`, 'pri' + (dt ? ' glow' : ''), () => commit(), 'Gibt den Plan ans Spiel — es baut alles, sobald die Gegend geladen ist'));   // (W1 §6: one word — the Karte view sets at once)
    if (dt) note('Änderungen sind noch nicht beim Spiel — <b>📍 Alle setzen</b> gibt sie weiter.', 'warn');
    row(btn('⟳ Gegend neu laden', '', () => openWorld(WM.world), 'Liest die Welt neu (nachdem das Spiel gespeichert hat)'), btn('◂ Andere Welt', '', () => { keepWorld(true); WM.world = null; freeRegion(); C.setScene(null); refresh(); listWorlds().then(refresh); }));
    row(btn('⟲ Rückgängig', '', () => undo(false), 'Strg+Z'), btn('⟳ Wiederholen', '', () => undo(true), 'Strg+Y'));
    const p = selPlan();
    if (WM.tool) {
      const m = meshFor(WM.tool), nm = nameOf(WM.tool);
      H('Setzen', esc(nm || ''));
      note(m ? `Zeig auf den Boden: Klick setzt · <b>R</b>/Shift+Rad dreht · ${WM.tool.kind === 'house' ? (designOf(WM.tool.index) ? '<b>✏️ dein Design</b>' : '<b>F</b> Fassade (' + esc(WM.tool.skin) + (WM.tool.mirror ? ', gespiegelt' : '') + ')') : ''} · <b>Esc</b> / Rechtsklick fertig` : 'wird vorbereitet …');
      // the keys as buttons too: ↻ (R), ◐ (F)
      const rb = btn('↻ Drehen · R', '', () => { rotateCurrent(); refresh(); }); rb.dataset.act = 'wrot';
      const fb = WM.tool.kind === 'house' && !designOf(WM.tool.index) ? btn('◐ Fassade · F', '', () => { if (cycleFacade(WM.tool)) { WM.ghost = null; refresh(); } }) : null; if (fb) fb.dataset.act = 'wfac';
      if (fb) row(rb, fb); else row(rb);
      row(btn('✕ Fertig', '', () => { WM.tool = null; WM.ghost = null; refresh(); }));
    } else if (p) {
      const m = meshFor(p), nm = nameOf(p);
      H('Auswahl', esc(nm || ''));
      const k2 = document.createElement('div'); k2.className = 'kv';
      k2.innerHTML = `<span>Position</span><b>${p.ox} · ${p.F} · ${p.oz}</b><span>Drehung</span><b>${p.r * 90}°</b><span>Status</span><b>${p.status === 'built' ? 'im Spiel gebaut' : p.status === 'pending' ? 'übergeben' : 'Entwurf'}</b>${m ? `<span>Größe</span><b>${m.lot[0]} × ${m.lot[1]} · ${m.top + 1} hoch</b>` : ''}`;
      el.appendChild(k2);
      if (editable(p)) {
        row(btn('↻ Drehen · R', '', rotateCurrent), btn('⧉ Klonen · Strg+D', '', () => { if (m) change(() => clonePlan(p, m), 'Geklont'); }));
        row(btn('▲ Höher', '', () => change(() => { p.F++; })), btn('▼ Tiefer', '', () => change(() => { p.F--; })), btn('✕ Löschen', '', () => change(() => { WM.plans = WM.plans.filter(q => q !== p); WM.sel = null; }, 'Entfernt')));
        if (p.kind === 'house' && !designOf(p.index)) row(btn('◐ Fassade · F', '', () => change(() => cycleFacade(p), 'Fassade gewechselt')));
      } else note('Schon im Spiel gebaut — dort mit Baustein für Baustein oder /undo ändern.', 'dim');
    }
    H('So geht’s');
    note('<b>Häuser</b>/<b>Möbel</b> links wählen → auf den Boden zeigen → Klick. Gesetztes anklicken: <b>ziehen</b> verschiebt, <b>Alt+Ziehen</b> klont, <b>R</b> dreht, <b>Strg+D</b> klont, <b>Bild↑/↓</b> Höhe, <b>Pfeile</b> 1 Block, <b>Entf</b> löscht. Kamera: Ziehen dreht, Shift+Ziehen schiebt, Rad zoomt, <b>WASD/Q/E</b> fährt.');
    note(window.__R9_IN_GAME ? 'Nach <b>📍 Alle setzen</b> (oder ▶ Spielen) baut das Spiel jedes Teil, sobald seine Gegend geladen ist — ist die Welt gerade im Spiel offen, sofort. Das Gelände wird dabei angepasst wie bei den Bauplänen.' : 'Achtung: Dieses Studio teilt den Speicher nicht mit dem Spiel — im Spiel: ⏸ → 🏗 Bauen.', window.__R9_IN_GAME ? '' : 'warn');
    return true;
  });
  HOOK_WRAP('hud', function () {
    if (!WM.world) { $('#hudName').textContent = 'Welt'; $('#hudMeta').innerHTML = WM.worlds ? `<b>${WM.worlds.length}</b> gespeicherte Welten` : 'liest …'; return true; }
    const hv = WM.hover, load = WM.loading;
    $('#hudName').textContent = 'Welt · ' + WM.world.name;
    $('#hudMeta').innerHTML = (load ? `lädt <b>${Math.round(100 * load.done / Math.max(1, load.total))} %</b> · ` : '') + `<b>${WM.plans.filter(p => p.status !== 'built').length}</b> im Plan` + (hv ? ` · Boden <span class="dim">${hv.x} · ${hv.y} · ${hv.z}</span>` : '') + (WM.tool ? ' · <span class="warn">setzen</span>' : '');
    return true;
  });

  // ---------------------------------------------------------------- the mode
  // the left list only re-renders when what it shows changed (no flicker while placing and dragging)
  let listSig = '', listTab = '';
  function refresh() {
    if (!WM.on) return;
    const sig = [WM.world ? WM.world.id : '-', WM.tab, WM.worlds ? WM.worlds.length : -1, WM.tool ? meshKey(WM.tool) : '', S.filter, C.HOUSE.size, WM.tab === 'plan' ? JSON.stringify(WM.plans.map(p => [p.id, p.ox, p.oz, p.F, p.r, p.status])) + WM.sel : '', Object.keys((VR.CUSTOM && VR.CUSTOM.models) || {}).length, (WM.tab === 'furn' || WM.tab === 'houses') && VR.Favs ? VR.Favs.list().join(',') : ''].join('|');
    if (sig !== listSig) {
      const tabKey = (WM.world ? WM.world.id : '-') + '|' + WM.tab;
      $('#list').classList.toggle('still', tabKey === listTab);
      listSig = sig; listTab = tabKey;
      C.chips(); C.list();
    }
    C.parts(); C.hud(); help();
  }
  function help() {
    let h = $('#worldHelp'); if (!h) { h = document.createElement('div'); h.id = 'worldHelp'; $('main').appendChild(h); }
    h.classList.toggle('on', WM.on && !!WM.world);
    h.innerHTML = WM.tool ? '<b>Klick</b> setzen · <b>R</b> drehen · <b>F</b> Fassade · <b>Esc</b> fertig · Ziehen dreht die Ansicht' : '<b>Klick</b> wählen · <b>Ziehen</b> (Auswahl) verschieben · <b>Alt+Ziehen</b> klonen · <b>R</b> drehen · <b>Strg+D</b> klonen · <b>Bild↑/↓</b> Höhe · <b>Entf</b> löschen · <b>Strg+Z/Y</b>';
  }
  let tipT = 0;
  function tip(text, ok) { let t = $('#worldTip'); if (!t) { t = document.createElement('div'); t.id = 'worldTip'; $('main').appendChild(t); } t.textContent = text; t.className = 'on' + (ok === false ? ' err' : ok ? ' ok' : ''); clearTimeout(tipT); tipT = setTimeout(() => { t.className = ''; }, 2600); }
  C.MODES.world = {
    enter() {
      WM.on = true; S.mode = 'world'; S.cat = 'all'; listSig = ''; listTab = '';
      for (const b of $$('nav.modes button')) b.classList.toggle('on', b.dataset.mode === 'world');
      for (const t of $$('.tab')) t.classList.toggle('on', t.dataset.pane === 'parts');
      for (const p of $$('.pane')) p.classList.toggle('on', p.id === 'parts');
      $('#studio').classList.add('worlding');
      if (WM.world && WM.region) { C.setScene({ type: 'world', name: WM.world.name, gpu: WM.gpu, off: [0, 0, 0], center: WM.region.center.slice(), span: 46, groundY: WM.region.center[1], noGrid: true, instances: [] }); S.cam.yaw = 0.62; S.cam.pitch = 0.78; }
      else C.setScene(null);
      refresh();
      if (!WM.world) listWorlds().then(refresh);
    },
    leave() { keepWorld(true); WM.on = false; WM.tool = null; WM.ghost = null; $('#studio').classList.remove('worlding'); const h = $('#worldHelp'); if (h) h.classList.remove('on'); },
  };
  HOOK_WRAP('dblclick', function () { return !!WM.tool; });   // with a piece in hand a click places: no fly-to then
  HOOK_WRAP('pickPoint', function (e) { if (!WM.region) return null; const g = pickGround(rayFromMouse(e)); return g ? [g.px, g.py, g.pz] : null; });
  // hooks are shared with the Crafter: the World mode answers while it is on, everything else goes through
  function HOOK_WRAP(name, fn) {
    const prev = HOOK[name];
    HOOK[name] = function (...a) { if (WM.on && S.mode === 'world') { const r = fn.apply(null, a); if (r !== false) return r; } return prev ? prev.apply(null, a) : false; };
  }
  // ---------------------------------------------------------------- 🕘 Weitermachen: the worlds you worked in
  // A world becomes a project once something changed in it here (the Werkbank, a plan, a place); it keeps the view
  // and the tab, and opening it from 🕘 goes back there.
  const PJ = () => VR.Projects;
  const TL = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  function keepWorld(pic) {
    const P = PJ(); if (!P || !WM.world || !WM.region || WM.loading) return;
    const id = 'w:' + WM.world.id, p = P.get(id), edited = (WM.editT || 0) > ((p && p.t) || 0);
    if (!p && !edited) return;
    const sc = S.scene, onIt = !!(sc && sc.type === 'world' && sc.center && WM.on);
    const view = onIt ? { center: sc.center.slice(), yaw: S.cam.yaw, pitch: S.cam.pitch, dist: S.cam.dist || 0, tab: WM.tab } : (p && p.view) || null;
    P.put(id, { kind: 'world', name: WM.world.name || 'Welt', ref: { id: WM.world.id }, view, info: { plans: WM.plans.filter(q => q.status !== 'built').length } }, { touch: edited });
    if (pic && onIt) { try { const c = C.renderThumb(sc, 480, 300, { yaw: S.cam.yaw, pitch: S.cam.pitch, dist: S.cam.dist || 0 }); P.thumb(id, c); } catch (e) { /* no picture then */ } }
  }
  // open a world by its id (the list is read first), on a tab; resolves when its region is there
  WM.openId = async function (id, tab) {
    if (S.mode !== 'world') C.setMode('world');
    for (let i = 0; i < 100 && !WM.worlds; i++) await new Promise(r => setTimeout(r, 150));
    const w = WM.worlds && WM.worlds.find(x => x.id === id); if (!w) return null;
    if (WM.world && WM.world.id === id && WM.region) {
      if (tab && WM.tab !== tab) { WM.tab = tab; refresh(); }
      for (let i = 0; i < 400 && WM.loading; i++) await new Promise(r => setTimeout(r, 150));
      return WM.world;
    }
    await openWorld(w, tab || null);
    return WM.world && WM.world.id === id && WM.region ? WM.world : null;
  };
  if (PJ()) {
    const P = PJ();
    P.kind('world', {
      icon: '🌍', label: TL('pj.k.world', 'Welt'),
      state(p) { const i = p.info || {}; return { live: true, status: '', sub: i.plans ? TL('pj.worldPlans', '{n} im Plan', { n: i.plans }) : '' }; },
      async open(p) {
        const v = p.view || {};
        const w = await WM.openId(p.ref.id, v.tab || null);
        if (!w) { C.sys(TL('pj.noWorld', 'Die Welt „{n}“ gibt es hier nicht', { n: P.nameOf(p) }), 'err'); return; }
        const sc = S.scene, box = regionBox(), num = Number.isFinite;
        if (sc && sc.type === 'world') {
          if (Array.isArray(v.center) && v.center.length === 3 && v.center.every(num) && box && v.center[0] >= box[0] && v.center[0] <= box[3] && v.center[2] >= box[2] && v.center[2] <= box[5]) sc.center = v.center.slice();
          if (num(v.yaw)) S.cam.yaw = v.yaw; if (num(v.pitch)) S.cam.pitch = v.pitch; if (num(v.dist)) S.cam.dist = v.dist;
        }
      },
      discard(p) { P.dropThumb(p.id); P.put(p.id, { hide: true, pin: false }, { touch: false }); },
      delTip: () => TL('pj.delWorld', 'Aus der Liste — die Welt selbst bleibt'),
    });
    P.onFlush((o) => { if (WM.on && WM.world) keepWorld(!!o.thumbs); });
  }
  WM.rayFromMouse = rayFromMouse; WM.tipW = tip; WM.regionBox = regionBox; WM.nameOf = nameOf;
  // 🏭 Forge: a structure by its DNA as the tool in hand (the Studio's Forge mode calls this with „📍 Setzen")
  // (the 🧰 Werkbank and 🎨 Stil tabs put their own tools in hand: a piece is set from the Häuser tab)
  WM.toolForge = function (dna) { if (!WM.world) return false; if (WM.tab === 'bench' || WM.tab === 'style' || WM.tab === 'worlds') WM.tab = 'houses'; WM.tool = { kind: 'forge', dna }; WM.ghost = null; WM.sel = null; meshFor(WM.tool); refresh(); tip('Zeig auf den Boden — Klick setzt, R / ↻ dreht, Esc fertig', true); return true; };
  WM.open = openWorld; WM.commit = commit; WM.list = listWorlds; WM.meshFor = meshFor; WM.houseItem = houseItem; WM.ghostAt = ghostAt; WM.pickGround = pickGround; WM.change = change; WM.clone = clonePlan; WM.rotate = rotatePlan; WM.refresh = refresh; WM.N = N; WM.getBlock = getBlock; WM.groundAt = groundAt; WM.placeOf = placeOf;
  // deep link: #world
  // deep links: #world · #world/<id> (the game's world list: "Plan in R9 Studio")
  window.addEventListener('load', () => setTimeout(async () => {
    const h = location.hash || ''; if (!h.startsWith('#world')) return;
    C.setMode('world');
    const parts = h.slice(7).split('/'), id = decodeURIComponent(parts[0] || ''); if (!id) return;
    for (let i = 0; i < 60 && !WM.worlds; i++) await new Promise(r => setTimeout(r, 150));
    const w = WM.worlds && WM.worlds.find(x => x.id === id); if (w) openWorld(w, parts[1] || null);
  }, 400));
})();

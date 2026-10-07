// 🏗 Baustelle (src/main/baustelle.js) in node, with the real blueprints.js and the real Forge, over a small fake world
// (a flat field with a hill, a tree and a hole on the lot, so the plan has earthworks and fill):
//  1. order: duplicates collapse (the last write wins, the undo keeps the first old value)
//  2. layer order of a real build (/bau Hochhaus 20 Stockwerke): every removal top-down first, then the fill and the
//     structure bottom-up — the layer of what is written never goes down; no write over 8 000 cells; it takes 6–20 s
//     and many writes (it grows, it does not pop)
//  3. completeness: the finished world is cell for cell the world Sofort builds (and Sofort is today's list)
//  4. undo in one step: after the build one Z takes all of it back to the field; Z in the middle of the build stops it
//     and puts back what was built — nothing is written after that, the plan is not built again
//  5. resume after a reload: a save in the middle finishes the build first (the saved world is the finished one, the
//     plan is marked built, a reload builds nothing more); a crash in the middle (no save) builds it again from the
//     last save — the same finished world
//  6. ⏩ Fertig: the rest at once, the same finished world
//  7. multiplayer: every written cell is told to the session (the guests end with the same cells)
//  8. a tiny piece (a bed) is a short magic moment, not a whole construction site
//   bash test/wt_run.sh baustelle.js
const V = require('./load_shared.js');
const store = new Map();
global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
require('../src/main/blueprints.js');
let loaded = true;
try { require('../src/main/baustelle.js'); } catch (e) { loaded = false; console.log('  (baustelle.js: ' + String(e && e.message || e).split('\n')[0] + ')'); }
const R = V.R, B0 = V.Blueprints;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
check(loaded && !!V.Baustelle, 'src/main/baustelle.js loads in node (VR.Baustelle)');
if (!loaded || !V.Baustelle) { console.log('FAILED ' + fails); process.exit(1); }

// ---------------------------------------------------------------- the fake world
const S = (n) => R.byName[n].defaultState;
const STONE = S('stone'), DIRT = S('dirt'), GRASS = S('grass_block'), LOG = S('oak_log'), LEAF = S('oak_leaves');
const OX = 0, OZ = 0, F0 = 4;
function base(x, y, z) {
  if (y < 0) return 0;
  // a hole on the lot (the lot is filled up to the yard), a hill (cut back), a tree (taken away)
  if (x >= OX + 3 && x <= OX + 8 && z >= OZ + 3 && z <= OZ + 7 && (y === 2 || y === 3)) return 0;
  if (y === 0) return STONE; if (y <= 2) return DIRT; if (y === 3) return GRASS;
  const hd = Math.hypot(x - (OX + 5), z - (OZ + 14)); const hh = Math.round(4 - hd * 0.8);
  if (hd < 5 && y >= 4 && y < 4 + hh) return STONE;
  if (x === OX + 15 && z === OZ + 4 && y >= 4 && y <= 8) return LOG;
  if (Math.abs(x - (OX + 15)) <= 2 && Math.abs(z - (OZ + 4)) <= 2 && y >= 7 && y <= 9 && !(x === OX + 15 && z === OZ + 4 && y <= 8)) return LEAF;
  return 0;
}
const K = (x, y, z) => ((x + 4096) * 8192 + (z + 4096)) * 4096 + y;
function makeWorld(edits) {
  const ed = new Map(edits || []);
  const cols = new Map();
  const w = {
    ed, listeners: [], writes: [], relit: 0, saves: 0,
    getBlock(x, y, z) { const k = K(x, y, z); return ed.has(k) ? ed.get(k) : base(x, y, z); },
    set(x, y, z, s) { const k = K(x, y, z); if (s === base(x, y, z)) ed.delete(k); else ed.set(k, s); },
    col(cx, cz) { const k = cx * 65536 + cz; let c = cols.get(k); if (!c) { c = { cx, cz, key: k, ready: true }; cols.set(k, c); } return c; },
    isLoaded() { return true; },
    topAt(x, z) { for (let y = 160; y >= 0; y--) if (this.getBlock(x, y, z)) return y; return 0; },
    bulkSet(list) { const t = new Set(); for (const [x, y, z, s] of list) { this.set(x, y, z, s); t.add(this.col(x >> 4, z >> 4)); } return t.size; },
    // the Baustelle's write: cells a … b of the list, the columns it touched collected (relit once at the end)
    buildSet(list, a, b, touched) { const cells = []; for (let k = a; k < b; k++) { const e = list[k]; cells.push([e[0], e[1], e[2], e[3]]); this.set(e[0], e[1], e[2], e[3]); const c = this.col(e[0] >> 4, e[2] >> 4); if (touched) touched.set(c.key, c); } this.writes.push(cells); return b - a; },
    relightColumns(cs) { this.relit += cs.length; },
    saveAll() { for (const l of this.listeners) if (l.onBeforeSave) l.onBeforeSave(this); this.saves++; return Promise.resolve(); },
    snapshot() { return new Map(ed); },
  };
  return w;
}
const BOX = [OX - 7, F0 - 50, OZ - 7, OX + 27, F0 + 116, OZ + 27];
function diff(wa, wb) {
  let n = 0, first = null;
  for (let y = BOX[1]; y <= BOX[4]; y++) for (let z = BOX[2]; z <= BOX[5]; z++) for (let x = BOX[0]; x <= BOX[3]; x++) {
    const a = wa.getBlock(x, y, z), b = wb.getBlock(x, y, z);
    if (a !== b) { n++; if (!first) first = [x, y, z, a, b]; }
  }
  return { n, first };
}
// ---------------------------------------------------------------- the game around it
const DNA = V.Forge.fromText('Hochhaus 20 Stockwerke');
function makeGame(world, mode, plans) {
  const told = [];
  const g = {
    world, state: 'play', meta: { id: 'wtest' }, time: 0,
    settings: { bau: mode, preset: 'balanced', particles: 2 },
    pool: { direct(n, msg, tr, cb) { if (msg.type === 'forge') cb(V.Forge.job(msg)); else cb({ type: msg.type, error: 'not here' }); } },
    ui: { toast() {}, hint() {}, chatLine() {} }, audio: { play() {}, place() {}, loop() {}, tone() {} },
    player: { pos: [OX + 10, F0 + 1, OZ - 40], creative: true, unstick() {} },
    mp: { active: true, onBlockChanged(x, y, z, old, s) { told.push([x, y, z, s]); } },
  };
  const gad = {
    g, wand: { undo: [] }, noteBlock() {},
    applyEdit(list, undo) { world.bulkSet(list, false); if (undo) this.wand.undo.push(undo); },
    // (Gadgets.undo: the step goes back, then a site that owns it hears of it)
    undo() { const u = this.wand.undo.pop(); if (!u) return; world.bulkSet(u, false); if (u.onUndo) u.onUndo(u); },
  };
  store.set('r9si.plans.wtest', JSON.stringify({ v: 1, world: 'wtest', plans }));
  const B = new B0(gad); gad.blue = B;
  B.loadPlans();
  return { g, gad, B, told };
}
const planOf = () => [{ id: 'p1', kind: 'forge', dna: DNA, ox: OX, oz: OZ, F: F0, r: 0, status: 'pending', t: 1 }];
const status = () => JSON.parse(store.get('r9si.plans.wtest')).plans.map(p => p.status).join(',');
// one frame of the game: the plan ticker (it calls the slices / the site itself)
function frame(G, dt) { G.g.time += dt; G.B.tickPlans(dt); }
function runUntil(G, dt, pred, maxT) { let t = 0; while (t < maxT && !pred(t)) { frame(G, dt); t += dt; } return t; }

// ---------------------------------------------------------------- 1 · order
{
  const L = [[0, 5, 0, STONE], [1, 9, 0, 0], [0, 5, 0, DIRT], [2, 4, 0, GRASS], [1, 12, 0, 0], [3, 2, 0, DIRT]];
  const U = [[0, 5, 0, 0], [1, 9, 0, LOG], [0, 5, 0, 0], [2, 4, 0, 0], [1, 12, 0, LEAF], [3, 2, 0, 0]];
  const o = V.Baustelle.order(L, U, 4);
  const at = (x, y) => o.list.findIndex(e => e[0] === x && e[1] === y);
  check(o.list.length === 5 && o.list[at(0, 5)][3] === DIRT && o.undo[at(0, 5)][3] === 0, 'order: a cell written twice keeps the last state, its undo the first old one (' + o.list.length + ' cells)');
  check(at(1, 12) === 0 && at(1, 9) === 1 && at(3, 2) === 2 && at(2, 4) === 3 && at(0, 5) === 4, 'order: removals top-down first, then the fill under the floor, then the structure bottom-up: ' + JSON.stringify(o.list.map(e => e[1] + (e[3] ? '+' : '-'))));
  check(o.list.every((e, i) => o.undo[i][0] === e[0] && o.undo[i][1] === e[1] && o.undo[i][2] === e[2]), 'order: the undo stays parallel to the list');
}

// ---------------------------------------------------------------- 3 · Sofort (today's builder) — the reference
const WS = makeWorld(), GS = makeGame(WS, 'instant', planOf());
const tS = runUntil(GS, 0.05, () => /built/.test(status()), 60);
check(/built/.test(status()), 'Sofort builds the tower (' + tS.toFixed(2) + ' s, ' + WS.ed.size + ' cells differ from the field)');
check(GS.gad.wand.undo.length === 1 && GS.gad.wand.undo[0].length > 15000, 'Sofort: one undo step (' + (GS.gad.wand.undo[0] || []).length + ' cells)');
check(tS < 2, 'Sofort is quick (' + tS.toFixed(2) + ' s of game time)');
// the list Sofort used is today's list: the field plus planAt is the reference world
const WT = makeWorld(), GT = makeGame(WT, 'instant', planOf());
{
  const pl = GT.B.plans[0], bp = GT.B.planPiece(pl) || GT.B.planPiece(pl), ROT = [(u, v) => [u, v]];   // (the worker answers at once here: the second call reads its cache)
  const rect = (u0, v0, u1, v1) => { const a = ROT[0](u0, v0), b = ROT[0](u1, v1); return [pl.ox + Math.min(a[0], b[0]), pl.oz + Math.min(a[1], b[1]), pl.ox + Math.max(a[0], b[0]), pl.oz + Math.max(a[1], b[1])]; };
  const [x0, z0, x1, z1] = rect(0, 0, bp.lot[0] - 1, bp.lot[1] - 1);
  const { list } = GT.B.planAt({ bp, r: 0, ox: pl.ox, oz: pl.oz, F: pl.F, x0, z0, x1, z1, rect, ok: true });
  for (const [x, y, z, s] of list) WT.set(x, y, z, s);
  const d = diff(WS, WT);
  check(d.n === 0, 'Sofort is exactly today\'s list (planAt): ' + d.n + ' cells differ' + (d.first ? ' ' + JSON.stringify(d.first) : ''));
}

// ---------------------------------------------------------------- 2 + 3 · Baustelle
const WB = makeWorld(), GB = makeGame(WB, 'site', planOf());
let startT = -1;
const tB = runUntil(GB, 1 / 30, (t) => { if (startT < 0 && GB.B.slices) startT = t; return /built/.test(status()); }, 60);
const dur = tB - startT;
check(/built/.test(status()), 'Baustelle builds the tower (' + WB.writes.length + ' writes)');
check(dur >= 6 && dur <= 20, 'it takes 6–20 s: ' + dur.toFixed(1) + ' s');
check(WB.writes.length >= 40, 'it grows in many writes (' + WB.writes.length + '), it does not pop');
check(WB.writes.every(c => c.length <= 8000), 'no write over 8 000 cells (largest ' + Math.max(...WB.writes.map(c => c.length)) + ')');
{
  const seq = [].concat(...WB.writes);
  const firstStruct = seq.findIndex(e => e[3] && e[1] >= F0), lastRemove = seq.reduce((m, e, i) => (e[3] ? m : i), -1);
  let downR = 0, downB = 0, prevR = Infinity, prevB = -Infinity, fillAfter = 0;
  for (let i = 0; i < seq.length; i++) {
    const e = seq[i];
    if (!e[3]) { if (e[1] > prevR) downR++; prevR = e[1]; continue; }
    if (e[1] < prevB) downB++; prevB = e[1];
    if (e[1] < F0 && i > firstStruct && firstStruct >= 0) fillAfter++;
  }
  const nR = seq.filter(e => !e[3]).length, nF = seq.filter(e => e[3] && e[1] < F0).length;
  check(nR > 20 && nF > 20, 'the plan has earthworks: ' + nR + ' cells taken away, ' + nF + ' filled under the floor');
  check(lastRemove < firstStruct && downR === 0, 'every removal comes first, top-down (last removal #' + lastRemove + ', first structure cell #' + firstStruct + ', ' + downR + ' steps up)');
  check(downB === 0 && fillAfter === 0, 'then the fill and the structure bottom-up: the layer never goes down (' + downB + ' steps down, ' + fillAfter + ' fill cells late)');
  check(seq.length === GB.gad.wand.undo[0].length, 'every cell is written once (' + seq.length + ' writes = ' + GB.gad.wand.undo[0].length + ' cells)');
  const told = new Map(); for (const e of GB.told) told.set(K(e[0], e[1], e[2]), e[3]);
  let bad = 0; for (const e of seq) if (told.get(K(e[0], e[1], e[2])) !== WB.getBlock(e[0], e[1], e[2])) bad++;
  check(GB.told.length >= seq.length && bad === 0, 'multiplayer: every written cell is told to the session (' + GB.told.length + ' told, ' + bad + ' differ from the world)');
}
{
  const d = diff(WB, WS);
  check(d.n === 0, 'the finished Baustelle is cell for cell what Sofort builds (' + d.n + ' cells differ' + (d.first ? ' ' + JSON.stringify(d.first) : '') + ')');
  check(WB.relit > 0, 'the touched columns are relit when it is done (' + WB.relit + ')');
}
// ---------------------------------------------------------------- 4 · undo in one step
{
  check(GB.gad.wand.undo.length === 1, 'the Baustelle leaves one undo step (' + GB.gad.wand.undo.length + ')');
  GB.gad.undo();
  const d = diff(WB, makeWorld());
  check(d.n === 0, 'one Z takes the whole tower back to the field (' + d.n + ' cells differ)');
}
{
  const W = makeWorld(), G = makeGame(W, 'site', planOf());
  runUntil(G, 1 / 30, () => G.B.slices && G.B.slices.at > G.B.slices.list.length * 0.4, 30);
  const at = G.B.slices ? G.B.slices.at : -1;
  check(at > 0 && G.gad.wand.undo.length === 1, 'in the middle of the build (' + at + ' cells in) its undo is already the top step');
  G.gad.undo();
  const n0 = W.writes.length;
  check(diff(W, makeWorld()).n === 0, 'Z in the middle puts back what was built: the field again');
  runUntil(G, 1 / 30, () => false, 25);
  check(W.writes.length === n0 && !G.B.slices && diff(W, makeWorld()).n === 0, 'nothing is written after that (' + (W.writes.length - n0) + ' more writes)');
  check(/built/.test(status()), 'and the plan is not built again (' + status() + ')');
}
// ---------------------------------------------------------------- 5 · resume after a reload
{
  const W = makeWorld(), G = makeGame(W, 'site', planOf());
  runUntil(G, 1 / 30, () => G.B.slices && G.B.slices.at > G.B.slices.list.length * 0.5, 30);
  check(!!G.B.slices && G.B.siteBusy && G.B.siteBusy(), 'half built: the site is busy (the autosave waits)');
  W.saveAll();
  const saved = W.snapshot(), st = status();
  check(!G.B.slices && /built/.test(st), 'a save in the middle finishes the build first (plan ' + st + ')');
  const WR = makeWorld(saved);
  check(diff(WR, WS).n === 0, 'the saved world is the finished building, cell for cell');
  const GR = makeGame(WR, 'site', JSON.parse(store.get('r9si.plans.wtest')).plans);
  runUntil(GR, 1 / 30, () => false, 12);
  check(WR.writes.length === 0 && diff(WR, WS).n === 0, 'after the reload nothing is built again (' + WR.writes.length + ' writes)');
}
{
  const W = makeWorld(), G = makeGame(W, 'site', planOf());
  runUntil(G, 1 / 30, () => G.B.slices && G.B.slices.at > G.B.slices.list.length * 0.5, 30);
  // the page dies here: the last save is the field, the plan is still pending in the browser's storage
  const st = status();
  check(/pending/.test(st), 'a crash in the middle leaves the plan pending (' + st + ')');
  const WR = makeWorld(), GR = makeGame(WR, 'site', JSON.parse(store.get('r9si.plans.wtest')).plans);
  runUntil(GR, 1 / 30, () => /built/.test(status()), 60);
  check(/built/.test(status()) && diff(WR, WS).n === 0, 'the next start builds it again: the same finished world (' + diff(WR, WS).n + ' differ)');
}
// ---------------------------------------------------------------- 6 · ⏩ Fertig
{
  const W = makeWorld(), G = makeGame(W, 'site', planOf());
  runUntil(G, 1 / 30, () => G.B.slices && G.B.slices.at > G.B.slices.list.length * 0.1, 30);
  const ok = G.B.siteSkip && G.B.siteSkip();
  check(ok && !G.B.slices && /built/.test(status()), '⏩ Fertig: the rest at once, the plan is built');
  check(diff(W, WS).n === 0 && G.gad.wand.undo.length === 1, '… the same finished world, still one undo step');
}
// ---------------------------------------------------------------- 8 · a tiny piece
{
  const W = makeWorld(), G = makeGame(W, 'site', [{ id: 'm1', kind: 'model', name: 'vm_bed_grey', ox: OX + 30, oz: OZ, F: F0, r: 0, status: 'pending', t: 1 }]);
  let st0 = -1;
  const t = runUntil(G, 1 / 30, (tt) => { if (st0 < 0 && G.B.slices) st0 = tt; return /built/.test(status()); }, 20);
  const site = G.B.sites && G.B.sites[0];
  check(/built/.test(status()) && t - st0 <= 2.5, 'a bed appears in a short magic moment (' + (t - st0).toFixed(1) + ' s)');
  check(!site || !site.scaffold, 'no construction site for a bed (no scaffold, no crane)');
}
// ---------------------------------------------------------------- 9 · the show (no GL here: its clock, its crew, its crane, its meshes)
{
  let folk = true; try { require('../src/main/villagers.js'); } catch (e) { folk = false; }
  const W = makeWorld(), G = makeGame(W, 'site', planOf());
  runUntil(G, 1 / 30, () => !!G.B.slices, 5);
  const site = G.B.slices, sh = site && site.show;
  check(!!sh && sh.scaffold && !!sh.inst && sh.inst.bays.length > 0, 'the tower gets a scaffold (' + (sh && sh.inst ? sh.inst.bays.length / 4 + ' bays, ' + sh.K + ' levels' : 'none') + ')');
  check(!!(sh && sh.crane) && sh.crane.Lj >= 10 && sh.crane.mastTop > sh.top, 'and a crane taller than it (' + (sh && sh.crane ? 'mast top ' + sh.crane.mastTop + ', jib ' + sh.crane.Lj : 'none') + ')');
  check(!folk || (sh && sh.crew.length === 3), 'a crew of three builders on Balanced (' + (sh ? sh.crew.length : 0) + ')');
  let deckOk = 0, deckN = 0, onDeck = 0, onN = 0, worked = 0, hauled = 0;
  const seen = new Set();
  runUntil(G, 1 / 30, () => {
    if (!(site.phase === 'build' && site.t > site.Te + 1)) return site.phase === 'done';
    const front = (site.t - site.Te) / site.Tb * sh.H; deckN++; if (Math.abs(sh.deck - Math.max(0, front - 1.25)) < 2.5) deckOk++;
    for (const b of sh.crew) { if (b.mode === 'deck') { onN++; if (Math.abs(b.pos[1] - (sh.oy + sh.deck + 0.11)) < 0.35) onDeck++; } if (b.state === 'work') worked++; }
    if (sh.crane) { seen.add(sh.crane.st); if (sh.crane.load) hauled++; }
    return false;
  }, 40);
  check(deckN > 100 && deckOk / deckN > 0.97, 'the working deck rises with the build front (' + deckOk + '/' + deckN + ' frames)');
  check(!folk || (onN > 100 && onDeck / onN > 0.97 && worked > 50), 'the builders stand on the deck and hammer (' + onDeck + '/' + onN + ' on it, ' + worked + ' frames of work)');
  check(hauled > 30 && seen.has('lower') && seen.has('down'), 'the crane picks loads at its yard and lowers them onto the deck (' + [...seen].join(' ') + ')');
  const tDone = site.phase === 'done';
  let gone = -1; runUntil(G, 1 / 30, (t) => { if (site.phase === 'gone' && gone < 0) gone = t; return gone >= 0; }, 30);
  check(tDone && gone > 1 && gone < 16, 'when it stands the scaffold folds, the builders walk off, the site is gone (' + gone.toFixed(1) + ' s)');
  check(!G.B.sites.length, 'no show is left behind');
  // the meshes: every triangle turns its front to its normal (back faces are culled)
  const BS = V.Baustelle, bad = [];
  const mods = Object.keys(BS.MOD).map(k => [k, k === 'corner' ? BS.MOD.corner(false) : k === 'top' ? BS.MOD.top(30, 9) : BS.MOD[k]()]).concat([['deckCorner', BS.MOD.corner(true)]]);
  for (const [k, m] of mods) {
    const v = m.raw; let off = 0;
    for (let i = 0; i < v.length; i += 30) {
      const ax = v[i + 10] - v[i], ay = v[i + 11] - v[i + 1], az = v[i + 12] - v[i + 2], bx = v[i + 20] - v[i], by = v[i + 21] - v[i + 1], bz = v[i + 22] - v[i + 2];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx, d = cx * v[i + 3] + cy * v[i + 4] + cz * v[i + 5];
      if (d < -1e-9) off++;
    }
    if (off) bad.push(k + ' ' + off);
  }
  check(!bad.length, 'every triangle of the ' + mods.length + ' meshes faces out (culling keeps them)' + (bad.length ? ': ' + bad.join(', ') : ''));
  const tris = mods.reduce((n, [, m]) => n + m.count / 3, 0), bay = mods.find(q => q[0] === 'bay')[1].count / 3;
  console.log('  (meshes: ' + Math.round(tris) + ' triangles in all, ' + bay + ' per scaffold bay)');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

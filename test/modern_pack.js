// The "Modern Living" item pack (voxmodern.js): registered late (after Vollton) so every shipped block keeps its
// state ids, compiled lazily (nothing compiles at load; a model builds itself on first use), lamps switch on and off.
// Checks: ids unchanged, names, limits, counts per set, display names, every model compiles to exactly its declared
// cells, every state paints + meshes under the quad budget, icons, toggles, containers, registration cost.
const t0 = Date.now();
require('./load_shared.js');
const loadMs = Date.now() - t0;
const fs = require('fs');
const R = VR.R, VX = VR.VX, VM = VR.VM, F = VR.F;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

// ---- the pack's sets (id: vm_<set>_<item>_<variant>) and how many items each must have at least (236 in all)
const EXPECT = { light: 24, smart: 18, kitchen: 27, living: 32, sleep: 17, bath: 16, plant: 14, office: 20, garden: 21, mobility: 12, shop: 21, deco: 14 };
const pack = R.types.filter(t => t.o.modern);
const names = pack.map(t => t.name);
console.log('pack', pack.length, 'items · load', loadMs, 'ms');

// 1 · ids: every shipped type keeps [base, nstates]; the pack comes after everything else
{
  const snap = JSON.parse(fs.readFileSync('/home/claude/vr/test/id_snapshot.json', 'utf8'));
  // the snapshot lists the pack's items too (since v0.39), so "shipped before the pack" means the non-pack entries only
  const packSet = new Set(names);
  let bad = 0, end = 1;
  for (const [name, base, n] of snap) { if (!packSet.has(name)) end = Math.max(end, base + n); const t = R.byName[name]; if (!t || t.base !== base || t.nstates !== n) { if (bad++ < 5) console.log('    shifted: ' + name); } }
  check(!bad, 'id snapshot: all ' + snap.length + ' shipped types keep their state ids');
  const first = pack.length ? Math.min(...pack.map(t => t.base)) : 0;
  check(pack.length > 0 && first >= end, 'the pack is appended after the last shipped state (' + (end - 1) + '), first pack state ' + first);
  const lastVollton = R.byName.vollton_plum_stairs;
  check(pack.every(t => t.id > lastVollton.id), 'every pack item is registered after Vollton');
  // the pack itself is append-only too: every item keeps the state ids it shipped with (test/modern_ids.json; a new item
  // goes after the last one). Only while no build with the pack has been played may the file be deleted and rewritten.
  const idFile = '/home/claude/vr/test/modern_ids.json';
  if (!fs.existsSync(idFile)) { fs.writeFileSync(idFile, '[\n' + pack.map(t => JSON.stringify([t.name, t.base, t.nstates])).join(',\n') + '\n]\n'); console.log('    wrote', idFile); }
  const mine = JSON.parse(fs.readFileSync(idFile, 'utf8'));
  const moved = mine.filter(([n, base, ns]) => { const t = R.byName[n]; return !t || t.base !== base || t.nstates !== ns; });
  check(!moved.length && mine.every(([n], i) => names[i] === n), 'the pack keeps the state ids of its ' + mine.length + ' recorded items (append-only)' + (moved.length ? ' — moved: ' + moved.slice(0, 4).map(r => r[0]).join(', ') : ''));
  check(VM.MODERN_NAMES.length === pack.length, 'every defined item registered (' + VM.MODERN_NAMES.length + ' defined, ' + pack.length + ' registered: a name an older block already has would be skipped)');
}

// 2 · names and limits
{
  check(new Set(names).size === names.length && names.every(n => /^vm_[a-z]+_[a-z0-9]+(_[a-z0-9]+)+$/.test(n)), 'ids unique and shaped vm_<set>_<item>_<variant>');
  const disp = pack.map(t => t.display);
  check(new Set(disp).size === disp.length, 'display names unique');
  const badFmt = pack.filter(t => !/^[\p{Lu}0-9][\p{L}0-9&'"\- ]+ · [\p{L}0-9][\p{L}0-9 &\-]*$/u.test(t.display));
  check(!badFmt.length, 'display names read "Family · variant"' + (badFmt.length ? ' — not: ' + badFmt.slice(0, 4).map(t => t.display).join(' | ') : ''));
  check(R.stateCount < 65535, 'state count ' + R.stateCount + ' < 65,535');
  check(R.texNames.length < 2048, 'texture layers ' + R.texNames.length + ' < 2,048');
  check(pack.every(t => t.cat === 'vmodern' && t.o.vxModel && VM.MODELS[t.name]), 'every item sits in the creative tab "vmodern" as a VX model');
  const CATS = VM.MODERN_CATS || {};
  check(pack.every(t => Array.isArray(t.o.cats) && t.o.cats.length && t.o.cats.every(c => CATS[c])), 'every item has Studio categories with German labels');
}

// 3 · counts per set
{
  const per = {};
  for (const n of names) { const s = n.split('_')[1]; per[s] = (per[s] || 0) + 1; }
  console.log('    per set', JSON.stringify(per));
  for (const [s, n] of Object.entries(EXPECT)) check((per[s] || 0) >= n, 'set ' + s + ': ' + (per[s] || 0) + ' items (≥ ' + n + ')');
  check(Object.keys(per).every(s => EXPECT[s]), 'no unknown set');
  const pal = new Set(Object.values(VM.MODERN_PALETTE || {}));
  const off = pack.filter(t => !pal.has(t.o.vx.col));
  check(!off.length, 'every item registers with a colour of the shared palette (' + pal.size + ' colours)' + (off.length ? ' — not: ' + off.slice(0, 4).map(t => t.name).join(', ') : ''));
}

// 4 · lazy: nothing compiled right after load; registration cost
{
  const compiled = pack.filter(t => VM.MODELS[t.name].compiled);
  check(!compiled.length, 'nothing in the pack is compiled after load' + (compiled.length ? ' — compiled: ' + compiled.slice(0, 5).map(t => t.name).join(', ') : ''));
  const st = VM.stats || {};
  console.log('    registration', (st.lateMs || 0).toFixed(1), 'ms for', st.lateN, 'models =', ((st.lateMs || 0) / Math.max(1, st.lateN)).toFixed(3), 'ms/model');
  check(st.lateN === pack.length && st.lateMs < 50, 'registering the pack takes < 50 ms (' + (st.lateMs || 0).toFixed(1) + ' ms)');
}

// 5 · lint while building: a primitive that draws nothing (a quarter-unit face rounds away on the grid) or reaches past
// the model's box (a tap above a one-block counter) means detail that silently is not there
const lint = {};
{
  const B = VM.Builder.prototype; let cur = null;
  const note = (msg) => (lint[cur] = lint[cur] || []).push(msg);
  const out = (b, x0, y0, z0, x1, y1, z1) => x1 * b.S > b.W + 0.5 || y1 * b.S > b.H + 0.5 || z1 * b.S > b.D + 0.5 || x0 < -0.25 || y0 < -0.25 || z0 < -0.25;
  for (const fn of ['box', 'pbox', 'rbox', 'cushion', 'cyl', 'tube', 'sphere', 'ellipsoid', 'lathe', 'extrude', 'rod', 'beam']) {
    const o = B[fn];
    B[fn] = function (...a) {
      if (!cur) return o.apply(this, a);
      const mat = fn === 'box' ? a[6] : fn === 'lathe' ? a[3] : fn === 'extrude' ? a[4] : fn === 'pbox' || fn === 'rbox' || fn === 'cushion' || fn === 'rod' || fn === 'beam' ? a[7] : fn === 'cyl' ? a[6] : fn === 'tube' ? a[7] : fn === 'sphere' ? a[4] : a[6];
      let n = 0, outside = 0; const set = this.set;
      this.set = function (x, y, z, v) { if (x < 0 || y < 0 || z < 0 || x >= this.W || y >= this.H || z >= this.D) outside++; else n++; return set.call(this, x, y, z, v); };
      const r = o.apply(this, a); this.set = set;
      if (mat && !n) note(fn + ' draws nothing (' + a.slice(0, 6).map(v => typeof v === 'number' ? +v.toFixed(2) : '…').join(',') + ')');
      else if (mat && outside > 8) note(fn + ' reaches past the model (' + outside + ' voxels)');
      else if (mat && (fn === 'box' || fn === 'pbox' || fn === 'rbox' || fn === 'cushion') && out(this, a[0], a[1], a[2], a[3], a[4], a[5])) note(fn + ' reaches past the model');
      return r;
    };
  }
  VM._lintSet = (name) => { cur = name; };
}
// 6 · every model compiles to exactly its declared cells, every state paints and meshes under the budget
const BUDGET = 1000;
{
  let errs = [], maxQ = 0, maxN = '', quads = 0, states = 0, bytes = 0, cms = 0, emptyIcon = [];
  const per = [];
  for (const t of pack) {
    const m = VM.MODELS[t.name];
    const declared = m.parts.map(p => p.px + ',' + p.py + ',' + p.pz).join(' ');
    VM._lintSet(t.name); const c0 = performance.now(); VM.materialize(m); const dt = performance.now() - c0; cms += dt; VM._lintSet(null);
    if (!m.compiled) { errs.push(t.name + ' did not compile'); continue; }
    const scanned = VM.scanParts(m).map(p => p.px + ',' + p.py + ',' + p.pz).join(' ');
    if (scanned !== declared) errs.push(t.name + ' cells: declared [' + declared + '] built [' + scanned + ']');
    bytes += m.vol.byteLength + m.pal.byteLength;
    per.push([t.name, dt, (m.vol.byteLength + m.pal.byteLength) / 1024]);
    const ic = VX.iconGrid(t.defaultState); if (!ic || !ic.some(v => v)) emptyIcon.push(t.name);
    for (let s = t.base; s < t.base + t.nstates; s++) {
      const sp = VX.spec(s);
      try {
        VM.paint(sp, { part: t.get(s, 'part'), facing: t.get(s, 'facing'), x: 0, lit: t.has('lit') ? t.get(s, 'lit') : 1 });
        const q = VX.meshGridN(VX.gridFor(sp.res), sp.res, 0, 0), nq = q.length / 27;
        quads += nq; states++;
        if (nq > maxQ) { maxQ = nq; maxN = t.name; }
        if (!nq) errs.push(t.name + ' state ' + (s - t.base) + ' meshes to nothing');
        const bx = VX.boxes(s, true); if (!bx.length) errs.push(t.name + ' has no selection box');
      } catch (e) { errs.push(t.name + ': ' + e.message); }
    }
  }
  console.log('    compiled', pack.length, 'models in', cms.toFixed(0), 'ms (' + (cms / Math.max(1, pack.length)).toFixed(1), 'ms/model) · volume', (bytes / 1048576).toFixed(1), 'MB (' + (bytes / 1024 / Math.max(1, pack.length)).toFixed(0), 'KB/model) · states', states, '· avg', (quads / Math.max(1, states)).toFixed(0), 'quads/state · max', maxQ, '(' + maxN + ')');
  per.sort((a, b) => b[2] - a[2]); console.log('    heaviest', per.slice(0, 4).map(p => p[0] + ' ' + p[2].toFixed(0) + ' KB ' + p[1].toFixed(1) + ' ms').join(' · '));
  check(!errs.length, 'every model compiles to its declared cells and every state paints and meshes' + (errs.length ? ' — ' + errs.slice(0, 6).join(' | ') : ''));
  check(maxQ <= BUDGET, 'every state stays under ' + BUDGET + ' quads (max ' + maxQ + ' · ' + maxN + ')');
  check(!emptyIcon.length, 'every item has an icon' + (emptyIcon.length ? ' — empty: ' + emptyIcon.slice(0, 5).join(', ') : ''));
  const lk = Object.keys(lint);
  check(!lk.length, 'no detail is lost on the grid or past the model\'s box' + (lk.length ? ' — ' + lk.slice(0, 4).map(k => k + ': ' + lint[k].slice(0, 2).join(' / ')).join(' | ') : ''));
}

// 7 · switches and containers
{
  const lamps = pack.filter(t => t.o.toggle);
  check(lamps.length >= 20 && lamps.every(t => t.has('lit') && (R.T.flags[t.base] & F.INTERACT)), lamps.length + ' lamps switch (a "lit" property, right click)');
  let bad = [];
  for (const t of lamps) {
    const on = t.state({ lit: 1 }), off = t.state({ lit: 0 });
    if (!R.T.emit[on] || R.T.emit[off]) bad.push(t.name + ' light');
    if (t.defaultState !== t.state({ lit: 1 })) bad.push(t.name + ' is placed switched off');
    const sp = VX.spec(on), m = VM.MODELS[t.name];
    const glow = (lit) => { let n = 0; for (let i = 0; i < m.parts.length; i++) { VM.paint(sp, { part: i, facing: 0, x: 0, lit }); for (const v of VX.gridFor(sp.res)) if (v & VX.EMIS) n++; } return n; };
    if (!glow(1)) bad.push(t.name + ' has nothing that glows');
    if (glow(0)) bad.push(t.name + ' still glows when off');
  }
  check(!bad.length, 'lamps give light only when on, glowing voxels go dark when off' + (bad.length ? ' — ' + bad.slice(0, 5).join(', ') : ''));
  const cab = pack.filter(t => t.o.ui === 'chest');
  if (names.some(n => /^vm_(kitchen|sleep|bath)_/.test(n))) check(cab.length >= 4 && cab.every(t => R.T.flags[t.base] & F.INTERACT) && cab.every(t => !t.o.seat && !t.o.bed && !t.o.toggle), cab.length + ' cupboards open as containers');
  // every part of a model finds its anchor (part 0) — the container and the switch work from any part
  const big = pack.find(t => VM.MODELS[t.name].parts.length >= 4);
  if (big) {
    const m = VM.MODELS[big.name]; let ok = true;
    for (let f = 0; f < 4; f++) for (let i = 0; i < m.parts.length; i++) {
      const fp = VM.footprint(m, f), me = fp[i], cells = VM.partCells(m, f, i, 100 + me[0], 50 + me[1], 100 + me[2]);
      if (cells.length !== m.parts.length || cells[0].join() !== '100,50,100') ok = false;
    }
    check(ok, 'from any part every cell of a model is found (' + big.name + ')');
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

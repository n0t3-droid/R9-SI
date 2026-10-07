// Phase B1 „⧉ Als Variante" — the variant slots in node: 256 slot types var_0 … var_255 of 64 states each, the last
// block types of the registry (pinned by test/id_snapshot.json); VR.Looks fills a slot from its source (props, options
// and table rows as shipped, its own name and look, drops itself) the same way on every thread; a stairs, a door, a
// furniture model and a VX wall variant behave like their sources; surplus states and a lost source are the grey
// „Fehlende Variante" cube; slots are handed out in order and never reused (Löschen only hides); exhaustion and „too big"
// say so; a world keeps a copy of the variants it contains; the multiplayer Studio-Paket round-trips.
//   bash test/wt_run.sh variants_core.js
const V = require('./load_shared.js');
const R = V.R, T = R.T, L = V.Looks, SH = V.SHAPE, F = V.F;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const fs = require('fs');

// ---------------------------------------------------------------- 1 · the slots in the registry
const slots = R.types.filter(t => /^var_\d+$/.test(t.name));
check(slots.length === 256, '256 slot types (' + slots.length + ')');
check(slots.every((t, k) => t.name === 'var_' + k && t.nstates === 64), 'var_0 … var_255, 64 states each');
const last = R.types.slice(-256);
check(last.every((t, k) => t === slots[k]), 'the slots are the last 256 block types (appended after everything, the modern pack too)');
check(slots.every((t, k) => k === 0 || t.base === slots[k - 1].base + 64) && slots[255].base + 64 === R.stateCount, 'their states are one block at the end: ' + slots[0].base + ' … ' + (R.stateCount - 1));
check(R.stateCount < 65535, 'state count ' + R.stateCount + ' < 65,535 (saved columns are Uint16)');
const grey = R.texIndex['concrete:light_gray'];
check(slots.every(t => T.shape[t.base] === SH.CUBE && (T.tex[t.base * 6 + 2] & 0xfff) === grey && t.cat === null && t.o.noItem), 'an empty slot is the grey cube „Fehlende Variante" (an existing texture: no new GPU layer), not an item');
check(/Variante|variant/i.test(slots[0].display), 'its name says so: ' + slots[0].display);
check(L.slotCount() === 256 && L.slotOf(slots[3].base + 5) === 3 && L.slotOf(R.byName.oak_planks.defaultState) === -1, 'Looks.slotOf: the slot of a state');
check(L.kindOf('var_0') === null, 'an empty slot is not offered for editing');
const TABLES = Object.keys(T);
const snapRows = () => { const [a, b] = L.slotRange(); return TABLES.map(k => k === 'tex' ? T[k].slice(a * 6, b * 6) : T[k].slice(a, b)); };
const sameArr = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const ROWS0 = snapRows(), O0 = slots.map(t => [t.o, t.props, t.propIndex, t.display, t.defaultState]);

// ---------------------------------------------------------------- 2 · hand-out
let data = L.empty();
const add = (def) => { const r = L.addVariant(data, def); if (r.ok) data = r.data; return r; };
const r0 = add({ src: 'oak_planks', name: 'Eiche hell', look: { rc: '#e6cfa4' } });
check(r0.ok && r0.k === 0 && r0.name === 'var_0' && data.next === 1, 'the first variant takes slot 0');
const rStairs = add({ src: 'stone_brick_stairs', name: 'Treppe', look: {} });
const rDoor = add({ src: 'oak_door', name: 'Tür hell', look: { rc: '#f0e0c0' } });
const rSofa = add({ src: 'vm_sofa_navy', name: 'Sofa Petrol', look: {}, model: true });
const rWall = add({ src: 'vx_plaster_white', name: 'Putz rot', look: { vx: { col: '#c04030' } } });
const rGone = add({ src: 'oak_planks', name: 'Platzhalter' });
check([rStairs, rDoor, rSofa, rWall, rGone].every((r, i) => r.ok && r.k === i + 1), 'slots are handed out in order (1 … 5)');
check(L.addVariant(data, { src: 'copper_door', name: 'x' }).why === 'big' && L.addVariant(data, { src: 'water', name: 'x' }).why === 'bad' && L.addVariant(data, { src: 'var_0', name: 'x' }).why === 'bad', '„Zu groß": copper_door (256 states) · water and a variant of a variant: no');
check(/groß|big/i.test(L.why('big')) && /256/.test(L.why('full')), 'the messages: ' + L.why('full'));
// slot 5's source is lost (a block removed in a later version): it stays the grey cube
data.slots[5].src = 'gone_block';

// ---------------------------------------------------------------- 3 · fill on apply
// the sources wear their own „Für alle" looks: a variant never inherits them
data.looks = { oak_planks: { rc: '#202020' }, vx_plaster_white: { vx: { col: '#00ff00', trim: '#0000ff' } } };
const ch = L.apply(data);
const v0 = R.byName.var_0, oak = R.byName.oak_planks;
check(ch.includes(v0.id) && ch.includes(oak.id), 'apply reports the filled slots and the changed sources');
check(v0.display === 'Eiche hell' && v0.o.variantOf === 'oak_planks' && v0.o.drops === 'var_0' && v0.cat === oak.cat && V.itemDef('var_0').name === 'Eiche hell', 'var_0: its own name, variantOf oak_planks, drops itself, in oak\'s tab, an item');
check(T.shape[v0.base] === T.shape[oak.base] && T.flags[v0.base] === T.flags[oak.base] && T.layer[v0.base] === T.layer[oak.base] && [0, 1, 2, 3, 4, 5].every(f => T.tex[v0.base * 6 + f] === T.tex[oak.base * 6 + f]), 'var_0 has oak\'s table row (shape, flags, layer, textures)');
check(T.rc[v0.base] === L.to565(0xe6cfa4) && T.rc[oak.base] === L.to565(0x202020), 'its own colour; oak keeps its own look (no inheritance either way)');
check(T.shape[v0.base + 1] === SH.CUBE && (T.tex[(v0.base + 1) * 6 + 2] & 0xfff) === grey && T.rc[v0.base + 1] === 0, 'states oak does not have: the grey cube');
check(L.kindOf('var_0') === 'tex' && L.fits('var_0') === false, 'a filled variant is edited like its source; no variant of a variant');
// stairs: the props of the source — get / with / state / decode
const vs = R.byName.var_1, st = R.byName.stone_brick_stairs;
const sv = vs.state({ facing: 2, half: 1 }), ss = st.state({ facing: 2, half: 1 });
check(sv - vs.base === ss - st.base && vs.get(sv, 'facing') === 2 && vs.get(sv, 'half') === 1 && vs.with(sv, 'facing', 0) - vs.base === st.with(ss, 'facing', 0) - st.base && JSON.stringify(vs.decode(sv)) === JSON.stringify(st.decode(ss)), 'stairs variant: facing / half decode like the source');
check(vs.o.kind === 'stairs' && T.shape[sv] === SH.STAIRS, 'and it is stairs');
// door: open / hinge / half, and the door logic's own type check
const vd = R.byName.var_2, od = R.byName.oak_door;
const dv = vd.state({ facing: 1, half: 0, open: 0, hinge: 1 }), dd = od.state({ facing: 1, half: 0, open: 0, hinge: 1 });
check(vd.o.kind === 'door' && vd.with(dv, 'open', 1) - vd.base === od.with(dd, 'open', 1) - od.base && R.models[vd.with(dv, 'open', 1)] === R.models[od.with(dd, 'open', 1)], 'door variant: opens like the source (the same faces)');
check(V.PHYS.collision(vd.with(dv, 'open', 1)).length === V.PHYS.collision(od.with(dd, 'open', 1)).length && JSON.stringify(V.PHYS.selection(dv)) === JSON.stringify(V.PHYS.selection(dd)), 'door variant: the same collision and selection boxes');
// the furniture model: its own model, the same footprint; Welt-Stil may map the source to it
const vm = R.byName.var_3, VM = V.VM;
check(!!VM.MODELS.var_3 && VM.MODELS.var_3 !== VM.MODELS.vm_sofa_navy && VM.MODELS.var_3.parts.length === VM.MODELS.vm_sofa_navy.parts.length, 'model variant: its own VM.MODELS.var_3, the same parts');
check(JSON.stringify(VM.footprint(VM.MODELS.var_3, 1)) === JSON.stringify(VM.footprint(VM.MODELS.vm_sofa_navy, 1)) && vm.o.vx.model === VM.MODELS.var_3, 'the same footprint; its states paint its own model');
check(V.WorldStyle.check('vm_sofa_navy', 'var_3') === '' && V.WorldStyle.check('oak_planks', 'var_0') === '', 'Welt-Stil allows source → variant');
const placed = []; VM.put((u, y, v, n, p) => placed.push([u, y, v, n, p.part]), 0, 0, 0, 'var_3', 1);
check(placed.length === VM.MODELS.vm_sofa_navy.parts.length && placed.every(p => p[3] === 'var_3'), 'VM.put places every part of the variant');
// VX wall: the variant's spec is a copy of the shipped spec (not the source's look) with its own look
const vw = R.byName.var_4, pw = R.byName.vx_plaster_white;
check(vw.o.vx !== pw.o.vx && vw.o.vx.col === 0xc04030 && vw.o.vx.trim === V.VX.COL.oakD, 'VX variant: its own spec — its colour, the shipped trim (not the source\'s look)');
check(pw.o.vx.col === 0x00ff00 && pw.o.vx.trim === 0x0000ff, 'the source keeps its own look');
check(V.VX.spec(vw.base) === vw.o.vx && V.VX.cls(vw.base) === V.VX.cls(pw.base), 'the VX tables know the variant\'s spec and class');
// a lost source: grey cube, not offered
check(L.kindOf('var_5') === null && T.shape[R.byName.var_5.base] === SH.CUBE && (T.tex[R.byName.var_5.base * 6] & 0xfff) === grey, 'a variant whose source is lost stays the grey cube');

// ---------------------------------------------------------------- 4 · meshes: a variant meshes like its source
{
  const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS, P = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
  const meshWith = (a, b, c) => {
    const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000), g = new Uint16Array(PSS).fill(0x7e8a);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) blocks[P(x, 0, z)] = R.S('stone');
    blocks[P(3, 1, 3)] = a; blocks[P(6, 1, 3)] = b; blocks[P(6, 2, 3)] = c[0]; blocks[P(9, 1, 3)] = c[1];
    const r = V.meshSection({ blocks, light, grass: g, foliage: g, water: g, sy: 0, ox: 0, oz: 0, smooth: true, fancyLeaves: true });
    return [r.opaque, r.cutout, r.trans];
  };
  V.VX.clearCache();
  const dTop = (t, s) => t.with(s, 'half', 1);
  const mSrc = meshWith(ss, dd, [dTop(od, dd), R.S('stone_brick_stairs', { facing: 0, half: 0 })]);
  const mVar = meshWith(sv, dv, [dTop(vd, dv), vs.state({ facing: 0, half: 0 })]);
  // the door variant is recoloured (w5 bit 15, its tint): compare without those two
  const strip = (m) => m.map(a => { const b = a.slice(); for (let i = 0; i < b.length; i += 8) { b[i + 5] &= 0x7fff; b[i + 7] = 0; } return b; });
  const same = strip(mSrc).every((a, i) => sameArr(a, strip(mVar)[i]));
  check(same, 'stairs and door variants: the same vertices as their sources (apart from the door\'s own colour)');
  const rcFaces = mVar[1].length ? [...mVar[0], ...mVar[1]] : mVar[0]; let rcN = 0; for (let i = 0; i < rcFaces.length; i += 8) if (rcFaces[i + 5] & 0x8000) rcN++;
  check(rcN > 0, 'the door variant\'s faces carry its colour (' + rcN + ' vertices)');
}

// ---------------------------------------------------------------- 5 · never reused, hidden only; exhaustion
{
  data = L.hideVariant(data, 0);
  L.apply(data);
  check(R.byName.var_0.o.variantOf === 'oak_planks' && R.byName.var_0.cat === null && data.slots[0].hidden, 'Löschen hides var_0: still filled (worlds may contain it), out of the tabs');
  const r = add({ src: 'glass', name: 'Glas blau', look: { rc: '#4080ff' } });
  check(r.ok && r.k === 6, 'the next variant takes slot 6, not the hidden 0');
  let d2 = data; for (let i = d2.next; i < 256; i++) { const q = L.addVariant(d2, { src: 'stone', name: 'S' + i }); d2 = q.data; }
  check(d2.next === 256 && L.addVariant(d2, { src: 'stone', name: 'zu viel' }).why === 'full', 'after 256 slots: „full" (' + L.why('full') + ')');
  const t0 = Date.now(); L.apply(d2); const ms = Date.now() - t0;
  check(R.byName.var_255.o.variantOf === 'stone', 'all 256 filled (' + ms + ' ms)');
  check(ms < 400, 'filling 250 slots takes ' + ms + ' ms');
  L.apply(data);
  check(R.byName.var_255.o.variantOf === undefined && R.byName.var_255.cat === null, 'and emptied again');
}

// ---------------------------------------------------------------- 6 · a world keeps a copy of the variants it contains
{
  const s1 = R.byName.var_1.base + 3, s4 = R.byName.var_4.base;
  const col = new Uint16Array(65536); col[100] = s1; col[2000] = s4; col[3000] = R.S('stone');
  const used = L.scanSlots(col);
  check(used.size === 2 && used.has(1) && used.has(4), 'a column\'s slots: ' + [...used].join(','));
  const rle = V.rleEncode ? V.rleEncode(col) : null;
  if (rle) check(L.scanSlots(rle, null, true).size === 2, 'also from the saved RLE pairs');
  const vars = L.worldVars({}, used, data);
  check(vars[1] && vars[1].src === 'stone_brick_stairs' && vars[4] && vars[4].look.vx.col === '#c04030' && !vars[0], 'the world\'s copy holds the definitions of the slots it uses');
  // another browser (or a cleared storage) without these variants opens the world
  const res = L.restoreVars(vars, L.empty());
  check(res.restored.length === 2 && res.data.slots[1].src === 'stone_brick_stairs' && res.data.next === 5, 'restored from the world: slots 1 and 4, next 5');
  const other = L.empty(); other.slots[1] = { src: 'glass', name: 'Anders', look: {} }; other.next = 2;
  const res2 = L.restoreVars(vars, other);
  check(res2.conflicts.length === 1 && res2.data.slots[1].src === 'glass' && res2.restored.length === 1, 'a slot this browser uses otherwise is kept (a conflict, reported)');
}

// ---------------------------------------------------------------- 7 · the Studio-Paket (multiplayer)
{
  const models = { var_3: { W: 2, H: 1, D: 1, res: 32, pal: [0, 1], rle: 'AAAA' }, vm_lamp: { W: 1, H: 1, D: 1, res: 32, pal: [0], rle: 'AA' } };
  const str = L.packMake(data, models), parts = L.packParts(str, 3000);
  check(parts.every(p => p.length <= 3000) && parts.length >= 1, 'the pack in ' + parts.length + ' parts of ≤ 3000 characters');
  const back = L.packJoin(parts);
  check(back && JSON.stringify(back.data) === JSON.stringify(L.normalize(data)) && back.models.var_3 && back.models.vm_lamp && back.left === 0, 'it comes back as it went: looks, slots, next, models');
  check(L.packJoin(parts.slice(0, -1).concat(['%%%'])) === null && L.packJoin([]) === null && L.packJoin([btoa('{"v":2}')]) === null, 'a broken or foreign pack is refused');
  const big = {}; for (let i = 0; i < 300; i++) big['m' + i] = { W: 1, H: 1, D: 1, res: 32, pal: [0], rle: 'A'.repeat(4000) };
  const bp = L.packJoin(L.packParts(L.packMake(data, big)));
  check(bp && bp.left > 0 && JSON.stringify(bp).length <= L.PACK_MAX + 20000, 'a pack is capped at 512 KB (' + bp.left + ' models left out)');
}

// ---------------------------------------------------------------- 8 · back to empty: byte-identical
{
  L.apply(L.empty());
  const rows = snapRows();
  check(TABLES.every((k, i) => sameArr(rows[i], ROWS0[i])), 'every slot row as registered');
  check(slots.every((t, k) => t.o === O0[k][0] && t.props === O0[k][1] && t.propIndex === O0[k][2] && t.display === O0[k][3] && t.defaultState === O0[k][4]), 'every slot type as registered (options, props, name)');
  check(!VM.MODELS.var_3, 'the model variant is gone');
  check(T.rc[oak.base] === 0 && pw.o.vx.col === 0xF1ECE0, 'the sources back to their originals');
}

// ---------------------------------------------------------------- 9 · ids: the snapshot pins the slots
{
  const snap = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', 'test', 'id_snapshot.json'), 'utf8'));
  const inSnap = snap.filter(r => /^var_\d+$/.test(r[0]));
  check(inSnap.length === 256 && inSnap.every((r, k) => r[0] === 'var_' + k && r[1] === slots[k].base && r[2] === 64), 'test/id_snapshot.json pins all 256 slots at their state ids');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

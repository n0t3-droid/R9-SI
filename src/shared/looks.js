// ============================================================================
// Looks (Phase B1 „🎨 Aussehen" and „⧉ Als Variante") — a block's colour and
// material, changed for every world of this browser, and the 256 variant slots
// (an edited copy of a block under its own id; the original stays).
// One deterministic apply on every thread (the game, its workers, the Studio and
// its worker): what the last apply changed is put back from its snapshot, the
// slots are filled from their sources' ORIGINAL values, then the looks go on.
//   · VX blocks (t.o.vx, 8³ pieces): the colour roles the spec has and the wall /
//     floor pattern („Material") are set on the spec in place — its identity stays
//     (windows borrow a wall's spec) — then the VX caches forget their pieces.
//   · textured blocks: T.rc (RGB565, 0 = none): the mesher writes it as the vertex
//     tint and sets w5 bit 15; the shaders draw lum(albedo) / avgLum(layer) × colour
//     (the face's average becomes the colour, the detail stays). „Oberfläche"
//     borrows a full cube's face textures, per face role (oben · Seite · unten),
//     into T.tex and the baked faces of slab halves.
//   · furniture models keep the Item-Crafter override ('r9si.studio' models); a
//     model variant gets its own VM.MODELS['var_k'] (and override 'var_k').
// Nothing here touches a texture: the cached base textures (tex_cache.js) never
// see a look. Fluids are not offered (water colour is Welt-Stil).
// Data ('r9si.looks', written by the Studio):
//   { v: 1, t, looks: { name: { vx: { col: '#rrggbb', …, pat } } | { rc: '#rrggbb', tex: name | { top, side, bottom } } },
//     slots: { k: { src, name, look, t, model?, hidden? } }, next }
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, SH = VR.SHAPE;
  const L = VR.Looks = {};
  L.KEY = 'r9si.looks';
  L.SLOTS = 256; L.SLOT_STATES = 64;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null);
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));

  // ---------------------------------------------------------------- the colour table
  // the roles a VX spec can have (the order of the editor) — [key, Deutsch, English]
  L.ROLES = [
    ['col', 'Grundfarbe', 'Main colour'], ['col2', 'Zweitfarbe', 'Second colour'], ['trim', 'Kante', 'Trim'],
    ['plinth', 'Sockel', 'Plinth'], ['corner', 'Ecke', 'Corner'], ['lintel', 'Sturz', 'Lintel'], ['jamb', 'Laibung', 'Jamb'],
    ['frame', 'Rahmen', 'Frame'], ['sill', 'Fensterbank', 'Sill'], ['cap', 'Abdeckung', 'Coping'], ['glow', 'Leuchtfarbe', 'Glow colour'],
    ['cushion', 'Polster', 'Cushion'], ['top', 'Platte', 'Top'],
  ];
  const ROLE = new Set(L.ROLES.map(r => r[0]));
  // „Material" of walls and floors = their pattern
  L.WALL_PATS = [['plaster', 'Putz', 'Plaster'], ['timber', 'Fachwerk', 'Timber frame'], ['siding', 'Holzverschalung', 'Wood siding'], ['logs', 'Blockbohlen', 'Logs'],
    ['planks', 'Bretter', 'Boards'], ['batten', 'Latten', 'Battens'], ['bricks', 'Ziegel', 'Bricks'], ['fieldstone', 'Feldstein', 'Fieldstone'], ['sandstone', 'Sandstein', 'Sandstone'],
    ['adobe', 'Lehm', 'Adobe'], ['hull', 'Rumpfplatten', 'Hull panels'], ['crystal', 'Kristall', 'Crystal'], ['techpanel', 'Technikplatten', 'Tech panels'], ['hexpanel', 'Wabenplatten', 'Hex panels']];
  L.FLOOR_PATS = [['planks', 'Dielen', 'Floorboards'], ['tiles', 'Fliesen', 'Tiles'], ['checker', 'Schachbrett', 'Checkerboard'], ['stone', 'Steinplatten', 'Flagstones'],
    ['metal', 'Metall', 'Metal'], ['marble', 'Marmor', 'Marble'], ['plaza', 'Pflaster', 'Paving'], ['line', 'Linien', 'Lines'], ['deck', 'Holzdeck', 'Decking'], ['hex', 'Waben', 'Hexagons'],
    ['pad', 'Landefeld', 'Landing pad'], ['shop', 'Ladenboden', 'Shop floor']];
  const FLOOR_BUILTIN = { planks: 1, tiles: 1, checker: 1, stone: 1, metal: 1, marble: 1 };
  // the second colour a pattern draws with (mortar, beams, seams, joints), when the spec has none
  const COL2 = { bricks: 0xD6CCBC, timber: 0x4A3222, fieldstone: 0x5E5C58, hull: 0x7A808A, crystal: 0xDCD4F4, techpanel: 0x2A2E36, hexpanel: 0x2A2E36, tiles: 0xE8D8C0, checker: 0x3A3A44, stone: 0x6E6C66, metal: 0x5A606A, marble: 0xB090F0, planks: 0x6A4A2A, plaza: 0x8A8A86, line: 0xF2F2EC, deck: 0x6A4A2A, hex: 0x5A606A, pad: 0xF0C040, shop: 0xC8C8C4 };
  const patOK = (sp, p) => !!(sp && typeof p === 'string' && ((sp.kind === 'wall' && VR.VX && VR.VX.PAT[p] && L.WALL_PATS.some(x => x[0] === p)) || (sp.kind === 'floor' && (FLOOR_BUILTIN[p] || (VR.VX && VR.VX.floorPat[p])) && L.FLOOR_PATS.some(x => x[0] === p))));

  // ---------------------------------------------------------------- colours
  L.hex2int = (h) => (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? parseInt(h.slice(1), 16) : -1);
  L.int2hex = (c) => '#' + ('000000' + ((c >>> 0) & 0xffffff).toString(16)).slice(-6);
  // RGB565 for T.rc and the vertex tint — 0 means "no colour", so black is the darkest grey the format has
  L.to565 = (c) => { const v = (((c >> 19) & 31) << 11) | (((c >> 10) & 63) << 5) | ((c >> 3) & 31); return v || 0x0821; };
  L.from565 = (v) => { const r = (v >> 11) & 31, g = (v >> 5) & 63, b = v & 31; return ((Math.round(r * 255 / 31) << 16) | (Math.round(g * 255 / 63) << 8) | Math.round(b * 255 / 31)) >>> 0; };

  // ---------------------------------------------------------------- what a block offers
  const SLOT_RE = /^var_(\d{1,3})$/;
  const slotIndex = (t) => (t && t.o && Number.isInteger(t.o.varSlot) ? t.o.varSlot : -1);
  L.isSlot = (name) => { const t = typeof name === 'string' ? R.byName[name] : name; return slotIndex(t) >= 0; };
  // 'vx' (colour roles + material) · 'tex' (colour + „Oberfläche") · 'model' (furniture: the Item-Crafter) · null
  L.kindOf = function (name) {
    const t = R.byName[name]; if (!t || name === 'air') return null;
    if (slotIndex(t) >= 0 && !t.o.variantOf) return null;                 // an empty variant slot
    const s = t.defaultState, T = R.T, sh = T.shape[s], fl = T.flags[s];
    if (sh === SH.VOXEL) { const sp = t.o.vx; if (!sp) return null; if (sp.kind === 'model' || sp.res >= 16) return VR.VM && VR.VM.MODELS && VR.VM.MODELS[name] ? 'model' : null; return 'vx'; }
    if (sh === SH.NONE || sh === SH.FLUID || sh === SH.WIRE || (fl & (F.FLUID | F.INVISIBLE))) return null;
    if (t.o.ctm) return null;                                               // connected panorama glass: its frames are its look
    return 'tex';
  };
  const specOf = (t) => (t && t.o && t.o.vx && t.o.vx.kind !== 'model' && !(t.o.vx.res >= 16) ? t.o.vx : null);
  // the colour roles the block's spec has (the editor shows only these)
  L.rolesOf = function (name) { const sp = specOf(R.byName[name]); if (!sp) return []; return L.ROLES.map(r => r[0]).filter(k => typeof sp[k] === 'number'); };
  L.patternsFor = function (name) {
    const sp = specOf(R.byName[name]); if (!sp || (sp.kind !== 'wall' && sp.kind !== 'floor')) return [];
    return (sp.kind === 'wall' ? L.WALL_PATS : L.FLOOR_PATS).filter(p => patOK(sp, p[0]));
  };
  const cubeLike = (t) => { const T = R.T, s = t.defaultState, sh = T.shape[s]; return (sh === SH.CUBE && (T.flags[s] & F.FULL)) || t.o.kind === 'slab' || sh === SH.STAIRS || sh === SH.WALL || sh === SH.FENCE; };
  // „Oberfläche": cube families (cubes, slabs, stairs, walls, fences) borrow …
  L.surfaceOK = (name) => { const t = R.byName[name]; return L.kindOf(name) === 'tex' && cubeLike(t); };
  // … the faces of a full opaque cube
  L.donorOK = (name) => { const t = R.byName[name]; if (!t || L.kindOf(name) !== 'tex' || slotIndex(t) >= 0) return false; const T = R.T, s = t.defaultState; return T.shape[s] === SH.CUBE && (T.flags[s] & F.FULL) !== 0 && (T.flags[s] & F.OPAQUE) !== 0 && T.layer[s] === 0; };
  // a variant needs its states in one slot (64): copper_door, copper_trapdoor, lightning_rod, vm_garage_door7 … do not fit
  L.fits = (name) => { const t = R.byName[name]; return !!t && t.nstates <= L.SLOT_STATES && !!L.kindOf(name) && slotIndex(t) < 0; };

  // ---------------------------------------------------------------- the stored form (also what multiplayer sends)
  const hex = (v) => (L.hex2int(v) >= 0 ? v.toLowerCase() : null);
  const cleanName = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 40);
  L.cleanLook = function (lk) {
    lk = obj(lk); if (!lk) return null;
    const out = {};
    if (obj(lk.vx)) {
      const v = {};
      for (const k of Object.keys(lk.vx)) { if (k === 'pat') { if (typeof lk.vx.pat === 'string' && (L.WALL_PATS.some(p => p[0] === lk.vx.pat) || L.FLOOR_PATS.some(p => p[0] === lk.vx.pat))) v.pat = lk.vx.pat; } else if (ROLE.has(k) && hex(lk.vx[k])) v[k] = hex(lk.vx[k]); }
      if (Object.keys(v).length) out.vx = v;
    }
    if (hex(lk.rc)) out.rc = hex(lk.rc);
    if (typeof lk.tex === 'string' && lk.tex) out.tex = lk.tex.slice(0, 64);
    else if (obj(lk.tex)) { const t = {}; for (const k of ['top', 'side', 'bottom']) if (typeof lk.tex[k] === 'string' && lk.tex[k]) t[k] = lk.tex[k].slice(0, 64); if (Object.keys(t).length) out.tex = t; }
    return Object.keys(out).length ? out : null;
  };
  L.cleanSlot = function (d) {
    d = obj(d); if (!d || typeof d.src !== 'string' || !d.src || SLOT_RE.test(d.src)) return null;
    const out = { src: d.src.slice(0, 64), name: cleanName(d.name) || d.src, look: L.cleanLook(d.look) || {} };
    if (typeof d.t === 'number' && isFinite(d.t)) out.t = d.t;
    if (d.model === true) out.model = true;
    if (d.hidden === true) out.hidden = true;
    return out;
  };
  L.normalize = function (d) {
    d = obj(d) || {};
    const out = { v: 1, t: typeof d.t === 'number' && isFinite(d.t) ? d.t : 0, looks: {}, slots: {}, next: 0 };
    const lk = obj(d.looks) || {};
    for (const n of Object.keys(lk)) { if (!n || n.length > 64 || SLOT_RE.test(n)) continue; const c = L.cleanLook(lk[n]); if (c) out.looks[n] = c; }
    const sl = obj(d.slots) || {};
    let top = 0;
    for (const k of Object.keys(sl)) { const i = +k; if (!Number.isInteger(i) || i < 0 || i >= L.SLOTS || String(i) !== k) continue; const c = L.cleanSlot(sl[k]); if (c) { out.slots[i] = c; top = Math.max(top, i + 1); } }
    const nx = Number.isInteger(d.next) ? d.next : 0;
    out.next = Math.max(0, Math.min(L.SLOTS, Math.max(nx, top)));
    return out;
  };
  L.empty = () => ({ v: 1, t: 0, looks: {}, slots: {}, next: 0 });

  // ---------------------------------------------------------------- snapshots (the originals, taken before the first change)
  let SNAP = new Map();          // state → { rc, tex: Uint16Array(6), model }
  let VXSNAP = new Map();        // spec → { key: original value | ABSENT }
  const ABSENT = { absent: true };
  const T_ = () => R.T;
  function snap(s) {
    let o = SNAP.get(s);
    if (!o) { const T = T_(); o = { rc: T.rc[s], tex: T.tex.slice(s * 6, s * 6 + 6), model: R.models[s] }; SNAP.set(s, o); }
    return o;
  }
  // a state's original rc / textures / faces (its snapshot when a look changed it)
  const origRC = (s) => { const o = SNAP.get(s); return o ? o.rc : T_().rc[s]; };
  const origTex = (s, f) => { const o = SNAP.get(s); return o ? o.tex[f] : T_().tex[s * 6 + f]; };
  const origModel = (s) => { const o = SNAP.get(s); return o ? o.model : R.models[s]; };
  function restoreType(t) {
    const T = T_();
    for (let s = t.base; s < t.base + t.nstates; s++) { const o = SNAP.get(s); if (!o) continue; T.rc[s] = o.rc; T.tex.set(o.tex, s * 6); R.models[s] = o.model; SNAP.delete(s); }
    const sp = t.o && t.o.vx, v = sp && VXSNAP.get(sp);
    if (v) { for (const k of Object.keys(v)) { if (v[k] === ABSENT) delete sp[k]; else sp[k] = v[k]; } VXSNAP.delete(sp); }
  }
  // the spec as shipped (a copy; the live one may wear a look)
  function origSpec(sp) { const c = Object.assign({}, sp), v = VXSNAP.get(sp); if (v) for (const k of Object.keys(v)) { if (v[k] === ABSENT) delete c[k]; else c[k] = v[k]; } return c; }

  // ---------------------------------------------------------------- one look on one block type
  function applyVX(t, vx) {
    const sp = specOf(t); if (!sp || !vx) return false;
    let v = VXSNAP.get(sp);
    const set = (k, val) => { if (!v) { v = {}; VXSNAP.set(sp, v); } if (!own(v, k)) v[k] = own(sp, k) ? sp[k] : ABSENT; sp[k] = val; };
    const orig = (k) => (v && own(v, k) ? (v[k] === ABSENT ? undefined : v[k]) : sp[k]);
    let any = false;
    if (vx.pat && patOK(sp, vx.pat) && vx.pat !== orig('pat')) { set('pat', vx.pat); if (typeof sp.col2 !== 'number') set('col2', COL2[vx.pat] !== undefined ? COL2[vx.pat] : (VR.VX ? VR.VX.sh(sp.col | 0, 0.7) : 0x555555)); any = true; }
    for (const k of Object.keys(vx)) {
      if (k === 'pat' || !ROLE.has(k)) continue;
      const c = L.hex2int(vx[k]); if (c < 0) continue;
      if (typeof orig(k) !== 'number' && !(k === 'col2' && typeof sp.col2 === 'number')) continue;   // only roles the block has
      set(k, c); any = true;
    }
    return any;
  }
  // which role a face has, from the textures as shipped: ends of a log are "top" in every axis; a block with one
  // texture all round goes by direction
  function roleOf(t, s, f) {
    const d = t.defaultState, top = origTex(d, 2) & 0xfff, bot = origTex(d, 3) & 0xfff, side = origTex(d, 4) & 0xfff, me = origTex(s, f) & 0xfff;
    const byDir = f === 2 ? 'top' : f === 3 ? 'bottom' : 'side';
    if (top === side && bot === side) return byDir;
    if (me === side) return 'side';
    if (me === top) return 'top';
    if (me === bot) return 'bottom';
    return byDir;
  }
  const FROLE = { top: 2, bottom: 3, side: 4 };
  function donorLayers(tex) {
    const pick = (name, role) => { if (!name || !L.donorOK(name)) return -1; const s = R.byName[name].defaultState; return origTex(s, FROLE[role]) & 0xfff; };
    if (typeof tex === 'string') return { top: pick(tex, 'top'), side: pick(tex, 'side'), bottom: pick(tex, 'bottom') };
    const o = obj(tex) || {};
    return { top: pick(o.top, 'top'), side: pick(o.side, 'side'), bottom: pick(o.bottom || o.top, 'bottom') };
  }
  function applyTex(t, lk) {
    if (L.kindOf(t.name) !== 'tex' && !(slotIndex(t) >= 0 && t.o.variantOf && R.T.shape[t.defaultState] !== SH.VOXEL)) return false;
    const T = T_(), rc = lk.rc ? L.to565(L.hex2int(lk.rc)) : 0;
    const dl = lk.tex && cubeLike(t) ? donorLayers(lk.tex) : null;
    const anyTex = dl && (dl.top >= 0 || dl.side >= 0 || dl.bottom >= 0);
    if (!rc && !anyTex) return false;
    const slab = t.o.kind === 'slab', MD = VR.MODEL;
    for (let s = t.base; s < t.base + t.nstates; s++) {
      if (rc) { snap(s); T.rc[s] = rc; }
      if (!anyTex) continue;
      snap(s);
      const tex6 = {};
      for (let f = 0; f < 6; f++) {
        const role = roleOf(t, s, f), lay = dl[role];
        const cur = origTex(s, f);
        const v = lay >= 0 ? ((cur & 0xf000) | lay) : cur;
        T.tex[s * 6 + f] = v; tex6[f] = v;
      }
      // a slab half is a baked model: its faces again, with the new textures (the full slab is a cube: T.tex)
      if (slab && R.T.shape[s] === SH.MODEL && MD) { const ty = t.has('type') ? t.get(s, 'type') : 0; R.models[s] = MD.box(ty === 1 ? [0, 8, 0, 16, 16, 16] : [0, 0, 0, 16, 8, 16], tex6); }
    }
    return true;
  }
  function applyLook(t, lk) {
    if (!t || !lk) return false;
    let any = false;
    if (lk.vx && specOf(t)) any = applyVX(t, lk.vx) || any;
    if ((lk.rc || lk.tex) && R.T.shape[t.defaultState] !== SH.VOXEL) any = applyTex(t, lk) || any;
    return any;
  }

  // ---------------------------------------------------------------- variant slots (blocks_var.js registers var_0 … var_255)
  const SLOTT = [];              // k → slot type
  const O0 = [];                 // k → the slot's own (empty) options, props, display
  let FALL = null;               // the empty slot's table row (a grey cube)
  let slotBase = -1, slotEnd = -1;
  function slotInit() {
    if (FALL || !R.byName.var_0) return !!FALL;
    const T = T_(), s0 = R.byName.var_0.base;
    FALL = { flags: T.flags[s0], emit: T.emit[s0], filter: T.filter[s0], shape: T.shape[s0], layer: T.layer[s0], tint: T.tint[s0], hard: T.hard[s0], blast: T.blast[s0], height: T.height[s0], tex: T.tex.slice(s0 * 6, s0 * 6 + 6) };
    for (let k = 0; k < L.SLOTS; k++) { const t = R.byName['var_' + k]; if (!t) break; SLOTT[k] = t; O0[k] = { o: t.o, props: t.props, propIndex: t.propIndex, display: t.display, group: t.group }; }
    slotBase = SLOTT.length ? SLOTT[0].base : -1; slotEnd = SLOTT.length ? SLOTT[SLOTT.length - 1].base + SLOTT[SLOTT.length - 1].nstates : -1;
    return true;
  }
  L.slotType = (k) => { slotInit(); return SLOTT[k] || null; };
  L.slotCount = () => { slotInit(); return SLOTT.length; };
  // the slot a state belongs to (-1: none)
  L.slotOf = (s) => { slotInit(); return s >= slotBase && s < slotEnd ? Math.floor((s - slotBase) / L.SLOT_STATES) : -1; };
  L.slotRange = () => { slotInit(); return [slotBase, slotEnd]; };
  let smoothExtra = new Set();
  function setRow(s, from) {
    const T = T_();
    if (from < 0) {
      T.flags[s] = FALL.flags; T.emit[s] = FALL.emit; T.filter[s] = FALL.filter; T.shape[s] = FALL.shape; T.layer[s] = FALL.layer; T.tint[s] = FALL.tint; T.hard[s] = FALL.hard; T.blast[s] = FALL.blast; T.height[s] = FALL.height;
      T.tex.set(FALL.tex, s * 6); T.rc[s] = 0; R.models[s] = null; if (R.stateInfo) R.stateInfo[s] = null; if (R.terrace) R.terrace[s] = 0; if (R.natural) R.natural[s] = 0;
      smoothExtra.delete(s);
      return;
    }
    T.flags[s] = T.flags[from]; T.emit[s] = T.emit[from]; T.filter[s] = T.filter[from]; T.shape[s] = T.shape[from]; T.layer[s] = T.layer[from]; T.tint[s] = T.tint[from];
    T.hard[s] = T.hard[from]; T.blast[s] = T.blast[from]; T.height[s] = T.height[from];
    for (let f = 0; f < 6; f++) T.tex[s * 6 + f] = origTex(from, f);
    T.rc[s] = origRC(from); R.models[s] = origModel(from);
    if (R.stateInfo) R.stateInfo[s] = R.stateInfo[from];
    if (R.terrace) R.terrace[s] = R.terrace[from];
    if (R.natural) R.natural[s] = R.natural[from];
    if (R.smoothStates && R.smoothStates.indexOf(from) >= 0) smoothExtra.add(s); else smoothExtra.delete(s);
  }
  function syncSmooth() {
    // the smooth-ground states (VR.setLook turns their SMOOTH flag on and off): the variants of natural ground too
    const base = (R.smoothStates || new Int32Array(0)), keep = [];
    for (let i = 0; i < base.length; i++) { const s = base[i]; if (slotBase < 0 || s < slotBase || s >= slotEnd) keep.push(s); }
    for (const s of smoothExtra) keep.push(s);
    R.smoothStates = Int32Array.from(keep);
  }
  // a model variant: its own model from the source's definition (as shipped), its own override 'var_k' on top
  function cloneModel(name, src) {
    const VM = VR.VM, m = VM && VM.MODELS && VM.MODELS[src]; if (!m) return null;
    let c = null;
    try {
      if (m.lazy && m.src) c = VM.lazyModel(name, m.src);
      else { const d = (VM.DEFS || []).find(x => x.name === src); c = d ? VM.compile(name, d.o) : null; }
    } catch (e) { c = null; }
    if (!c || !c.parts || !c.parts.length) return null;
    c.display = m.display; if (m.def) c.def = m.def;
    return c;
  }
  function unfill(k) {
    const t = SLOTT[k]; if (!t || !O0[k]) return;
    for (let s = t.base; s < t.base + t.nstates; s++) { SNAP.delete(s); setRow(s, -1); }
    if (t.o && t.o.vx) VXSNAP.delete(t.o.vx);
    const z = O0[k];
    t.o = z.o; t.props = z.props; t.propIndex = z.propIndex; t.display = z.display; t.group = z.group; t.cat = null; t.defaultState = t.base; t.itemDef = null;
    if (VR.VM && VR.VM.MODELS && VR.VM.MODELS[t.name]) delete VR.VM.MODELS[t.name];
  }
  // fill slot k from its definition: the source's props, options and table rows (as shipped), its own name, drops
  // itself; states the source does not have stay the grey cube
  function fill(k, def) {
    const t = SLOTT[k], src = def && R.byName[def.src];
    if (!t || !src || src.nstates > t.nstates || slotIndex(src) >= 0 || !L.kindOf(src.name)) return false;
    const o = Object.assign({}, src.o);
    o.display = def.name || src.display; o.variantOf = src.name; o.varSlot = k; o.drops = t.name;
    o.cat = def.hidden ? null : src.cat;
    if (o.parent) delete o.parent;
    const ssp = src.o.vx;
    if (ssp && (ssp.kind === 'model' || ssp.res >= 16)) {
      const m = cloneModel(t.name, src.name); if (!m) return false;
      o.vx = Object.assign({}, ssp, { model: m, col: m.col });
      if (m.lazy) o.vx.lazy = true;
      VR.VM.MODELS[t.name] = m;
      if (VR.Custom && VR.Custom.forget) VR.Custom.forget(t.name);
      const ov = VR.CUSTOM && VR.CUSTOM.models && VR.CUSTOM.models[t.name];
      if (ov && VR.Custom && VR.Custom.applyModel) { try { VR.Custom.applyModel(t.name, ov); } catch (e) { /* the variant keeps its source's voxels */ } }
    } else if (ssp) o.vx = origSpec(ssp);
    t.o = o; t.props = src.props; t.propIndex = src.propIndex; t.display = o.display; t.group = src.group; t.cat = o.cat;
    t.defaultState = t.base + (src.defaultState - src.base); t.itemDef = null;
    for (let i = 0; i < t.nstates; i++) setRow(t.base + i, i < src.nstates ? src.base + i : -1);
    return true;
  }

  // ---------------------------------------------------------------- apply (every thread, the same way)
  let CUR = L.empty();
  const HOOKS = [];
  L.on = (fn) => { HOOKS.push(fn); };
  L.current = () => CUR;
  const sig = (o) => (o ? JSON.stringify(o) : '');
  // → the ids of the block types whose look changed (the caller re-meshes what holds them)
  L.apply = function (data, opts) {
    const D = L.normalize(data);
    slotInit();
    const changed = new Set();
    const prevL = CUR.looks, nextL = D.looks, prevS = CUR.slots, nextS = D.slots;
    const lookCh = [], slotCh = [];
    for (const n of new Set(Object.keys(prevL).concat(Object.keys(nextL)))) if (sig(prevL[n]) !== sig(nextL[n])) lookCh.push(n);
    for (const k of new Set(Object.keys(prevS).concat(Object.keys(nextS)))) if (sig(prevS[k]) !== sig(nextS[k])) slotCh.push(+k);
    let vxTouched = false;
    for (const n of lookCh) { const t = R.byName[n]; if (!t || slotIndex(t) >= 0) continue; restoreType(t); changed.add(t.id); if (t.o.vx) vxTouched = true; }
    for (const k of slotCh) { const t = SLOTT[k]; if (!t) continue; unfill(k); changed.add(t.id); vxTouched = true; }
    for (const k of slotCh) { const d = nextS[k], t = SLOTT[k]; if (!t || !d) continue; if (fill(k, d) && d.look) { try { applyLook(t, d.look); } catch (e) { /* one bad look never stops the rest */ } } }
    for (const n of lookCh) { const t = R.byName[n], lk = nextL[n]; if (!t || !lk || slotIndex(t) >= 0) continue; try { applyLook(t, lk); } catch (e) { /* */ } }
    if (slotCh.length) syncSmooth();
    CUR = D;
    if (changed.size) refresh(changed, vxTouched, slotCh, opts);
    return [...changed];
  };
  function refresh(changed, vx, slotCh, opts) {
    for (const id of changed) { const t = R.types[id]; if (t) t.itemDef = null; }
    if (vx && VR.VX) { if (slotCh.length && VR.VX.refreshStates) for (const k of slotCh) { const t = SLOTT[k]; if (t) VR.VX.refreshStates(t.base, t.nstates); } if (VR.VX.clearCache) VR.VX.clearCache(); }
    if (VR.meshCacheClear) VR.meshCacheClear();
    if (slotCh.length) {
      if (VR.PHYS && VR.PHYS.forget) for (const k of slotCh) { const t = SLOTT[k]; if (t) VR.PHYS.forget(t.base, t.nstates); }
      if (VR.WorldStyle && VR.WorldStyle.clearCache) VR.WorldStyle.clearCache();
    }
    for (const f of HOOKS) { try { f([...changed], { slots: slotCh.slice(), quiet: !!(opts && opts.quiet) }); } catch (e) { console.warn('looks hook', e); } }
  }
  // the Studio compiles its models anew (studio.js compileAll): the model variants are made again from them
  L.remodel = function () {
    slotInit();
    for (const k of Object.keys(CUR.slots)) { const d = CUR.slots[k], t = SLOTT[+k]; if (!t || !d || !t.o.variantOf || !(t.o.vx && t.o.vx.kind === 'model')) continue; unfill(+k); fill(+k, d); }
    if (VR.VX && VR.VX.refreshStates) for (const k of Object.keys(CUR.slots)) { const t = SLOTT[+k]; if (t) VR.VX.refreshStates(t.base, t.nstates); }
    if (VR.VX && VR.VX.clearCache) VR.VX.clearCache();
  };

  // ---------------------------------------------------------------- storage (the pages; workers get the data in a message)
  // a guest plays with the host's looks for the session (multiplayer), then with its own again
  L.session = null;
  L.load = function () { try { const t = typeof localStorage !== 'undefined' ? localStorage.getItem(L.KEY) : null; return L.normalize(t ? JSON.parse(t) : null); } catch (e) { return L.empty(); } };
  L.save = function (data) { try { const d = L.normalize(data); d.t = Date.now(); localStorage.setItem(L.KEY, JSON.stringify(d)); return true; } catch (e) { return false; } };
  L.effective = () => (L.session ? L.session : L.load());

  // ---------------------------------------------------------------- variants: hand-out, hide, messages
  // a new variant in the next free slot (handed out in order, never reused) → { ok, k, data } | { ok: false, why }
  L.addVariant = function (data, def) {
    const d = L.normalize(data), c = L.cleanSlot(def);
    if (!c) return { ok: false, why: 'bad' };
    if (!L.fits(c.src)) return { ok: false, why: R.byName[c.src] && R.byName[c.src].nstates > L.SLOT_STATES ? 'big' : 'bad' };
    if (d.next >= Math.min(L.SLOTS, L.slotCount() || L.SLOTS)) return { ok: false, why: 'full' };
    const k = d.next; c.t = c.t || Date.now(); d.slots[k] = c; d.next = k + 1;
    return { ok: true, k, name: 'var_' + k, data: d };
  };
  // „Löschen" only hides a variant: worlds may contain it
  L.hideVariant = function (data, k, on) { const d = L.normalize(data); if (d.slots[k]) { if (on === false) delete d.slots[k].hidden; else d.slots[k].hidden = true; } return d; };
  L.why = function (why) {
    if (why === 'full') return tx('live.var.full', { n: L.SLOTS }, 'Alle {n} Variantenplätze sind belegt — ändere eine Variante oder den Block „Für alle".', 'All {n} variant slots are taken — change a variant, or the block "for all".');
    if (why === 'big') return tx('live.var.big', null, 'Zu groß für eine Variante.', 'Too big for a variant.');
    return tx('live.var.bad', null, 'Davon geht keine Variante.', 'This cannot have a variant.');
  };

  // ---------------------------------------------------------------- a world keeps the variants it contains
  // the slots of the states in an array (a column's blocks, or its RLE pairs: every other value)
  L.scanSlots = function (arr, out, rle) {
    slotInit(); out = out || new Set(); if (slotBase < 0 || !arr) return out;
    const step = rle ? 2 : 1;
    for (let i = 0; i < arr.length; i += step) { const s = arr[i]; if (s >= slotBase && s < slotEnd) out.add(Math.floor((s - slotBase) / L.SLOT_STATES)); }
    return out;
  };
  // the world's copy: what it had, and the definition of every slot it uses now
  L.worldVars = function (prev, used, data) {
    const d = data || CUR, out = Object.assign({}, obj(prev) || {});
    for (const k of used || []) { const c = d.slots[k]; if (c) out[k] = JSON.parse(JSON.stringify(c)); }
    return out;
  };
  // a world opens: a slot its copy knows and this browser does not is taken over (a conflict keeps this browser's)
  L.restoreVars = function (vars, data) {
    const d = L.normalize(data), restored = [], conflicts = [];
    for (const key of Object.keys(obj(vars) || {})) {
      const k = +key; if (!Number.isInteger(k) || k < 0 || k >= L.SLOTS) continue;
      const c = L.cleanSlot(vars[key]); if (!c) continue;
      if (!d.slots[k]) { d.slots[k] = c; restored.push(k); d.next = Math.max(d.next, k + 1); }
      else if (sig(d.slots[k]) !== sig(c) && d.slots[k].src !== c.src) conflicts.push(k);
    }
    return { data: d, restored, conflicts };
  };

  // ---------------------------------------------------------------- the Studio-Paket for multiplayer (looks, slots, models)
  const enc = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(unescape(encodeURIComponent(s)), c => c.charCodeAt(0)));
  const dec = (u) => (typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(u) : decodeURIComponent(escape(String.fromCharCode.apply(null, u))));
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (str) => { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  L.PACK_MAX = 512 * 1024;
  // models: { name: override } (newest first is the caller's order); what does not fit is left out and counted
  L.packMake = function (data, models) {
    const d = L.normalize(data), out = { v: 1, looks: d.looks, slots: d.slots, next: d.next, models: {} };
    let size = JSON.stringify(out).length, left = 0;
    for (const n of Object.keys(obj(models) || {})) { const m = models[n]; if (!m) continue; const len = JSON.stringify(m).length + n.length + 4; if (size + len > L.PACK_MAX) { left++; continue; } out.models[n] = m; size += len; }
    out.left = left;
    return JSON.stringify(out);
  };
  L.packParts = function (str, per) { const s = b64(enc(str)), n = per || 3000, out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out.length ? out : ['']; };
  L.packJoin = function (parts) {
    try {
      if (!Array.isArray(parts) || !parts.length || parts.some(p => typeof p !== 'string')) return null;
      const o = JSON.parse(dec(unb64(parts.join(''))));
      if (!obj(o) || o.v !== 1) return null;
      const d = L.normalize(o), models = {};
      for (const n of Object.keys(obj(o.models) || {})) { const m = o.models[n]; if (obj(m) && typeof m.rle === 'string' && Array.isArray(m.pal) && m.rle.length < 4e6) models[n] = m; }
      return { data: d, models, left: o.left | 0 };
    } catch (e) { return null; }
  };

  // ---------------------------------------------------------------- the shaders' half (game and Studio share it)
  // a recoloured face (w5 bit 15 without the connected-glass bit 14): the texture's own detail — its luminance against
  // the layer's average luminance (a 64 × 64 R32F table, u_avgLum) — in the chosen colour, so the face's average
  // becomes that colour and light and dark texels stay light and dark
  L.GLSL = `
uniform highp sampler2D u_avgLum;
bool lookOn(uint w5) { return (w5 >> 14u) == 2u; }
vec3 lookRecolor(vec3 alb, float layer, vec3 col) {
  int li = int(layer + 0.5);
  float al = texelFetch(u_avgLum, ivec2(li & 63, li >> 6), 0).r;
  return col * (dot(alb, vec3(0.2126, 0.7152, 0.0722)) / max(al, 0.004));
}
`;
  // the table: the linear luminance average of every layer (level 0; cut-outs over their solid texels) — built on the
  // main thread from the albedo the renderer already has, only when a look recolours something
  let LUT = null;
  L.lumTable = function (albedo0, layers, N, cutMask) {
    if (!LUT) { LUT = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); } }
    const out = new Float32Array(4096), px = N * N;
    for (let l = 0; l < Math.min(layers, 4096); l++) {
      const off = l * px * 4, cut = !!(cutMask && cutMask[l]);
      let sum = 0, w = 0;
      for (let i = 0; i < px; i++) {
        const o = off + i * 4, a = albedo0[o + 3];
        if (cut && a < 128) continue;
        sum += 0.2126 * LUT[albedo0[o]] + 0.7152 * LUT[albedo0[o + 1]] + 0.0722 * LUT[albedo0[o + 2]]; w++;
      }
      out[l] = w ? sum / w : 0.5;
    }
    return out;
  };
  // does any look recolour (the table is only needed then)
  L.usesRC = function () { for (const n in CUR.looks) if (CUR.looks[n].rc) return true; for (const k in CUR.slots) if (CUR.slots[k].look && CUR.slots[k].look.rc) return true; return false; };
})(VR);

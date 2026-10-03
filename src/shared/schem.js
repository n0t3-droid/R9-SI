// ============================================================================
// Files in and out of the Werkbank (v0.35): the structures other block editors write — Sponge schematics (.schem,
// WorldEdit / Amulet / MCEdit Unified / Axiom), vanilla structure files (.nbt), Litematica (.litematic),
// MagicaVoxel (.vox) — become a Werkbank piece, and a piece goes out as .schem or .vox again. NBT, gzip
// (the browser's own (De)CompressionStream), Minecraft block names ↔ R9 blocks, and a small zip for hosts that only
// hand out certain file types.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const SC = VR.Schem = {};

  // ---------------------------------------------------------------- gzip
  async function pipe(u8, stream) { const s = new Blob([u8]).stream().pipeThrough(stream); return new Uint8Array(await new Response(s).arrayBuffer()); }
  SC.gunzip = (u8) => pipe(u8, new DecompressionStream('gzip'));
  SC.gzip = (u8) => pipe(u8, new CompressionStream('gzip'));
  SC.isGzip = (u8) => u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b;

  // ---------------------------------------------------------------- NBT (big endian)
  const td = new TextDecoder(), te = new TextEncoder();
  SC.nbtRead = function (u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let o = 0;
    const str = () => { const n = dv.getUint16(o); o += 2; const s = td.decode(u8.subarray(o, o + n)); o += n; return s; };
    const val = (t) => {
      switch (t) {
        case 1: { const v = dv.getInt8(o); o += 1; return v; }
        case 2: { const v = dv.getInt16(o); o += 2; return v; }
        case 3: { const v = dv.getInt32(o); o += 4; return v; }
        case 4: { const v = dv.getBigInt64(o); o += 8; return v; }
        case 5: { const v = dv.getFloat32(o); o += 4; return v; }
        case 6: { const v = dv.getFloat64(o); o += 8; return v; }
        case 7: { const n = dv.getInt32(o); o += 4; const v = new Int8Array(u8.buffer.slice(u8.byteOffset + o, u8.byteOffset + o + n)); o += n; return v; }
        case 8: return str();
        case 9: { const et = dv.getUint8(o); o += 1; const n = dv.getInt32(o); o += 4; const a = []; for (let i = 0; i < n; i++) a.push(val(et)); return a; }
        case 10: { const c = {}; for (;;) { const ct = dv.getUint8(o); o += 1; if (ct === 0) break; const k = str(); c[k] = val(ct); } return c; }
        case 11: { const n = dv.getInt32(o); o += 4; const a = new Int32Array(n); for (let i = 0; i < n; i++) { a[i] = dv.getInt32(o); o += 4; } return a; }
        case 12: { const n = dv.getInt32(o); o += 4; const a = new BigInt64Array(n); for (let i = 0; i < n; i++) { a[i] = dv.getBigInt64(o); o += 8; } return a; }
        default: throw new Error('NBT: unknown tag ' + t);
      }
    };
    const t = dv.getUint8(o); o += 1; if (t !== 10) throw new Error('NBT: no compound at the root');
    const name = str(); return { name, value: val(10) };
  };
  // writing: typed wrappers
  const N = SC.nbt = {
    byte: (v) => ({ t: 1, v }), short: (v) => ({ t: 2, v }), int: (v) => ({ t: 3, v }), str: (v) => ({ t: 8, v }),
    bytes: (v) => ({ t: 7, v }), ints: (v) => ({ t: 11, v }), list: (et, v) => ({ t: 9, et, v }), comp: (v) => ({ t: 10, v }),
  };
  SC.nbtWrite = function (name, root) {
    const chunks = []; let size = 0;
    const push = (u8) => { chunks.push(u8); size += u8.length; };
    const num = (n, f) => { const b = new Uint8Array(n), dv = new DataView(b.buffer); f(dv); push(b); };
    const str = (s) => { const b = te.encode(s); num(2, dv => dv.setUint16(0, b.length)); push(b); };
    const val = (x) => {
      switch (x.t) {
        case 1: return num(1, dv => dv.setInt8(0, x.v));
        case 2: return num(2, dv => dv.setInt16(0, x.v));
        case 3: return num(4, dv => dv.setInt32(0, x.v));
        case 7: num(4, dv => dv.setInt32(0, x.v.length)); return push(new Uint8Array(x.v.buffer, x.v.byteOffset, x.v.length));
        case 8: return str(x.v);
        case 9: num(1, dv => dv.setUint8(0, x.et)); num(4, dv => dv.setInt32(0, x.v.length)); for (const e of x.v) val(e); return;
        case 10: for (const k of Object.keys(x.v)) { num(1, dv => dv.setUint8(0, x.v[k].t)); str(k); val(x.v[k]); } return num(1, dv => dv.setUint8(0, 0));
        case 11: num(4, dv => dv.setInt32(0, x.v.length)); for (const v of x.v) num(4, dv => dv.setInt32(0, v)); return;
        case 4: return num(8, dv => dv.setBigInt64(0, BigInt(x.v)));
        case 12: num(4, dv => dv.setInt32(0, x.v.length)); for (const v of x.v) num(8, dv => dv.setBigInt64(0, BigInt(v))); return;
        default: throw new Error('NBT: cannot write tag ' + x.t);
      }
    };
    num(1, dv => dv.setUint8(0, 10)); str(name || ''); val(root);
    const out = new Uint8Array(size); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
  };

  // ---------------------------------------------------------------- block names ↔ R9 blocks
  // a Minecraft block id ("minecraft:oak_stairs" + properties) → an R9 state (-1: not known here)
  const ALIAS = { grass: 'short_grass', cave_air: 'air', void_air: 'air', structure_void: null, light: 'air', barrier: 'air', jigsaw: null, bubble_column: 'water', kelp_plant: 'kelp', twisting_vines_plant: 'twisting_vines', weeping_vines_plant: 'weeping_vines', tall_seagrass: 'seagrass', grass_path: 'dirt_path', moving_piston: 'air' };
  const VAL = { true: 1, false: 0, upper: 'top', lower: 'bottom', head: 'head', foot: 'foot' };
  SC.toState = function (id, props) {
    let name = String(id); const k = name.indexOf(':'); if (k >= 0) name = name.slice(k + 1);
    if (name in ALIAS) { const a = ALIAS[name]; if (a === null) return -2; name = a; }
    if (name === 'air') return 0;
    const t = R.byName[name]; if (!t) return -1;
    let s = t.defaultState;
    if (props) for (const p of t.props || []) {
      let v = props[p.name]; if (v === undefined) continue;
      v = String(v);
      let i = p.values ? p.values.findIndex(x => String(x) === v) : -1;
      if (i < 0 && VAL[v] !== undefined) i = p.values ? p.values.findIndex(x => String(x) === String(VAL[v])) : -1;
      if (i < 0 && /^\d+$/.test(v) && +v < p.n) i = +v;
      if (i >= 0) s = t.with(s, p.name, i);
    }
    return s;
  };
  // an R9 state → "minecraft:name[prop=value,…]" (blocks only R9 has keep the namespace "r9si")
  SC.toId = function (s) {
    if (!s) return 'minecraft:air';
    const t = R.types[R.T.type[s]]; if (!t) return 'minecraft:air';
    const ns = t.o.wiki ? 'minecraft:' : 'r9si:', ps = [];
    for (const p of t.props || []) { const i = t.get(s, p.name); let v = p.values ? p.values[i] : i; if (v === 0 || v === 1) { if (p.values && p.values.length === 2 && p.values[0] === 0) v = v ? 'true' : 'false'; } if (p.name === 'half' && (t.o.kind === 'door' || t.o.tall)) v = v === 'top' ? 'upper' : 'lower'; ps.push(p.name + '=' + v); }
    return ns + t.name + (ps.length ? '[' + ps.join(',') + ']' : '');
  };
  const parseId = (id) => { const m = /^([^[]+)(?:\[(.*)\])?$/.exec(id); const props = {}; if (m && m[2]) for (const kv of m[2].split(',')) { const [a, b] = kv.split('='); if (a) props[a.trim()] = (b || '').trim(); } return [m ? m[1] : id, props]; };

  // ---------------------------------------------------------------- readers → { sx, sy, sz, blocks: Uint16Array (0xffff keep), unknown: {name: n}, format }
  const KEEP = 0xffff;
  function grid(sx, sy, sz) { return { sx, sy, sz, blocks: new Uint16Array(sx * sy * sz).fill(KEEP), unknown: {} }; }
  const note = (g, name) => { g.unknown[name] = (g.unknown[name] || 0) + 1; };
  function varints(bytes, n) { const out = new Int32Array(n); let o = 0; for (let i = 0; i < n && o < bytes.length; i++) { let v = 0, sh = 0, b; do { b = bytes[o++] & 0xff; v |= (b & 0x7f) << sh; sh += 7; } while (b & 0x80 && o < bytes.length); out[i] = v; } return out; }
  function readSponge(root) {
    let S = root.Schematic || root; if (S.Schematic) S = S.Schematic;
    const sx = S.Width, sy = S.Height, sz = S.Length; if (!(sx > 0 && sy > 0 && sz > 0)) throw new Error('Schematic ohne Größe');
    const B = S.Blocks || S, pal = B.Palette || S.Palette, data = B.Data || B.BlockData || S.BlockData;
    if (!pal || !data) throw new Error('Schematic ohne Blöcke (alte MCEdit-Datei? Bitte als .schem speichern)');
    const map = []; for (const id of Object.keys(pal)) { const [n, p] = parseId(id); map[pal[id]] = { s: SC.toState(n, p), n }; }
    const g = grid(sx, sy, sz), idx = varints(data, sx * sy * sz);
    for (let i = 0; i < idx.length; i++) { const m = map[idx[i]]; if (!m) continue; if (m.s === -1) { note(g, m.n); g.blocks[i] = 0; } else if (m.s >= 0) g.blocks[i] = m.s; }
    g.format = 'schem';
    return g;
  }
  function readStructure(root) {
    const size = root.size; if (!size || size.length < 3) throw new Error('Strukturdatei ohne Größe');
    const pal = root.palette || (root.palettes && root.palettes[0]) || [];
    const map = pal.map(p => ({ s: SC.toState(p.Name, p.Properties || null), n: p.Name }));
    const g = grid(size[0], size[1], size[2]);
    for (const b of root.blocks || []) {
      const [x, y, z] = b.pos, m = map[b.state]; if (!m) continue;
      const i = (y * g.sz + z) * g.sx + x;
      if (m.s === -1) { note(g, m.n); g.blocks[i] = 0; } else if (m.s >= 0) g.blocks[i] = m.s;
    }
    g.format = 'nbt';
    return g;
  }
  function readLitematic(root) {
    const regs = root.Regions || {}; const names = Object.keys(regs); if (!names.length) throw new Error('Litematic ohne Regionen');
    // all regions into one box
    const parts = names.map(n => { const r = regs[n], p = r.Position, s = r.Size; const x0 = p.x + Math.min(0, s.x + 1), y0 = p.y + Math.min(0, s.y + 1), z0 = p.z + Math.min(0, s.z + 1); return { r, x0, y0, z0, sx: Math.abs(s.x), sy: Math.abs(s.y), sz: Math.abs(s.z) }; });
    const X0 = Math.min(...parts.map(p => p.x0)), Y0 = Math.min(...parts.map(p => p.y0)), Z0 = Math.min(...parts.map(p => p.z0));
    const g = grid(Math.max(...parts.map(p => p.x0 + p.sx)) - X0, Math.max(...parts.map(p => p.y0 + p.sy)) - Y0, Math.max(...parts.map(p => p.z0 + p.sz)) - Z0);
    for (const p of parts) {
      const pal = (p.r.BlockStatePalette || []).map(b => ({ s: SC.toState(b.Name, b.Properties || null), n: b.Name }));
      const bits = Math.max(2, Math.ceil(Math.log2(Math.max(1, pal.length)))), mask = (1n << BigInt(bits)) - 1n, L = p.r.BlockStates;
      const n = p.sx * p.sy * p.sz;
      for (let i = 0; i < n; i++) {
        const bit = BigInt(i * bits), li = Number(bit >> 6n), off = bit & 63n;
        let v = (BigInt.asUintN(64, L[li]) >> off) & mask;
        if (off + BigInt(bits) > 64n && li + 1 < L.length) v |= (BigInt.asUintN(64, L[li + 1]) << (64n - off)) & mask;
        const m = pal[Number(v)]; if (!m) continue;
        const x = i % p.sx, z = Math.floor(i / p.sx) % p.sz, y = Math.floor(i / (p.sx * p.sz));
        const j = ((p.y0 - Y0 + y) * g.sz + (p.z0 - Z0 + z)) * g.sx + (p.x0 - X0 + x);
        if (m.s === -1) { note(g, m.n); g.blocks[j] = 0; } else if (m.s >= 0) g.blocks[j] = m.s;
      }
    }
    g.format = 'litematic';
    return g;
  }
  // MagicaVoxel: colour indices → blocks through colorToState(r, g, b); z is up there
  SC.readVox = function (u8, colorToState) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const id = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
    if (id(0) !== 'VOX ') throw new Error('keine .vox-Datei');
    const models = [], pal = []; let size = null; const trn = [];
    const walk = (o, end) => {
      while (o + 12 <= end) {
        const cid = id(o), n = dv.getInt32(o + 4, true), ch = dv.getInt32(o + 8, true), c = o + 12;
        if (cid === 'SIZE') size = [dv.getInt32(c, true), dv.getInt32(c + 4, true), dv.getInt32(c + 8, true)];
        else if (cid === 'XYZI') { const k = dv.getInt32(c, true), v = []; for (let i = 0; i < k; i++) { const q = c + 4 + i * 4; v.push(u8[q], u8[q + 1], u8[q + 2], u8[q + 3]); } models.push({ size, v }); }
        else if (cid === 'RGBA') { for (let i = 0; i < 256; i++) { const q = c + i * 4; pal[i + 1] = [u8[q], u8[q + 1], u8[q + 2], u8[q + 3]]; } }
        else if (cid === 'nTRN') {
          // node id, attributes, child, reserved, layer, frames: the first frame's "_t" is the model's centre
          let q = c + 4; const dict = () => { const m = {}; const k = dv.getInt32(q, true); q += 4; for (let i = 0; i < k; i++) { const a = dv.getInt32(q, true); q += 4; const ks = td.decode(u8.subarray(q, q + a)); q += a; const b = dv.getInt32(q, true); q += 4; const vs = td.decode(u8.subarray(q, q + b)); q += b; m[ks] = vs; } return m; };
          dict(); q += 16; const frames = dv.getInt32(q - 4, true); const f = frames > 0 ? dict() : {};
          if (f._t) trn.push(f._t.split(' ').map(Number));
        }
        if (ch > 0) walk(c + n, c + n + ch);
        o = c + n + ch;
      }
    };
    walk(8, u8.length);
    if (!models.length) throw new Error('.vox ohne Modell');
    for (let i = 1; i <= 255; i++) if (!pal[i]) { const h = (i * 47) % 360, l = 40 + (i % 5) * 10; pal[i] = hsl(h, 60, l); }
    // models side by side unless the scene gives their places (centres)
    let ox = 0; const placed = models.map((m, k) => { const t = trn[k + 1] || trn[k]; const at = t && models.length > 1 ? [t[0] - (m.size[0] >> 1), t[2] - (m.size[2] >> 1), t[1] - (m.size[1] >> 1)] : [ox, 0, 0]; ox += m.size[0] + 1; return { m, at }; });
    const X0 = Math.min(...placed.map(p => p.at[0])), Y0 = Math.min(...placed.map(p => p.at[1])), Z0 = Math.min(...placed.map(p => p.at[2]));
    const g = grid(Math.max(...placed.map(p => p.at[0] + p.m.size[0])) - X0, Math.max(...placed.map(p => p.at[1] + p.m.size[2])) - Y0, Math.max(...placed.map(p => p.at[2] + p.m.size[1])) - Z0);
    const memo = new Map();
    for (const { m, at } of placed) for (let i = 0; i < m.v.length; i += 4) {
      const x = m.v[i], y = m.v[i + 1], z = m.v[i + 2], ci = m.v[i + 3];
      let s = memo.get(ci); if (s === undefined) { const c = pal[ci] || [200, 200, 200, 255]; s = colorToState(c[0], c[1], c[2]); memo.set(ci, s); }
      // vox (x, y, z-up) → R9 (x, y-up, z): depth y becomes z, mirrored so the front stays the front
      const gx = at[0] - X0 + x, gy = at[1] - Y0 + z, gz = g.sz - 1 - (at[2] - Z0 + y);
      if (gx >= 0 && gy >= 0 && gz >= 0 && gx < g.sx && gy < g.sy && gz < g.sz) g.blocks[(gy * g.sz + gz) * g.sx + gx] = s;
    }
    g.format = 'vox';
    return g;
  };
  function hsl(h, s, l) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255), 255]; }

  // any of them, from the file's bytes (name for the kind)
  SC.read = async function (name, u8, colorToState) {
    const lower = String(name || '').toLowerCase();
    if (lower.endsWith('.vox')) return SC.readVox(u8, colorToState);
    if (lower.endsWith('.json')) { const j = JSON.parse(td.decode(u8)); return SC.fromJSON(j); }
    let raw = u8;
    if (SC.isGzip(u8)) raw = await SC.gunzip(u8);
    const { value } = SC.nbtRead(raw);
    if (value.Regions) return readLitematic(value);
    if (value.size && (value.palette || value.palettes)) return readStructure(value);
    if (value.Schematic || value.Width || value.Palette) return readSponge(value);
    if (value.Blocks && value.Data && !value.Palette) throw new Error('Alte MCEdit-.schematic (Zahlen-IDs) — bitte in Amulet/WorldEdit als .schem speichern');
    throw new Error('Unbekanntes NBT-Format');
  };

  // ---------------------------------------------------------------- writers
  SC.writeSchem = async function (g, name) {
    const pal = new Map([['minecraft:air', 0]]), idx = new Int32Array(g.sx * g.sy * g.sz);
    for (let i = 0; i < idx.length; i++) { const s = g.blocks[i]; const id = s === KEEP || !s ? 'minecraft:air' : SC.toId(s); let k = pal.get(id); if (k === undefined) { k = pal.size; pal.set(id, k); } idx[i] = k; }
    const bytes = []; for (const v of idx) { let x = v; while (x >= 0x80) { bytes.push((x & 0x7f) | 0x80); x >>>= 7; } bytes.push(x); }
    const palC = {}; for (const [id, k] of pal) palC[id] = N.int(k);
    const root = N.comp({
      Version: N.int(2), DataVersion: N.int(3465), Width: N.short(g.sx), Height: N.short(g.sy), Length: N.short(g.sz),
      PaletteMax: N.int(pal.size), Palette: N.comp(palC), BlockData: N.bytes(Int8Array.from(bytes)), BlockEntities: N.list(10, []),
      Offset: N.ints(Int32Array.from([0, 0, 0])), Metadata: N.comp({ Name: N.str(name || 'R9 Werkbank'), Author: N.str('R9 Studio') }),
    });
    return SC.gzip(SC.nbtWrite('Schematic', root));
  };
  SC.writeVox = function (g, stateColor) {
    const cols = new Map(), vox = [];
    for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
      const s = g.blocks[(y * g.sz + z) * g.sx + x]; if (!s || s === KEEP) continue;
      const c = stateColor(s); const key = (c[0] << 16) | (c[1] << 8) | c[2];
      let k = cols.get(key); if (k === undefined) { if (cols.size >= 255) { let best = 1, bd = 1e9; for (const [kk, ii] of cols) { const d = (((kk >> 16) & 255) - c[0]) ** 2 + (((kk >> 8) & 255) - c[1]) ** 2 + ((kk & 255) - c[2]) ** 2; if (d < bd) { bd = d; best = ii; } } k = best; } else { k = cols.size + 1; cols.set(key, k); } }
      vox.push(x, g.sz - 1 - z, y, k);
    }
    const n = vox.length / 4, size = 12 + 12, xyzi = 12 + 4 + n * 4, rgba = 12 + 1024, out = new Uint8Array(8 + 12 + size + xyzi + rgba), dv = new DataView(out.buffer);
    let o = 0; const w4 = (s) => { for (let i = 0; i < 4; i++) out[o++] = s.charCodeAt(i); }, wi = (v) => { dv.setInt32(o, v, true); o += 4; };
    w4('VOX '); wi(150); w4('MAIN'); wi(0); wi(size + xyzi + rgba);
    w4('SIZE'); wi(12); wi(0); wi(Math.min(256, g.sx)); wi(Math.min(256, g.sz)); wi(Math.min(256, g.sy));
    w4('XYZI'); wi(4 + n * 4); wi(0); wi(n); for (let i = 0; i < vox.length; i++) out[o++] = vox[i] & 255;
    w4('RGBA'); wi(1024); wi(0); const pal = new Uint8Array(1024); for (const [key, k] of cols) { const q = (k - 1) * 4; pal[q] = (key >> 16) & 255; pal[q + 1] = (key >> 8) & 255; pal[q + 2] = key & 255; pal[q + 3] = 255; } out.set(pal, o); o += 1024;
    return out;
  };
  // the Werkbank's own format: a Bauteil as JSON (palette of R9 blocks)
  SC.toJSON = function (g, name) {
    const pal = [0, 'air'], map = new Map(), idx = new Uint16Array(g.blocks.length);
    for (let i = 0; i < idx.length; i++) { const s = g.blocks[i]; if (s === KEEP) continue; if (!s) { idx[i] = 1; continue; } let k = map.get(s); if (k === undefined) { k = pal.length; pal.push(VR.Custom.portable(s)); map.set(s, k); } idx[i] = k; }
    return { r9: 'bauteil', v: 1, name: name || 'Bauteil', sx: g.sx, sy: g.sy, sz: g.sz, dy: g.dy || 0, pal, rle: VR.Custom.b64(VR.Custom.vrle(idx)) };
  };
  SC.fromJSON = function (j) {
    if (!j || !j.sx || !j.rle) throw new Error('keine R9-Bauteil-Datei');
    const C = VR.Custom, pal = j.pal.map((p, i) => (i === 0 ? KEEP : i === 1 ? 0 : C.fromPortable(p))), idx = C.unvrle(C.unb64(j.rle), j.sx * j.sy * j.sz), g = grid(j.sx, j.sy, j.sz);
    for (let i = 0; i < idx.length; i++) { const s = pal[idx[i]]; g.blocks[i] = s === undefined || s < 0 ? 0 : s; }
    g.format = 'json'; g.name = j.name; g.dy = Math.max(-8, Math.min(0, Math.round(+j.dy) || 0));   // a house sits its floor into the ground
    return g;
  };

  // ---------------------------------------------------------------- a zip (stored, no compression) for hosts that hand out .zip but not .schem
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  SC.zip = function (files) {
    const parts = [], cen = []; let off = 0;
    for (const f of files) {
      const nm = te.encode(f.name), d = f.data, c = crc32(d), h = new Uint8Array(30 + nm.length), dv = new DataView(h.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(8, 0, true); dv.setUint32(14, c, true); dv.setUint32(18, d.length, true); dv.setUint32(22, d.length, true); dv.setUint16(26, nm.length, true); h.set(nm, 30);
      parts.push(h, d);
      const ce = new Uint8Array(46 + nm.length), cv = new DataView(ce.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint32(16, c, true); cv.setUint32(20, d.length, true); cv.setUint32(24, d.length, true); cv.setUint16(28, nm.length, true); cv.setUint32(42, off, true); ce.set(nm, 46);
      cen.push(ce); off += h.length + d.length;
    }
    let cl = 0; for (const c of cen) cl += c.length;
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cl, true); ev.setUint32(16, off, true);
    const all = parts.concat(cen, [end]); let n = 0; for (const p of all) n += p.length;
    const out = new Uint8Array(n); let o = 0; for (const p of all) { out.set(p, o); o += p.length; } return out;
  };
  SC.KEEP = KEEP;
})(VR);

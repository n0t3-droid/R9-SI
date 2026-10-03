// ============================================================================
// Block registry infrastructure: types, states, flags, per-state tables, models
// Deterministic: executed identically in main thread and in workers.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R = {
    types: [], byName: Object.create(null), stateCount: 1,
    texNames: [], texIndex: Object.create(null), texMeta: [],
    T: null, // tables (built in finalize)
    models: [], // per-state model (array of faces) or null
    cats: {}, // creative categories
  };

  // ---- Flags ----------------------------------------------------------------
  const F = VR.F = {
    SOLID: 1 << 0,        // has collision
    OPAQUE: 1 << 1,       // full opaque cube: occludes faces & blocks light
    FULL: 1 << 2,         // full cube geometry (AO occluder)
    CUTOUT: 1 << 3,
    TRANS: 1 << 4,
    FLUID: 1 << 5,
    WATER: 1 << 6,
    LAVA: 1 << 7,
    REPLACE: 1 << 8,      // replaceable when placing
    FALLING: 1 << 9,
    CLIMB: 1 << 10,
    LEAVES: 1 << 11,
    SELFCULL: 1 << 12,    // cull faces against same type (glass, leaves, ice)
    RANDTICK: 1 << 13,
    WAVE: 1 << 14,        // waving plant
    WAVELEAF: 1 << 15,
    RANDROT: 1 << 16,     // random texture rotation (top face)
    EMISSIVE: 1 << 17,    // full-bright texture
    CONDUCT: 1 << 18,     // conducts signal (solid opaque)
    NOITEM: 1 << 19,
    WATERLOG: 1 << 20,    // water-filled (seagrass, kelp...)
    INTERACT: 1 << 21,    // right-click does something
    MACRO: 1 << 22,       // world-space macro color variation
    UNBREAK: 1 << 23,
    BOUNCY: 1 << 24,
    SLOW: 1 << 25,
    PLANT: 1 << 26,       // needs soil support
    INVISIBLE: 1 << 27,
    POWERSRC: 1 << 28,
    GLOWTEX: 1 << 29,
    SMOOTH: 1 << 30,      // natural ground: the mesher draws its top as a smooth slope between neighbouring columns
  };

  // Shape ids
  const S = VR.SHAPE = { NONE: 0, CUBE: 1, CROSS: 2, CROP: 3, FLUID: 4, MODEL: 5, SLAB: 6, STAIRS: 7, FENCE: 8, WALL: 9, PANE: 10, WIRE: 11, CHORUS: 12, TALLCROSS: 13, DRIP: 14, VOXEL: 15 };
  const LAYER = VR.LAYER = { OPAQUE: 0, CUTOUT: 1, TRANS: 2 };

  // ---- Textures ---------------------------------------------------------------
  // tex meta: {anim: frames}
  function T(name, meta) {
    let i = R.texIndex[name];
    if (i === undefined) { i = R.texNames.length; R.texNames.push(name); R.texIndex[name] = i; R.texMeta.push(meta || null); }
    else if (meta && !R.texMeta[i]) R.texMeta[i] = meta;
    return i;
  }
  R.tex = T;
  // Animated textures reserve consecutive layers
  function TA(name, frames) {
    const first = T(name + '#0', { anim: frames });
    for (let f = 1; f < frames; f++) T(name + '#' + f, { animFrame: f });
    return first;
  }
  R.texAnim = TA;

  // ---- Colors -------------------------------------------------------------
  VR.COLORS = ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink'];
  VR.COLOR_HEX = {
    white: 0xF2F2EC, light_gray: 0x9FA3A6, gray: 0x4E5358, black: 0x1B1C22, brown: 0x7A4E2C, red: 0xB3312C,
    orange: 0xF07F24, yellow: 0xF7D23C, lime: 0x80C728, green: 0x4E6B1F, cyan: 0x179494, light_blue: 0x40AEE0,
    blue: 0x353A9E, purple: 0x7B2FB0, magenta: 0xC04BBE, pink: 0xF08FB0
  };
  VR.COLOR_NAME = c => c.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

  // ---- Properties / states ------------------------------------------------------
  // props: [[name, count or [values]] ...] ; state index = mixed radix, first prop least significant
  function normProps(props) {
    const out = [];
    let mul = 1;
    for (const p of props || []) {
      const name = p[0];
      const values = Array.isArray(p[1]) ? p[1] : Array.from({ length: p[1] }, (_, i) => i);
      out.push({ name, values, n: values.length, mul });
      mul *= values.length;
    }
    return { props: out, count: mul };
  }

  class BlockType {
    constructor(name, o) {
      this.name = name;
      this.o = o;
      const np = normProps(o.props);
      this.props = np.props;
      this.propIndex = {};
      for (let i = 0; i < this.props.length; i++) this.propIndex[this.props[i].name] = i;
      this.nstates = np.count;
      this.id = R.types.length;
      this.base = R.stateCount;
      R.stateCount += this.nstates;
      this.display = o.display || name.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      this.cat = o.cat || null;
      this.group = o.group || null;
      this.wiki = o.wiki || null;
      this.defaultState = this.base + (o.defaultIndex || 0);
    }
    // decode prop value index from state
    get(state, prop) { const p = this.props[this.propIndex[prop]]; return Math.floor((state - this.base) / p.mul) % p.n; }
    getV(state, prop) { const p = this.props[this.propIndex[prop]]; return p.values[Math.floor((state - this.base) / p.mul) % p.n]; }
    has(prop) { return this.propIndex[prop] !== undefined; }
    with(state, prop, v) {
      const p = this.props[this.propIndex[prop]];
      if (!p) return state;
      if (typeof v !== 'number') v = p.values.indexOf(v);
      const cur = Math.floor((state - this.base) / p.mul) % p.n;
      return state + (v - cur) * p.mul;
    }
    state(obj) { // build state from {prop: value}
      let idx = 0;
      for (const p of this.props) {
        let v = obj && obj[p.name] !== undefined ? obj[p.name] : 0;
        if (typeof v !== 'number') v = p.values.indexOf(v);
        idx += v * p.mul;
      }
      return this.base + idx;
    }
    decode(state) {
      const o = {}; const i = state - this.base;
      for (const p of this.props) o[p.name] = Math.floor(i / p.mul) % p.n;
      return o;
    }
  }
  R.BlockType = BlockType;

  function def(name, o) {
    if (R.byName[name]) throw new Error('dup block ' + name);
    const t = new BlockType(name, o || {});
    R.types.push(t);
    R.byName[name] = t;
    return t;
  }
  R.def = def;
  R.get = (name) => R.byName[name];
  R.S = (name, props) => { const t = R.byName[name]; if (!t) throw new Error('no block ' + name); return props ? t.state(props) : t.defaultState; };

  // ---- Model helpers ---------------------------------------------------------
  // A face: {p:[12 floats 0..1], uv:[8 floats in 1/16 texel units], tex, dir (normal face idx), cull (face idx or -1), shade(bool)}
  const FACE_UV = {
    // for each dir, function returning [u0,v0,u1,v1] from box (in 1/16 units)
    2: (b) => [b[0], b[2], b[3], b[5]],            // up: u=x, v=z
    3: (b) => [b[0], 16 - b[5], b[3], 16 - b[2]],  // down: u=x, v=16-z (flipped)
    4: (b) => [b[0], 16 - b[4], b[3], 16 - b[1]],  // south: u=x
    5: (b) => [16 - b[3], 16 - b[4], 16 - b[0], 16 - b[1]], // north: u=16-x
    0: (b) => [16 - b[5], 16 - b[4], 16 - b[2], 16 - b[1]], // east: u=16-z
    1: (b) => [b[2], 16 - b[4], b[5], 16 - b[1]],  // west: u=z
  };
  // vertex positions for face of box (units 0..16): order TL, BL, BR, TR
  function facePos(dir, b) {
    const [x0, y0, z0, x1, y1, z1] = b;
    switch (dir) {
      case 2: return [x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0];
      case 3: return [x0, y0, z1, x0, y0, z0, x1, y0, z0, x1, y0, z1];
      case 4: return [x0, y1, z1, x0, y0, z1, x1, y0, z1, x1, y1, z1];
      case 5: return [x1, y1, z0, x1, y0, z0, x0, y0, z0, x0, y1, z0];
      case 0: return [x1, y1, z1, x1, y0, z1, x1, y0, z0, x1, y1, z0];
      case 1: return [x0, y1, z0, x0, y0, z0, x0, y0, z1, x0, y1, z1];
    }
  }
  // box(x0,y0,z0,x1,y1,z1 in 1/16, tex (layer or {dir:layer} or function), opts)
  // opts: {faces: set of dirs to include, uv: {dir:[u0,v0,u1,v1]}, rot:{dir:0..3}, cull: bool(default auto), shade}
  function box(b, tex, opts) {
    opts = opts || {};
    const faces = [];
    for (let dir = 0; dir < 6; dir++) {
      if (opts.faces && opts.faces.indexOf(dir) < 0) continue;
      let t = typeof tex === 'number' ? tex : (tex[dir] !== undefined ? tex[dir] : (dir === 2 ? tex.top : dir === 3 ? tex.bottom : tex.side));
      if (t === undefined || t === null || t < 0) continue;
      const uvr = (opts.uv && opts.uv[dir]) || FACE_UV[dir](b);
      const [u0, v0, u1, v1] = uvr;
      let uv = [u0, v0, u0, v1, u1, v1, u1, v0];
      const rot = opts.rot && opts.rot[dir];
      if (rot) for (let r = 0; r < rot; r++) uv = [uv[2], uv[3], uv[4], uv[5], uv[6], uv[7], uv[0], uv[1]];
      const p = facePos(dir, b).map(v => v / 16);
      let cull = -1;
      if (opts.cull !== false) {
        if (dir === 0 && b[3] === 16) cull = 0; else if (dir === 1 && b[0] === 0) cull = 1;
        else if (dir === 2 && b[4] === 16) cull = 2; else if (dir === 3 && b[1] === 0) cull = 3;
        else if (dir === 4 && b[5] === 16) cull = 4; else if (dir === 5 && b[2] === 0) cull = 5;
      }
      faces.push({ p, uv, tex: t, dir, cull, shade: opts.shade !== false, tint: opts.tint || 0, flags: opts.flags || 0 });
    }
    return faces;
  }
  // Plane (for cross-shaped / arbitrary quads). pts: 4 points [x,y,z] in 1/16 units TL,BL,BR,TR; uv rect
  function quad(pts, tex, uvr, dir, opts) {
    opts = opts || {};
    const [u0, v0, u1, v1] = uvr || [0, 0, 16, 16];
    return { p: pts.flat().map(v => v / 16), uv: [u0, v0, u0, v1, u1, v1, u1, v0], tex, dir: dir === undefined ? 2 : dir, cull: opts.cull === undefined ? -1 : opts.cull, shade: opts.shade !== false, tint: opts.tint || 0, flags: opts.flags || 0, double: !!opts.double };
  }
  // Rotate model faces around Y axis by quarter turns (clockwise seen from above: north→east)
  const ROTY_DIR = [4, 5, 2, 3, 1, 0]; // dir after one 90° rotation: east→south, west→north, south→west, north→east
  function rotY(faces, q) {
    q = ((q % 4) + 4) % 4;
    if (!q) return faces;
    return faces.map(f => {
      const p = f.p.slice();
      let dir = f.dir, cull = f.cull;
      for (let r = 0; r < q; r++) {
        for (let i = 0; i < 12; i += 3) { const x = p[i], z = p[i + 2]; p[i] = 1 - z; p[i + 2] = x; }
        dir = ROTY_DIR[dir]; if (cull >= 0) cull = ROTY_DIR[cull];
      }
      return Object.assign({}, f, { p, dir, cull });
    });
  }
  // Rotate around X axis by quarter turns (y→z): used for up/down facing variants
  const ROTX_DIR = [0, 1, 4, 5, 3, 2]; // up→south, down→north, south→down, north→up
  function rotX(faces, q) {
    q = ((q % 4) + 4) % 4;
    if (!q) return faces;
    return faces.map(f => {
      const p = f.p.slice();
      let dir = f.dir, cull = f.cull;
      for (let r = 0; r < q; r++) {
        for (let i = 0; i < 12; i += 3) { const y = p[i + 1], z = p[i + 2]; p[i + 1] = 1 - z; p[i + 2] = y; }
        dir = ROTX_DIR[dir]; if (cull >= 0) cull = ROTX_DIR[cull];
      }
      return Object.assign({}, f, { p, dir, cull });
    });
  }
  function flipY(faces) {
    return faces.map(f => {
      const p = f.p.slice();
      for (let i = 0; i < 12; i += 3) p[i + 1] = 1 - p[i + 1];
      // reverse winding: swap vertex order TL<->BL, TR<->BR
      const q = [p[3], p[4], p[5], p[0], p[1], p[2], p[9], p[10], p[11], p[6], p[7], p[8]];
      const uv = [f.uv[2], f.uv[3], f.uv[0], f.uv[1], f.uv[6], f.uv[7], f.uv[4], f.uv[5]];
      const dir = f.dir === 2 ? 3 : f.dir === 3 ? 2 : f.dir;
      const cull = f.cull === 2 ? 3 : f.cull === 3 ? 2 : f.cull;
      return Object.assign({}, f, { p: q, uv, dir, cull });
    });
  }
  function translate(faces, dx, dy, dz) {
    return faces.map(f => {
      const p = f.p.slice();
      for (let i = 0; i < 12; i += 3) { p[i] += dx / 16; p[i + 1] += dy / 16; p[i + 2] += dz / 16; }
      return Object.assign({}, f, { p, cull: -1 });
    });
  }
  // Cross (X-shaped plant) quads
  function cross(tex, opts) {
    opts = opts || {};
    const h = opts.h || 16, i = opts.inset === undefined ? 0.8 : opts.inset, y0 = opts.y0 || 0;
    const a = i, b = 16 - i;
    const fl = opts.flags || 0;
    return [
      quad([[a, y0 + h, a], [a, y0, a], [b, y0, b], [b, y0 + h, b]], tex, [0, 16 - h, 16, 16], 2, { double: true, shade: false, flags: fl, tint: opts.tint }),
      quad([[a, y0 + h, b], [a, y0, b], [b, y0, a], [b, y0 + h, a]], tex, [0, 16 - h, 16, 16], 2, { double: true, shade: false, flags: fl, tint: opts.tint }),
    ];
  }
  // # shaped crop planes
  function cropHash(tex, opts) {
    opts = opts || {};
    const h = opts.h || 16, o = opts.off || 4, y0 = opts.y0 === undefined ? -1 : opts.y0;
    const fl = opts.flags || 0;
    const q = (pts) => quad(pts, tex, [0, 16 - h, 16, 16], 2, { double: true, shade: false, flags: fl, tint: opts.tint });
    return [
      q([[o, y0 + h, 0], [o, y0, 0], [o, y0, 16], [o, y0 + h, 16]]),
      q([[16 - o, y0 + h, 16], [16 - o, y0, 16], [16 - o, y0, 0], [16 - o, y0 + h, 0]]),
      q([[0, y0 + h, 16 - o], [0, y0, 16 - o], [16, y0, 16 - o], [16, y0 + h, 16 - o]]),
      q([[16, y0 + h, o], [16, y0, o], [0, y0, o], [0, y0 + h, o]]),
    ];
  }
  VR.MODEL = { box, quad, rotY, rotX, flipY, translate, cross, cropHash, FACE_UV, facePos };

  // ---- Finalize tables -----------------------------------------------------------
  R.finalize = function () {
    const n = R.stateCount;
    const T = R.T = {
      type: new Uint16Array(n), flags: new Uint32Array(n), emit: new Uint16Array(n), filter: new Uint8Array(n),
      shape: new Uint8Array(n), layer: new Uint8Array(n), tex: new Uint16Array(n * 6), tint: new Uint8Array(n),
      hard: new Float32Array(n), blast: new Float32Array(n), height: new Uint8Array(n),
    };
    R.models = new Array(n).fill(null);
    R.stateInfo = new Array(n).fill(null);
    // air (state 0)
    T.type[0] = 65535; T.flags[0] = F.REPLACE | F.INVISIBLE; T.shape[0] = S.NONE; T.filter[0] = 0;
    for (const t of R.types) {
      const o = t.o;
      for (let s = t.base; s < t.base + t.nstates; s++) {
        const props = t.decode(s);
        const info = typeof o.info === 'function' ? o.info(props, s) : null;
        const get = (key, dflt) => {
          if (info && info[key] !== undefined) return info[key];
          const v = o[key];
          if (typeof v === 'function' && key !== 'model' && key !== 'tex') return v(props, s);
          return v === undefined ? dflt : v;
        };
        T.type[s] = t.id;
        const shapeName = get('shape', 'cube');
        const shape = typeof shapeName === 'number' ? shapeName : S[shapeName.toUpperCase()];
        T.shape[s] = shape;
        const layerName = get('layer', 'opaque');
        T.layer[s] = layerName === 'opaque' ? 0 : layerName === 'cutout' ? 1 : 2;
        let fl = get('flags', 0);
        const solid = get('solid', shape === S.CUBE || shape === S.SLAB || shape === S.STAIRS || shape === S.FENCE || shape === S.WALL || shape === S.PANE || shape === S.MODEL);
        if (solid) fl |= F.SOLID;
        const full = shape === S.CUBE && get('full', true);
        if (full) fl |= F.FULL;
        const opaque = get('opaque', full && T.layer[s] === 0);
        if (opaque) fl |= F.OPAQUE | F.CONDUCT;
        if (T.layer[s] === 1) fl |= F.CUTOUT;
        if (T.layer[s] === 2) fl |= F.TRANS;
        if (get('smooth', false) && opaque) fl |= F.SMOOTH;
        T.flags[s] = fl;
        const light = get('light', null);
        if (light) T.emit[s] = VR.packLight(light[0], light[1], light[2]);
        T.filter[s] = get('filter', opaque ? 15 : 0);
        T.hard[s] = get('hard', 1);
        T.blast[s] = get('blast', T.hard[s]);
        const tint = get('tint', 0);
        T.tint[s] = tintCode(tint);
        T.height[s] = get('height', solid ? 16 : 0);
        // face textures for cube-like shapes
        let tx = o.tex;
        if (typeof tx === 'function') tx = tx(props, s);
        if (info && info.tex !== undefined) tx = info.tex;
        const faces = resolveFaces(tx);
        for (let f = 0; f < 6; f++) T.tex[s * 6 + f] = faces[f];
        if (o.model) {
          const m = o.model(props, s, faces);
          R.models[s] = m;
        }
      }
    }
  };
  // what a pane (glass pane, iron bars, glass balustrade) joins on its sides: other panes, walls and every full solid
  // block — stone and planks, but also glass, window and panorama glass (not leaves, like the original game).
  // The mesher and the collision boxes both ask this, so what you see is what you bump into.
  R.paneJoin = function (s) {
    if (!s) return false;
    const T = R.T, sh = T.shape[s], fl = T.flags[s];
    return sh === S.PANE || sh === S.WALL || (fl & F.OPAQUE) !== 0 || ((fl & F.FULL) !== 0 && (fl & F.SOLID) !== 0 && (fl & F.LEAVES) === 0);
  };
  // tint codes: 0 none, 1 grass, 2 foliage, 3 water, 4 birch, 5 spruce, 6 dry, 7 stem, 8+ fixed colors
  R.tintColors = [];
  function tintCode(tint) {
    if (!tint) return 0;
    const named = { grass: 1, foliage: 2, water: 3, birch: 4, spruce: 5, dry: 6, stem: 7 };
    if (typeof tint === 'string') return named[tint] || 0;
    let i = R.tintColors.indexOf(tint);
    if (i < 0) { i = R.tintColors.length; R.tintColors.push(tint); }
    return 8 + i;
  }
  R.tintCode = tintCode;
  // tex spec → 6 face values (layer | rot<<12)
  function resolveFaces(tx) {
    const out = [0, 0, 0, 0, 0, 0];
    if (tx === undefined || tx === null) return out;
    if (typeof tx === 'number') return [tx, tx, tx, tx, tx, tx];
    if (Array.isArray(tx)) return tx.slice(0, 6);
    const side = tx.side !== undefined ? tx.side : tx.all;
    out[0] = tx.east !== undefined ? tx.east : side;
    out[1] = tx.west !== undefined ? tx.west : side;
    out[2] = tx.top !== undefined ? tx.top : (tx.all !== undefined ? tx.all : side);
    out[3] = tx.bottom !== undefined ? tx.bottom : (tx.top !== undefined ? tx.top : (tx.all !== undefined ? tx.all : side));
    out[4] = tx.south !== undefined ? tx.south : side;
    out[5] = tx.north !== undefined ? tx.north : side;
    return out;
  }
  R.resolveFaces = resolveFaces;
  const ROT = (layer, r) => layer | (r << 12);
  R.ROT = ROT;
})(VR);

// ============================================================================
// R9 Studio · 🏠 Haus-Baukasten (v0.35): a whole house from a handful of choices
// — size, floors, roof, walls, windows, door, extras — with the inside done too:
// floors, a staircase up through every storey, lights, a kitchen, a sofa, beds.
// ✨ Genie fills the same choices from a photo or a sentence; the Baukasten
// turns them into ordinary game blocks (nothing here exists only in the Studio).
// House frame: u (x) along the front, v (z) from the front (v = 0, facing −z)
// to the back, y up from the floor slab (y = 0 sits in the ground: dy = −1).
// ============================================================================
(function () {
  'use strict';
  const R = VR.R, VM = VR.VM; if (!R) return;
  const KEEP = 0xffff;
  const HK = VR.HouseKit = {};
  const has = (n) => !!(n && R.byName[n]);
  const stC = new Map();
  const st = (name, props) => {
    const key = props ? name + JSON.stringify(props) : name;
    let s = stC.get(key); if (s !== undefined) return s;
    const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0;
    stC.set(key, s); return s;
  };
  const clamp = (v, a, b, d) => { v = Math.round(+v); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  const oneOf = (v, list, d) => (list.includes(v) ? v : d);
  const HEX = /^#?[0-9a-f]{6}$/i;
  const hex = (v, d) => (typeof v === 'string' && HEX.test(v.trim()) ? '#' + v.trim().replace('#', '').toLowerCase() : d);

  // ---------------------------------------------------------------- the choices
  HK.STYLES = ['cottage', 'modern', 'classic', 'cabin'];
  HK.ROOFS = ['gable', 'hip', 'flat', 'shed', 'pyramid', 'mansard'];
  HK.WALLS = ['plaster', 'brick', 'wood', 'stone', 'timber', 'log', 'concrete', 'glass'];
  HK.WINDOWS = ['small', 'std', 'tall', 'wide', 'panorama', 'arch', 'round'];
  HK.FRAMES = ['white', 'black', 'wood'];
  HK.DOORS = ['wood', 'glass', 'double', 'modern'];
  HK.EXTRAS = ['chimney', 'porch', 'balcony', 'garage', 'terrace', 'fence', 'columns', 'flowers', 'dormers', 'garden', 'pool', 'solar'];
  HK.DEFAULT = {
    name: 'Landhaus', style: 'cottage', width: 11, depth: 9, floors: 2, floorHeight: 4,
    roof: { type: 'gable', color: '#b0453a', ridge: 'side' },
    walls: { material: 'plaster', color: '#f1ece0' }, accent: '#ffffff',
    windows: { style: 'std', frame: 'white', shutters: null, front: 0, side: 0 },
    door: { position: 'center', kind: 'wood', color: '#8a5a32' },
    extras: ['chimney', 'flowers'], interior: true,
  };
  // anything (an AI answer, an old save, a half-filled form) → a complete, buildable spec
  HK.normalize = function (s) {
    s = s && typeof s === 'object' ? s : {};
    const D = HK.DEFAULT, r = s.roof || {}, w = s.walls || {}, win = s.windows || {}, d = s.door || {};
    const out = {
      name: String(s.name || D.name).slice(0, 40),
      style: oneOf(s.style, HK.STYLES, D.style),
      width: clamp(s.width, 7, 31, D.width), depth: clamp(s.depth, 7, 25, D.depth),
      floors: clamp(s.floors, 1, 4, D.floors), floorHeight: clamp(s.floorHeight, 4, 5, s.style === 'modern' || s.style === 'classic' ? 5 : 4),
      roof: { type: oneOf(r.type, HK.ROOFS, D.roof.type), color: hex(r.color, D.roof.color), ridge: oneOf(r.ridge, ['side', 'front'], D.roof.ridge) },
      walls: { material: oneOf(w.material, HK.WALLS, D.walls.material), color: hex(w.color, D.walls.color) },
      accent: hex(s.accent, s.style === 'cabin' ? '#5a3f2a' : s.style === 'modern' ? '#2a2a2a' : D.accent),
      windows: { style: oneOf(win.style, HK.WINDOWS, D.windows.style), frame: oneOf(win.frame, HK.FRAMES, D.windows.frame), shutters: hex(win.shutters, null), front: clamp(win.front, 0, 9, 0), side: clamp(win.side, 0, 7, 0) },
      door: { position: oneOf(d.position, ['left', 'center', 'right'], D.door.position), kind: oneOf(d.kind, HK.DOORS, D.door.kind), color: hex(d.color, D.door.color) },
      extras: (Array.isArray(s.extras) ? s.extras : D.extras).filter((e, i, a) => HK.EXTRAS.includes(e) && a.indexOf(e) === i),
      interior: s.interior !== false,
    };
    // a staircase needs room: floors above the ground need a run of floorHeight steps plus a landing
    if (out.floors > 1 && Math.max(out.width, out.depth) - 2 < out.floorHeight + 1) out.floorHeight = 4;
    if (out.floors > 1 && Math.max(out.width, out.depth) - 2 < out.floorHeight + 1) out.width = out.floorHeight + 3;
    if (out.floors < 2) out.extras = out.extras.filter(e => e !== 'balcony');
    return out;
  };

  // ---------------------------------------------------------------- blocks that fit a colour
  let NAMES = null;
  const allNames = () => NAMES || (NAMES = R.types.filter(t => t && !t.o.noItem).map(t => t.name));
  const grep = (re, not) => allNames().filter(n => re.test(n) && !(not && not.test(n)));
  const FAMC = {};
  const FAMS = {
    plasterVX: () => grep(/^vx_plaster_/).concat(['vx_adobe']),
    stucco: () => grep(/^stucco_[a-z]+$/),
    vollton: () => grep(/^vollton_[a-z_]+$/, /_gloss$|_slab$|_stairs$|_wall$/),
    brick: () => ['vx_redbrick', 'bricks', 'white_clinker', 'mud_bricks', 'nether_bricks', 'red_nether_bricks', 'deepstone_bricks', 'stone_bricks', 'tuff_bricks', 'resin_bricks'],
    woodVX: () => grep(/^vx_siding_/).concat(['vx_planks', 'vx_darkwood']),
    planks: () => grep(/_planks$/, /^vx_/),
    woodModern: () => ['wood_slat', 'walnut_panel'].concat(grep(/_planks$/, /^vx_/)),
    stone: () => ['vx_stonebrick', 'vx_fieldstone', 'vx_sandstone', 'stacked_stone', 'bossed_stone', 'travertine', 'stone_bricks', 'cobblestone', 'mossy_cobblestone', 'sandstone', 'smooth_sandstone', 'polished_andesite', 'polished_granite', 'polished_diorite', 'calcite', 'polished_tuff'],
    timber: () => grep(/^vx_timber_/),
    log: () => ['vx_logwall'].concat(grep(/_log$/, /stripped|crimson|warped|^vx_/)),
    concrete: () => ['concrete_smooth', 'micro_cement', 'charcoal_panel'].concat(grep(/_concrete$/), grep(/^vollton_(white|light_grey|stone_grey|mid_grey|anthracite|graphite|black)$/)),
    trim: () => ['white_trim', 'charcoal_panel', 'black_metal', 'stacked_stone', 'travertine', 'bossed_stone', 'stone_bricks', 'bricks', 'dark_oak_planks', 'spruce_planks', 'oak_planks'].concat(grep(/^stucco_[a-z]+$/), grep(/^vollton_[a-z_]+$/, /_gloss$|_slab$|_stairs$|_wall$/)),
    roof45: () => grep(/^vx_roof_/),
    hip: () => grep(/^vx_hip_/),
    woodDoor: () => grep(/_door$/, /trapdoor|^vx_|^door_|^vm_|garage|crimson|copper/),
    modernDoor: () => ['door_pivot_anthracite', 'door_flush_white', 'door_flush_oak', 'door_loft_black', 'door_slat_walnut', 'door_strip_anthracite', 'door_frosted_steel'],
    flowersVX: () => ['vx_windowbox', 'vx_windowbox_wood'],
  };
  const fam = (k) => FAMC[k] || (FAMC[k] = (FAMS[k] ? FAMS[k]() : []).filter(has));
  const rgbOf = (h) => { const v = parseInt(String(h).replace('#', ''), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  const memoN = new Map();
  // the block of a list whose face comes nearest to a colour (OKLab); without textures (tests in node) the first one
  function nearest(list, color, face) {
    if (!list || !list.length) return null;
    const BC = VR.BlockColors, key = list[0] + list.length + '|' + color + face;
    if (memoN.has(key)) return memoN.get(key);
    let best = list[0];
    if (BC && BC.colorOf && BC.ready && BC.ready()) {
      const c = rgbOf(color), L = BC.toLab(c[0], c[1], c[2]); let bd = Infinity;
      for (const n of list) {
        const q0 = BC.colorOf(R.byName[n].defaultState, face), q = BC.toLab(q0[0], q0[1], q0[2]);
        const d = (q[0] - L[0]) ** 2 * 0.7 + (q[1] - L[1]) ** 2 + (q[2] - L[2]) ** 2;
        if (d < bd) { bd = d; best = n; }
      }
      memoN.set(key, best);
    }
    return best;
  }
  HK.nearest = nearest;
  // a colour → the nearest entry of a small {name: 0xrrggbb} table (blocks that share one texture colour)
  const SHUTTERS = { green: 0x5e9a6a, blue: 0x4f7fb8, red: 0xb5423a, teal: 0x3e9c98, yellow: 0xe7b84a, violet: 0x7a55c8 };
  function nearestTable(tab, color) {
    const BC = VR.BlockColors, c = rgbOf(color); let best = Object.keys(tab)[0], bd = Infinity;
    for (const k in tab) { const h = tab[k], r = h >> 16 & 255, g = h >> 8 & 255, b = h & 255; const d = BC ? (() => { const p = BC.toLab(r, g, b), q = BC.toLab(c[0], c[1], c[2]); return (p[0] - q[0]) ** 2 * 0.7 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; })() : (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2; if (d < bd) { bd = d; best = k; } }
    return best;
  }
  const lum = (h) => { const c = rgbOf(h); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

  // the materials of a spec, chosen once per build
  function kit(S) {
    const K = {};
    const sty = S.style, m = S.walls.material;
    let list;
    switch (m) {
      case 'plaster': list = sty === 'modern' ? fam('stucco').concat(fam('vollton')) : sty === 'classic' ? fam('stucco').concat(fam('plasterVX'), ['white_clinker']) : fam('plasterVX').concat(fam('stucco')); break;
      case 'brick': list = fam('brick'); break;
      case 'wood': list = sty === 'modern' ? fam('woodModern') : fam('woodVX').concat(fam('planks')); break;
      case 'stone': list = fam('stone'); break;
      case 'timber': list = fam('timber'); break;
      case 'log': list = fam('log'); break;
      case 'concrete': list = fam('concrete'); break;
      default: list = null;
    }
    K.glassWall = m === 'glass';
    K.wall = K.glassWall ? (S.windows.frame === 'white' ? 'panorama_white' : 'panorama_black') : (nearest(list, S.walls.color, 'side') || 'stucco_white');
    K.isLog = /_log$/.test(K.wall);
    K.vxWall = /^vx_/.test(K.wall);
    K.accent = nearest(fam('trim'), S.accent, 'side') || 'white_trim';
    // the solid frame of a glass house: the accent, or the wall colour in Vollton when the accent is too close to glass
    K.frame = K.glassWall ? (nearest(fam('vollton').concat(fam('concrete')), S.accent, 'side') || 'vollton_graphite') : K.accent;
    K.band = (K.vxWall || K.isLog || m === 'timber') ? K.wall : K.accent;
    K.roof45 = nearest(fam('roof45'), S.roof.color, 'top') || 'vx_roof_slate';
    K.ridge = K.roof45.replace('vx_roof_', 'vx_ridge_'); if (!has(K.ridge)) K.ridge = K.roof45;
    K.hip = nearest(fam('hip'), S.roof.color, 'top') || 'vx_hip_slate';
    K.roofFill = 'roof_charcoal';
    const cosy = sty === 'cottage' || sty === 'cabin';
    K.floor = sty === 'modern' ? 'floor_oak' : sty === 'classic' ? 'floor_marble' : sty === 'cabin' ? 'vx_floor_spruce' : 'vx_floor_oak';
    if (!has(K.floor)) K.floor = 'oak_planks';
    K.ceiling = cosy ? 'spruce_planks' : 'stucco_white';
    K.stairs = sty === 'modern' ? 'stucco_white_stairs' : sty === 'classic' ? 'quartz_stairs' : sty === 'cabin' ? 'spruce_stairs' : 'oak_stairs';
    if (!has(K.stairs)) K.stairs = 'oak_stairs';
    K.light = cosy ? 'vx_lantern' : 'vx_pendant'; if (!has(K.light)) K.light = 'lantern';
    K.rail = sty === 'modern' ? 'glass_rail' : sty === 'classic' ? 'vx_balustrade' : sty === 'cabin' ? 'spruce_fence' : 'vx_fence_white';
    K.fence = sty === 'modern' ? 'vx_railing_black' : sty === 'classic' ? 'vx_balustrade' : sty === 'cabin' ? 'spruce_fence' : 'vx_fence_white';
    K.gate = sty === 'cabin' ? 'spruce_fence_gate' : 'oak_fence_gate';
    K.post = sty === 'classic' ? 'vx_column_classic' : sty === 'modern' ? 'black_metal' : sty === 'cabin' ? 'spruce_log' : 'vx_pillar_white';
    K.column = 'vx_column_classic';
    K.path = sty === 'modern' ? 'paver_grey' : sty === 'classic' ? 'travertine' : 'gravel';
    K.deck = sty === 'modern' || sty === 'classic' ? 'travertine' : 'spruce_planks';
    K.chimney = cosy ? 'vx_chimney_stone' : 'vx_chimney'; if (!has(K.chimney)) K.chimney = 'bricks';
    K.kitchen = sty === 'modern' ? (lum(S.walls.color) < 120 ? 'white' : 'black') : sty === 'classic' ? 'white' : 'oak';
    K.sofa = ['cream', 'taupe', 'sage', 'navy', 'charcoal'][(S.width * 7 + S.depth * 3) % 5];
    K.bed = ['white', 'sage', 'navy', 'grey', 'rose'][(S.width + S.depth * 5) % 5];
    // windows
    const fr = S.windows.frame, vmF = fr === 'black' ? 'black' : 'white';
    K.vmF = vmF;
    K.winCell = S.windows.shutters && has('vx_window_shutter_green') ? 'vx_window_shutter_' + nearestTable(SHUTTERS, S.windows.shutters) : fr === 'wood' ? 'vx_window_wood' : fr === 'black' && !cosy ? 'window_black' : 'vx_window';
    K.pane = fr === 'black' ? 'window_black' : 'window_white';
    K.pano = fr === 'white' ? 'panorama_white' : 'panorama_black';
    K.cosyWin = cosy;
    // doors
    const dk = S.door.kind;
    K.doorWood = nearest(fam('woodDoor'), S.door.color, 'side') || 'oak_door';
    K.doorModern = nearest(fam('modernDoor'), S.door.color, 'side') || 'door_flush_white';
    K.doorGlass = fr === 'white' ? 'door_glass_white' : 'door_glass_black';
    K.door = dk === 'glass' ? K.doorGlass : dk === 'modern' ? K.doorModern : K.doorWood;
    K.doorN = dk === 'double' || (dk === 'glass' && S.width >= 11) ? 2 : 1;
    K.windowbox = cosy ? (fr === 'wood' || sty === 'cabin' ? 'vx_windowbox_wood' : 'vx_windowbox') : null;
    return K;
  }

  // ---------------------------------------------------------------- the builder
  const FACE_IN = [2, 3, 0, 1];   // furniture against wall side s faces into the room
  // the game's wooden doors sit flush with the outside when they face into the house (as in the villages); the
  // modern door models (door_…) face out and sit recessed (as in the villas)
  const mcDoor = (n) => /_door$/.test(n) && !/^(door_|vm_|vx_)/.test(n);
  const doorF = (name, side) => (mcDoor(name) ? FACE_IN[side] : side);
  HK.doorF = doorF;
  const nameOf = (s) => { const t = s ? R.types[R.T.type[s]] : null; return t ? t.name : ''; };
  // the floor plan first (everything else fits around it): inner walls, the bathroom box, where the balcony goes
  function planOf(S) {
    const W = S.width, D = S.depth, SH = S.floorHeight, NF = S.floors;
    const pl = { alongU: W - 2 >= SH + 1, pu: 0, bath: [], rooms: [] };
    for (let k = 0; k < NF; k++) pl.rooms.push([{ u0: 1, u1: W - 2, v0: 1, v1: D - 2, kind: k === 0 ? 'living' : 'bed' }]);
    // a wide upper floor: a wall across the middle (door near the front) → the left side with the stairs, a bedroom right
    const pu = W >> 1;
    if (NF > 1 && W >= 12 && D >= 7 && (!pl.alongU || pu >= SH + 2)) pl.pu = pu;
    for (let k = 1; k < NF; k++) {
      if (!pl.pu) continue;
      pl.rooms[k] = [{ u0: 1, u1: pu - 1, v0: 1, v1: D - 2, kind: 'hall' }, { u0: pu + 1, u1: W - 2, v0: 1, v1: D - 2, kind: k === 1 ? 'master' : k === 2 ? 'kids' : 'guest' }];
      // the bathroom: a tiled box in the front-left corner of the left side, its door onto the corridor beside it
      if (pl.alongU && D >= 8 && pu >= 6) pl.bath[k] = { u0: 1, v0: 1, u1: 3, v1: 3, wu: 4, wv: 4, door: [4, 2], side: 1 };
    }
    // a one-storey house: the bathroom at the back-left (no stairs there), the bed in the open room
    if (NF === 1 && W >= 9 && D >= 8) pl.bath[0] = { u0: 1, v0: D - 4, u1: 3, v1: D - 2, wu: 4, wv: D - 5, door: [4, D - 3], side: 1 };
    // the balcony sits in front of a room, never in front of the inner wall
    pl.balC = pl.pu ? Math.min(W - 3, (pl.pu + W - 1) >> 1) : W >> 1;
    return pl;
  }
  HK.build = function (spec) {
    const S = HK.normalize(spec), K = kit(S), pl = planOf(S);
    const W = S.width, D = S.depth, SH = S.floorHeight, NF = S.floors, top = NF * SH;
    const ex = new Set(S.extras);
    const M = new Map(), key = (x, y, z) => ((y + 8) * 512 + (z + 64)) * 512 + (x + 64);
    // P(u, y, v, name|null, props): null = air (it clears whatever the world has there)
    const P = (u, y, v, name, props) => { const s = name ? (typeof name === 'number' ? name : st(name, props)) : 0; if (name && !s) return; M.set(key(u, y, v), s); };
    const get = (u, y, v) => M.get(key(u, y, v));
    const free = (u, y, v) => { const s = get(u, y, v); return s === undefined || s === 0; };
    const info = { roofTop: top, door: null };
    const wallAt = (u, y, v) => {
      if (K.isLog) P(u, y, v, K.wall, { axis: (v === 0 || v === D - 1) ? 1 : 2 });
      else P(u, y, v, K.wall);
    };
    const corner = (u, v) => (u === 0 || u === W - 1) && (v === 0 || v === D - 1);
    const busy = []; for (let k = 0; k <= NF; k++) busy.push(new Uint8Array(W * D));
    const mark = (k, u, v) => { if (u >= 0 && v >= 0 && u < W && v < D && busy[k]) busy[k][v * W + u] = 1; };
    const B = { S, K, pl, W, D, SH, NF, top, ex, P, get, free, info, busy, mark, wallAt };

    // ---- storeys: floor slab, walls, the rooms cleared
    for (let k = 0; k < NF; k++) {
      const y0 = k * SH;
      for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) {
        const edge = u === 0 || v === 0 || u === W - 1 || v === D - 1;
        P(u, y0, v, edge ? (k === 0 ? (K.vxWall ? 'stone_bricks' : K.band) : K.band) : K.floor);
        for (let y = y0 + 1; y < y0 + SH; y++) {
          if (!edge) { P(u, y, v, null); continue; }
          if (K.glassWall) { P(u, y, v, corner(u, v) ? K.frame : K.wall); continue; }
          wallAt(u, y, v);
        }
      }
      if (K.glassWall) for (const [u, v] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) for (let y = y0 + 1; y < y0 + SH; y++) P(u, y, v, K.frame);
      // classic: stone quoins at the corners
      if (S.style === 'classic' && !K.glassWall) for (const [u, v] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) for (let y = y0 + 1; y < y0 + SH; y++) if ((y - y0) % 2 === 1) P(u, y, v, K.accent);
    }
    // the foundation under the slab
    for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) P(u, -1, v, 'stone_bricks');

    // ---- doors and windows
    const dW = K.doorN;
    const du = S.door.position === 'left' ? Math.max(1, Math.round(W * 0.22)) : S.door.position === 'right' ? Math.min(W - 1 - dW, Math.round(W * 0.78) - dW + 1) : Math.max(1, (W - dW) >> 1);
    B.du = du; B.dW = dW;
    const doorAt = (u0, y, v, side, name, n) => {
      const f = doorF(name, side);
      for (let k = 0; k < n; k++) {
        const hinge = n === 2 ? (f === 2 ? 1 - k : k) : 0;
        P(u0 + k, y, v, name, { facing: f, half: 0, hinge, open: 0 });
        P(u0 + k, y + 1, v, name, { facing: f, half: 1, hinge, open: 0 });
        for (let yy = y + 2; yy < y - 1 + SH; yy++) if (!K.glassWall) P(u0 + k, yy, v, SH >= 5 && yy === y + 2 ? K.pane : get(u0 + k, yy, v) === undefined ? K.wall : get(u0 + k, yy, v));
      }
    };
    doorAt(du, 1, 0, 0, K.door, dW);
    info.door = [du, 1, 0];
    // where windows go on a wall: n units of width w evenly over the run lo..hi, skipping the cells in `avoid`
    const spots = (lo, hi, w, n, avoid) => {
      const run = hi - lo + 1; if (run < w) return [];
      if (!n) n = Math.max(1, Math.floor((run + 1) / (w + (S.windows.style === 'panorama' ? 1 : 2))));
      n = Math.min(n, Math.floor((run + 1) / (w + 1)));
      const out = [], gap = (run - n * w) / (n + 1);
      for (let i = 0; i < n; i++) {
        const a = Math.round(lo + gap * (i + 1) + w * i);
        let ok = true; for (let k = -1; k <= w; k++) if (avoid && avoid(a + k)) ok = false;
        if (ok) out.push(a);
      }
      return out;
    };
    // one window unit at a0 along wall side s (0 front, 1 right, 2 back, 3 left), storey floor y0
    const ws = S.windows.style;
    const unitW = ws === 'wide' ? (K.cosyWin ? 2 : 3) : ws === 'panorama' ? Math.max(2, Math.min(4, Math.floor(W / 4))) : 1;
    const vmWin = (name, s, a0, y, fixed) => {
      if (!VM || !VM.MODELS[name]) return false;
      const cells = VM.cells(name, s), mn = Math.min(...cells.map(c => (s & 1) ? c[1] : c[0]));
      if (s & 1) VM.put(P, fixed, y, a0 - mn, name, s); else VM.put(P, a0 - mn, y, fixed, name, s);
      return true;
    };
    const cell = (s, a, fixed) => (s & 1) ? [fixed, a] : [a, fixed];
    function windowUnit(s, a0, y0, w) {
      const fixed = s === 0 ? 0 : s === 1 ? W - 1 : s === 2 ? D - 1 : 0;
      const fx = (s & 1) ? 1 : 0;   // vx windows: 0 on front/back walls, 1 on the sides
      if (K.glassWall) return;
      if (ws === 'panorama') { for (let k = 0; k < w; k++) for (let y = y0 + 1; y < y0 + SH; y++) { const [u, v] = cell(s, a0 + k, fixed); P(u, y, v, K.pano); } return; }
      if (ws === 'round') { const [u, v] = cell(s, a0, fixed); P(u, y0 + 2, v, 'vx_window_round', { facing: fx }); return; }
      if (K.cosyWin) {
        const name = ws === 'arch' ? 'vx_window_arch' : K.winCell, tall = ws === 'tall' || SH >= 5;
        for (let k = 0; k < w; k++) {
          const [u, v] = cell(s, a0 + k, fixed);
          if (/^window_/.test(name)) { P(u, y0 + 2, v, name); if (tall) P(u, y0 + 3, v, name); }
          else { P(u, y0 + 2, v, name, { facing: fx }); if (tall && ws !== 'arch') P(u, y0 + 3, v, name, { facing: fx }); }
          if (K.windowbox && ex.has('flowers') && (s === 0 || s === 2)) { const ov = s === 0 ? -1 : D; P(u, y0 + 1, ov, K.windowbox, { facing: s === 0 ? 0 : 2 }); }
        }
        return;
      }
      // modern / classic: the furniture windows of the villas (frames, sills, mullions)
      const tall = ws === 'tall' && SH >= 5, kind = ws === 'small' ? 'high' : ws === 'arch' ? 'arch' : tall ? 'tall' : 'std';
      const n = Math.max(1, Math.min(3, w)), name = 'vm_win_' + kind + n + '_' + K.vmF;
      const y = kind === 'high' ? y0 + 2 : y0 + 1;
      if (!vmWin(name, s, a0, y, fixed)) for (let k = 0; k < w; k++) { const [u, v] = cell(s, a0 + k, fixed); P(u, y0 + 2, v, K.pane); }
    }
    const outChim = ex.has('chimney') && S.roof.type === 'gable' && S.roof.ridge !== 'front';
    for (let k = 0; k < NF; k++) {
      const y0 = k * SH, bc = pl.balC;
      const frontAvoid = (a) => (k === 0 && a >= du - 1 && a <= du + dW) || (k === 1 && ex.has('balcony') && a >= bc - 1 && a <= bc + 1) || (k > 0 && pl.pu && a === pl.pu);
      for (const a of spots(1, W - 2, unitW, S.windows.front, frontAvoid)) windowUnit(0, a, y0, unitW);
      for (const a of spots(1, W - 2, unitW, S.windows.front, (a) => (k === 0 && ex.has('terrace') && a >= W - 4 && a <= W - 2) || (k > 0 && pl.pu && a === pl.pu))) windowUnit(2, a, y0, unitW);
      const sideW = ws === 'panorama' ? Math.max(2, Math.min(4, Math.floor(D / 4))) : ws === 'wide' ? 2 : 1;
      for (const a of spots(1, D - 2, sideW, S.windows.side, (a) => outChim && a === (D >> 1))) windowUnit(1, a, y0, sideW);
      const bath = pl.bath[k];
      for (const a of spots(1, D - 2, sideW, S.windows.side, (a) => (ex.has('garage') && k === 0 && a >= 1 && a <= 3) || (bath && a === bath.wv))) windowUnit(3, a, y0, sideW);
    }
    // a glass house: solid frame bands at every floor, the door set again into the band
    if (K.glassWall) for (let k = 0; k < NF; k++) for (let u = 0; u < W; u++) { P(u, k * SH, 0, K.frame); P(u, k * SH, D - 1, K.frame); }
    if (K.glassWall) for (let v = 0; v < D; v++) for (let k = 0; k < NF; k++) { P(0, k * SH, v, K.frame); P(W - 1, k * SH, v, K.frame); }
    if (K.glassWall) doorAt(du, 1, 0, 0, K.door, dW);
    // classic: a frieze under the roof wherever the top row is plain wall
    if (S.style === 'classic' && !K.glassWall) { const wallS = st(K.wall); for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) if ((u === 0 || v === 0 || u === W - 1 || v === D - 1) && get(u, top - 1, v) === wallS) P(u, top - 1, v, K.accent); }

    // ---- the roof, the ceiling of the top storey, dormers
    roof(P, get, S, K, W, D, top, info, wallAt);
    if (S.roof.type !== 'flat') for (let v = 1; v < D - 1; v++) for (let u = 1; u < W - 1; u++) P(u, top, v, K.ceiling);
    if (ex.has('dormers')) dormers(B);

    // ---- stairs: one straight run per storey, stacked, along the back wall (or the right wall of a deep narrow house)
    if (NF > 1) {
      const alongU = pl.alongU;
      for (let k = 0; k < NF - 1; k++) {
        const y0 = k * SH, Ys = (k + 1) * SH;
        for (let s = 0; s < SH; s++) {
          const u = alongU ? 1 + s : W - 2, v = alongU ? D - 2 : 1 + s, y = y0 + 1 + s;
          P(u, y, v, K.stairs, { facing: alongU ? 1 : 2, half: 0 });
          if (k === 0) for (let yy = y0 + 1; yy < y; yy++) if (get(u, yy, v) === 0) P(u, yy, v, K.ceiling);   // the solid underside (upper runs float: the run below needs the head room)
          // headroom: the slab above the steps a player climbs through
          const headTop = y + 1 + 1.85; if (s < SH - 1 && Ys >= y + 1 && Ys < headTop) P(u, Ys, v, null);
          if (s < SH - 1 && Ys + 1 < headTop && get(u, Ys + 1, v) === undefined) P(u, Ys + 1, v, null);
          for (const kk of [k, k + 1]) { mark(kk, u, v); if (alongU) mark(kk, u, v - 1); else mark(kk, u - 1, v); }
        }
        if (alongU) { mark(k + 1, SH + 1, D - 2); mark(k + 1, SH + 1, D - 3); mark(k, 1, D - 3); } else { mark(k + 1, W - 2, SH + 1); mark(k + 1, W - 3, SH + 1); mark(k, W - 3, 1); }
        // a railing along the stairwell on the upper floor
        if (alongU) for (let s = 1; s < SH - 1; s++) { if (get(1 + s, Ys, D - 3) !== 0) P(1 + s, Ys + 1, D - 3, sRail(S)); }
        else for (let s = 1; s < SH - 1; s++) { if (get(W - 3, Ys, 1 + s) !== 0) P(W - 3, Ys + 1, 1 + s, sRail(S)); }
      }
    }
    // keep the doorways clear inside
    for (let k = 0; k < dW; k++) { mark(0, du + k, 1); mark(0, du + k, 2); }

    // ---- inner walls: the wall across a wide upper floor, the bathroom boxes
    const inner = S.style === 'modern' || S.style === 'classic' ? 'stucco_white' : S.style === 'cabin' ? 'spruce_planks' : 'birch_planks';
    const innerDoor = mcDoor(K.doorWood) ? 'birch_door' : 'door_flush_white';
    const innerDoorAt = (u, y, v, side) => { P(u, y, v, innerDoor, { facing: doorF(innerDoor, side), half: 0, hinge: 0, open: 0 }); P(u, y + 1, v, innerDoor, { facing: doorF(innerDoor, side), half: 1, hinge: 0, open: 0 }); };
    if (pl.pu) for (let k = 1; k < NF; k++) {
      const y0 = k * SH, pu = pl.pu;
      for (let v = 1; v <= D - 2; v++) { for (let y = y0 + 1; y < y0 + SH; y++) if (get(pu, y, v) === 0) P(pu, y, v, inner); mark(k, pu, v); }
      innerDoorAt(pu, y0 + 1, 2, 1);
      mark(k, pu - 1, 2); mark(k, pu + 1, 2);
    }
    for (let k = 0; k < NF; k++) {
      const b = pl.bath[k]; if (!b) continue;
      const y0 = k * SH, tile = S.style === 'modern' || S.style === 'classic' ? 'porcelain_tile' : 'vx_floor_tile';
      for (let v = Math.min(b.v0, b.wv); v <= Math.max(b.v1, b.wv); v++) for (let y = y0 + 1; y < y0 + SH; y++) if (get(b.wu, y, v) === 0) P(b.wu, y, v, inner);
      for (let u = Math.min(b.u0, b.wu); u <= Math.max(b.u1, b.wu); u++) for (let y = y0 + 1; y < y0 + SH; y++) if (get(u, y, b.wv) === 0) P(u, y, b.wv, inner);
      for (let v = Math.min(b.v0, b.wv); v <= Math.max(b.v1, b.wv); v++) mark(k, b.wu, v);
      for (let u = Math.min(b.u0, b.wu); u <= Math.max(b.u1, b.wu); u++) mark(k, u, b.wv);
      innerDoorAt(b.door[0], y0 + 1, b.door[1], b.side);
      mark(k, b.door[0] - 1, b.door[1]); mark(k, b.door[0] + 1, b.door[1]);
      for (let v = b.v0; v <= b.v1; v++) for (let u = b.u0; u <= b.u1; u++) if (has(tile)) P(u, y0, v, tile);
    }

    // ---- extras
    if (ex.has('porch') || ex.has('columns')) porch(P, S, K, W, D, SH, top, du, dW, ex);
    if (ex.has('balcony') && NF > 1) balcony(B);
    if (ex.has('garage')) garage(P, S, K, W, D, SH, ex);
    if (ex.has('terrace')) terrace(B);
    if (ex.has('pool')) pool(B);
    if (ex.has('fence')) fence(P, get, S, K, W, D, du, dW, ex);
    if (ex.has('chimney')) chimney(P, get, S, K, W, D, top, info);
    if (ex.has('garden')) garden(B);
    if (ex.has('solar')) solar(B);
    if (ex.has('flowers') && !K.cosyWin) { P(du - 1, 1, -1, 'vx_potplant'); P(du + dW, 1, -1, 'vx_potplant'); }
    gutters(B);

    // ---- inside: the interior designer, then a light in every room still dark
    const lit = S.interior ? designer(B) : [];
    for (let k = 0; k < NF; k++) for (const r of pl.rooms[k]) if (!(lit[k] || []).some(([u, v]) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1)) lights(P, get, K, W, D, (k + 1) * SH - 1, busy[k], r);
    for (let k = 0; k < NF; k++) { const b = pl.bath[k]; if (b && !(lit[k] || []).some(([u, v]) => u >= b.u0 && u <= b.u1 && v >= b.v0 && v <= b.v1)) lights(P, get, K, W, D, (k + 1) * SH - 1, null, b); }
    // at the door: a wall lamp, the house number, a letterbox
    if (has('vm_wall_lantern') && !K.glassWall && free(du + dW, 3, -1)) P(du + dW, 3, -1, 'vm_wall_lantern', { facing: 0 });
    if (has('vm_house_sign') && !K.glassWall && free(du - 1, 3, -1) && du - 1 >= 1) P(du - 1, 3, -1, 'vm_house_sign', { facing: 0 });
    if (has('vm_letterbox')) { const lu = du - 2, lv = ex.has('fence') ? -4 : -2; if (free(lu, 1, lv) && get(lu, 0, lv) !== st(K.path)) P(lu, 1, lv, 'vm_letterbox', { facing: 0 }); }

    // ---- into a block grid (cells nobody set keep the world's blocks)
    let x0 = 1e9, y0b = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (const k of M.keys()) { const x = (k % 512) - 64, z = (Math.floor(k / 512) % 512) - 64, y = Math.floor(k / 262144) - 8; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0b) y0b = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const sx = x1 - x0 + 1, sy = y1 - y0b + 1, sz = z1 - z0 + 1, blocks = new Uint16Array(sx * sy * sz).fill(KEEP);
    let n = 0;
    for (const [k, s] of M) { const x = (k % 512) - 64, z = (Math.floor(k / 512) % 512) - 64, y = Math.floor(k / 262144) - 8; blocks[((y - y0b) * sz + (z - z0)) * sx + (x - x0)] = s; if (s) n++; }
    return { sx, sy, sz, blocks, n, name: S.name, dy: y0b - 1, house: S, origin: [x0, y0b, z0], door: [info.door[0] - x0, info.door[1] - y0b, info.door[2] - z0] };
  };
  const sRail = (S) => (S.style === 'modern' ? 'glass_rail' : S.style === 'classic' ? 'vx_balustrade' : S.style === 'cabin' ? 'spruce_fence' : 'oak_fence');

  // ---------------------------------------------------------------- roofs
  function roof(P, get, S, K, W, D, top, info, wallAt) {
    const t = S.roof.type;
    const air = (u, y, v) => { if (u > 0 && u < W - 1 && v > 0 && v < D - 1) P(u, y, v, null); };
    if (t === 'flat') {
      for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) {
        const edge = u === 0 || v === 0 || u === W - 1 || v === D - 1;
        P(u, top, v, edge ? K.band : K.ceiling);
        if (edge) P(u, top + 1, v, K.glassWall ? K.frame : K.accent);
        else P(u, top + 1, v, 'roof_charcoal_slab', { type: 'bottom' });
      }
      info.roofTop = top + 1;
      return;
    }
    if (t === 'gable' || t === 'shed' && false) {
      const ridgeX = S.roof.ridge !== 'front';
      const span = ridgeX ? D : W, len = ridgeX ? W : D;
      const at = (a, b) => (ridgeX ? [a, b] : [b, a]);
      const upF = ridgeX ? 2 : 1, upB = ridgeX ? 0 : 3;
      for (let i = 0; ; i++) {
        const y = top - 1 + i, bf = i - 1, bb = span - i;
        if (bf > bb) break;
        for (let a = -1; a <= len; a++) {
          if (bf < bb) {
            const [u1, v1] = at(a, bf), [u2, v2] = at(a, bb);
            P(u1, y, v1, K.roof45, { facing: upF }); P(u2, y, v2, K.roof45, { facing: upB });
            for (let b = bf + 1; b < bb; b++) {
              const [u, v] = at(a, b);
              if (i < 1) continue;
              if (a === 0 || a === len - 1) wallAt(u, y, v);
              else if (a > 0 && a < len - 1) air(u, y, v);
            }
          } else { const [u, v] = at(a, bf); P(u, y, v, K.ridge, { facing: ridgeX ? 0 : 1 }); }
        }
        info.roofTop = y;
      }
      // a round window in each gable when there is room
      if (span >= 5) { const mid = (span - 1) >> 1; for (const a of [0, len - 1]) { const [u, v] = at(a, mid); P(u, top + 1, v, 'vx_window_round', { facing: ridgeX ? 1 : 0 }); } }
      return;
    }
    if (t === 'shed') {
      // a low single slope rising to the back (the 22° pieces: two cells per block of rise)
      const name = K.hip;
      for (let v = -1; v <= D; v++) {
        const r = v + 1, k = r >> 1, part = r & 1, y = top + k;
        for (let u = -1; u <= W; u++) {
          P(u, y, v, name, { facing: 2, part });
          for (let yy = top; yy < y; yy++) {
            if (u === 0 || u === W - 1 || v === D - 1) { if (v >= 0 && v < D) wallAt(u, yy, v); }
            else if (u > 0 && u < W - 1 && v > 0 && v < D - 1) P(u, yy, v, yy === top ? K.ceiling : null);
          }
        }
        info.roofTop = Math.max(info.roofTop, y);
      }
      return;
    }
    if (t === 'hip') { info.roofTop = hipLow(P, -1, -1, W, D, top, K.hip, K.roofFill); return; }
    if (t === 'mansard') {
      for (let v = -1; v <= D; v++) for (let u = -1; u <= W; u++) {
        const iu = Math.min(u + 1, W - u), iv = Math.min(v + 1, D - v), inset = Math.min(iu, iv);
        const f = iu < iv ? (u + 1 < W - u ? 1 : 3) : (v + 1 < D - v ? 2 : 0);
        if (inset === 0) { if (iu === iv) P(u, top, v, K.band); else P(u, top, v, K.roof45, { facing: f }); }
        else if (inset === 1) { P(u, top, v, K.band); const dormer = (v === 0 || v === D - 1) && u >= 2 && u <= W - 3 && (u % 3 === 1); P(u, top + 1, v, dormer ? (K.cosyWin ? 'vx_window' : K.pane) : K.roof45, dormer ? (K.cosyWin ? { facing: 0 } : undefined) : { facing: f }); if (dormer) P(u, top + 2, v, 'roof_charcoal_slab', { type: 'bottom' }); }
        else P(u, top + 1, v, K.roofFill);
      }
      info.roofTop = hipLow(P, 1, 1, W - 2, D - 2, top + 2, K.hip, K.roofFill);
      return;
    }
    // pyramid (and anything else): 45° rings stepping in to a point or a ridge
    for (let r = 0; ; r++) {
      const ua = -1 + r, va = -1 + r, ub = W - r, vb = D - r, y = top - 1 + r;
      if (ua > ub || va > vb) break;
      for (let v = va; v <= vb; v++) for (let u = ua; u <= ub; u++) {
        const ring = u === ua || u === ub || v === va || v === vb;
        if (!ring) { if (r >= 1) air(u, y, v); continue; }
        if (ua === ub || va === vb) { P(u, y, v, ua === ub && va === vb ? K.ridge : K.ridge, { facing: ua === ub ? 1 : 0 }); continue; }
        const iu = Math.min(u - ua, ub - u), iv = Math.min(v - va, vb - v);
        const f = iu < iv ? (u - ua < ub - u ? 1 : 3) : iv < iu ? (v - va < vb - v ? 2 : 0) : (Math.abs(u - (ua + ub) / 2) * D >= Math.abs(v - (va + vb) / 2) * W ? (u < (ua + ub) / 2 ? 1 : 3) : (v < (va + vb) / 2 ? 2 : 0));
        P(u, y, v, K.roof45, { facing: f });
      }
      info.roofTop = y;
    }
  }
  // the low 22° hip roof of the villas: rings of half-slope pieces (lower/upper halves, corners left/right)
  function hipLow(P, ua, va, ub, vb, y0, name, fill) {
    const spanU = ub - ua + 1, spanV = vb - va + 1, minSpan = Math.min(spanU, spanV), maxInset = (minSpan - 1) >> 1;
    const rows = minSpan & 1 ? 1 : 2;
    for (let v = va; v <= vb; v++) for (let u = ua; u <= ub; u++) {
      const iu = Math.min(u - ua, ub - u), iv = Math.min(v - va, vb - v), inset = Math.min(iu, iv);
      const k = inset >> 1, up = inset & 1;
      for (let y = y0 + 1; y < y0 + k; y++) P(u, y, v, fill);
      if (inset === maxInset) {
        if ((maxInset & 1) === 0) { if (k > 0) P(u, y0 + k - 1, v, fill); P(u, y0 + k, v, 'roof_charcoal_slab', { type: 'bottom' }); continue; }
        if (rows === 1) { P(u, y0 + k, v, fill); continue; }
      }
      const fu = (u - ua < ub - u) ? 1 : 3, fv = (v - va < vb - v) ? 2 : 0;
      let facing = fu, part = up;
      if (iu < iv) facing = fu; else if (iv < iu) facing = fv; else part = up | ((((fv - fu) & 3) === 1 ? 1 : 2) << 1);
      P(u, y0 + k, v, name, { facing, part });
    }
    return y0 + (maxInset >> 1) + 1;
  }

  // ---------------------------------------------------------------- extras
  function porch(P, S, K, W, D, SH, top, du, dW, ex) {
    const big = ex.has('columns');
    const u0 = big ? Math.max(0, du - 2) : du - 1, u1 = big ? Math.min(W - 1, du + dW + 1) : du + dW, deep = 2;
    const roofY = big ? top - 1 : Math.min(SH, top - 1);
    for (let u = u0; u <= u1; u++) for (let v = -deep; v <= -1; v++) {
      P(u, 0, v, K.path === 'gravel' ? 'stone_bricks' : K.path);
      for (let y = 1; y < roofY; y++) P(u, y, v, null);
      P(u, roofY, v, K.accent);
    }
    // the posts / columns at the outer corners (and every other cell under a portico)
    const posts = big ? [] : [u0, u1];
    if (big) for (let u = u0; u <= u1; u += 2) posts.push(u); if (big && posts[posts.length - 1] !== u1) posts.push(u1);
    for (const u of posts) for (let y = 1; y < roofY; y++) P(u, y, -deep, big ? K.column : K.post, K.post === 'spruce_log' && !big ? { axis: 0 } : undefined);
    if (big) for (let u = u0; u <= u1; u++) P(u, roofY + 1, -deep, K.rail === 'glass_rail' ? K.accent : 'white_trim_slab', K.rail === 'glass_rail' ? undefined : { type: 'bottom' });
  }
  function balcony(B) {
    const { P, S, K, W, SH, ex, busy, pl } = B;
    const c = pl.balC, u0 = Math.max(1, c - 2), u1 = Math.min(W - 2, c + 2), y = SH;
    for (let u = u0; u <= u1; u++) for (let v = -2; v <= -1; v++) { P(u, y, v, K.accent); P(u, y + 1, v, null); P(u, y + 2, v, null); }
    for (let u = u0; u <= u1; u++) P(u, y + 1, -2, K.rail);
    for (const u of [u0, u1]) P(u, y + 1, -1, K.rail);
    // the door out (glass), in the middle of the balcony; two chairs and a little table out there when it is wide
    const g = K.doorGlass;
    P(c, y + 1, 0, g, { facing: 0, half: 0, hinge: 0, open: 0 }); P(c, y + 2, 0, g, { facing: 0, half: 1, hinge: 0, open: 0 });
    for (let yy = y + 3; yy < y + SH; yy++) P(c, yy, 0, K.glassWall ? K.wall : K.cosyWin ? K.wall : K.pane);
    if (busy[1]) { busy[1][1 * W + c] = 1; busy[1][2 * W + c] = 1; }
    if (VM && VM.MODELS.vm_garden_chair && u1 - u0 >= 4) { VM.put(P, u0 + 1, y + 1, -2 + 1, 'vm_garden_chair', 2); VM.put(P, u1 - 1, y + 1, -1, 'vm_garden_chair', 2); if (has('vx_potplant')) P(u0 + 1, y + 1, -2, null); }
    // brackets under a balcony without porch posts
    if (!ex.has('porch') && !ex.has('columns')) for (const u of [u0, u1]) P(u, y - 1, -1, K.rail === 'glass_rail' ? 'black_metal' : K.accent);
  }
  function garage(P, S, K, W, D, SH, ex) {
    const GW = 7, gd = Math.min(D, 7), x0 = -GW, x1 = -1, h = 3;
    for (let v = 0; v < gd; v++) for (let u = x0; u <= x1; u++) {
      const edge = u === x0 || v === 0 || v === gd - 1;
      P(u, -1, v, 'stone_bricks'); P(u, 0, v, edge ? K.band : 'concrete_smooth');
      for (let y = 1; y <= h; y++) P(u, y, v, edge ? (K.glassWall ? K.frame : K.wall) : null);
      P(u, h + 1, v, edge || v === 0 ? K.accent : 'roof_charcoal_slab', edge || v === 0 ? undefined : { type: 'bottom' });
      if (u === x1 && !edge) for (let y = 1; y <= h; y++) P(u, y, v, null);
    }
    // the door: 5 wide × 3 high garage door blocks, a driveway in front
    for (let u = x0 + 1; u <= x1 - 1; u++) for (let y = 1; y <= 3; y++) P(u, y, 0, 'garage_door');
    for (let u = x0 + 1; u <= x1 - 1; u++) for (let v = -3; v <= -1; v++) P(u, 0, v, 'paver_grey');
    // a car when there is room
    if (gd >= 6 && has('vx_car_black')) car(P, x0 + 2, 1, 1, 2, ['vx_car_black', 'vx_car_white', 'vx_car_red', 'vx_car_blue', 'vx_car_silver'][(W + D) % 5]);
    // solar panels on the flat garage roof
    if (ex && ex.has('solar') && has('vx_solar')) for (let u = x0 + 1; u <= x1 - 1; u++) for (let v = 1; v <= gd - 2; v += 2) P(u, h + 2, v, 'vx_solar', { facing: 0 });
    // and the door from the garage into the house (the house's left wall)
    const dv = Math.min(gd - 2, 2);
    if (dv >= 1) { P(0, 1, dv, 'birch_door', { facing: doorF('birch_door', 3), half: 0, hinge: 0, open: 0 }); P(0, 2, dv, 'birch_door', { facing: doorF('birch_door', 3), half: 1, hinge: 0, open: 0 }); }
  }
  // a parked car: 2 wide × 4 long × 2 tall, (u, v) its front-left corner (as the town builder parks them)
  function car(P, u, v, y, facing, name) {
    const along = (facing & 1) === 0;
    for (let p = 0; p < 16; p++) {
      const px = p & 1, py = (p >> 1) & 1, pz = p >> 2;
      const du = along ? px : pz, dv = along ? pz : px;
      const uu = facing === 2 ? u + 1 - du : facing === 3 ? u + 3 - du : u + du;
      const vv = facing === 0 ? v + 3 - dv : facing === 1 ? v + 1 - dv : v + dv;
      P(uu, y + py, vv, name, { facing, part: 'p' + p });
    }
  }
  function terrace(B) {
    const { P, S, K, W, D, busy, top } = B;
    for (let u = 0; u < W; u++) for (let v = D; v <= D + 2; v++) { P(u, 0, v, K.deck); P(u, 1, v, null); P(u, 2, v, null); }
    // the door out at the back, on the right (the stairs run along the back wall from the left)
    const tu = W - 3, g = K.cosyWin ? K.doorWood : K.doorGlass;
    if (S.floors < 2 || W - 2 < S.floorHeight + 1 || tu > S.floorHeight + 1) {
      P(tu, 1, D - 1, g, { facing: doorF(g, 2), half: 0, hinge: 0, open: 0 }); P(tu, 2, D - 1, g, { facing: doorF(g, 2), half: 1, hinge: 0, open: 0 });
      if (busy[0]) { busy[0][(D - 2) * W + tu] = 1; busy[0][(D - 3) * W + tu] = 1; }
    }
    if (VM && VM.MODELS.vm_garden_table && W >= 8) {
      const cu = Math.max(1, (W >> 1) - 2);
      VM.put(P, cu, 1, D + 1, 'vm_garden_table', 0);
      VM.put(P, cu - 1, 1, D + 1, 'vm_garden_chair', 1); VM.put(P, cu + 2, 1, D + 1, 'vm_garden_chair', 3);
      if (W >= 12 && VM.MODELS.vm_bbq) VM.put(P, W - 3, 1, D + 1, 'vm_bbq', 0);
      if (VM.MODELS.vm_planter) { VM.put(P, 0, 1, D + 2, 'vm_planter', 0); VM.put(P, W - 1, 1, D + 2, 'vm_planter', 0); }
    }
    // a flat roof becomes a roof terrace: loungers, a parasol, planters (the parapet keeps everyone up there)
    if (S.roof.type === 'flat' && VM && VM.MODELS.vm_lounger && W >= 9 && D >= 7) {
      const y = top + 2;
      VM.put(P, 2, y, 2, 'vm_lounger', 2); VM.put(P, 4, y, 2, 'vm_lounger', 2);
      if (VM.MODELS.vm_planter) { VM.put(P, 1, y, D - 2, 'vm_planter', 0); VM.put(P, W - 2, y, D - 2, 'vm_planter', 0); VM.put(P, W - 2, y, 1, 'vm_planter', 0); }
      if (VM.MODELS.vm_outdoor_sofa && W >= 12) VM.put(P, W - 5, y, D - 3, 'vm_outdoor_sofa', 0);
    }
  }
  // a pool behind the house (behind the terrace when there is one): tiled basin, water two deep, a stone rim, loungers
  function pool(B) {
    const { P, get, S, K, W, D, ex } = B;
    if (W < 9) return;
    const pw = Math.max(4, Math.min(W - 4, 9)), pd = Math.max(3, Math.min(5, Math.round(pw * 0.5)));
    const cu0 = Math.max(0, (W - (pw + 2)) >> 1), cu1 = cu0 + pw + 1, v0 = D + (ex.has('terrace') ? 3 : 1), v1 = v0 + pd + 1;
    const rim = S.style === 'cabin' ? 'stone_bricks' : 'travertine', tile = has('pool_tile') ? 'pool_tile' : 'porcelain_tile';
    for (let v = v0; v <= v1; v++) for (let u = cu0; u <= cu1; u++) {
      const edge = u === cu0 || u === cu1 || v === v0 || v === v1;
      P(u, -3, v, tile);
      if (edge) { P(u, -2, v, tile); P(u, -1, v, tile); P(u, 0, v, rim); }
      else { P(u, -2, v, tile); P(u, -1, v, 'water'); P(u, 0, v, 'water'); }
      P(u, 1, v, null); P(u, 2, v, null);
    }
    // loungers along the long side, a parasol between them
    if (VM && VM.MODELS.vm_lounger) for (let k = 0; k < Math.min(3, Math.floor(pw / 3)); k++) { const u = cu0 + 1 + k * 3; if (get(u, 1, v1 + 1) === undefined && get(u, 1, v1 + 2) === undefined) VM.put(P, u, 1, v1 + 1, 'vm_lounger', 2); }
    if (has('vx_lamppost_black')) P(cu1 + 1, 1, v0, 'vx_lamppost_black');
  }
  // a garden: bushes along the sides, a fruit tree at each back corner, a bench
  function garden(B) {
    const { P, get, S, K, W, D, ex } = B;
    const fruit = ['apple', 'cherry', 'plum', 'orange'][(W * 3 + D) % 4];
    const tree = (u, v) => {
      if (!has('vx_fruit_trunk')) return;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (get(u + a, 1, v + b) !== undefined && !(a === 0 && b === 0)) return;
      for (let y = 1; y <= 3; y++) P(u, y, v, 'vx_fruit_trunk');
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { P(u + a, 4, v + b, 'vx_fruit_crown_' + fruit); if (Math.abs(a) + Math.abs(b) <= 1) P(u + a, 5, v + b, 'vx_fruit_crown_' + fruit); }
    };
    const back = D + (ex.has('terrace') ? 3 : 1) + (ex.has('pool') ? 8 : 0) + 1;
    tree(-3, Math.min(back, D + 3)); tree(W + 2, Math.min(back, D + 3));
    if (!ex.has('pool')) tree(W >> 1, D + (ex.has('terrace') ? 5 : 3));
    for (let v = 1; v <= D - 2; v += 2) {
      if (!ex.has('garage') && get(-1, 1, v) === undefined) P(-1, 1, v, v % 4 === 1 ? 'vx_bush' : 'vx_hedge');
      if (get(W, 1, v) === undefined && get(W, 2, v) === undefined) P(W, 1, v, v % 4 === 1 ? 'vx_bush' : 'vx_hedge');
    }
    if (VM && VM.MODELS.vm_bench) { const bu = W + 1, bv = D + 1; if (get(bu, 1, bv) === undefined && get(bu, 1, bv + 1) === undefined) VM.put(P, bu, 1, bv, 'vm_bench', 3); }
    if (has('vx_birdbath') && get(-2, 1, D + 1) === undefined) P(-2, 1, D + 1, 'vx_birdbath');
  }
  // solar panels in rows on a flat roof (pitched roofs keep their tiles; the garage roof gets some too)
  function solar(B) {
    const { P, get, S, W, D, top } = B;
    if (S.roof.type !== 'flat' || !has('vx_solar')) return;
    // with a roof terrace the panels keep to the back half
    const v0 = B.ex.has('terrace') ? Math.max(2, (D >> 1) + 1) : 2;
    for (let v = v0; v <= D - 3; v += 2) for (let u = 2; u <= W - 3; u++) if (get(u, top + 2, v) === undefined) P(u, top + 2, v, 'vx_solar', { facing: 0 });
  }
  // gutters under the eaves and downpipes at the corners (as on the villas): along both eaves of a gable roof, all
  // round a hip, pyramid or mansard roof
  function gutters(B) {
    const { P, get, S, W, D, top } = B;
    if (!VM || !VM.MODELS.vm_gutter) return;
    const t = S.roof.type, open = (u, y, v) => get(u, y, v) === undefined;
    const isG = (s) => !!s && nameOf(s) === 'vm_gutter';
    // a downpipe drops from the gutter (replacing that piece) down the wall to the ground
    const pipe = (u, y, v, f) => { const s0 = get(u, y, v); if (!(s0 === undefined || isG(s0))) return; P(u, y, v, 'vm_downpipe_top', { facing: f }); for (let yy = y - 1; yy >= 1; yy--) { if (!open(u, yy, v)) break; P(u, yy, v, 'vm_downpipe', { facing: f }); } };
    if (t === 'gable') {
      const y = top - 2, side = S.roof.ridge !== 'front';
      if (side) for (const [v, f] of [[-1, 0], [D, 2]]) { for (let u = 0; u < W; u++) if (open(u, y, v)) P(u, y, v, 'vm_gutter', { facing: f }); pipe(0, y, v, f); pipe(W - 1, y, v, f); }
      else for (const [u, f] of [[-1, 3], [W, 1]]) { for (let v = 0; v < D; v++) if (open(u, y, v)) P(u, y, v, 'vm_gutter', { facing: f }); pipe(u, y, 0, f); pipe(u, y, D - 1, f); }
      return;
    }
    if (t !== 'hip' && t !== 'pyramid' && t !== 'mansard') return;
    const y = t === 'pyramid' ? top - 2 : top - 1, ua = -1, va = -1, ub = W, vb = D;
    for (let u = ua + 1; u <= ub - 1; u++) { if (open(u, y, va)) P(u, y, va, 'vm_gutter', { facing: 0 }); if (open(u, y, vb)) P(u, y, vb, 'vm_gutter', { facing: 2 }); }
    for (let v = va + 1; v <= vb - 1; v++) { if (open(ua, y, v)) P(ua, y, v, 'vm_gutter', { facing: 3 }); if (open(ub, y, v)) P(ub, y, v, 'vm_gutter', { facing: 1 }); }
    for (const [cu, cv, f, pu, pv] of [[ua, va, 0, ua + 1, va], [ub, va, 1, ub, va + 1], [ub, vb, 2, ub - 1, vb], [ua, vb, 3, ua, vb - 1]]) {
      if (open(cu, y, cv) && VM.MODELS.vm_gutter_corner) P(cu, y, cv, 'vm_gutter_corner', { facing: f });
      pipe(pu, y, pv, f);
    }
  }
  // dormers on a gable roof that shows its slope to the front: a little gabled box with a window, one or two per slope
  function dormers(B) {
    const { P, get, S, K, W, D, top } = B;
    if (S.roof.type !== 'gable' || S.roof.ridge === 'front' || D < 9 || W < 7) return;
    const at = W >= 12 ? [Math.round(W * 0.27) - 1, Math.round(W * 0.73) - 1] : [(W >> 1) - 1];
    const win = K.cosyWin ? (S.windows.frame === 'wood' ? 'vx_window_wood' : 'vx_window') : K.pane;
    for (const [v, f] of [[1, 0], [D - 2, 0]]) for (const a0 of at) {
      if (a0 < 1 || a0 + 2 > W - 2) continue;
      const y = top + 1;
      P(a0, y, v, K.wall); P(a0 + 2, y, v, K.wall);
      if (/^vx_/.test(win)) P(a0 + 1, y, v, win, { facing: f }); else P(a0 + 1, y, v, win);
      // its roof: the same tiles, rising from both sides to a ridge over the window
      P(a0, y + 1, v, K.roof45, { facing: 1 }); P(a0 + 2, y + 1, v, K.roof45, { facing: 3 }); P(a0 + 1, y + 1, v, K.ridge, { facing: 1 });
      // the attic behind it stays open
      const vb = v === 1 ? 2 : D - 3; if (get(a0 + 1, y, vb) !== undefined && get(a0 + 1, y, vb) !== 0 && vb > 1 && vb < D - 2) P(a0 + 1, y, vb, null);
    }
  }
  function fence(P, get, S, K, W, D, du, dW, ex) {
    const fv = -5, ua = ex.has('garage') ? 0 : -2, ub = W + 1;
    for (let u = ua; u <= ub; u++) { const gate = u >= du && u < du + Math.max(1, dW); P(u, 1, fv, gate ? K.gate : K.fence, gate ? { facing: 0 } : undefined); }
    for (let v = fv + 1; v <= -1; v++) { if (!ex.has('garage')) P(ua, 1, v, K.fence); P(ub, 1, v, K.fence); }
    // the path from the gate to the door
    for (let v = fv; v <= -1; v++) for (let k = 0; k < Math.max(1, dW); k++) if (get(du + k, 0, v) === undefined) P(du + k, 0, v, K.path);
    // flowers along the fence
    if (has('vx_flowerbed')) for (let u = ua + 1; u <= ub - 1; u += 1) if ((u < du - 1 || u > du + dW) && get(u, 1, fv + 1) === undefined) P(u, 1, fv + 1, ['vx_flowerbed', 'vx_flowerbed_roses', 'vx_flowerbed_tulips'][(u & 3) % 3]);
  }
  function chimney(P, get, S, K, W, D, top, info) {
    // on the gable end of a pitched roof: outside the wall, from the ground to above the ridge
    if (S.roof.type === 'gable' && S.roof.ridge !== 'front') {
      const cu = W, cv = D >> 1;
      for (let y = 0; y <= info.roofTop + 2; y++) P(cu, y, cv, K.chimney);
      P(cu, -1, cv, 'stone_bricks');
      return;
    }
    // anywhere else: up through the roof near the ridge, two blocks above the tiles
    const cu = Math.max(1, W - 3), cv = Math.max(1, (D >> 1) - 1);
    let hy = top; for (let y = info.roofTop + 1; y > top; y--) { const s = get(cu, y, cv); if (s) { hy = y; break; } }
    for (let y = top + 1; y <= hy + 2; y++) P(cu, y, cv, K.chimney);
  }
  // a light in a room that the designer left dark: pendants (or lanterns), about one per 6 × 6 blocks
  function lights(P, get, K, W, D, y, busy, r) {
    r = r || { u0: 1, u1: W - 2, v0: 1, v1: D - 2 };
    const RW = r.u1 - r.u0 + 1, RD = r.v1 - r.v0 + 1;
    const nu = Math.max(1, Math.round(RW / 6)), nv = Math.max(1, Math.round(RD / 6));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u = Math.round(r.u0 + RW * (i + 0.5) / nu - 0.5), v = Math.round(r.v0 + RD * (j + 0.5) / nv - 0.5);
      if (get(u, y + 1, v) === 0 || (get(u, y, v) !== 0 && get(u, y, v) !== undefined)) continue;
      if (busy && busy[v * W + u] && get(u, y - 1, v)) continue;
      P(u, y, v, K.light);
    }
  }

  // ---------------------------------------------------------------- the interior designer
  // Every storey is furnished room by room, the way the villas are: the ground floor is open (a kitchen with upper
  // cabinets and a hood, an island, a dining table under a pendant, a sofa facing the TV or the fireplace, a rug, plants,
  // art, a coat rack by the door); upstairs a tiled bathroom, the master bedroom (bed, nightstands with lamps, art above
  // the bed, wardrobe, dresser), a kids' room (bunk bed, toy box, desk) or a guest room, a study corner. Nothing is
  // forced: a piece only goes where all its cells are free, so small houses simply get less. Returns the lights placed.
  function designer(B) {
    const { P, get, S, K, W, D, SH, NF, busy, pl, du, dW } = B;
    const lit = []; for (let k = 0; k < NF; k++) lit.push([]);
    if (!VM) return lit;
    const has3 = (n) => !!VM.MODELS[n];
    const cosy = S.style === 'cottage' || S.style === 'cabin', classic = S.style === 'classic', modern = S.style === 'modern';
    const yF = (k) => k * SH + 1, yC = (k) => (k + 1) * SH - 1;
    const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const cellsOf = (name, f, u, v) => VM.cells(name, f).map(([dx, dz]) => [u + dx, v + dz]);
    const inR = (r, x, z) => x >= r.u0 && z >= r.v0 && x <= r.u1 && z <= r.v1;
    const fits = (k, cs, r) => cs.every(([x, z]) => inR(r, x, z) && !busy[k][z * W + x]);
    const take = (k, cs) => { for (const [x, z] of cs) busy[k][z * W + x] = 1; };
    const isFree = (k, r, x, z) => inR(r, x, z) && !busy[k][z * W + x];
    function put(k, name, f, u, v, r, dy) {
      if (!has3(name)) return null;
      const cs = cellsOf(name, f, u, v); if (!fits(k, cs, r)) return null;
      take(k, cs); VM.put(P, u, yF(k) + (dy || 0), v, name, f); return cs;
    }
    // a model whose cells are centred on (cu, cv) (models anchor on their first part, not their middle)
    function putAt(k, name, f, cu, cv, r) {
      if (!has3(name)) return null;
      const c0 = cellsOf(name, f, 0, 0), mx = Math.round(c0.reduce((a, c) => a + c[0], 0) / c0.length), mz = Math.round(c0.reduce((a, c) => a + c[1], 0) / c0.length);
      for (const [ex, ez] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) { const cs = put(k, name, f, cu - mx + ex, cv - mz + ez, r); if (cs) return cs; }
      return null;
    }
    // the wall of room r on side s next to a cell, at a height above the floor: plain (no window, no door)?
    const wallCell = (r, s, x, z) => (s === 0 ? [x, r.v0 - 1] : s === 1 ? [r.u1 + 1, z] : s === 2 ? [x, r.v1 + 1] : [r.u0 - 1, z]);
    function plain(k, r, s, x, z, dy) { const [wx, wz] = wallCell(r, s, x, z), b = get(wx, k * SH + dy, wz); if (!b) return false; const n = nameOf(b); return !/window|panorama|glass|door|vm_win|_rail|fence/.test(n); }
    // along wall s of room r, facing into the room: the first place it fits (searched from one end, or out from `at`)
    function onWall(k, name, s, r, o) {
      o = o || {};
      if (!has3(name)) return null;
      const f = FACE_IN[s], c0 = cellsOf(name, f, 0, 0);
      const minX = Math.min(...c0.map(c => c[0])), maxX = Math.max(...c0.map(c => c[0])), minZ = Math.min(...c0.map(c => c[1])), maxZ = Math.max(...c0.map(c => c[1]));
      const lo = (s & 1) ? r.v0 : r.u0, hi = (s & 1) ? r.v1 : r.u1, list = [];
      for (let a = lo; a <= hi; a++) list.push(a);
      if (o.at !== undefined) list.sort((p, q) => Math.abs(p - o.at) - Math.abs(q - o.at)); else if (o.fromEnd) list.reverse();
      for (const a of list) {
        let u, v;
        if (s === 0) { v = r.v0 - minZ; u = a - minX; } else if (s === 2) { v = r.v1 - maxZ; u = a - minX; } else if (s === 1) { u = r.u1 - maxX; v = a - minZ; } else { u = r.u0 - minX; v = a - minZ; }
        const cs = cellsOf(name, f, u, v);
        if (!fits(k, cs, r)) continue;
        if (o.noWin) { let ok = true; for (const [x, z] of cs) { const adj = s === 0 ? z === r.v0 : s === 2 ? z === r.v1 : s === 1 ? x === r.u1 : x === r.u0; if (adj && (!plain(k, r, s, x, z, 1) || !plain(k, r, s, x, z, 2))) ok = false; } if (!ok) continue; }
        take(k, cs); VM.put(P, u, yF(k) + (o.dy || 0), v, name, f);
        return { u, v, cells: cs, f, s };
      }
      return null;
    }
    // hanging lights: a pendant (a chandelier in a classic house, a lantern in a cottage) from the ceiling
    function hang(k, u, v, kind) {
      if (get(u, yC(k), v) !== 0 || !get(u, yC(k) + 1, v)) return false;
      const name = cosy ? K.light : kind === 'grand' && classic && has3('vm_chandelier') ? 'vm_chandelier' : has3('vm_pendant') ? 'vm_pendant' : K.light;
      if (VM.MODELS[name]) P(u, yC(k), v, name, { facing: 0, part: 0 }); else P(u, yC(k), v, name);
      lit[k].push([u, v]); return true;
    }
    // art at eye height on a plain stretch of wall (it needs no floor: furniture may stand below)
    function art(k, r, s, at) {
      const names = ['vm_art_landscape', 'vm_art_abstract', 'vm_art_photo', 'vx_art_warm', 'vx_art_cool', 'vx_art_gold'].filter(n => has(n));
      if (!names.length) return false;
      const lo = (s & 1) ? r.v0 : r.u0, hi = (s & 1) ? r.v1 : r.u1, list = []; for (let a = lo; a <= hi; a++) list.push(a);
      list.sort((p, q) => Math.abs(p - at) - Math.abs(q - at));
      const y = yF(k) + 1;
      for (const a of list) {
        const x = (s & 1) ? (s === 1 ? r.u1 : r.u0) : a, z = (s & 1) ? a : (s === 0 ? r.v0 : r.v1);
        if (get(x, y, z) !== 0 || !plain(k, r, s, x, z, 2) || (get(x, y - 1, z) && /vm_win/.test(nameOf(get(x, y - 1, z))))) continue;
        const n = names[(x * 7 + z * 3 + k) % names.length];
        if (VM.MODELS[n]) P(x, y, z, n, { facing: FACE_IN[s], part: 0 }); else P(x, y, z, n, { facing: FACE_IN[s] });
        return true;
      }
      return false;
    }
    // plants in the free corners of a room
    function plants(k, r, n) {
      let c = 0;
      for (const [x, z] of [[r.u0, r.v0], [r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v1]]) {
        if (c >= n) break;
        if (!isFree(k, r, x, z)) continue;
        const name = (x + z + k) % 2 ? 'vm_monstera' : 'vm_olive';
        if (put(k, name, 0, x, z, r)) c++;
      }
    }
    // a rug on the free cells of a patch (rugs lie flat: people walk over them)
    function rug(k, r, cells, name) { for (const [x, z] of cells) if (isFree(k, r, x, z) && get(x, yF(k), z) === 0 && has(name)) P(x, yF(k), z, name); }
    // the longest free run of cells along a wall (for the kitchen), ordered from the end nearest the room's corner
    function run(k, r, s) {
      let best = [], cur = [];
      const lo = (s & 1) ? r.v0 : r.u0, hi = (s & 1) ? r.v1 : r.u1;
      for (let a = lo; a <= hi + 1; a++) {
        const x = (s & 1) ? (s === 1 ? r.u1 : r.u0) : a, z = (s & 1) ? a : (s === 0 ? r.v0 : r.v1);
        const ok = a <= hi && isFree(k, r, x, z) && plain(k, r, s, x, z, 1);
        if (ok) cur.push([x, z]); else { if (cur.length > best.length) best = cur; cur = []; }
      }
      return best;
    }
    // ------------------------------------------------ the rooms
    function kitchen(k, r) {
      const set = K.kitchen, Kp = 'vm_kitchen_' + set + '_';
      const runs = [2, 3, 0].map(s => ({ s, cells: run(k, r, s) })).sort((a, b) => b.cells.length - a.cells.length);
      const R0 = runs[0]; if (!R0 || R0.cells.length < 3) return null;
      const s = R0.s, f = FACE_IN[s], cells = R0.cells.slice(0, Math.min(8, R0.cells.length)), n = cells.length;
      let sinkAt = cells.findIndex(([x, z]) => !plain(k, r, s, x, z, 2)); if (sinkAt < 1 || sinkAt > n - 3) sinkAt = Math.min(1, n - 1);
      cells.forEach(([x, z], i) => {
        let name;
        if (i === n - 1 && n >= 4) name = 'vm_fridge';
        else if (i === n - 2 && n >= 6) name = Kp + 'tall';
        else name = i === sinkAt ? Kp + 'sink' : i === sinkAt + 1 && has3('vm_dishwasher') ? 'vm_dishwasher' : i === sinkAt + 2 ? Kp + 'hob' : i === sinkAt + 3 ? Kp + 'oven' : Kp + 'cabinet';
        if (!put(k, name, f, x, z, r)) return;
        const up = yF(k) + 2;
        if (up >= yC(k) + 1) return;
        if (name === Kp + 'hob' && has3('vm_range_hood')) P(x, up, z, 'vm_range_hood', { facing: f, part: 0 });
        else if (!/fridge|tall/.test(name) && plain(k, r, s, x, z, 3)) P(x, up, z, Kp + 'upper', { facing: f, part: 0 });
      });
      // an island in front of a long kitchen
      if (n >= 6 && has3('vm_island')) { const mid = cells[Math.floor(n / 2)], dd = DIR[f]; putAt(k, 'vm_island', (s & 1) ? 0 : 1, mid[0] + dd[0] * 2, mid[1] + dd[1] * 2, r) || putAt(k, 'vm_island', (s & 1) ? 1 : 0, mid[0] + dd[0] * 2, mid[1] + dd[1] * 2, r); }
      return { s, cells };
    }
    function living(k, r) {
      // the focus on the right wall: a fireplace beside the chimney (cosy and classic houses) or a lowboard with the TV
      const s = 1, f = FACE_IN[s], vMidR = (r.v0 + r.v1) >> 1;
      let focus = null;
      if (B.ex.has('chimney') && !modern && has3('vm_fireplace')) focus = onWall(k, 'vm_fireplace', s, r, { at: D >> 1, noWin: true });
      if (!focus && has3('vm_lowboard')) {
        focus = onWall(k, 'vm_lowboard', s, r, { at: vMidR, noWin: true }) || onWall(k, 'vm_lowboard', s, r, { at: vMidR });
        if (focus && has3('vm_tv')) {
          for (const [x, z] of focus.cells) { const tc = cellsOf('vm_tv', f, x, z); if (tc.every(([a, b]) => focus.cells.some(([p, q]) => p === a && q === b))) { VM.put(P, x, yF(k) + 1, z, 'vm_tv', f); break; } }
        }
      }
      const sofaN = 'vm_sofa_' + K.sofa;
      if (focus && r.u1 - r.u0 >= 6) {
        const vMid = Math.round(focus.cells.reduce((a, c) => a + c[1], 0) / focus.cells.length), su = r.u1 - 4;
        const sofa = putAt(k, sofaN, 1, su, vMid, r);
        if (sofa) {
          putAt(k, 'vm_coffee_table', 1, su + 2, vMid, r) || putAt(k, 'vm_coffee_table_glass', 1, su + 2, vMid, r);
          putAt(k, 'vm_armchair_' + K.sofa, 0, su + 2, vMid + 2, r) || putAt(k, 'vm_armchair_' + K.sofa, 2, su + 2, vMid - 2, r);
          putAt(k, 'vm_floor_lamp', 0, su, vMid - 2, r) || putAt(k, 'vm_floor_lamp', 0, su, vMid + 2, r);
          rug(k, r, [[su + 1, vMid - 1], [su + 1, vMid], [su + 1, vMid + 1], [su + 3, vMid - 1], [su + 3, vMid], [su + 3, vMid + 1]], S.style === 'cabin' ? 'vx_rug_red' : modern ? 'vx_rug_sand' : 'vx_rug_blue');
          hang(k, su + 2, vMid);
          return true;
        }
      }
      // a narrow room: the sofa against the wall opposite the focus, or against the right wall
      const sofa = onWall(k, sofaN, focus ? 3 : 1, r, { at: vMidR }) || onWall(k, sofaN, 0, r, { fromEnd: true });
      if (sofa) { const c = sofa.cells[1] || sofa.cells[0], dd = DIR[sofa.f]; putAt(k, 'vm_coffee_table', sofa.f, c[0] + dd[0], c[1] + dd[1], r); hang(k, c[0] + dd[0], c[1] + dd[1]); }
      return !!sofa;
    }
    function dining(k, r, kitch) {
      const tname = cosy && has3('vm_dining_table_oak') ? 'vm_dining_table_oak' : 'vm_dining_table', chair = cosy && has3('vm_dining_chair_oak') ? 'vm_dining_chair_oak' : 'vm_dining_chair';
      if (!has3(tname)) return false;
      // near the kitchen if there is one, otherwise in the middle of the room
      const cu = kitch ? Math.round(kitch.cells.reduce((a, c) => a + c[0], 0) / kitch.cells.length) : (r.u0 + r.u1) >> 1;
      const cv = kitch ? Math.round(kitch.cells.reduce((a, c) => a + c[1], 0) / kitch.cells.length) : (r.v0 + r.v1) >> 1;
      const tries = [];
      for (let du2 = -6; du2 <= 6; du2++) for (let dv2 = -6; dv2 <= 6; dv2++) tries.push([cu + du2, cv + dv2, Math.abs(du2) + Math.abs(dv2) + (kitch ? 0 : 0)]);
      tries.sort((a, b) => a[2] - b[2]);
      for (const [x, z] of tries) {
        const tc = cellsOf(tname, 0, x, z);
        if (!fits(k, tc, r)) continue;
        const north = tc.map(([a, b]) => [a, b - 1]), south = tc.map(([a, b]) => [a, b + 1]);
        const need = [north[0], north[tc.length - 1], south[0], south[tc.length - 1]];
        if (!fits(k, need, r)) continue;
        // keep a walkway: the cells beyond the chairs stay free
        if (!fits(k, [[north[1][0], north[1][1] - 1], [south[1][0], south[1][1] + 1]], r)) continue;
        take(k, tc); VM.put(P, x, yF(k), z, tname, 0);
        for (const c of [north[0], north[tc.length - 1]]) put(k, chair, 2, c[0], c[1], r);
        for (const c of [south[0], south[tc.length - 1]]) put(k, chair, 0, c[0], c[1], r);
        const mid = tc[Math.floor(tc.length / 2)]; hang(k, mid[0], mid[1], 'grand');
        return true;
      }
      return false;
    }
    function entry(k, r) {
      // a coat rack beside the front door, a console with a mirror when there is room
      putAt(k, 'vm_coat_rack', 2, du - 1, 1, r) || putAt(k, 'vm_coat_rack', 2, du + dW, 1, r);
      if (r.u1 - r.u0 >= 10) onWall(k, 'vm_console', 0, r, { at: du + dW + 3, noWin: true });
    }
    function bedroom(k, r, kind) {
      const f0 = r.u1 === W - 2 ? 1 : 3;   // the outer side wall
      const wide = r.u1 - r.u0 >= 3, kids = kind === 'kids';
      const bedN = kids ? (has3('vm_bunk_bed') ? 'vm_bunk_bed' : 'vm_bed_single') : wide ? 'vm_bed_' + K.bed : 'vm_bed_single';
      const bed = onWall(k, bedN, f0, r, { at: (r.v0 + r.v1) >> 1, noWin: true }) || onWall(k, bedN, 2, r, { at: (r.u0 + r.u1) >> 1, noWin: true }) || onWall(k, bedN, f0, r, {}) || onWall(k, 'vm_bed_single', f0 ^ 2, r, {});
      if (bed) {
        // nightstands with lamps either side of the head, art above it, a rug at the foot
        const s = bed.s, along = (s & 1) ? 1 : 0, head = bed.cells.filter(([x, z]) => (s === 0 ? z === r.v0 : s === 2 ? z === r.v1 : s === 1 ? x === r.u1 : x === r.u0));
        if (head.length && !kids) {
          const lo = Math.min(...head.map(c => c[along])), hi = Math.max(...head.map(c => c[along])), fixed = head[0][1 - along];
          for (const a of [lo - 1, hi + 1]) { const c = along ? [fixed, a] : [a, fixed]; if (put(k, 'vm_nightstand', bed.f, c[0], c[1], r) && has3('vm_table_lamp')) VM.put(P, c[0], yF(k) + 1, c[1], 'vm_table_lamp', bed.f); }
          const hc = head[Math.floor(head.length / 2)]; if (get(hc[0], yF(k) + 1, hc[1]) === 0) art(k, { u0: hc[0], u1: hc[0], v0: hc[1], v1: hc[1] }, s, along ? hc[1] : hc[0]);
        }
        const foot = bed.cells.map(([x, z]) => [x + DIR[bed.f][0] * 2, z + DIR[bed.f][1] * 2]);
        if (!kids) rug(k, r, foot.filter(([x, z]) => !bed.cells.some(([p, q]) => p === x && q === z)), 'vx_rug_sand');
        const mid = bed.cells[0]; hang(k, mid[0] + DIR[bed.f][0] * 2, mid[1] + DIR[bed.f][1] * 2);
      }
      onWall(k, kids ? 'vm_wardrobe' : (classic ? 'vm_wardrobe_walnut' : 'vm_wardrobe'), 2, r, { noWin: true, fromEnd: true }) || onWall(k, 'vm_wardrobe', f0 ^ 2, r, { noWin: true }) || onWall(k, 'vm_wardrobe', 0, r, { noWin: true });
      if (kids) { onWall(k, 'vm_toy_box', 0, r, {}); const d = onWall(k, 'vm_desk', 0, r, { fromEnd: true }); if (d) putAt(k, 'vm_office_chair', 0, d.cells[0][0], d.cells[0][1] + 1, r); }
      else if (wide) onWall(k, 'vm_dresser', 0, r, {}) || onWall(k, 'vm_dresser', f0 ^ 2, r, { noWin: true });
      plants(k, r, 1);
    }
    function bathroom(k, b) {
      const r = { u0: b.u0, u1: b.u1, v0: b.v0, v1: b.v1 };
      // the door's cell inside stays free
      const di = [b.door[0] - 1, b.door[1]]; const keep = isFree(k, r, di[0], di[1]); if (keep) busy[k][di[1] * W + di[0]] = 1;
      const front = b.v0 === 1;
      onWall(k, 'vm_shower', front ? 2 : 0, r, {}) || onWall(k, 'vm_shower', 3, r, { fromEnd: !front });
      onWall(k, 'vm_toilet', 3, r, { fromEnd: !front }) || onWall(k, 'vm_toilet', front ? 0 : 2, r, {});
      onWall(k, 'vm_vanity', front ? 0 : 2, r, { fromEnd: true }) || onWall(k, 'vm_vanity', 3, r, {});
      if (r.u1 - r.u0 >= 2) onWall(k, 'vm_bathtub', front ? 2 : 0, r, { fromEnd: true });
      onWall(k, 'vm_towel_rail', 1, r, {}) || onWall(k, 'vm_towel_rail', 0, r, {});
      if (keep) busy[k][di[1] * W + di[0]] = 0;
      hang(k, (r.u0 + r.u1) >> 1, (r.v0 + r.v1) >> 1);
      // done: nobody else furnishes the bathroom
      for (let z = r.v0; z <= r.v1; z++) for (let x = r.u0; x <= r.u1; x++) busy[k][z * W + x] = 1;
    }
    function hall(k, r) {
      // what is left of the stairs' side: a study corner when it is roomy, a bench or a reading chair, art, a plant
      if ((r.u1 - r.u0 + 1) * (r.v1 - r.v0 + 1) >= 24) { const d = onWall(k, 'vm_desk', 0, r, { fromEnd: true }); if (d) putAt(k, 'vm_office_chair', 0, d.cells[0][0], d.cells[0][1] + 1, r); }
      onWall(k, 'vm_bench', 0, r, { fromEnd: true, noWin: false }) || onWall(k, 'vm_armchair_' + K.sofa, 0, r, { fromEnd: true });
      onWall(k, 'vm_bookshelf', 3, r, { noWin: true, fromEnd: true });
      plants(k, r, 1);
      art(k, r, 3, (r.v0 + r.v1) >> 1);
    }
    // ------------------------------------------------ storey by storey
    for (let k = 0; k < NF; k++) {
      if (pl.bath[k]) bathroom(k, pl.bath[k]);
      for (const r of pl.rooms[k]) {
        if (k === 0) {
          entry(k, r);
          const kit = kitchen(k, r);
          living(k, r);
          dining(k, r, kit);
          if (classic && r.u1 - r.u0 >= 10) onWall(k, 'vm_piano', 0, r, { noWin: false, fromEnd: false });
          onWall(k, 'vm_bookshelf', 0, r, { noWin: true }) || onWall(k, 'vm_sideboard', 2, r, { noWin: true });
          plants(k, r, 2);
          art(k, r, 2, (r.u0 + r.u1) >> 1); art(k, r, 3, (r.v0 + r.v1) >> 1);
          if (NF === 1) bedroom(k, r, 'master');
        } else if (r.kind === 'hall') hall(k, r);
        else bedroom(k, r, r.kind === 'bed' ? (k === 1 ? 'master' : 'kids') : r.kind);
      }
    }
    return lit;
  }

  // ---------------------------------------------------------------- 🎲 a random house that looks like one
  const PAL = {
    cottage: { walls: [['plaster', '#f1ece0'], ['plaster', '#eeddb8'], ['plaster', '#f3bf9a'], ['plaster', '#b3d6ee'], ['timber', '#f1ece0'], ['wood', '#b5423a'], ['wood', '#4f7fb8'], ['brick', '#a84e3a'], ['stone', '#9c9a94']], roofs: ['#b0453a', '#c8693f', '#4f5663', '#8e6a45', '#d2b060', '#3f63a8'], types: ['gable', 'gable', 'gable', 'hip', 'pyramid'] },
    modern: { walls: [['plaster', '#f4f4f2'], ['plaster', '#e8e2d6'], ['concrete', '#9a9a96'], ['wood', '#8a6a4a'], ['glass', '#202020'], ['plaster', '#3a3d42']], roofs: ['#3a3d42', '#4f5663', '#2a2a2a'], types: ['flat', 'flat', 'shed', 'hip'] },
    classic: { walls: [['plaster', '#eeddb8'], ['plaster', '#f1ece0'], ['stone', '#e8e0cc'], ['brick', '#c8bca8']], roofs: ['#4f5663', '#c8693f', '#2a2d33'], types: ['hip', 'mansard', 'hip'] },
    cabin: { walls: [['log', '#8a5e36'], ['wood', '#5a3f2a'], ['log', '#6a4a2a']], roofs: ['#8e6a45', '#4e7f46', '#4f5663', '#b0453a'], types: ['gable', 'gable', 'shed'] },
  };
  HK.random = function (rnd) {
    rnd = rnd || Math.random;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const style = pick(HK.STYLES), P = PAL[style], w = pick(P.walls);
    const width = 8 + Math.floor(rnd() * (style === 'modern' ? 10 : 7)), depth = 7 + Math.floor(rnd() * 6);
    const floors = style === 'cabin' ? 1 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 3);
    const extras = HK.EXTRAS.filter(e => rnd() < ({ chimney: style === 'modern' ? 0.1 : 0.7, porch: 0.45, balcony: 0.4, garage: 0.3, terrace: 0.5, fence: 0.35, columns: style === 'classic' ? 0.6 : 0.03, flowers: style === 'cottage' ? 0.8 : 0.3, dormers: style === 'cottage' || style === 'classic' ? 0.5 : 0.1, garden: 0.55, pool: style === 'modern' ? 0.45 : style === 'classic' ? 0.3 : 0.08, solar: style === 'modern' ? 0.5 : 0.1 }[e] || 0));
    const names = { cottage: ['Landhaus', 'Cottage', 'Häuschen am Hang', 'Gartenhaus'], modern: ['Kubus', 'Stadtvilla', 'Haus am See', 'Glashaus'], classic: ['Herrenhaus', 'Palais', 'Villa'], cabin: ['Blockhütte', 'Jagdhütte', 'Bergchalet'] };
    return HK.normalize({
      name: pick(names[style]), style, width, depth, floors, floorHeight: style === 'modern' || style === 'classic' ? 5 : 4,
      roof: { type: pick(P.types), color: pick(P.roofs), ridge: rnd() < 0.7 ? 'side' : 'front' },
      walls: { material: w[0], color: w[1] }, accent: style === 'modern' ? pick(['#2a2a2a', '#ffffff']) : '#ffffff',
      windows: { style: style === 'modern' ? pick(['panorama', 'tall', 'wide']) : style === 'classic' ? pick(['tall', 'arch', 'std']) : pick(['std', 'small', 'std', 'arch']), frame: style === 'modern' ? 'black' : style === 'cabin' ? 'wood' : 'white', shutters: style === 'cottage' && rnd() < 0.4 ? pick(['#5e9a6a', '#4f7fb8', '#b5423a', '#3e9c98']) : null },
      door: { position: pick(['center', 'center', 'left', 'right']), kind: style === 'modern' ? pick(['modern', 'glass']) : style === 'classic' ? 'double' : 'wood', color: style === 'modern' ? '#2a2a2a' : pick(['#8a5a32', '#5a3a22', '#b5423a', '#2f6a4a']) },
      extras,
    });
  };
})();

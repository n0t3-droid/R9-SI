// ============================================================================
// Forge kit — what every generator builds with: a grid writer with named
// states (cached, unknown names become air instead of throwing), boxes, shells,
// floors, columns, stairs, doors, ladders, lamps, trees; the scissor stairwell
// that reaches every floor; a room furnisher that drives the villa catalogue's
// interior designer (PLAN.furnish — 15 room types, deterministic) plus office
// and lobby furnishers from the Modern Living pack; and Forge.walkable, the
// flood fill the tests use to prove that a person can walk from the door to
// every floor (stairs, slabs; ladders only when asked).
// ============================================================================
(function (VR) {
  'use strict';
  const Forge = VR.Forge; if (!Forge) return;
  const R = VR.R, T = R.T, F = VR.F, VM = VR.VM, SHAPE = VR.SHAPE;
  const KEEP = 0xFFFF;
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // facing 0 = north (−v), 1 = east (+u), 2 = south (+v), 3 = west (−u)
  Forge.DIR = DIR;
  const stCache = new Map();
  // a state by name (+ props); numbers pass through; unknown names → 0 (air) so a missing block never breaks a build
  function st(name, props) {
    if (typeof name === 'number') return name;
    if (!name || name === 'air') return 0;
    const key = props ? name + '|' + JSON.stringify(props) : name;
    let s = stCache.get(key);
    if (s !== undefined) return s;
    const t = R.byName[name];
    s = t ? (props ? t.state(props) : t.defaultState) : 0;
    if (!t && Forge.strict) throw new Error('Forge: no block ' + name);
    stCache.set(key, s);
    return s;
  }
  Forge.st = st;

  Forge.kit = function (sx, sy, sz, dy) {
    const blocks = new Uint16Array(sx * sy * sz).fill(KEEP);
    const grid = { sx, sy, sz, blocks, dy: dy || 0 };
    const idx = (x, y, z) => (y * sz + z) * sx + x;
    const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz;
    const K = {
      grid, sx, sy, sz, dy: dy || 0, st, idx, inside, KEEP,
      get: (x, y, z) => (inside(x, y, z) ? blocks[idx(x, y, z)] : KEEP),
      set: (x, y, z, name, props) => { if (inside(x, y, z)) blocks[idx(x, y, z)] = st(name, props); },
      air: (x, y, z) => { if (inside(x, y, z)) blocks[idx(x, y, z)] = 0; },
      keep: (x, y, z) => { if (inside(x, y, z)) blocks[idx(x, y, z)] = KEEP; },
      // a filled box (inclusive corners, any order)
      box(x0, y0, z0, x1, y1, z1, name, props) {
        const s = st(name, props);
        const ax = Math.max(0, Math.min(x0, x1)), bx = Math.min(sx - 1, Math.max(x0, x1)), ay = Math.max(0, Math.min(y0, y1)), by = Math.min(sy - 1, Math.max(y0, y1)), az = Math.max(0, Math.min(z0, z1)), bz = Math.min(sz - 1, Math.max(z0, z1));
        for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) { const row = (y * sz + z) * sx; for (let x = ax; x <= bx; x++) blocks[row + x] = s; }
      },
      // only the four walls of a box
      shell(x0, y0, z0, x1, y1, z1, name, props) {
        const s = st(name, props);
        for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue; if (inside(x, y, z)) blocks[idx(x, y, z)] = s; }
      },
      floor: (x0, z0, x1, z1, y, name, props) => K.box(x0, y, z0, x1, y, z1, name, props),
      col: (x, z, y0, y1, name, props) => K.box(x, y0, z, x, y1, z, name, props),
      clear: (x0, y0, z0, x1, y1, z1) => K.box(x0, y0, z0, x1, y1, z1, 0),
      stair: (x, y, z, facing, name, top) => K.set(x, y, z, name, { facing, half: top ? 1 : 0 }),
      slab: (x, y, z, name, top) => K.set(x, y, z, name, { type: top ? 1 : 0 }),
      // a two-block door (bottom + top half), closed
      door(x, y, z, facing, name, hinge) { K.set(x, y, z, name || 'oak_door', { facing, half: 0, hinge: hinge || 0, open: 0 }); K.set(x, y + 1, z, name || 'oak_door', { facing, half: 1, hinge: hinge || 0, open: 0 }); },
      ladder(x, y0, y1, z, facing) { for (let y = y0; y <= y1; y++) K.set(x, y, z, 'ladder', { facing }); },
      lamp: (x, y, z, name) => K.set(x, y, z, name || 'vx_lamppost_black'),
      // a model with every part (anchor at (u, y, v), facing f)
      model(name, u, y, v, f, extra) { if (!VM || !VM.MODELS[name]) { K.set(u, y, v, name, Object.assign({ facing: f || 0 }, extra || {})); return; } VM.put((a, b, c, nm, pr) => K.set(a, b, c, nm, pr), u, y, v, name, f || 0, extra); },
      // can a model stand at (u, y, v) facing f? (every cell of its footprint is air now and has a floor under it)
      fits(name, u, y, v, f) {
        const m = VM && VM.MODELS[name]; if (!m) return inside(u, y, v) && blocks[idx(u, y, v)] === 0;
        for (const [dx, dyy, dz] of VM.footprint(m, f || 0)) { const x = u + dx, yy = y + dyy, z = v + dz; if (!inside(x, yy, z) || blocks[idx(x, yy, z)] !== 0) return false; if (dyy === 0 && !solidish(K.get(x, yy - 1, z))) return false; }
        return true;
      },
      // a simple tree: trunk of logs, a leaf crown (persistent leaves)
      tree(x, y, z, kind, rng, big) {
        const k = kind || 'oak', log = k + '_log', leaf = k + '_leaves';
        if (!R.byName[log]) return;
        const h = (k === 'birch' ? 5 : k === 'spruce' ? 6 : 4) + (big ? 2 : 0) + (rng ? rng.int(2) : 0);
        for (let i = 0; i < h; i++) K.set(x, y + i, z, log, { axis: 0 });
        const L = (a, b, c) => { if (K.get(a, b, c) === KEEP || K.get(a, b, c) === 0) K.set(a, b, c, leaf, { persistent: 1, distance: 1 }); };
        if (k === 'spruce') { for (let i = 2; i < h + 1; i++) { const r = Math.max(0, Math.floor((h + 1 - i) / 2)); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (Math.abs(a) + Math.abs(b) <= r + (i & 1 ? 0 : 1) && (a || b || i >= h)) L(x + a, y + i, z + b); } L(x, y + h + 1, z); return; }
        const r = big ? 3 : 2, top = y + h;
        for (let yy = -1; yy <= 2; yy++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
          const d = Math.abs(a) + Math.abs(b) + Math.abs(yy) * (yy > 0 ? 1.2 : 0.8);
          if (d > r + 1.3) continue;
          if (yy <= 0 && a === 0 && b === 0 && top + yy < y + h) continue;
          L(x + a, top + yy, z + b);
        }
      },
      // the straight scissor stair: floor k rises SH steps in column x (even k, toward +v) or x + 1 (odd k, toward −v);
      // landings at z − 1 and z + SH on every floor. Fills under the steps, clears the headroom and the slab over the
      // last three steps. Returns the landing cells per floor and the whole stairwell box.
      stairwell(x, y0, z, floors, SH, stairName, fillName, railName) {
        const landings = [], cells = [];
        for (let k = 0; k < floors; k++) landings.push([x, y0 + k * SH + 1, z - 1]);
        for (let k = 0; k < floors - 1; k++) {
          const c = x + (k & 1), base = y0 + k * SH;
          for (let i = 0; i < SH; i++) {
            const zi = (k & 1) ? z + SH - 1 - i : z + i, yi = base + 1 + i, facing = (k & 1) ? 0 : 2;
            for (let yy = base + 1; yy < yi; yy++) K.set(c, yy, zi, fillName);
            K.set(c, yi, zi, stairName, { facing, half: 0 });
            K.air(c, yi + 1, zi); K.air(c, yi + 2, zi);
            cells.push([c, yi, zi]);
          }
          // the slab of the floor above over the last three steps is open, with a railing on the open side
          for (let i = Math.max(0, SH - 3); i < SH - 1; i++) { const zi = (k & 1) ? z + SH - 1 - i : z + i; K.air(c, base + SH, zi); }
          if (railName) { const oc = (k & 1) ? x - 1 : x + 2; for (let i = Math.max(0, SH - 3); i < SH; i++) { const zi = (k & 1) ? z + SH - 1 - i : z + i; if (K.get(oc, base + SH + 1, zi) === 0 && solidish(K.get(oc, base + SH, zi))) K.set(oc, base + SH + 1, zi, railName); } }
        }
        return { landings, cells, box: [x, y0, z - 1, x + 1, y0 + floors * SH, z + SH] };
      },
      // a spiral stair in a (2r+1)² well around a centre post: three steps per side, one block up each
      spiral(cx, y0, cz, height, stairName, fillName, postName) {
        const ring = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]], FACE = [1, 1, 2, 2, 3, 3, 0, 0];
        let y = y0 + 1, k = 0; const steps = [];
        while (y <= y0 + height) {
          const [a, b] = ring[k & 7];
          K.set(cx + a, y, cz + b, stairName, { facing: FACE[k & 7], half: 0 });
          if (fillName) { const [pa, pb] = ring[(k + 7) & 7]; K.set(cx + pa, y, cz + pb, fillName); }
          K.air(cx + a, y + 1, cz + b); K.air(cx + a, y + 2, cz + b);
          steps.push([cx + a, y, cz + b]); y++; k++;
        }
        if (postName) K.col(cx, cz, y0 + 1, y0 + height, postName);
        return steps;
      },
      // ---- interiors through the villa catalogue's designer (gen_villa_rooms.js); H: {w, d, floors:[{y, rect, rooms}], entry}
      furnish(H, F0, skinId, rng, SH) {
        const PLAN = VR.VillageGen && VR.VillageGen.plan2, info = { beds: [], seats: [], work: [], door: null, outside: null, inside: null, chimney: null, table: null, lights: [], roofTop: 0, plan: H, skin: skinId, cars: [], desks: [] };
        H.u0 = H.u0 || 0; H.v0 = H.v0 || 0; H.sh = SH; H.entry = H.entry || { u: H.w >> 1, n: 1 };
        const hp = (u, y, v, name, pr) => K.set(H.u0 + u, y, H.v0 + v, name, pr);
        const roomAt = [];
        H.floors.forEach((fl, fi) => {
          const map = new Map(); roomAt.push(map); fl.rect = fl.rect || [0, 0, H.w - 1, H.d - 1];
          for (const r of fl.rooms) { r.fi = fi; r.doors = r.doors || []; r.windows = r.windows || []; r.w = r.u1 - r.u0 + 1; r.d = r.v1 - r.v0 + 1; for (let v = r.v0; v <= r.v1; v++) for (let u = r.u0; u <= r.u1; u++) map.set(u + ',' + v, r); if (r.zones) for (const z of r.zones) { z.parent = r; z.fi = fi; z.doors = r.doors; z.windows = r.windows; z.w = z.u1 - z.u0 + 1; z.d = z.v1 - z.v0 + 1; } }
        });
        const skin = (PLAN && PLAN.SKINS && PLAN.SKINS[skinId]) || { id: skinId || 'bauhaus' };
        const ctx = { hp, H, F: F0, skin, info, rng, W: H.w - 2, D: H.d - 2, roomAt, SH };
        for (const fl of H.floors) for (const r of fl.rooms) {
          try {
            if (PLAN && PLAN.furnish) { if (r.zones) for (const z of r.zones) PLAN.furnish(ctx, z, r); else PLAN.furnish(ctx, r, null); }
            else { const y = F0 + r.fi * SH + 1; K.set((r.u0 + r.u1) >> 1, y + SH - 2, (r.v0 + r.v1) >> 1, 'vx_spot'); K.set((r.u0 + r.u1) >> 1, y, (r.v0 + r.v1) >> 1, 'vx_rug_sand'); }
          } catch (e) { /* a room the designer cannot do stays empty — the house still stands */ }
        }
        return info;
      },
      // ---- a small room engine for the Forge's own furnishers: free cells, pieces against walls, pieces at a spot
      room(r, y, rng) {
        const used = new Set(), key = (u, v) => u + ',' + v;
        const inR = (u, v) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1;
        const free = (u, v) => inR(u, v) && !used.has(key(u, v)) && K.get(u, y, v) === 0 && K.get(u, y + 1, v) === 0 && (r.doors || []).every(d => !(d[0] === u && d[1] === v));
        const take = (u, v) => used.add(key(u, v));
        const cellsOf = (name, f, u, v) => (VM && VM.MODELS[name] ? VM.cells(name, f) : [[0, 0]]).map(([dx, dz]) => [u + dx, v + dz]);
        const at = (name, f, u, v) => { const cs = cellsOf(name, f, u, v); if (!cs.every(([a, b]) => free(a, b))) return null; K.model(name, u, y, v, f); for (const c of cs) take(c[0], c[1]); return cs; };
        const wallCells = (s) => { const out = []; if (s === 0) for (let u = r.u0; u <= r.u1; u++) out.push([u, r.v0]); if (s === 2) for (let u = r.u0; u <= r.u1; u++) out.push([u, r.v1]); if (s === 3) for (let v = r.v0; v <= r.v1; v++) out.push([r.u0, v]); if (s === 1) for (let v = r.v0; v <= r.v1; v++) out.push([r.u1, v]); return out; };
        const FACE = [2, 3, 0, 1];
        // a piece with its back to wall s; opts: {at: preferred index, corner: true, centre: true}
        const along = (s, name, opts) => {
          opts = opts || {};
          const f = FACE[s], sz = VM && VM.MODELS[name] ? VM.size(name, f) : [1, 1, 1], len = (s & 1) ? sz[2] : sz[0], deep = (s & 1) ? sz[0] : sz[2];
          const wall = wallCells(s), dd = DIR[f], cands = [];
          for (let i = 0; i + len <= wall.length; i++) {
            const cells = []; for (let k = 0; k < len; k++) for (let q = 0; q < deep; q++) cells.push([wall[i + k][0] + dd[0] * q, wall[i + k][1] + dd[1] * q]);
            if (!cells.every(([a, b]) => free(a, b))) continue;
            let score = opts.corner ? ((i === 0 || i + len === wall.length) ? 5 : 0) : -Math.abs(i + len / 2 - wall.length / 2);
            if (opts.at !== undefined) score = -Math.abs(i - opts.at) * 3;
            cands.push([score + (rng ? rng.next() * 0.3 : 0), cells, i]);
          }
          if (!cands.length) return null;
          cands.sort((a, b) => b[0] - a[0]);
          const [, cells, i] = cands[0];
          // anchor: the model's own cells must map onto these cells exactly
          const off = cellsOf(name, f, 0, 0), au = Math.min(...cells.map(c => c[0])) - Math.min(...off.map(o => o[0])), av = Math.min(...cells.map(c => c[1])) - Math.min(...off.map(o => o[1]));
          const want = off.map(([dx, dz]) => [au + dx, av + dz]);
          if (!want.every(([a, b]) => free(a, b))) return null;
          K.model(name, au, y, av, f); for (const c of want) take(c[0], c[1]);
          return { cells: want, i, f, len, u: au, v: av };
        };
        const up = (u, v, name, pr) => K.set(u, y + 1, v, name, pr);
        const spot = (u, v, h) => K.set(u, y + (h || 2), v, 'vx_spot');
        return { used, free, take, at, along, wallCells, up, spot, FACE, y, r, cu: (r.u0 + r.u1) >> 1, cv: (r.v0 + r.v1) >> 1 };
      },
      // an office floor: desk pairs along the windows, a meeting table, whiteboard, bookcase, lockers, printer, plants
      office(r, y, rng, opts) {
        opts = opts || {};
        const RM = K.room(r, y, rng), w = r.u1 - r.u0 + 1, d = r.v1 - r.v0 + 1, win = opts.windows || [0, 2], FACE = RM.FACE;
        let desks = 0;
        for (const s of win) {
          const f = FACE[s], dd = DIR[f], n = (s & 1) ? d : w;
          for (let i = 1; i + 2 <= n - 1; i += 3) {
            const dk = RM.along(s, rng.chance(0.2) ? 'vm_office_desk_standing' : 'vm_office_desk_oak', { at: i }); if (!dk) continue;
            desks++;
            for (const cc of dk.cells) if (RM.at('vm_office_chair_mesh', (f + 2) & 3, cc[0] + dd[0], cc[1] + dd[1])) break;
          }
        }
        const inner = [0, 1, 2, 3].filter(s => !win.includes(s));
        if (inner.length) { RM.along(inner[0], 'vm_office_whiteboard_mobile', { corner: false }); RM.along(inner[0], 'vm_office_bookcase_cubes', { corner: true }); RM.along(inner[0], 'vm_office_printer_cabinet', { corner: true }); }
        if (inner.length > 1) { RM.along(inner[1], 'vm_office_lockers_sage', { corner: true }); RM.along(inner[1], 'vm_office_filing_white', { corner: true }); RM.along(inner[1], 'vm_office_vending_coffee', { corner: true }); }
        if (w >= 8 && d >= 8) { const mu = RM.cu - 1, mv = RM.cv; if (RM.at('vm_office_meeting_oak', 0, mu, mv)) { for (let k = 0; k < 3; k++) { RM.at('vm_office_chair_mesh', 2, mu + k, mv - 1); RM.at('vm_office_chair_mesh', 0, mu + k, mv + 2); } K.set(mu + 1, y + 3, mv, 'vm_light_pendant_tube_black', { facing: 0, part: 0 }); } }
        for (const [u, v] of [[r.u0, r.v0], [r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v1]]) if (RM.free(u, v)) RM.at(rng.pick(['vm_plant_fig_concrete', 'vm_plant_strelitzia_concrete', 'vm_plant_palm_concrete', 'vm_office_booth_acoustic']), 0, u, v);
        for (let v = r.v0 + 2; v <= r.v1 - 1; v += 4) for (let u = r.u0 + 2; u <= r.u1 - 1; u += 4) RM.spot(u, v, 3);
        return desks;
      },
      // a lobby: reception desk facing the entrance, a waiting group, plants, art, pendants
      lobby(r, y, rng, opts) {
        opts = opts || {};
        const RM = K.room(r, y, rng), FACE = RM.FACE, back = opts.back === undefined ? 2 : opts.back;
        const f = FACE[back], dd = DIR[f];
        const wall = RM.wallCells(back), i0 = Math.max(0, Math.min(wall.length - 2, (wall.length >> 1) - 1 + (opts.off || 0)));
        // the desk: two consoles side by side, two cells in from the back wall, a chair behind them
        const du = wall[i0][0] + dd[0] * 2, dv = wall[i0][1] + dd[1] * 2;
        const desk = RM.at('vm_console', f, du, dv);
        if (desk) { for (const c of desk) RM.at('vm_office_chair_mesh', f, c[0] - dd[0], c[1] - dd[1]); K.set(desk[0][0], y + 1, desk[0][1], 'vm_smart_display_hub', { facing: f, part: 0 }); }
        RM.along(back, 'vm_office_lockers_sage', { corner: true }); RM.along(back, 'vm_deco_canvas_large', { corner: false });
        // the waiting group at a side wall: a three-seater, a coffee table, an armchair, a floor lamp
        const side = (back + 1) & 3;
        const so = RM.along(side, 'vm_living_sofa3_' + rng.pick(['boucle', 'sage', 'graphite', 'terracotta']), {});
        if (so) { const sd = DIR[FACE[side]]; const tu = so.cells[1][0] + sd[0] * 2, tv = so.cells[1][1] + sd[1] * 2; RM.at('vm_living_coffeetable_walnut', (side & 1) ? 0 : 1, tu, tv); RM.at('vm_living_lounge_shell', FACE[side], so.cells[0][0] + sd[0] * 3, so.cells[0][1] + sd[1] * 3); RM.at('vm_light_floor_globe_brass', 0, so.cells[2][0] + sd[0], so.cells[2][1] + sd[1]); }
        RM.along((back + 3) & 3, 'vm_deco_sculpture_ring', { corner: true }); RM.along((back + 3) & 3, 'vm_plant_fig_terracotta', { corner: true });
        for (const [u, v] of [[r.u0, r.v0], [r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v1]]) if (RM.free(u, v)) RM.at(rng.pick(['vm_plant_fig_concrete', 'vm_plant_strelitzia_concrete', 'vm_deco_vase_pampas']), 0, u, v);
        for (let v = r.v0 + 1; v <= r.v1 - 1; v += 3) for (let u = r.u0 + 1; u <= r.u1 - 1; u += 4) K.set(u, y + (opts.h || 3), v, u === RM.cu || u === RM.cu - 1 ? 'vm_light_pendant_halo_black' : 'vx_spot', u === RM.cu || u === RM.cu - 1 ? { facing: 0, part: 0 } : undefined);
        return RM;
      },
    };
    return K;
  };
  // a block a person stands on or bumps into (slabs, stairs, furniture ≥ half a block): the test's and the kit's notion
  const solCache = new Map();
  function solidish(s) {
    if (s === KEEP) return true; if (!s) return false;
    let v = solCache.get(s); if (v !== undefined) return v;
    const t = R.types[T.type[s]], k = t && t.o && t.o.kind;
    if (!t || k === 'ladder' || k === 'door' || k === 'gate' || k === 'trapdoor') v = false;
    else if (!(T.flags[s] & F.SOLID)) v = false;
    else { let top = 0; try { for (const b of VR.PHYS.collision(s, null)) if (b[4] > top) top = b[4]; } catch (e) { top = 1; } v = top >= 0.5; }
    solCache.set(s, v); return v;
  }
  Forge.solidish = solidish;
  const stepUp = (s) => { if (!s || s === KEEP) return false; const t = R.types[T.type[s]], k = t && t.o && t.o.kind; return k === 'stairs' || k === 'slab' || T.shape[s] === SHAPE.STAIRS; };
  const isLadder = (s) => { if (!s || s === KEEP) return false; const t = R.types[T.type[s]]; return !!(t && t.o && t.o.kind === 'ladder'); };
  // flood fill of the positions a person reaches on foot from `from` ([x, y, z] = the feet cell): flat moves, one-block
  // drops (up to three), steps up only onto stairs and slabs, ladders only with opts.ladders. → {reach: Set 'x,y,z', floors: [feet y…]}
  Forge.walkable = function (g, from, opts) {
    opts = opts || {};
    const get = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= g.sx || y >= g.sy || z >= g.sz) ? KEEP : g.blocks[(y * g.sz + z) * g.sx + x];
    const sol = (x, y, z) => solidish(get(x, y, z));
    const onLadder = (x, y, z) => opts.ladders && isLadder(get(x, y, z)) && !sol(x, y + 1, z);
    const standable = (x, y, z) => !sol(x, y, z) && !sol(x, y + 1, z) && (sol(x, y - 1, z) || y === 0);
    const ok = (x, y, z) => standable(x, y, z) || onLadder(x, y, z);
    const reach = new Set(), floors = new Set(), q = [from.slice()];
    const key = (p) => p[0] + ',' + p[1] + ',' + p[2];
    if (!ok(from[0], from[1], from[2])) { for (let dy = 1; dy <= 2; dy++) if (ok(from[0], from[1] - dy, from[2])) { q[0] = [from[0], from[1] - dy, from[2]]; break; } if (!ok(q[0][0], q[0][1], q[0][2]) && ok(from[0], from[1] + 1, from[2])) q[0] = [from[0], from[1] + 1, from[2]]; }
    if (!ok(q[0][0], q[0][1], q[0][2])) return { reach, floors: [] };
    reach.add(key(q[0])); floors.add(q[0][1]);
    const push = (x, y, z) => { const k = x + ',' + y + ',' + z; if (reach.has(k)) return; reach.add(k); floors.add(y); q.push([x, y, z]); };
    let guard = 0;
    while (q.length && guard++ < 2000000) {
      const [x, y, z] = q.pop();
      for (const [dx, dz] of DIR) {
        const nx = x + dx, nz = z + dz;
        if (standable(nx, y, nz)) push(nx, y, nz);
        else if (standable(nx, y + 1, nz) && stepUp(get(nx, y, nz))) push(nx, y + 1, nz);
        else { for (let dy = 1; dy <= 3; dy++) { if (sol(nx, y - dy + 1, nz)) break; if (standable(nx, y - dy, nz)) { push(nx, y - dy, nz); break; } } }
        if (opts.ladders && onLadder(nx, y, nz)) push(nx, y, nz);
      }
      if (opts.ladders) { if (onLadder(x, y, z) || onLadder(x, y + 1, z)) { if (ok(x, y + 1, z)) push(x, y + 1, z); } if (onLadder(x, y, z) || onLadder(x, y - 1, z)) { if (ok(x, y - 1, z)) push(x, y - 1, z); } }
    }
    return { reach, floors: [...floors].sort((a, b) => a - b) };
  };
})(VR);

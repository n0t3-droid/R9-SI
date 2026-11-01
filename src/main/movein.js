// ============================================================================
// u-movein · VR.MoveIn — build a home and a family moves in; your settlement grows and remembers you (plan
// docs/superpowers/plans/2026-11-01-u-movein.md). The owner: peaceful, loving coexistence, beauty, never-boring play;
// builders are a core player type.
//   · a home: an enclosed room ≥ 3 × 3 × 2 with a door in its shell, a light and a bed or a seat (MI.detect, a bounded
//     flood of the air around the block you placed — a gap in a wall or the roof escapes the bound). Kreativ and
//     Abenteuer alike. Near a generated village homes.js keeps its own move-in; everywhere else this file.
//   · the arrival: at the next dawn (later homes a day or two after, MI.dueAt) a family walks up the way with its hand
//     cart, greets you by your chosen name, unpacks and decorates a little (MI.planDecor: removable decor in cells that
//     are air, never over a block of yours; in Kreativ only after a first-time Ja). No camera takeover; Rücktaste skips.
//   · living with you: each settlement is a village of VR.Villages of its own (plan.mine): names, beds, the day's
//     routine, neighbours visiting, kids at play. A memory per family (built · gifted · helped) picks their greetings;
//     a small wrapped gift at your door some mornings; the 2nd family → you name the settlement; 3 homes → a market
//     stall and a festival night every 7th evening (festival.js).
//   · save: meta.movein (MI.load normalises; old saves have none), the families in meta.villages['mi:N'].st.custom.
// Cost 🟢: the detector once per change (debounced), the schedule twice a second, ≤ 1 cart + 3 gifts + 1 stall drawn;
// Very Low: plan.folkCap 8 per settlement. Multiplayer: the host decides; a guest runs none of it.
// Pure core node-tested (test/movein.js); the glue wraps VR.Villages' prototype (after homes.js and festival.js).
// ============================================================================
(function (VR) {
  'use strict';
  const MI = VR.MoveIn = VR.MoveIn || {};
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  MI.V = 1; MI.DAY = 24000; MI.WIN = 9000; MI.OVERDUE = 3 * 24000; MI.NEAR = 150;
  MI.MAXHOMES = 12; MI.MAXSETS = 6; MI.SETR = 64; MI.MAXDECOR = 3; MI.MEM = 10;
  const h32 = (a, b, c) => { let h = Math.imul((a | 0) ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b) ^ Math.imul((c | 0) + 0x5bd1e995, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13; return h >>> 0; };
  MI.h = h32;

  // ---------------------------------------------------------------- what a block is to a home
  const SEATNAME = /chair|stool|bench|sofa|couch|armchair|pilot_seat/;
  MI.kindOf = function (R, s) {
    if (!s) return null;
    const t = R.types[R.T.type[s]]; if (!t) return null;
    const o = t.o || {};
    if (o.kind === 'door' && !o.ironDoor) return 'door';
    if (o.bed || o.kind === 'bed') return 'bed';
    if (o.seat || o.kind === 'seat' || SEATNAME.test(t.name)) return 'seat';
    if (R.T.emit[s]) return 'light';
    return null;
  };

  // a carpet or a rug: lies on the floor, you walk over it (the room's air goes on through it)
  let thinC = null;
  MI.thin = function (R, s) {
    if (!thinC || thinC.length !== R.T.type.length) thinC = new Uint8Array(R.T.type.length);
    let v = thinC[s];
    if (!v) { const t = R.types[R.T.type[s]]; v = thinC[s] = t && /carpet|rug/.test(t.name) ? 2 : 1; }
    return v === 2;
  };
  // ---------------------------------------------------------------- detection (pure: get(x, y, z) → state)
  // the room around (x, y, z): the flood of the passable cells next to it; the first region that is a home wins, else
  // the most telling reason why not ('walls' · 'door' · 'small' · 'light' · 'bed')
  const ORDER = ['walls', 'door', 'small', 'light', 'bed'];
  MI.detect = function (get, x, y, z, R, lim) {
    const T0 = R.T, F = VR.F, HX = VR.HF_DX, HZ = VR.HF_DZ;
    const L = Object.assign({ cells: 900, wide: 24, high: 14 }, lim || {});
    const passable = (s) => !s || (!(T0.flags[s] & F.SOLID) && !(T0.flags[s] & F.FLUID)) || MI.thin(R, s);
    const starts = [];
    const s0 = get(x, y, z);
    if (passable(s0) && MI.kindOf(R, s0) !== 'door') starts.push([x, y, z]);
    const k0 = MI.kindOf(R, s0);
    // a bed's other half and a door's other half: their neighbours too
    const anchors = [[x, y, z]];
    if (k0 === 'bed') { const t = R.types[T0.type[s0]]; const f = t.get(s0, 'facing'), head = t.get(s0, 'part'); anchors.push(head ? [x - HX[f], y, z - HZ[f]] : [x + HX[f], y, z + HZ[f]]); }
    if (k0 === 'door') { const t = R.types[T0.type[s0]]; anchors.push([x, t.get(s0, 'half') ? y - 1 : y + 1, z]); }
    for (const [ax, ay, az] of anchors) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const s = get(ax + dx, ay + dy, az + dz);
      if (passable(s) && MI.kindOf(R, s) !== 'door') starts.push([ax + dx, ay + dy, az + dz]);
    }
    const seenAll = new Set();
    let best = null;
    for (const st of starts) {
      const k = st[0] + ',' + st[1] + ',' + st[2];
      if (seenAll.has(k)) continue;
      const res = flood(get, st, R, L, passable, seenAll);
      if (res.ok) return res;
      if (!best || ORDER.indexOf(res.why) > ORDER.indexOf(best.why)) best = res;
    }
    return best || { ok: false, why: 'walls' };
  };
  function flood(get, start, R, L, passable, seenAll) {
    const T0 = R.T, F = VR.F, HX = VR.HF_DX, HZ = VR.HF_DZ;
    const key = (x, y, z) => x + ',' + y + ',' + z;
    const seen = new Set([key(start[0], start[1], start[2])]), Q = [start], cells = [];
    const doors = [], beds = new Map(), seats = [], lights = [];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9, big = false;
    const shell = (s, nx, ny, nz, cx, cz) => {
      const kd = MI.kindOf(R, s);
      if (kd === 'door') { const t = R.types[T0.type[s]]; const lo = t.get(s, 'half') ? ny - 1 : ny; if (!doors.some(d => d[0] === nx && d[1] === lo && d[2] === nz)) doors.push([nx, lo, nz, cx, cz]); }
      else if (kd === 'bed') { const t = R.types[T0.type[s]]; const f = t.get(s, 'facing'), head = t.get(s, 'part'); const fx = head ? nx - HX[f] : nx, fz = head ? nz - HZ[f] : nz; beds.set(fx + ',' + ny + ',' + fz, [fx, ny, fz, f]); }
      else if (kd === 'seat') { if (!seats.some(q => q[0] === nx && q[1] === ny && q[2] === nz)) seats.push([nx, ny, nz]); }
      else if (kd === 'light') { if (!lights.some(q => q[0] === nx && q[1] === ny && q[2] === nz)) lights.push([nx, ny, nz]); }
    };
    while (Q.length) {
      const c = Q.pop(); cells.push(c);
      const [x, y, z] = c;
      seenAll.add(key(x, y, z));
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      if (cells.length > L.cells || x1 - x0 >= L.wide || z1 - z0 >= L.wide || y1 - y0 >= L.high || y > 300 || y < 1) { big = true; break; }
      const sc = get(x, y, z);
      if (sc) shell(sc, x, y, z, x, z);   // a torch, a rug-side seat: inside the air
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
        const nx = x + dx, ny = y + dy, nz = z + dz, k = key(nx, ny, nz);
        if (seen.has(k)) continue;
        const s = get(nx, ny, nz);
        if (MI.kindOf(R, s) === 'door') { seen.add(k); shell(s, nx, ny, nz, x, z); continue; }
        if (!passable(s)) { shell(s, nx, ny, nz, x, z); continue; }
        seen.add(k); Q.push([nx, ny, nz]);
      }
    }
    if (big) return { ok: false, why: 'walls' };
    const wx = x1 - x0 + 1, wz = z1 - z0 + 1, hy = y1 - y0 + 1;
    const out = { ok: false, why: null, cells: cells.length, size: [wx, hy, wz] };
    if (!doors.length) { out.why = 'door'; return out; }
    if (Math.min(wx, wz) < 3 || Math.max(wx, wz) < 3 || hy < 2 || cells.length < 12) { out.why = 'small'; return out; }
    if (!lights.length) { out.why = 'light'; return out; }
    if (!beds.size && !seats.length) { out.why = 'bed'; return out; }
    // the door: a ground-floor one first; inside the room cell next to it, outside the cell beyond
    doors.sort((a, b) => a[1] - b[1]);
    const d = doors[0], ix = d[3], iz = d[4], ox = d[0] * 2 - ix, oz = d[2] * 2 - iz;
    const floor = [];
    for (const c of cells) { const b = get(c[0], c[1] - 1, c[2]); if (b && (T0.flags[b] & F.SOLID) && (T0.flags[b] & F.FULL)) floor.push(c); }
    return Object.assign(out, { ok: true, why: null, door: [d[0], d[1], d[2]], inside: [ix, d[1], iz], outside: [ox, d[1], oz], beds: [...beds.values()].slice(0, 6), seats: seats.slice(0, 6), lights: lights.slice(0, 6), box: [x0, y0, z0, x1, y1, z1], F: y0 - 1, floor });
  }
  MI.homeKey = (room) => room.door.join(',');

  // ---------------------------------------------------------------- the arrival's schedule (world time = day·24000 + tod)
  // the first family at the next dawn (tod 0 — the hour sleeping wakes you), the 2nd a day later, the others two
  MI.dueAt = function (now, nBefore) { return (Math.floor(now / MI.DAY) + 1 + Math.min(2, Math.max(0, nBefore | 0))) * MI.DAY; };
  // 'arrive' (the moment, the player near) · 'quiet' (long overdue: they moved in while you were away) · null
  MI.ready = function (home, now, near) {
    if (!home || home.st !== 'wait') return null;
    if (now < home.due) return null;
    const tod = ((now % MI.DAY) + MI.DAY) % MI.DAY;
    if (near && tod < MI.WIN) return 'arrive';
    if (now >= home.due + MI.OVERDUE) return 'quiet';
    return null;
  };

  // ---------------------------------------------------------------- the record (meta.movein)
  MI.fresh = () => ({ v: MI.V, n: 0, homes: [], sets: [], mem: {}, gifts: [], decor: null, last: {}, cart: null });
  MI.load = function (o) {
    const r = MI.fresh();
    if (!o || typeof o !== 'object') return r;
    if ((o.v | 0) > MI.V) return o;   // a newer game's record: kept as it is
    const arr = (a) => (Array.isArray(a) ? a : []);
    const pt = (p) => Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite);
    r.n = Math.max(0, o.n | 0);
    for (const h of arr(o.homes)) if (h && pt(h.door) && pt(h.inside) && pt(h.outside)) r.homes.push({ id: String(h.id || ('h' + r.homes.length)), st: h.st === 'home' ? 'home' : 'wait', due: +h.due || 0, set: h.set ? String(h.set) : null, door: h.door, inside: h.inside, outside: h.outside, beds: arr(h.beds).filter(pt), seats: arr(h.seats).filter(pt), box: arr(h.box), F: h.F | 0, floor: arr(h.floor).filter(pt).slice(0, 400), fam: Number.isFinite(h.fam) ? h.fam : -1, decor: arr(h.decor).filter(pt), at: +h.at || 0, cr: !!h.cr });
    for (const s of arr(o.sets)) if (s && s.id && Number.isFinite(s.x) && Number.isFinite(s.z)) r.sets.push({ id: String(s.id), x: s.x, y: +s.y || 64, z: s.z, seed: s.seed >>> 0, name: String(s.name || ''), named: !!s.named, asked: !!s.asked, market: !!s.market, fest: +s.fest || 0, stall: pt(s.stall) ? s.stall : null });
    if (o.mem && typeof o.mem === 'object') for (const k of Object.keys(o.mem)) r.mem[k] = arr(o.mem[k]).filter(m => m && typeof m.k === 'string').slice(-MI.MEM);
    for (const g of arr(o.gifts)) if (g && pt(g.at)) r.gifts.push({ at: g.at, item: String(g.item || 'bread'), n: Math.max(1, g.n | 0), fam: String(g.fam || ''), name: String(g.name || '') });
    r.decor = o.decor === true ? true : o.decor === false ? false : null;
    r.last = o.last && typeof o.last === 'object' ? Object.assign({}, o.last) : {};
    r.cart = o.cart && pt(o.cart.at) && Number.isFinite(o.cart.until) ? { at: o.cart.at.slice(0, 4), until: o.cart.until, set: String(o.cart.set || '') } : null;
    return r;
  };
  MI.save = (rec) => JSON.parse(JSON.stringify(rec));

  // a home's settlement: the one within SETR blocks, else a new one (null when there are enough)
  MI.settlementFor = function (rec, pos, seedBase) {
    let best = null, bd = MI.SETR;
    for (const s of rec.sets) { const d = Math.hypot(s.x - pos[0], s.z - pos[2]); if (d < bd) { bd = d; best = s; } }
    if (best) return best;
    if (rec.sets.length >= MI.MAXSETS) return null;
    rec.n++;
    const seed = h32(seedBase | 0, rec.n, pos[0] * 31 + pos[2]);
    const s = { id: 'mi:' + rec.n, x: pos[0], y: pos[1], z: pos[2], seed, name: (VR.VillageGen && VR.VillageGen.name ? VR.VillageGen.name(seed) : 'Neuheim'), named: false, asked: false, market: false, fest: 0, stall: null };
    rec.sets.push(s);
    return s;
  };
  MI.homesOf = (rec, set) => rec.homes.filter(h => h.set === set.id && h.st === 'home');
  // the settlement's village plan (the shape VR.Villages reads; worldeco.js's natives' plan is the model)
  MI.planFor = function (set, rec, tier) {
    const P = { id: set.id, name: set.name, style: 'meadow', x: set.x, y: set.y, z: set.z, seed: set.seed, rad: 30, homes: [], work: [], farms: [], lots: [], lamps: [], chimneys: [], plaza: { x: set.x, y: set.y, z: set.z, r: 3 }, roads: [], bell: null, pad: null, shops: [], pastures: [], orchards: [], windmills: [], base: null, mine: true, folkCap: { max: tier === 0 ? 8 : 30 } };
    MI.workFor(P, set, rec);
    return P;
  };
  MI.workFor = function (P, set, rec) {
    P.work.length = 0;
    const hs = MI.homesOf(rec, set);
    // a garden by every other home (a gardener tends it), the market's stall when there is one
    hs.forEach((h, i) => { if (i % 2 === 0 && P.work.length < 3) P.work.push({ kind: 'garden', spot: [h.outside[0] + (i & 2 ? 2 : -2), h.outside[1], h.outside[2]] }); });
    if (set.market && set.stall) P.work.push({ kind: 'stall', spot: [set.stall[0] - 1, set.stall[1], set.stall[2]], keeper: [set.stall[0] + 1.5, set.stall[1], set.stall[2] + 0.5] });
    return P;
  };
  // the plaza: the middle of the homes' doorsteps
  MI.plazaOf = function (rec, set) {
    const hs = MI.homesOf(rec, set); if (!hs.length) return { x: set.x, y: set.y, z: set.z };
    let x = 0, y = 0, z = 0; for (const h of hs) { x += h.outside[0]; y += h.outside[1]; z += h.outside[2]; }
    return { x: Math.round(x / hs.length), y: Math.round(y / hs.length), z: Math.round(z / hs.length) };
  };

  // ---------------------------------------------------------------- f-polish5: the arrival on screen (pure)
  // the way in: 40–60 m out toward the nearest village (≤ 900 m; else out from the door): [[x, z], …] in the order to try
  MI.approach = function (door, out, villages) {
    let a0 = Math.atan2(out[1], out[0]), bd = 900;
    for (const v of villages || []) { const d = Math.hypot(v.x - door[0], v.z - door[2]); if (d < bd && d > 1) { bd = d; a0 = Math.atan2(v.z - door[2], v.x - door[0]); } }
    const res = [];
    for (const k of [0, 1, -1, 2, -2, 3, -3]) for (const r of [50, 42, 58]) { const a = a0 + k * Math.PI / 8; res.push([Math.round(door[0] + Math.cos(a) * r), Math.round(door[2] + Math.sin(a) * r)]); }
    return res;
  };
  // the waypoints from there to the doorstep (≤ 9 m apart; the last the doorstep): [[x, z], …]
  MI.wayPoints = function (a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 9)), out = [];
    for (let i = 1; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
    return out;
  };
  // the gentle framing (⚙ moveinCam): in RISE s, held, out FALL s — no jolt (smootherstep); a key eases out from where it is
  MI.FRAME = { rise: 1.5, hold: 1.8, fall: 1.5 }; MI.FRAME.dur = MI.FRAME.rise + MI.FRAME.hold + MI.FRAME.fall;
  const smoother = (t) => { const u = t <= 0 ? 0 : t >= 1 ? 1 : t; return u * u * u * (u * (u * 6 - 15) + 10); };
  MI.frameK = function (t) { const F = MI.FRAME; return t <= 0 || t >= F.dur ? 0 : t < F.rise ? smoother(t / F.rise) : t < F.rise + F.hold ? 1 : smoother((F.dur - t) / F.fall); };
  MI.frameSkip = function (t) { const F = MI.FRAME; return t < F.rise ? F.dur - F.fall * Math.max(0, t) / F.rise : t < F.rise + F.hold ? F.rise + F.hold : t; };
  // the framing camera: beside the way a little ahead of the family (6 m toward the door, 6 m to the side, 2.6 m up),
  // looking at the group (the lead, the cart behind) — they walk toward the frame's side, the land behind them
  // o-wander2 (R56-12): with the cart the shot comes close — 4 m beside the cart, a little ahead toward the door, 1.9 m
  // up, looking between the cart and the lead: the cart ≥ 8 % of the frame, the lead beside it (MI.FRAME_NEAR)
  MI.FRAME_NEAR = { d: 4.0, ahead: 1.2, up: 1.9 };
  MI.framePose = function (lead, door, out, side, cart) {
    out = out || {};
    if (cart) {
      let dx = lead[0] - door[0], dz = lead[2] - door[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const N = MI.FRAME_NEAR, sd = side || 1, mx = (lead[0] + cart[0]) / 2, mz = (lead[2] + cart[2]) / 2, my = Math.max(lead[1], cart[1]);
      out.x = cart[0] - dx * N.ahead - dz * N.d * sd; out.z = cart[2] - dz * N.ahead + dx * N.d * sd; out.y = my + N.up;
      const ex = mx - out.x, ez = mz - out.z, ty = my + 0.9;
      out.yaw = Math.atan2(-ex, -ez); out.pitch = Math.atan2(ty - out.y, Math.hypot(ex, ez));
      return out;
    }
    let dx = lead[0] - door[0], dz = lead[2] - door[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const sd = side || 1, ah = Math.min(6, L * 0.5);
    out.x = lead[0] - dx * ah - dz * 6 * sd; out.z = lead[2] - dz * ah + dx * 6 * sd; out.y = lead[1] + 2.6;
    const tx = lead[0] + dx * 1.0, tz = lead[2] + dz * 1.0, ty = lead[1] + 0.9;
    const ex = tx - out.x, ez = tz - out.z;
    out.yaw = Math.atan2(-ex, -ez); out.pitch = Math.atan2(ty - out.y, Math.hypot(ex, ez));
    return out;
  };
  // the festival night of a settlement: lantern strings between the doorsteps (in their order round the plaza; a ring
  // from three homes; none longer than 32 m), each sagging a little under its lanterns (~2.4 m apart, 2.9 m up at the
  // doors), and the fire ring on the plaza: {strings: [[i, j]], lamps: [[x, y, z, string, colour]], fire: [x, y, z]}
  MI.festLights = function (doors, pz) {
    const D = doors.map((d, i) => ({ d, a: Math.atan2(d[2] - pz.z, d[0] - pz.x), i })).sort((p, q) => p.a - q.a);
    const pairs = []; if (D.length >= 2) for (let k = 0; k < D.length; k++) { if (D.length === 2 && k === 1) break; pairs.push([D[k], D[(k + 1) % D.length]]); }
    const strings = [], lamps = [];
    for (const [A, B] of pairs) {
      const a = A.d, b = B.d, L = Math.hypot(b[0] - a[0], b[2] - a[2]); if (L > 32 || L < 2) continue;
      const si = strings.length; strings.push([A.i, B.i]);
      const n = Math.max(2, Math.round(L / 2.4)), sag = Math.min(1.2, L * 0.05);
      for (let j = 0; j < n; j++) { const u = (j + 0.5) / n; lamps.push([a[0] + (b[0] - a[0]) * u + 0.5, a[1] + (b[1] - a[1]) * u + 2.9 - sag * 4 * u * (1 - u), a[2] + (b[2] - a[2]) * u + 0.5, si, (j + si) % 4]); }
    }
    return { strings, lamps, fire: [pz.x, pz.y, pz.z] };
  };

  // ---------------------------------------------------------------- decor (pure): only into air, never over your blocks
  MI.DECOR = { corner: ['vx_potplant', 'flower_pot', 'vx_lantern'], middle: ['vx_rug_red', 'vx_rug_blue', 'vx_rug_green', 'vx_rug_sand'] };
  MI.planDecor = function (get, room, R, opts) {
    const o = Object.assign({ max: MI.MAXDECOR, seed: 1 }, opts || {}), T0 = R.T, F = VR.F;
    const st = (n) => (R.byName[n] ? R.byName[n].defaultState : 0);
    const solid = (s) => !!(s && (T0.flags[s] & F.SOLID));
    const full = (s) => !!(s && (T0.flags[s] & F.SOLID) && (T0.flags[s] & F.FULL));
    const no = new Set();
    const ban = (x, y, z) => no.add(x + ',' + y + ',' + z);
    const [ix, iy, iz] = room.inside;
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { ban(ix + dx, iy, iz + dz); ban(ix + dx, iy + 1, iz + dz); }
    // a bed's sides and foot stay free (the way to lie down)
    for (const b of room.beds || []) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ban(b[0] + dx, b[1], b[2] + dz); const hx = b[0] + VR.HF_DX[b[3]], hz = b[2] + VR.HF_DZ[b[3]]; ban(hx + dx, b[1], hz + dz); }
    for (const q of room.seats || []) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ban(q[0] + dx, q[1], q[2] + dz);
    const corner = [], middle = [];
    for (const c of room.floor || []) {
      const [x, y, z] = c, k = x + ',' + y + ',' + z;
      if (no.has(k) || get(x, y, z) !== 0 || get(x, y + 1, z) !== 0 || !full(get(x, y - 1, z))) continue;
      let walls = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (solid(get(x + dx, y, z + dz))) walls++;
      if (walls >= 2) corner.push(c); else if (walls === 0) middle.push(c);
    }
    const out = [], used = new Set();
    const take = (list, names, salt) => {
      if (!list.length || out.length >= o.max) return;
      const c = list[h32(o.seed, salt, list.length) % list.length], k = c.join(',');
      if (used.has(k)) return;
      const nm = names[h32(o.seed, salt + 7, 3) % names.length], s = st(nm) || st(names[0]);
      if (!s) return;
      used.add(k); out.push([c[0], c[1], c[2], s]);
    };
    take(corner, MI.DECOR.corner, 1); take(middle, MI.DECOR.middle, 2);
    const c2 = corner.filter(c => !used.has(c.join(',')) && !out.some(q => Math.abs(q[0] - c[0]) + Math.abs(q[2] - c[2]) < 2));
    take(c2, ['vx_lantern', 'vx_potplant'], 3);
    return out;
  };

  // ---------------------------------------------------------------- memory and greetings (pure)
  MI.remember = function (rec, fam, k, t, what) {
    const L = rec.mem[fam] || (rec.mem[fam] = []);
    const last = L[L.length - 1];
    if (last && last.k === k && last.what === what && t - last.t < 2000) return L;   // the same thing twice in a moment: once
    L.push({ k, t, what: what || '' });
    while (L.length > MI.MEM) L.shift();
    return L;
  };
  // the greeting's key: what you did lately (a day: gifted, helped), else what they remember most, else a plain hello
  MI.greetKey = function (L, now, named) {
    const sfx = named ? '' : 'N';
    if (!L || !L.length) return 'g.mi.greet.none' + sfx;
    const last = L[L.length - 1];
    if (now - last.t < MI.DAY && (last.k === 'gifted' || last.k === 'helped')) return 'g.mi.greet.' + last.k + sfx;
    const n = { built: 0, gifted: 0, helped: 0 }; for (const m of L) if (n[m.k] !== undefined) n[m.k]++;
    const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    return n[top] ? 'g.mi.greet.' + top + sfx : 'g.mi.greet.none' + sfx;
  };
  // a gift's item (what the giver likes), as [id, n]
  MI.GIFTS = { bread: [['bread', 2], ['cookie', 4], ['cake', 1]], flowers: [['poppy', 3], ['dandelion', 3], ['cornflower', 3]], fish: [['cooked_cod', 2]], music: [['cookie', 3]], stars: [['glowstone_dust', 4], ['cookie', 3]], _: [['apple', 3], ['bread', 2], ['cookie', 4], ['poppy', 3]] };
  MI.giftFor = function (likes, seed, has) {
    const L = (MI.GIFTS[likes] || []).concat(MI.GIFTS._).filter(g => !has || has(g[0]));
    return L.length ? L[seed % L.length] : ['bread', 1];
  };
  // every key the module names (test/movein.js checks both tables)
  MI.KEYS = ['g.mi.found', 'g.mi.found2', 'g.mi.hint', 'g.mi.why.walls', 'g.mi.why.door', 'g.mi.why.small', 'g.mi.why.light', 'g.mi.why.bed', 'g.mi.coming', 'g.mi.skip', 'g.mi.skipBtn', 'g.mi.movedT', 'g.mi.moved', 'g.mi.movedAway', 'g.mi.decorAsk', 'g.mi.yes', 'g.mi.no', 'g.mi.nameAsk', 'g.mi.nameOk', 'g.mi.later', 'g.mi.named', 'g.mi.market', 'g.mi.festSoon', 'g.mi.giftNote', 'g.mi.giftT', 'g.mi.giftGot', 'g.mi.arrive', 'g.mi.arriveN', 'g.mi.arriveKid', 'g.mi.unpack', 'g.mi.greet.none', 'g.mi.greet.built', 'g.mi.greet.gifted', 'g.mi.greet.helped', 'g.mi.greet.noneN', 'g.mi.greet.builtN', 'g.mi.greet.giftedN', 'g.mi.greet.helpedN'];

  // ================================================================ the glue (the game only)
  const Vs = VR.Villages;
  if (!Vs || !Vs.prototype || Vs.prototype.__movein) return;
  const P = Vs.prototype; P.__movein = true;
  const hasDoc = typeof document !== 'undefined';
  const host = (g) => !(g.mp && g.mp.isClient);
  // the switch: settings.movein === false — no homes noticed, no arrivals, nothing drawn (the families who live here stay)
  MI.on = (g) => !(g && g.settings && g.settings.movein === false);
  if (VR.Settings && VR.Settings.add && !(VR.Settings.byKey && VR.Settings.byKey('moveinCam'))) VR.Settings.add({ key: 'moveinCam', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.moveinCam', tip: 'g.set.moveinCam.tip', def: true });   // (f-polish5)
  const tierOf = (g) => (VR.LifeKit && VR.LifeKit.tierOf ? VR.LifeKit.tierOf(g.settings) : 2);
  const now = (g) => (g.env.day || 0) * MI.DAY + g.env.timeOfDay;
  const playerName = (g) => { const n = g.settings && g.settings.playerName; return n && String(n).trim() ? String(n).trim().slice(0, 24) : ''; };
  const note = (g, text, key) => { if (VR.Quiet && VR.Quiet.note) { try { VR.Quiet.note(text, 2, key); return; } catch (e) { /* the channel is theirs */ } } if (g.ui) g.ui.hint(text, 5000); };
  MI.rec = function (g) {
    if (!g.meta) return MI.fresh();
    if (!g.meta.movein || !g._miLoaded || g._miLoaded !== g.meta) { g.meta.movein = MI.load(g.meta.movein); g._miLoaded = g.meta; }
    return g.meta.movein;
  };
  const famKey = (set, fam) => set.id + ':' + fam;
  const setById = (rec, id) => rec.sets.find(s => s.id === id) || null;

  // the settlement's village, made known to VR.Villages (once per game)
  MI.villageOf = function (V, set) {
    const g = V.g, rec = MI.rec(g);
    let vil = V.known.get(set.id);
    if (!vil) {
      const pz = MI.plazaOf(rec, set);
      set.x = pz.x; set.y = pz.y; set.z = pz.z;
      V.addVillage(MI.planFor(set, rec, tierOf(g)));
      vil = V.known.get(set.id);
      if (vil) vil.visited = true;   // your own settlement: no „Willkommen in …“ toast
    }
    return vil;
  };
  MI.init = function (V) {
    const g = V.g; if (!g.meta || V._miInit === g.meta) return;
    V._miInit = g.meta;
    const rec = MI.rec(g);
    for (const s of rec.sets) if (MI.homesOf(rec, s).length) MI.villageOf(V, s);
    V._mi = { watch: [], checkT: -1, tickT: 0, job: null, greetT: new Map(), giftT: 0 };
  };

  // ---------------------------------------------------------------- hooks
  // homes.js's village outskirts: never ours (our settlements take their own homes)
  const baseHomeVillage = P.homeVillage;
  if (baseHomeVillage) P.homeVillage = function (x, z) {
    for (const vil of this.known.values()) { if (!vil.active || (vil.plan && vil.plan.mine)) continue; const pz = vil.plan.plaza, RAD = vil.plan.rad || 58; if (Math.hypot(x - pz.x, z - pz.z) < RAD + 45) return vil; }
    return null;
  };
  const baseChanged = P.onBlockChanged;
  P.onBlockChanged = function (x, y, z, old, s) {
    baseChanged.call(this, x, y, z, old, s);
    if (this.selfEdit || !this._mi || !host(this.g) || !MI.on(this.g)) return;
    try { MI.onChange(this, x, y, z, old, s); } catch (e) { if (!MI.warned) { MI.warned = true; console.warn('movein', e); } }
  };
  const baseUpdate = P.update;
  P.update = function (dt) {
    baseUpdate.call(this, dt);
    this._miDt = dt;   // (f-polish5: the festival's one-frame lanterns live a frame)
    try { MI.init(this); MI.tick(this, dt); } catch (e) { if (!MI.warned) { MI.warned = true; console.warn('movein', e); } }
  };
  const baseThink = P.think;
  P.think = function (a, tod) { if (a.act && a.act.type === 'arrive') return; return baseThink.call(this, a, tod); };
  const baseRun = P.runAct;
  P.runAct = function (a, dt, tod) { if (a.act && a.act.type === 'arrive') return MI.runArrive(this, a, dt); return baseRun.call(this, a, dt, tod); };
  const baseSocial = P.social;
  if (baseSocial) P.social = function (a, dt, tod) { if (a.act && a.act.type === 'arrive') return; return baseSocial.call(this, a, dt, tod); };
  const baseDraw = P.draw;
  P.draw = function (r, E, cam) { const out = baseDraw.call(this, r, E, cam); try { MI.draw(this, r, E, cam); } catch (e) { /* drawn next frame */ } return out; };
  // the newcomers of our settlements: no toast from villages.js (the arrival says it at its end)
  const baseCustom = P.onCustomHome;
  P.onCustomHome = function (vil) {
    if (!vil.plan || !vil.plan.mine || !this.g.ui) return baseCustom.call(this, vil);
    const ui = this.g.ui, toast = ui.toast; ui.toast = () => {};
    try { return baseCustom.call(this, vil); } finally { ui.toast = toast; }
  };
  // festival night: a settlement of 3 homes or more, every 7th evening (the first the evening after its 3rd family)
  const baseFestDay = P.festivalDay;
  if (baseFestDay) P.festivalDay = function (vil) {
    if (!vil.plan || !vil.plan.mine) return baseFestDay.call(this, vil);
    const rec = MI.rec(this.g), set = setById(rec, vil.id); if (!set || MI.homesOf(rec, set).length < 3) return false;
    const d = this.g.env.day || 0;
    return d === set.fest || (d > set.fest && (d - set.fest) % 7 === 0);
  };
  // what you did for them: a gift (held item handed over), a request done
  const baseGift = P.gift;
  if (baseGift) P.gift = function (a) {
    const mine = a && a.vil && a.vil.plan && a.vil.plan.mine;
    const held = mine && this.g.player.inv && this.g.player.inv.held;
    const q = mine && a.vil.st.quests && a.vil.st.quests[a.p.id], was = q && q.done;
    const out = baseGift.call(this, a);
    if (mine && held) {
      const rec = MI.rec(this.g), set = setById(rec, a.vil.id);
      if (set) MI.remember(rec, famKey(set, a.p.fam), q && !was && q.done ? 'helped' : 'gifted', now(this.g), VR.itemName ? VR.itemName(held.id) : held.id);
    }
    return out;
  };

  // ---------------------------------------------------------------- noticing a home
  MI.onChange = function (V, x, y, z, old, s) {
    const g = V.g, R = VR.R, M = V._mi, rec = MI.rec(g);
    const kd = MI.kindOf(R, s);
    if (kd && !V.homeVillage(x, z) && !M.watch.some(w => w[0] === x && w[1] === y && w[2] === z)) { M.watch.push([x, y, z, 1]); if (M.watch.length > 16) M.watch.shift(); }
    let near = !!kd;
    for (const w of M.watch) if (Math.abs(w[0] - x) < 14 && Math.abs(w[2] - z) < 14 && Math.abs(w[1] - y) < 10) { w[3] = 1; near = true; }
    if (near) M.checkT = 1.2;
    // building near a family's home after they moved in: they remember you helped (once a day)
    if (s && !kd) for (const h of rec.homes) {
      if (h.st !== 'home' || Math.abs(h.outside[0] - x) > 10 || Math.abs(h.outside[2] - z) > 10) continue;
      const set = setById(rec, h.set); if (!set) continue;
      const k = famKey(set, h.fam), L = rec.mem[k] || [], t = now(g);
      if (!L.some(m => m.k === 'helped' && t - m.t < MI.DAY) && h.at && t - h.at > 600) MI.remember(rec, k, 'helped', t, '');
      break;
    }
  };
  MI.check = function (V) {
    const g = V.g, R = VR.R, M = V._mi, rec = MI.rec(g), w = g.world;
    const get = (x, y, z) => w.getBlock(x, y, z);
    for (let i = M.watch.length - 1; i >= 0; i--) {
      const a = M.watch[i]; if (!a[3]) continue; a[3] = 0;
      if (!MI.kindOf(R, get(a[0], a[1], a[2]))) { M.watch.splice(i, 1); continue; }
      const room = MI.detect(get, a[0], a[1], a[2], R);
      M.lastWhy = room.ok ? 'ok' : room.why;
      if (!room.ok) { if (room.why && (M.hintT || 0) < V.time) { M.hintT = V.time + 25; note(g, T('g.mi.hint', { why: T('g.mi.why.' + room.why) }), 'mi:hint'); } continue; }
      M.watch.splice(i, 1);
      MI.register(V, room);
    }
  };
  MI.register = function (V, room) {
    const g = V.g, rec = MI.rec(g), key = MI.homeKey(room);
    if (rec.homes.some(h => h.door.join(',') === key || (h.box && h.box.length === 6 && room.door[0] >= h.box[0] - 1 && room.door[0] <= h.box[3] + 1 && room.door[2] >= h.box[2] - 1 && room.door[2] <= h.box[5] + 1 && Math.abs(room.door[1] - h.door[1]) < 4))) return null;
    if (rec.homes.length >= MI.MAXHOMES * MI.MAXSETS) return null;
    const set = MI.settlementFor(rec, room.outside, g.meta && g.meta.seed ? String(g.meta.seed).length * 977 + 13 : 13);
    if (!set) return null;
    const mine = rec.homes.filter(h => h.set === set.id);
    if (mine.length >= MI.MAXHOMES) return null;
    const t = now(g), n = rec.homes.filter(h => h.st === 'wait' || h.set === set.id).length;
    const h = { id: 'h' + (rec.homes.length + 1) + ':' + key, st: 'wait', due: MI.dueAt(t, n), set: set.id, door: room.door, inside: room.inside, outside: room.outside, beds: room.beds, seats: room.seats, box: room.box, F: room.F, floor: room.floor.slice(0, 400), fam: -1, decor: [], at: 0, cr: !!(g.player && g.player.creative) };
    rec.homes.push(h);
    note(g, T(n ? 'g.mi.found2' : 'g.mi.found'), 'mi:found');
    if (g.audio && g.audio.play) { try { g.audio.play('pop'); } catch (e) { /* a sound */ } }
    return h;
  };

  // ---------------------------------------------------------------- the schedule
  MI.tick = function (V, dt) {
    const g = V.g, M = V._mi; if (!M || !g.player || !g.env || (!MI.on(g) && !M.job)) return;
    if (M.checkT >= 0) { M.checkT -= dt; if (M.checkT < 0 && host(g)) MI.check(V); }
    if (M.job) MI.updateJob(V, dt);
    MI.updateGifts(V, dt);
    M.tickT -= dt; if (M.tickT > 0) return;
    M.tickT = 0.5;
    if (!host(g)) return;
    const rec = MI.rec(g), t = now(g), p = g.player.pos;
    for (const h of rec.homes) {
      const near = Math.hypot(h.outside[0] - p[0], h.outside[2] - p[2]) < MI.NEAR && g.world.isLoaded(h.outside[0], h.outside[2]);
      const r = MI.ready(h, t, near && !M.job);
      if (!r) continue;
      // still a home? (walls broken since: they wait)
      const room = MI.detect((x, y, z) => g.world.getBlock(x, y, z), h.inside[0], h.inside[1], h.inside[2], VR.R);
      if (r === 'arrive' && !room.ok) { if ((M.hintT || 0) < V.time) { M.hintT = V.time + 40; note(g, T('g.mi.hint', { why: T('g.mi.why.' + room.why) }), 'mi:hint'); } continue; }
      if (room.ok) { h.beds = room.beds; h.seats = room.seats; h.floor = room.floor.slice(0, 400); }
      if (r === 'arrive') { MI.startArrival(V, h); break; }
      MI.moveIn(V, h, true);
    }
    MI.greetings(V, t);
    MI.dailyGift(V, t);
    MI.updateCart(V, t);
  };

  // the family moves in (the village's roster grows by their home); quiet: while you were away
  MI.moveIn = function (V, h, quiet) {
    const g = V.g, rec = MI.rec(g), set = setById(rec, h.set); if (!set) return null;
    h.st = 'home'; h.at = now(g);
    const vil = MI.villageOf(V, set);
    const st = vil.st; st.custom = st.custom || [];
    h.fam = st.custom.length;
    st.custom.push({ kind: 'home', beds: h.beds.length ? h.beds : [], door: h.door, inside: h.inside, outside: h.outside, seats: [], table: null, lights: [], work: [], box: h.box && h.box.length === 6 ? [h.box[0] - 1, h.box[1] - 1, h.box[2] - 1, h.box[3] + 1, h.box[4] + 1, h.box[5] + 1] : null, F: h.F, chimney: null, mine: true });
    MI.workFor(vil.plan, set, rec);
    // the plaza follows the homes (the middle of their doorsteps): the festival dances there, the stall stands near
    const pz = MI.plazaOf(rec, set); set.x = pz.x; set.y = pz.y; set.z = pz.z;
    Object.assign(vil.plan.plaza, { x: pz.x, y: pz.y, z: pz.z }); vil.plan.x = pz.x; vil.plan.y = pz.y; vil.plan.z = pz.z; vil.center = [pz.x, pz.y, pz.z];
    if (!vil.active && g.world.isLoaded(vil.plan.x, vil.plan.z) && Math.hypot(g.player.pos[0] - vil.plan.x, g.player.pos[2] - vil.plan.z) < 110) V.activate(vil, g.env.timeOfDay);
    const before = vil.agents.length;
    V.onCustomHome(vil);
    MI.remember(rec, famKey(set, h.fam), 'built', now(g), '');
    if (VR.Adventure) { try { VR.Adventure.award('home', { id: set.id + ':' + h.door.join(',') }); } catch (e) { /* theirs */ } }
    const fam = vil.fams[h.fam];
    if (quiet) { rec.last.away = { fam: fam ? fam.surname : '', set: set.id }; MI.decorate(V, h, true); MI.grow(V, set); }
    return { vil, fam, agents: vil.agents.slice(before) };
  };

  // ---------------------------------------------------------------- the arrival
  MI.startArrival = function (V, h) {
    const g = V.g, w = g.world;
    const mv = MI.moveIn(V, h, false); if (!mv) return;
    const { vil, fam, agents } = mv;
    // the way in: out from the door 26 blocks (the first of eight headings with ground), the family one after another
    const nx = h.outside[0] - h.inside[0], nz = h.outside[2] - h.inside[2];
    const base = Math.atan2(nz, nx);
    let start = null, way = null;
    // f-polish5: they come along the way from the nearest village, 40–60 m out (the path's blocks preferred)
    { const vs = (V.sites || []).filter(v => v && Number.isFinite(v.x)), C = MI.approach(h.outside, [nx, nz], vs);
      for (const [sx, sz] of C) { if (!w.isLoaded(sx, sz)) continue; const y = MI.groundAt(w, sx, h.outside[1] + 16, sz, 36); if (y === null) continue; start = [sx + 0.5, y, sz + 0.5]; break; }
      if (start) way = MI.wayPoints([start[0], start[2]], [h.outside[0] + 0.5, h.outside[2] + 0.5]).map(([x, z], i, A) => MI.wayAt(w, x, z, i === A.length - 1 ? h.outside[1] : start[1] + (h.outside[1] - start[1]) * (i + 1) / A.length, i === A.length - 1));
      if (way && way.some(q => !q)) { start = null; way = null; } }
    for (let k = 0; k < 8 && !start; k++) {
      const an = base + (k ? ((k + 1) >> 1) * (k & 1 ? 1 : -1) * Math.PI / 6 : 0);
      const sx = Math.round(h.outside[0] + Math.cos(an) * 26), sz = Math.round(h.outside[2] + Math.sin(an) * 26);
      if (!w.isLoaded(sx, sz)) continue;
      const y = MI.groundAt(w, sx, h.outside[1] + 10, sz, 24); if (y === null) continue;
      start = [sx + 0.5, y, sz + 0.5];
    }
    if (!start) start = [h.outside[0] + 0.5, h.outside[1], h.outside[2] + 0.5];
    const dir = [start[0] - h.outside[0], start[2] - h.outside[2]], dl = Math.hypot(dir[0], dir[1]) || 1;
    agents.forEach((a, i) => {
      a.pos = [start[0] + (dir[0] / dl) * i * 1.4 + (i & 1 ? 0.6 : -0.6) * (dir[1] / dl), start[1], start[2] + (dir[1] / dl) * i * 1.4 - (i & 1 ? 0.6 : -0.6) * (dir[0] / dl)];
      a.vel = [0, 0, 0]; a.path = null; a.goal = null; a.pose = 'stand'; a.bubble = null;
      a.act = { type: 'arrive', phase: 'walk', t: 0, lead: i === 0, i, home: h.fam };
    });
    V._mi.job = { h, vil, fam: fam ? fam.surname : '', agents, t: 0, start, way, frame: null, frameDone: false, cart: [start[0] - (dir[0] / dl) * 0.2, start[1], start[2], Math.atan2(-dir[0], -dir[1]) + Math.PI], parked: false, greeted: false, done: false };
    card(g, T('g.mi.coming', { fam: fam ? fam.surname : '' }), [[T('g.mi.skipBtn'), () => MI.skip(g)]], T('g.mi.skip'));
  };
  MI.groundAt = function (w, x, yTop, z, span) {
    const R = VR.R, F = VR.F;
    for (let y = yTop; y > yTop - span; y--) {
      const b = w.getBlock(x, y - 1, z), a0 = w.getBlock(x, y, z), a1 = w.getBlock(x, y + 1, z);
      if (b && (R.T.flags[b] & F.SOLID) && !(R.T.flags[b] & F.FLUID) && !(a0 && (R.T.flags[a0] & (F.SOLID | F.FLUID))) && !(a1 && (R.T.flags[a1] & (F.SOLID | F.FLUID)))) return y;
    }
    return null;
  };
  // f-polish5: a waypoint on the ground (a path, gravel or road block within 3 m preferred): [x, y, z] or null
  const WAYN = /path|gravel|cobble|road|paver|brick/;
  MI.wayAt = function (w, x, z, y0, exact) {
    const R = VR.R, xi = Math.floor(x), zi = Math.floor(z);
    if (!exact) {
      let best = null, bd = 99;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const d = dx * dx + dz * dz; if (d >= bd || d > 9) continue;
        const y = MI.groundAt(w, xi + dx, Math.round(y0) + 8, zi + dz, 18); if (y === null) continue;
        const t = R.types[R.T.type[w.getBlock(xi + dx, y - 1, zi + dz)]]; if (t && WAYN.test(t.name)) { bd = d; best = [xi + dx + 0.5, y, zi + dz + 0.5]; }
      }
      if (best) return best;
    }
    const y = MI.groundAt(w, xi, Math.round(y0) + 8, zi, 18);
    return y === null ? null : [xi + 0.5, y, zi + 0.5];
  };
  // one family member's walk in: up the way to the doorstep, the first greets you, all unpack a little, then inside
  MI.runArrive = function (V, a, dt) {
    const act = a.act, J = V._mi && V._mi.job, g = V.g;
    act.t += dt;
    if (!J || J.vil !== a.vil) { a.act = null; return; }
    const h = J.h, o = h.outside, p = g.player.pos;
    if (act.phase === 'walk') {
      if (act.t < act.i * 0.9) return;
      // f-polish5: along the way's waypoints first (each in ≤ 25 s, else a step to it), then to the doorstep
      const Wy = J.way; if (Wy && (act.wi | 0) < Wy.length - 1) {
        const q = Wy[act.wi | 0]; act.wt = (act.wt || 0) + dt;
        if (V.goTo(a, q[0] - 0.5, q[1], q[2] - 0.5, 1.6) || act.wt > 25) { if (act.wt > 25) { a.pos = q.slice(); a.path = null; } act.wi = (act.wi | 0) + 1; act.wt = 0; }
        act.tw = act.t;
        return;
      }
      const tl = act.t - (act.tw || 0);
      const tx = o[0] + (act.i ? ((act.i & 1) ? 1 : -1) * Math.min(2, (act.i + 1) >> 1) : 0), tz = o[2];
      if (V.goTo(a, tx, o[1], tz, 1.3) || tl > 75) {
        if (tl > 75) { a.pos = [tx + 0.5, o[1], tz + 0.5]; a.path = null; }
        act.phase = act.lead ? 'greet' : 'unpack'; act.t = 0;
        if (act.lead && !J.parked) { J.parked = true; MI.parkCart(V, J); }
      }
      return;
    }
    if (act.phase === 'greet') {
      a.lookAt = [p[0], p[1] + 1.4, p[2]];
      if (!J.greeted) {
        J.greeted = true;
        const nm = playerName(g), near = Math.hypot(p[0] - a.pos[0], p[2] - a.pos[2]) < 24;
        if (near) a.say(T(nm ? 'g.mi.arrive' : 'g.mi.arriveN', { name: nm, fam: J.fam }), 6);
        a.waveT = 2.6;
      }
      if (act.t > 3.2) { act.phase = 'unpack'; act.t = 0; }
      return;
    }
    if (act.phase === 'unpack') {
      const c = J.cart;
      if (V.goTo(a, c[0], c[1], c[2], 1.8) || act.t > 12) {
        a.pose = 'crouch'; a.lookAt = [c[0], c[1] + 0.5, c[2]];
        if (!act.said && a.kid && act.t > 1) { act.said = true; a.say(T('g.mi.arriveKid'), 3.5); }
        if (!act.said && act.i === 1) { act.said = true; a.say(T('g.mi.unpack'), 3.5); }
        act.ut = (act.ut || 0) + dt;
        if (act.ut > 4.5 + act.i * 0.7) { act.phase = 'in'; act.t = 0; a.pose = 'stand'; a.lookAt = null; }
      }
      return;
    }
    if (act.phase === 'in') {
      const q = h.inside;
      if (V.goTo(a, q[0], q[1], q[2], 1.6) || act.t > 30) { a.act = null; a.pose = 'stand'; act.done = true; }
    }
  };
  MI.updateJob = function (V, dt) {
    const J = V._mi.job; J.t += dt;
    const left = J.agents.filter(a => a.act && a.act.type === 'arrive' && V.agents.includes(a));
    // the cart rolls behind the lead while they walk
    const L = J.agents[0];
    if (L && L.act && L.act.type === 'arrive' && L.act.phase === 'walk' && !J.parked) {
      const yaw = L.yaw; const bx = L.pos[0] + Math.sin(yaw) * 1.7, bz = L.pos[2] + Math.cos(yaw) * 1.7;
      J.cart[0] += (bx - J.cart[0]) * Math.min(1, dt * 4); J.cart[2] += (bz - J.cart[2]) * Math.min(1, dt * 4); J.cart[1] += (L.pos[1] - J.cart[1]) * Math.min(1, dt * 4);
      const dx = L.pos[0] - J.cart[0], dz = L.pos[2] - J.cart[2]; if (dx * dx + dz * dz > 0.05) J.cart[3] = Math.atan2(-dx, -dz);
    }
    MI.frameTick(V, J, dt);
    if ((!left.length && J.t > 2) || J.t > (J.way ? 300 : 160)) MI.finish(V);
  };
  // ---- f-polish5: the gentle framing — once an arrival, when the family is ~30 m from the door and you are near it
  // (⚙ Spiel „Einzug im Bild" moveinCam; never with Weniger Bewegung, a menu, the Studio, a guest; any key: out now)
  MI.frameTick = function (V, J, dt) {
    const g = V.g, L = J.agents[0], o = J.h.outside;
    if (J.frame) {
      const F = J.frame; F.t += dt;
      const I = g.input, any = !!I && ((I.pressed && I.pressed.size > 0) || (I.mouse && I.mouse.clicked && I.mouse.clicked.some(Boolean)) || (I.padPressed && I.padPressed.size > 0));
      if (any && F.t > 0.1) F.t = Math.max(F.t, MI.frameSkip(F.t));
      if (F.t >= MI.FRAME.dur || !L || !L.act) MI.frameEnd(g, J);
      return;
    }
    if (J.frameDone || !L || !L.act || L.act.phase !== 'walk' || !J.way) return;
    if (g.settings && (g.settings.moveinCam === false || g.settings.travelCam === false)) return;
    if ((VR.A11y && VR.A11y.less && VR.A11y.less(g.settings)) || g.studioOpen || g.photo || (g.ui && g.ui.screen && g.ui.screen !== 'hud') || (g.director && g.director.active) || (g.wow && g.wow.active)) return;
    const p = g.player.pos, dl = Math.hypot(L.pos[0] - o[0], L.pos[2] - o[2]);
    if (dl > 34 || dl < 12 || Math.hypot(p[0] - o[0], p[2] - o[2]) > 45) return;
    // the side of the way with the lower ground (the camera never in a hill)
    const dx = (L.pos[0] - o[0]) / dl, dz = (L.pos[2] - o[2]) / dl, mx = o[0] + dx * dl * 0.5, mz = o[2] + dz * dl * 0.5, w = g.world;
    const hA = w.topAt ? w.topAt(Math.floor(mx - dz * 9), Math.floor(mz + dx * 9)) : 0, hB = w.topAt ? w.topAt(Math.floor(mx + dz * 9), Math.floor(mz - dx * 9)) : 0;
    let side = hA <= hB ? 1 : -1;
    // o-wander2: the close shot — the side whose line from the camera to the cart is clear of blocks (else the lower)
    if (J.cart && VR.MoveIn.lineClear) { const ok = (sd) => { const P = MI.framePose(L.pos, o, {}, sd, J.cart); return MI.lineClear(w, [P.x, P.y, P.z], [J.cart[0], J.cart[1] + 1, J.cart[2]]); }; if (!ok(side) && ok(-side)) side = -side; }
    J.frame = { t: 0, side, pose: {}, hh: !!g.hideHud };
    g.hideHud = true;   // (the held item is not in the shot)
  };
  // o-wander2: no solid block on the line a → b (0.4-m steps, the last metre skipped: the cart itself)
  MI.lineClear = function (w, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz), n = Math.ceil(L / 0.4), R = VR.R, F = VR.F;
    for (let i = 1; i < n; i++) { const u = i / n; if (u * L > L - 1) break; const st = w.getBlock(Math.floor(a[0] + dx * u), Math.floor(a[1] + dy * u), Math.floor(a[2] + dz * u)); if (st && R && R.T && (R.T.flags[st] & F.SOLID)) return false; }
    return true;
  };
  MI.frameEnd = function (g, J) { if (!J || !J.frame) return; g.hideHud = J.frame.hh; J.frame = null; J.frameDone = true; };
  const wrapA = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  // the camera while it frames (game.js: after the wow moment's): base → the framing pose by MI.frameK, the HUD kept
  MI.cam = function (g, base) {
    const V = g.villages, J = V && V._mi && V._mi.job, F = J && J.frame; if (!F) return null;
    const L = J.agents[0]; if (!L) return null;
    const k = MI.frameK(F.t); if (k <= 0.001) return null;
    const P = MI.framePose(L.pos, J.h.outside, F.pose, F.side, J.cart || null);
    const gy = g.world.topAt ? g.world.topAt(Math.floor(P.x), Math.floor(P.z)) + 2.2 : P.y; if (P.y < gy) P.y = gy;
    return Object.assign({}, base, { x: base.x + (P.x - base.x) * k, y: base.y + (P.y - base.y) * k, z: base.z + (P.z - base.z) * k, yaw: base.yaw + wrapA(P.yaw - base.yaw) * k, pitch: base.pitch + (P.pitch - base.pitch) * k, roll: (base.roll || 0) * (1 - k), fixed: true });
  };
  MI.parkCart = function (V, J) {
    const g = V.g, h = J.h, w = g.world;
    // beside the doorstep, two blocks along the wall
    const nx = h.outside[0] - h.inside[0], nz = h.outside[2] - h.inside[2];
    for (const s of [2, -2, 3, -3]) {
      const x = h.outside[0] + (nz ? s : 0) + nx, z = h.outside[2] + (nx ? s : 0) + nz;
      const y = MI.groundAt(w, x, h.outside[1] + 3, z, 7); if (y === null) continue;
      J.cart = [x + 0.5, y, z + 0.5, Math.atan2(-nz, -nx) + Math.PI / 2]; return;
    }
  };
  MI.skip = function (g) {
    const V = g.villages, J = V && V._mi && V._mi.job; if (!J) return false;
    for (const a of J.agents) { if (!a.act || a.act.type !== 'arrive') continue; const q = J.h.inside; a.pos = [q[0] + 0.5, q[1], q[2] + 0.5]; a.path = null; a.act = null; a.pose = 'stand'; }
    if (!J.parked) { J.parked = true; MI.parkCart(V, J); }
    MI.finish(V);
    return true;
  };
  MI.finish = function (V) {
    const g = V.g, J = V._mi.job; if (!J || J.done) return;
    MI.frameEnd(g, J);   // (f-polish5)
    J.done = true; V._mi.job = null;
    card(g, null);
    const rec = MI.rec(g), set = setById(rec, J.h.set);
    rec.cart = { at: J.cart.slice(), until: (g.env.day || 0) * MI.DAY + 12500, set: J.h.set };
    MI.decorate(V, J.h, false);
    if (g.ui) { g.ui.toast(T('g.mi.movedT'), T('g.mi.moved', { fam: J.fam }), null); if (g.audio) { try { g.audio.play('achievement'); } catch (e) { /* a sound */ } } }
    if (set) MI.grow(V, set);
  };

  // ---------------------------------------------------------------- decor (removable, into air only)
  MI.decorate = function (V, h, quiet) {
    const g = V.g, rec = MI.rec(g), w = g.world;
    if (h.decor && h.decor.length) return;
    const creative = g.player && g.player.creative;
    if (creative && rec.decor !== true) {
      if (rec.decor === null && !quiet) { const fam = (V.known.get(h.set) || { fams: [] }).fams[h.fam]; MI.askDecor(g, h, fam ? fam.surname : ''); }
      return;
    }
    MI.placeDecor(V, h);
  };
  MI.placeDecor = function (V, h) {
    const g = V.g, w = g.world, get = (x, y, z) => w.getBlock(x, y, z);
    const room = { inside: h.inside, beds: h.beds, seats: h.seats, floor: h.floor };
    const ops = MI.planDecor(get, room, VR.R, { seed: h32(h.door[0], h.door[1], h.door[2]) });
    h.decor = [];
    for (const [x, y, z, s] of ops) { if (get(x, y, z) !== 0 || V.occupied(x, y, z)) continue; V.setBlock(x, y, z, s); h.decor.push([x, y, z]); }
  };
  MI.askDecor = function (g, h, fam) {
    card(g, T('g.mi.decorAsk', { fam }), [[T('g.mi.yes'), () => MI.answerDecor(g, true)], [T('g.mi.no'), () => MI.answerDecor(g, false)]], null, true);
  };
  MI.answerDecor = function (g, yes) {
    const rec = MI.rec(g); rec.decor = !!yes; card(g, null);
    if (!yes || !g.villages) return;
    for (const h of rec.homes) if (h.st === 'home' && (!h.decor || !h.decor.length)) MI.placeDecor(g.villages, h);
  };

  // ---------------------------------------------------------------- growth: a name, a market, a festival night
  MI.grow = function (V, set) {
    const g = V.g, rec = MI.rec(g), n = MI.homesOf(rec, set).length, vil = V.known.get(set.id);
    if (n >= 2 && !set.named && !set.asked) { set.asked = true; MI.askName(g, set, n); }
    if (n >= 3 && !set.market) {
      const pz = MI.plazaOf(rec, set), w = g.world;
      // the stall: a free bit of ground near the middle of the doorsteps (presentation only — a model, no blocks)
      for (let k = 0; k < 12 && !set.stall; k++) {
        const an = k * 0.9, r = 3 + (k >> 2) * 2, x = Math.round(pz.x + Math.cos(an) * r), z = Math.round(pz.z + Math.sin(an) * r);
        const y = MI.groundAt(w, x, pz.y + 4, z, 9); if (y === null) continue;
        if (rec.homes.some(h => h.box && h.box.length === 6 && x >= h.box[0] - 2 && x <= h.box[3] + 2 && z >= h.box[2] - 2 && z <= h.box[5] + 2)) continue;
        set.stall = [x, y, z];
      }
      if (set.stall) {
        set.market = true; set.fest = (g.env.day || 0) + 1;
        if (vil) { MI.workFor(vil.plan, set, rec); }
        note(g, T('g.mi.market', { v: set.name }) + ' ' + T('g.mi.festSoon', { v: set.name }), 'mi:market');
      }
    }
  };
  MI.nameSettlement = function (g, id, name) {
    const rec = MI.rec(g), set = setById(rec, id); if (!set) return false;
    const nm = String(name || '').replace(/[<>]/g, '').trim().slice(0, 28); if (!nm) return false;
    set.name = nm; set.named = true;
    const vil = g.villages && g.villages.known.get(id); if (vil) { vil.name = nm; vil.plan.name = nm; }
    note(g, T('g.mi.named', { v: nm }), 'mi:named');
    return true;
  };
  MI.askName = function (g, set, n) {
    if (!hasDoc) return;
    card(g, T('g.mi.nameAsk', { n }), [[T('g.mi.nameOk'), () => { const el = document.getElementById('mi_name'); MI.nameSettlement(g, set.id, el ? el.value : set.name); card(g, null); }], [T('g.mi.later'), () => { set.asked = false; card(g, null); }]], null, true, set.name);
  };

  // ---------------------------------------------------------------- greetings by what they remember
  MI.greetings = function (V, t) {
    const g = V.g, M = V._mi, rec = MI.rec(g), p = g.player.pos;
    if (M.job) return;
    for (const a of V.agents) {
      if (!a.vil.plan || !a.vil.plan.mine || a.pose === 'sleep' || a.kid || a.bubble) continue;
      const d2 = (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2; if (d2 > 6 * 6) continue;
      const last = M.greetT.get(a.p.id) || -1e9; if (V.time - last < 150) continue;
      M.greetT.set(a.p.id, V.time);
      const set = setById(rec, a.vil.id); if (!set) continue;
      const nm = playerName(g), L = rec.mem[famKey(set, a.p.fam)] || [];
      const key = MI.greetKey(L, t, !!nm), m = L[L.length - 1];
      a.say(T(key, { name: nm, what: m && m.what ? m.what : '' }), 4.5);
      a.lookAt = [p[0], p[1] + 1.4, p[2]];
      break;
    }
    // back after being away: who moved in meanwhile
    if (rec.last.away) { const s = setById(rec, rec.last.away.set); if (s && Math.hypot(s.x - p[0], s.z - p[2]) < 60) { note(g, T('g.mi.movedAway', { fam: rec.last.away.fam }), 'mi:away'); rec.last.away = null; } }
  };

  // ---------------------------------------------------------------- gifts at your door
  MI.dailyGift = function (V, t) {
    const g = V.g, rec = MI.rec(g), day = Math.floor(t / MI.DAY), tod = t - day * MI.DAY;
    if (tod < 600 || tod > 5000 || rec.last.giftDay === day || rec.gifts.length >= 3) return;
    rec.last.giftDay = day;
    const homes = rec.homes.filter(h => h.st === 'home' && h.at && t - h.at > 3000); if (!homes.length) return;
    const h = homes[h32(day, homes.length, 77) % homes.length];
    if (h32(day, h.fam, 91) % 100 >= 55) return;   // a little more than every other morning
    MI.leaveGift(V, h);
  };
  MI.leaveGift = function (V, h) {
    const g = V.g, rec = MI.rec(g), w = g.world, set = setById(rec, h.set), vil = set && V.known.get(set.id);
    if (!vil) return null;
    // your door: the one nearest your bed (within 12 blocks), else this family's own doorstep
    let at = null;
    const b = g.player.spawnBed;
    if (b) {
      let best = 1e9;
      for (const q of rec.homes) { const d = Math.hypot(q.door[0] - b[0], q.door[2] - b[2]); if (d < 12 && d < best) { best = d; at = q.outside; } }
    }
    at = at || h.outside;
    const y = MI.groundAt(w, at[0], at[1] + 2, at[2], 5); if (y === null) return null;
    const fam = vil.fams[h.fam], giver = fam && fam.members[0];
    const has = (id) => !!((VR.itemDef && VR.itemDef(id)) || VR.R.byName[id]);
    const [item, n] = MI.giftFor(giver ? giver.likes : '_', h32(h.fam, (g.env.day || 0), 5), has);
    const gift = { at: [at[0] + 0.5, y, at[2] + 0.5], item, n, fam: fam ? fam.surname : '', name: giver ? giver.name : '' };
    rec.gifts.push(gift);
    if (Math.hypot(g.player.pos[0] - at[0], g.player.pos[2] - at[2]) < 80) note(g, T('g.mi.giftNote'), 'mi:gift');
    return gift;
  };
  MI.updateGifts = function (V, dt) {
    const g = V.g, M = V._mi; M.giftT -= dt; if (M.giftT > 0) return; M.giftT = 0.25;
    const rec = MI.rec(g); if (!rec.gifts.length || !g.player.inv) return;
    const p = g.player.pos;
    for (let i = rec.gifts.length - 1; i >= 0; i--) {
      const q = rec.gifts[i];
      if (Math.hypot(q.at[0] - p[0], q.at[2] - p[2]) > 1.3 || Math.abs(q.at[1] - p[1]) > 2) continue;
      rec.gifts.splice(i, 1);
      g.player.inv.add(q.item, q.n);
      if (g.ui) g.ui.toast(T('g.mi.giftT'), T('g.mi.giftGot', { fam: q.fam, n: q.n, item: VR.itemName ? VR.itemName(q.item) : q.item }), null);
      if (g.audio) { try { g.audio.play('pop'); } catch (e) { /* a sound */ } }
      if (g.particles && g.particles.glow) for (let k = 0; k < 8; k++) g.particles.glow(q.at[0] + (Math.random() - 0.5) * 0.6, q.at[1] + 0.5 + Math.random() * 0.5, q.at[2] + (Math.random() - 0.5) * 0.6, [1, 0.8, 0.4]);
    }
  };
  MI.updateCart = function (V, t) { const rec = MI.rec(V.g); if (rec.cart && t > rec.cart.until) rec.cart = null; };

  // ---------------------------------------------------------------- drawing (presentation only)
  MI.draw = function (V, r, E, cam) {
    const g = V.g, ent = g.entities, LK = VR.LifeKit; if (!ent || !LK || !g.meta || !g.meta.movein || !MI.on(g)) return;
    const rec = g.meta.movein, J = V._mi && V._mi.job;
    const cart = J ? J.cart : rec.cart && rec.cart.at;
    const sets = rec.sets.filter(s => s.market && s.stall);
    MI.drawFest(V, r, E, cam);   // (f-polish5: a settlement's festival night — lantern strings, the fire ring)
    if (!cart && !rec.gifts.length && !sets.length) return;
    const FD2 = 120 * 120, near = (q) => (q[0] - cam.x) ** 2 + (q[2] - cam.z) ** 2 < FD2;
    let prog = null; const P0 = () => prog || (prog = ent.beginVox(r, E));
    if (cart && near(cart)) LK.drawModel(g, r, P0(), 'movein_cart', cart, cart[3] || 0, cam, {});
    for (const q of rec.gifts) if (near(q.at)) LK.drawModel(g, r, P0(), 'movein_gift', q.at, (q.at[0] * 7 + q.at[2] * 3) % 6.28, cam, {});
    for (const s of sets) { const q = [s.stall[0] + 0.5, s.stall[1], s.stall[2] + 0.5]; if (near(q)) { LK.drawModel(g, r, P0(), 'movein_stall', q, 0, cam, {}); LK.drawModel(g, r, P0(), 'life_goods', [q[0], q[1] + 0.95, q[2]], 0, cam, {}); } }
  };

  // ---- f-polish5: the festival night of your settlement, readable — lanterns strung between the doorsteps and a fire
  // ring on the plaza (presentation only; no block). Very Low: the lanterns as warm one-frame dots (one batch), the fire as
  // embers; Low and up: the paper lanterns, the fire's flames, soft halos (⚙ wonderGlow; ≤ 10 halos).
  const FPO = { col: [1, 0.7, 0.35], size: 0.2, force: true, grav: 0, drag: 0, collide: false, fade: false, life: 0.05, emis: 1 };
  const FFL = { col: [1, 0.6, 0.2], size: 0.22, grav: -1.4, drag: 0.6, collide: false, life: 0.7, emis: 1, wind: 0.2 };
  const LCOL = [[1, 0.62, 0.3], [1, 0.82, 0.42], [1, 0.5, 0.42], [0.95, 0.75, 0.5]];
  const FH = []; for (let i = 0; i < 10; i++) FH.push({ p: [0, 0, 0], s: [1, 1], col: [1, 0.7, 0.4], a: 0, kind: 0 });
  const LAMPO = { scale: 1 };
  MI.drawFest = function (V, r, E, cam) {
    const g = V.g, rec = g.meta.movein, tod = g.env.timeOfDay, LK = VR.LifeKit;
    if (!rec || !rec.sets.length || !V.festivalOn) return;
    const T0 = tierOf(g), dt = Math.min(0.1, V._miDt || 0.033);
    for (const set of rec.sets) {
      const vil = V.known.get(set.id); if (!vil || !vil.active || !V.festivalOn(vil, tod)) continue;
      const pz = vil.plan.plaza; if ((pz.x - cam.x) ** 2 + (pz.z - cam.z) ** 2 > 140 * 140) continue;
      const hs = MI.homesOf(rec, set); if (hs.length < 2) continue;
      const key = hs.map(h => h.outside.join(',')).join('|');
      if (!set._fl || set._flKey !== key) { set._fl = MI.festLights(hs.map(h => h.outside), MI.plazaOf(rec, set)); set._flKey = key; }
      const FL = set._fl, P = g.particles, dusk = Math.max(0, Math.min(1, (tod - 11400) / 900));
      let prog = null; const P0 = () => prog || (prog = g.entities.beginVox(r, E));
      // the lanterns
      for (let i = 0; i < FL.lamps.length; i++) {
        const q = FL.lamps[i], c = LCOL[q[4]], sw = Math.sin(V.time * 1.3 + i) * 0.04;
        if (T0 >= 1 && LK) { LAMPO.scale = 1; LK.drawModel(g, r, P0(), 'movein_lantern', [q[0] + sw, q[1] - 0.3, q[2]], i * 0.7, cam, LAMPO); }
        else if (P) { FPO.col = c; FPO.size = 0.22; FPO.life = dt * 1.5 + 1e-4; P.spawn(q[0], q[1], q[2], 0, 0, 0, FPO); }
      }
      // the fire ring
      const f = FL.fire;
      if (LK && T0 >= 1) LK.drawModel(g, r, P0(), 'movein_firering', [f[0] + 0.5, f[1], f[2] + 0.5], 0, cam, LAMPO);
      else if (P) { FPO.col = LCOL[0]; FPO.size = 0.5; FPO.life = dt * 1.5 + 1e-4; P.spawn(f[0] + 0.5, f[1] + 0.25, f[2] + 0.5, 0, 0, 0, FPO); }   // (Very Low: the embers as one warm dot — no model, no vox pass)
      if (P && Math.random() < dt * (T0 >= 1 ? 26 : 8)) { FFL.col = Math.random() < 0.5 ? [1, 0.55, 0.15] : [1, 0.8, 0.3]; P.spawn(f[0] + 0.5 + (Math.random() - 0.5) * 0.6, f[1] + 0.3, f[2] + 0.5 + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.3, 1.2 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3, FFL); }
      // the halos: the fire and the lanterns nearest you
      if (T0 >= 1 && g.settings.wonderGlow !== false && VR.StoryGlow && VR.StoryGlow.draw) {
        const night = Math.max(dusk, Math.min(1, (E && E.night) || 0)), A = 0.35 + 0.65 * night;
        let n = 0; const H0 = FH[n++]; H0.p[0] = f[0] + 0.5; H0.p[1] = f[1] + 0.9; H0.p[2] = f[2] + 0.5; H0.s[0] = H0.s[1] = 2.6 + Math.sin(V.time * 7) * 0.08; H0.col[0] = 1; H0.col[1] = 0.55; H0.col[2] = 0.22; H0.a = 0.8 * A;
        for (let i = 0; i < FL.lamps.length && n < FH.length; i += (FL.lamps.length > 18 ? 2 : 1)) { const q = FL.lamps[i], c = LCOL[q[4]], H = FH[n++]; H.p[0] = q[0]; H.p[1] = q[1] - 0.15; H.p[2] = q[2]; H.s[0] = H.s[1] = 0.9; H.col[0] = c[0]; H.col[1] = c[1]; H.col[2] = c[2]; H.a = 0.5 * A; }
        for (let i = n; i < FH.length; i++) FH[i].a = 0;
        VR.StoryGlow.draw(r, cam, FH);
      }
    }
  };
  // the models (our own; 1 voxel = 1/8 m)
  const MOD = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (MOD && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const gr = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(gr); return { grid: gr, pivot: [0, 0, 0] }; };
    // f-polish5 · a paper festival lantern (0.4 m): a warm round body with ribs, a dark cap and a tassel
    MOD.movein_lantern = () => ({
      unit: 8, radius: 0.5, parts: {
        body: part(5, 6, 5, [2, 0, 2], (gr) => {
          gr.ell(2.5, 2.5, 2.5, 2.4, 2.1, 2.4, (x, y) => (y === 2 ? 0xffc070 : 0xffa04a), { emis: 1 });
          gr.box(2, 5, 2, 2, 5, 2, 0x3a2a1a); gr.box(1, 4, 1, 3, 4, 3, 0x5a3a20); gr.set(2, 0, 2, 0xd04a30);
        }),
      }, layout: { body: [0, 0, 0] },
    });
    // f-polish5 · the fire ring: nine field stones round a small stack of logs, glowing embers
    MOD.movein_firering = () => ({
      unit: 8, radius: 1.4, parts: {
        body: part(22, 6, 22, [11, 0, 11], (gr) => {
          for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, x = 11 + Math.cos(a) * 8.6, z = 11 + Math.sin(a) * 8.6; gr.ell(x, 0.5, z, 1.8, 1.6, 1.8, (k & 1) ? 0x8a8478 : 0x6e6a62); }
          gr.ell(11, 0, 11, 5.4, 0.8, 5.4, 0x3a2a20);
          gr.ell(11, 1, 11, 3.6, 1, 3.6, (x, y, z) => ((x + z) & 1 ? 0xff7a2a : 0xffb040), { emis: 1 });
          gr.box(7, 1, 10, 15, 2, 11, 0x6a4428); gr.box(10, 2, 7, 11, 3, 15, 0x7a5030); gr.box(9, 3, 9, 13, 3, 12, 0x5a3a22);
        }),
      }, layout: { body: [0, 0, 0] },
    });
    // the hand cart: a plank bed 2 m long on two big spoked wheels, a canvas over the bundles, a potted plant, two shafts
    MOD.movein_cart = () => ({
      unit: 8, radius: 2, parts: {
        body: part(16, 16, 22, [8, 0, 11], (gr) => {
          const wood = 0x9A6A3A, wood2 = 0x7A4E28, rim = 0x4A3220, can = 0xEDE3C8, can2 = 0xD8CBA8;
          gr.box(2, 4, 3, 13, 5, 18, (x, y, z) => ((z >> 1) & 1 ? wood : wood2));
          gr.box(2, 6, 3, 2, 8, 18, wood2); gr.box(13, 6, 3, 13, 8, 18, wood2); gr.box(2, 6, 18, 13, 8, 18, wood2); gr.box(2, 6, 3, 13, 7, 3, wood2);
          for (const x of [0, 15]) for (let a = 0; a < 40; a++) { const an = a / 40 * Math.PI * 2; gr.set(x, Math.round(4 + Math.sin(an) * 3.6), Math.round(11 + Math.cos(an) * 3.6), rim); }
          for (const x of [0, 15]) for (let k = -3; k <= 3; k++) { gr.set(x, 4 + k, 11, wood2); gr.set(x, 4, 11 + k, wood2); }
          gr.box(1, 4, 11, 14, 4, 11, rim);
          gr.box(3, 6, 4, 12, 10, 16, (x, y, z) => ((x + z) % 5 === 0 ? can2 : can));
          gr.box(4, 11, 6, 11, 11, 14, can2);
          gr.box(4, 6, 13, 7, 9, 16, 0x8A5A30); gr.box(9, 6, 14, 11, 8, 16, 0xB07840);
          gr.box(9, 11, 8, 10, 12, 9, 0xB0543A); gr.box(8, 13, 7, 11, 14, 10, 0x4E9A3A); gr.set(9, 15, 8, 0xE8A0C0); gr.set(10, 15, 9, 0xF6D24A);
          gr.box(4, 5, 0, 4, 5, 2, wood); gr.box(11, 5, 0, 11, 5, 2, wood); gr.box(4, 5, 0, 11, 5, 0, wood2);
          gr.box(6, 0, 19, 6, 3, 19, wood2); gr.box(9, 0, 19, 9, 3, 19, wood2);
        }),
      }, layout: { body: [0, 0, 0] },
    });
    // a small wrapped gift: a box in a warm red with a cream ribbon cross and a bow
    MOD.movein_gift = () => ({
      unit: 16, radius: 0.5, parts: {
        body: part(8, 9, 8, [4, 0, 4], (gr) => {
          gr.box(0, 0, 0, 7, 5, 7, (x, y, z) => (x === 3 || x === 4 || z === 3 || z === 4 ? 0xF4E8C8 : 0xC8443A));
          gr.box(0, 6, 0, 7, 6, 7, (x, y, z) => (x === 3 || x === 4 || z === 3 || z === 4 ? 0xF4E8C8 : 0xB03830));
          gr.box(2, 7, 3, 2, 8, 4, 0xF4E8C8); gr.box(5, 7, 3, 5, 8, 4, 0xF4E8C8); gr.box(3, 7, 3, 4, 7, 4, 0xE8D8B0);
        }),
      }, layout: { body: [0, 0, 0] },
    });
    // the market stall: four posts, a counter, a striped roof in green and cream
    MOD.movein_stall = () => ({
      unit: 8, radius: 2.4, parts: {
        body: part(24, 22, 14, [12, 0, 7], (gr) => {
          const wood = 0x9A6A3A, wood2 = 0x7A4E28;
          for (const [x, z] of [[0, 0], [23, 0], [0, 13], [23, 13]]) gr.box(x, 0, z, x, 18, z, wood2);
          gr.box(1, 0, 1, 22, 6, 5, (x, y, z) => (y === 6 ? wood : (x % 4 === 0 ? wood2 : wood)));
          gr.box(0, 19, 0, 23, 19, 13, (x) => ((x >> 2) & 1 ? 0x5A9A5A : 0xF4F0E6));
          gr.box(0, 18, 0, 23, 18, 0, (x) => ((x >> 2) & 1 ? 0x4A8A4A : 0xE4E0D6));
          gr.box(2, 7, 2, 5, 8, 4, 0xE8483A); gr.box(18, 7, 2, 21, 8, 4, 0xF6D24A);
        }),
      }, layout: { body: [0, 0, 0] },
    });
  }

  // ---------------------------------------------------------------- the card (a small panel at the bottom; skip / ask / name)
  let cssDone = false;
  function card(g, txt, btns, foot, unlock, inputVal) {
    if (!hasDoc) return;
    let el = document.getElementById('mi_card');
    if (!txt) { if (el) el.remove(); return; }
    if (!cssDone) {
      cssDone = true;
      const s = document.createElement('style');
      s.textContent = '#mi_card{position:absolute;left:50%;top:14%;transform:translateX(-50%);max-width:min(520px,86vw);background:rgba(26,22,18,.78);color:#fdf3df;border:1px solid rgba(255,220,160,.35);border-radius:12px;padding:10px 14px;font:14px/1.4 inherit;z-index:30;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:auto}#mi_card button{margin:8px 5px 0;padding:5px 12px;border-radius:8px;border:1px solid rgba(255,220,160,.5);background:rgba(255,220,160,.14);color:#fdf3df;cursor:pointer}#mi_card input{margin-top:8px;padding:5px 8px;border-radius:7px;border:1px solid rgba(255,220,160,.5);background:rgba(0,0,0,.3);color:#fff;width:70%}#mi_card .ft{opacity:.7;font-size:12px;margin-top:4px}';
      document.head.appendChild(s);
    }
    if (!el) { el = document.createElement('div'); el.id = 'mi_card'; el.setAttribute('role', 'dialog'); (document.getElementById('ui') || document.body).appendChild(el); }
    el.textContent = '';
    const p = document.createElement('div'); p.textContent = txt; el.appendChild(p);
    if (inputVal !== undefined) { const i = document.createElement('input'); i.id = 'mi_name'; i.type = 'text'; i.maxLength = 28; i.value = inputVal; i.onkeydown = (e) => e.stopPropagation(); el.appendChild(i); el.appendChild(document.createElement('br')); }
    for (const [lab, fn] of btns || []) { const b = document.createElement('button'); b.textContent = lab; b.onclick = (e) => { e.stopPropagation(); fn(); }; el.appendChild(b); }
    if (foot) { const f = document.createElement('div'); f.className = 'ft'; f.textContent = foot; el.appendChild(f); }
    if (unlock && document.exitPointerLock && document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* fine */ } }
  }
  MI.card = card;
  // the test's window (test/movein.mjs)
  MI.debug = function (g) {
    const V = g.villages, rec = MI.rec(g), J = V && V._mi && V._mi.job;
    return {
      homes: rec.homes.map(h => ({ st: h.st, due: h.due, set: h.set, fam: h.fam, decor: (h.decor || []).length, door: h.door, beds: h.beds.length })),
      sets: rec.sets.map(s => ({ id: s.id, name: s.name, named: s.named, market: s.market, stall: s.stall, fest: s.fest })),
      job: J ? { fam: J.fam, phases: J.agents.map(a => (a.act && a.act.type === 'arrive' ? a.act.phase : 'done')), cart: J.cart.map(v => +v.toFixed(1)), start: J.start && J.start.map(v => Math.round(v)), way: J.way ? J.way.length : 0, framing: J.frame ? +MI.frameK(J.frame.t).toFixed(2) : 0 } : null,
      watch: V && V._mi ? V._mi.watch.length : -1, why: V && V._mi ? V._mi.lastWhy || null : null,
      gifts: rec.gifts.slice(), mem: rec.mem, decor: rec.decor, card: hasDoc && document.getElementById('mi_card') ? document.getElementById('mi_card').textContent : null,
      agents: V ? V.agents.filter(a => a.vil.plan && a.vil.plan.mine).map(a => [a.p.name, a.vil.fams[a.p.fam].surname, a.p.role, a.act && a.act.type, a.pos.map(Math.round), a.bubble ? a.bubble.text : null]) : [],
    };
  };
  if (hasDoc && typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', (e) => {
    const g = VR.game; if (!g || !g.villages || !g.villages._mi || !g.villages._mi.job) return;
    if (e.code === 'Backspace' && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { e.preventDefault(); MI.skip(g); }
  }, true);
})(VR);

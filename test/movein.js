// u-movein — the pure core of VR.MoveIn (src/main/movein.js; plan docs/superpowers/plans/2026-11-01-u-movein.md):
//  · detection on voxel data: an enclosed room ≥ 3×3×2 with a door, a light and a bed or a seat is a home; a missing
//    door / light / bed, a hole in a wall or the roof, a room too small are not (and say why); found from any of the
//    anchors (the bed, the door, the light) — Kreativ and Abenteuer alike (no mode in the detector);
//  · the arrival schedule (next dawn, later homes a day or two after; the window; long overdue → quiet);
//  · the save record's round trip (+ an old save without one, a broken one, a newer one kept);
//  · decor never overwrites a player block (only air, on a full floor, never the door's way, at most three);
//  · memory and greetings; gifts; settlements; every key in both language tables.
//   bash test/wt_run.sh movein.js 300
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require(__dirname + '/../src/main/movein.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const MI = V.MoveIn, R = V.R;
check(!!MI && !!MI.detect && !!MI.planDecor && !!MI.load, 'VR.MoveIn exists (detect, planDecor, load)');
const st = (n, p) => { const t = R.byName[n]; return p ? t.state(p) : t.defaultState; };

// ---------------------------------------------------------------- a tiny world
function World() { this.m = new Map(); }
World.prototype.get = function (x, y, z) { if (y <= 60) return st('stone'); return this.m.get(x + ',' + y + ',' + z) || 0; };
World.prototype.set = function (x, y, z, s) { if (s) this.m.set(x + ',' + y + ',' + z, s); else this.m.delete(x + ',' + y + ',' + z); };
// a house: inner size w × d, h high, at (cx, 61, cz); door in the +z wall
function house(o) {
  o = Object.assign({ w: 5, d: 5, h: 3, door: true, light: true, bed: true, seat: false, hole: null, roofHole: false }, o || {});
  const W = new World(), x0 = 0, z0 = 0, y0 = 61;
  const P = st('oak_planks');
  for (let x = x0 - 1; x <= x0 + o.w; x++) for (let z = z0 - 1; z <= z0 + o.d; z++) {
    W.set(x, y0 - 1, z, P);   // floor (on the stone)
    W.set(x, y0 + o.h, z, P); // roof
    const wall = x === x0 - 1 || x === x0 + o.w || z === z0 - 1 || z === z0 + o.d;
    if (wall) for (let y = y0; y < y0 + o.h; y++) W.set(x, y, z, P);
  }
  const dx = x0 + (o.w >> 1), dz = z0 + o.d;
  if (o.door) { const dt = R.byName.oak_door; W.set(dx, y0, dz, dt.state({ facing: 2, half: 0, open: 0, hinge: 0 })); W.set(dx, y0 + 1, dz, dt.state({ facing: 2, half: 1, open: 0, hinge: 0 })); }
  else { W.set(dx, y0, dz, P); W.set(dx, y0 + 1, dz, P); }
  if (o.bed) { const bt = R.byName.red_bed; W.set(x0, y0, z0 + 1, bt.state({ facing: 0, part: 0 })); W.set(x0, y0, z0, bt.state({ facing: 0, part: 1 })); }
  if (o.seat) W.set(x0 + o.w - 1, y0, z0, st('vx_chair'));
  if (o.light) W.set(x0 + o.w - 1, y0 + 1, z0 + o.d - 1, st('torch'));
  if (o.hole) W.set(o.hole[0], o.hole[1], o.hole[2], 0);
  if (o.roofHole) W.set(x0 + 1, y0 + o.h, z0 + 1, 0);
  return { W, get: (x, y, z) => W.get(x, y, z), door: [dx, y0, dz], bed: [x0, y0, z0 + 1], light: [x0 + o.w - 1, y0 + 1, z0 + o.d - 1], seat: [x0 + o.w - 1, y0, z0], y0 };
}

// ---------------------------------------------------------------- detection
{
  const H = house();
  const r = MI.detect(H.get, H.bed[0], H.bed[1], H.bed[2], R);
  check(r.ok, `a 5×5×3 room with a door, a torch and a bed is a home (${r.why || 'ok'}, ${r.cells} cells)`);
  check(r.ok && r.door.join() === H.door.join() && r.inside[2] === H.door[2] - 1 && r.outside[2] === H.door[2] + 1, `its door ${r.door}, inside ${r.inside}, outside ${r.outside}`);
  check(r.ok && r.beds.length === 1 && r.lights.length === 1, 'one bed, one light found');
  check(r.ok && r.floor.length >= 20, `its floor cells (${r.floor && r.floor.length})`);
  const r2 = MI.detect(H.get, H.door[0], H.door[1], H.door[2], R);
  check(r2.ok && r2.door.join() === r.door.join(), 'found from the door too (its outside escapes, its inside is the room)');
  const r3 = MI.detect(H.get, H.light[0], H.light[1], H.light[2], R);
  check(r3.ok, 'found from the light too');
  const r4 = MI.detect(H.get, H.door[0], H.door[1] + 1, H.door[2], R);
  check(r4.ok, "found from the door's upper half too");
}
{
  const H = house({ door: false }); const r = MI.detect(H.get, H.bed[0], H.bed[1], H.bed[2], R);
  check(!r.ok && r.why === 'door', `no door: not a home (why ${r.why})`);
}
{
  const H = house({ light: false }); const r = MI.detect(H.get, H.bed[0], H.bed[1], H.bed[2], R);
  check(!r.ok && r.why === 'light', `no light: not a home (why ${r.why})`);
}
{
  const H = house({ bed: false, seat: false }); const r = MI.detect(H.get, H.light[0], H.light[1], H.light[2], R);
  check(!r.ok && r.why === 'bed', `no bed and no seat: not a home (why ${r.why})`);
}
{
  const H = house({ bed: false, seat: true }); const r = MI.detect(H.get, H.seat[0], H.seat[1], H.seat[2], R);
  check(r.ok && r.seats.length === 1 && !r.beds.length, `a seat instead of a bed is a home (${r.why || 'ok'})`);
}
{
  const H = house({ hole: [-1, 62, 2] }); const r = MI.detect(H.get, H.bed[0], H.bed[1], H.bed[2], R);
  check(!r.ok && r.why === 'walls', `a hole in the wall: not enclosed (why ${r.why})`);
}
{
  const H = house({ roofHole: true }); const r = MI.detect(H.get, H.bed[0], H.bed[1], H.bed[2], R);
  check(!r.ok && r.why === 'walls', `a hole in the roof: not enclosed (why ${r.why})`);
}
{
  const H = house({ w: 2, d: 5, bed: false, seat: true }); const r = MI.detect(H.get, H.seat[0], H.seat[1], H.seat[2], R);
  check(!r.ok && r.why === 'small', `2 wide: too small (why ${r.why})`);
  const H2 = house({ h: 1, bed: false, seat: false }); const r2 = MI.detect(H2.get, H2.door[0], H2.door[1], H2.door[2] - 1, R);
  check(!r2.ok, `1 high: not a home (why ${r2.why})`);
  const H3 = house({ w: 3, d: 3, h: 2 }); const r3 = MI.detect(H3.get, H3.bed[0], H3.bed[1], H3.bed[2], R);
  check(r3.ok, `exactly 3×3×2 is a home (${r3.why || 'ok'})`);
}
{
  // a huge hall: beyond the bound, never "enclosed"
  const H = house({ w: 30, d: 30, h: 4 }); const r = MI.detect(H.get, H.bed[0], H.bed[1], H.bed[2], R);
  check(!r.ok && r.why === 'walls', `a 30×30 hall is beyond the room's bound (why ${r.why})`);
}
{
  const t0 = Date.now(); let n = 0;
  const H = house({ w: 9, d: 9, h: 4 });
  for (let k = 0; k < 200; k++) { if (MI.detect(H.get, H.bed[0], H.bed[1], H.bed[2], R).ok) n++; }
  const ms = (Date.now() - t0) / 200;
  check(n === 200 && ms < 6, `a 9×9×4 room detected in ${ms.toFixed(2)} ms (< 6 ms; once per change, debounced)`);
}

// ---------------------------------------------------------------- the arrival schedule
{
  const D = MI.DAY;
  check(MI.dueAt(3 * D + 14000, 0) === 4 * D, 'the first family: the next dawn');
  check(MI.dueAt(3 * D + 100, 0) === 4 * D, 'built in the morning: still the next dawn (never the same day)');
  check(MI.dueAt(3 * D + 14000, 1) === 5 * D && MI.dueAt(3 * D + 14000, 5) === 6 * D, 'the 2nd a day later, the others two');
  const h = { st: 'wait', due: 4 * D };
  check(MI.ready(h, 4 * D - 10, true) === null, 'not before dawn');
  check(MI.ready(h, 4 * D + 50, true) === 'arrive', 'at dawn with the player near: the arrival');
  check(MI.ready(h, 4 * D + 50, false) === null, 'the player away: they wait');
  check(MI.ready(h, 4 * D + 12000, true) === null, 'in the evening: they come tomorrow');
  check(MI.ready(h, 5 * D + 2000, true) === 'arrive', 'the next morning: the arrival');
  check(MI.ready(h, 7 * D + 13000, false) === 'quiet', 'three days overdue and away: they move in quietly');
  check(MI.ready({ st: 'home', due: 0 }, 9 * D, true) === null, 'a home moved into: done');
}

// ---------------------------------------------------------------- the record
{
  const rec = MI.fresh();
  const s = MI.settlementFor(rec, [100, 64, 200], 7);
  check(s && s.id === 'mi:1' && typeof s.name === 'string' && s.name.length > 1, `a first home founds a settlement (${s && s.name})`);
  check(MI.settlementFor(rec, [130, 64, 220], 7) === s, 'a home 36 m away joins it');
  const s2 = MI.settlementFor(rec, [400, 64, 200], 7);
  check(s2 && s2.id === 'mi:2', 'a home 300 m away founds another');
  rec.homes.push({ id: 'h1', st: 'home', due: 24000, set: 'mi:1', door: [1, 61, 5], inside: [1, 61, 4], outside: [1, 61, 6], beds: [[0, 61, 1, 0]], seats: [], box: [0, 61, 0, 4, 63, 4], F: 60, floor: [[1, 61, 1]], fam: 0, decor: [[2, 61, 2]], at: 24100, cr: true });
  rec.homes.push({ id: 'h2', st: 'wait', due: 48000, set: 'mi:1', door: [9, 61, 5], inside: [9, 61, 4], outside: [9, 61, 6], beds: [], seats: [[8, 61, 1]], box: [8, 61, 0, 12, 63, 4], F: 60, floor: [], fam: -1, decor: [], at: 0, cr: false });
  MI.remember(rec, 'mi:1:0', 'built', 24100, '');
  MI.remember(rec, 'mi:1:0', 'gifted', 30000, 'Brot');
  rec.gifts.push({ at: [1.5, 61, 6.5], item: 'bread', n: 2, fam: 'Berger', name: 'Lina' });
  rec.cart = { at: [3.5, 61, 7.5, 1.57], until: 36500, set: 'mi:1' }; rec.last.giftDay = 1;
  rec.decor = false; s.named = true; s.name = 'Lindenhain'; s.market = true; s.stall = [3, 61, 9]; s.fest = 5;
  const json = JSON.stringify(MI.save(rec));
  const back = MI.load(JSON.parse(json));
  check(JSON.stringify(MI.save(back)) === json, `the record survives a save round trip (${json.length} bytes)`);
  check(back.homes.length === 2 && back.homes[0].st === 'home' && back.homes[1].st === 'wait' && back.sets[0].name === 'Lindenhain' && back.mem['mi:1:0'].length === 2 && back.decor === false && back.gifts.length === 1, 'homes, settlements, memory, gifts and the decor answer come back');
  const old = MI.load(undefined);
  check(old.v === MI.V && old.homes.length === 0 && old.decor === null, 'an old save without the record: a fresh one');
  const broken = MI.load({ v: 1, homes: [{ door: 'x' }, null, { door: [1, 2, 3], inside: [1, 2, 2], outside: [1, 2, 4] }], sets: [{ id: 'mi:1' }], mem: { a: 'no' }, gifts: [{}] });
  check(broken.homes.length === 1 && broken.sets.length === 0 && broken.mem.a.length === 0 && broken.gifts.length === 0, 'a damaged record: what is sound is kept, the rest dropped');
  const newer = { v: 9, homes: 'future' };
  check(MI.load(newer) === newer, "a newer game's record is kept untouched");
  const P = MI.planFor(s, back, 0);
  check(P.id === 'mi:1' && P.mine && P.folkCap.max === 8 && P.plaza && Array.isArray(P.lots) && P.work.some(w => w.kind === 'stall'), 'the settlement plan: ours, Very Low capped at 8 people, a plaza, the market stall');
  check(MI.planFor(s, back, 3).folkCap.max === 30, 'High: up to 30 people');
}

// ---------------------------------------------------------------- decor never overwrites a player block
{
  let over = 0, placed = 0, maxN = 0, badCell = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const H = house({ w: 4 + (seed % 5), d: 4 + ((seed >> 2) % 4), h: 3, seat: !!(seed & 1) });
    // the player's own things: a few blocks on the floor
    const mine = [];
    for (let k = 0; k < 4; k++) { const x = (seed * (k + 3)) % 4, z = (seed * (k + 5)) % 4; if (H.W.get(x, H.y0, z)) continue; H.W.set(x, H.y0, z, st('vx_crate')); mine.push([x, H.y0, z]); }
    const room = MI.detect(H.get, H.bed[0], H.bed[1], H.bed[2], R);
    if (!room.ok) { over++; continue; }
    const before = new Map(H.W.m);
    const ops = MI.planDecor(H.get, room, R, { seed });
    maxN = Math.max(maxN, ops.length);
    for (const [x, y, z, s] of ops) {
      if (H.W.get(x, y, z) !== 0) over++;
      const [ix, iy, iz] = room.inside; if (Math.abs(x - ix) + Math.abs(z - iz) <= 1 && y === iy) badCell++;
      if (!s) badCell++;
      H.W.set(x, y, z, s); placed++;
    }
    for (const [k, v] of before) if (H.W.m.get(k) !== v) over++;
  }
  check(over === 0, `60 houses: decor never lands on a block of yours (${placed} pieces placed)`);
  check(badCell === 0, "never in the door's way");
  check(maxN <= MI.MAXDECOR && placed > 60, `at most ${MI.MAXDECOR} pieces a home (max ${maxN}), and some decor in most homes`);
  const H = house({ w: 3, d: 3, h: 2 });
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) if (!H.W.get(x, H.y0, z)) H.W.set(x, H.y0, z, st('white_carpet'));
  const room = MI.detect(H.get, H.bed[0], H.bed[1], H.bed[2], R);
  check(room.ok && MI.planDecor(H.get, room, R, { seed: 3 }).length === 0, 'a room you filled: nothing to add');
}

// ---------------------------------------------------------------- memory and greetings, gifts
{
  const rec = MI.fresh();
  check(MI.greetKey([], 0, true) === 'g.mi.greet.none' && MI.greetKey(null, 0, false) === 'g.mi.greet.noneN', 'nothing remembered: a plain hello (with / without your name)');
  MI.remember(rec, 'f', 'built', 1000, '');
  check(MI.greetKey(rec.mem.f, 5000, true) === 'g.mi.greet.built', 'they remember you built their home');
  MI.remember(rec, 'f', 'gifted', 6000, 'Brot');
  check(MI.greetKey(rec.mem.f, 7000, true) === 'g.mi.greet.gifted', 'a gift today: thanks for it');
  check(MI.greetKey(rec.mem.f, 6000 + 30000, true) === 'g.mi.greet.built', 'days later: what they remember most (ties: built first)');
  MI.remember(rec, 'f', 'gifted', 6100, 'Brot');
  check(rec.mem.f.length === 2, 'the same gift twice in a moment is remembered once');
  for (let k = 0; k < 30; k++) MI.remember(rec, 'f', k & 1 ? 'helped' : 'gifted', 10000 + k * 3000, 'x' + k);
  check(rec.mem.f.length === MI.MEM, `the memory keeps the last ${MI.MEM}`);
  const g1 = MI.giftFor('bread', 4, (id) => !!R.byName[id] || ['bread', 'cookie', 'cake', 'apple'].includes(id));
  check(Array.isArray(g1) && g1[1] >= 1, `a gift from someone who likes bread: ${g1}`);
}

// ---------------------------------------------------------------- texts
{
  const D = V.I18N.dict.de, E = V.I18N.dict.en;
  const has = (tab, k) => tab && Object.prototype.hasOwnProperty.call(tab, k);
  let miss = [];
  for (const k of MI.KEYS) { if (!has(D, k)) miss.push('de:' + k); if (!has(E, k)) miss.push('en:' + k); }
  check(D && E && !miss.length, `every key in both tables (${MI.KEYS.length} keys${miss.length ? '; missing ' + miss.slice(0, 4).join(' ') : ''})`);
  const src = require('fs').readFileSync(__dirname + '/../src/main/movein.js', 'utf8');
  const used = new Set((src.match(/'g\.mi\.[a-zA-Z.]+'/g) || []).map(s => s.slice(1, -1)).filter(k => !/\.$/.test(k)));
  const unlisted = [...used].filter(k => !MI.KEYS.includes(k));
  check(!unlisted.length, `every key the file names is listed (${unlisted.join(' ') || 'all'})`);
}
{ // o-wander2: the arrival framed close — the cart ≥ 8 % of the frame, the lead in it too (a pinhole at 70°, 16:9)
  const MI = V.MoveIn, door = [0, 64, 0], lead = [0, 64, 20], cart = [0, 64, 21.7];
  const P = MI.framePose(lead, door, {}, 1, cart), fov = 70 * Math.PI / 180, asp = 16 / 9, ty = Math.tan(fov / 2), tx = ty * asp;
  const proj = (q) => { const dx = q[0] - P.x, dy = q[1] - P.y, dz = q[2] - P.z; const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw); const x1 = dx * cy - dz * sy, z1 = dx * sy + dz * cy; const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch); const y2 = dy * cp + z1 * sp, z2 = -dy * sp + z1 * cp; const f = -z2; return [x1 / (f * tx), y2 / (f * ty), f]; };
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const ox of [-1, 1]) for (const oy of [0, 2]) for (const oz of [-1.37, 1.37]) { const q = proj([cart[0] + ox, cart[1] + oy, cart[2] + oz]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const area = (Math.min(1, x1) - Math.max(-1, x0)) * (Math.min(1, y1) - Math.max(-1, y0)) / 4, L = proj([lead[0], lead[1] + 1, lead[2]]);
  check(area >= 0.08 && Math.abs(L[0]) < 0.95 && Math.abs(L[1]) < 0.95 && L[2] > 0, `the move-in shot: the cart ${(area * 100).toFixed(1)} % of the frame (≥ 8 %), the lead in frame (${L[0].toFixed(2)}, ${L[1].toFixed(2)})`);
  const P0 = MI.framePose(lead, door, {}, 1);
  check(Math.hypot(P0.x - cart[0], P0.z - cart[2]) > Math.hypot(P.x - cart[0], P.z - cart[2]) + 3, 'closer than the wide shot without a cart');
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

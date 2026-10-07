// Physics and the player must survive bad numbers and keep their results: P.move / P.gather / P.raycast behave as
// before on ordinary input (a hashed walk over generated land, a staircase and a fence yard), a NaN or absurd velocity
// never moves a body into nowhere or freezes the frame, and a player whose position went bad (a /tp with letters, a
// corrupt save) stands on solid ground again instead of vanishing.
//   bash test/wt_run.sh phys_guard.js
const V = require('./load_shared.js');
require('../src/main/player.js');
const R = V.R, PH = V.PHYS;
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };
const fin = (a) => a.every(Number.isFinite);
// ---- a small world: generated land plus a yard of fences, stairs and a wall ----
const g = V.makeGen('overworld', 777, {});
const cols = new Map(); const key = (cx, cz) => cx * 65536 + cz;
for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) cols.set(key(cx, cz), g.generate(cx, cz).blocks);
const getState = (x, y, z) => { if (y < 0 || y >= 256) return 0; const c = cols.get(key(x >> 4, z >> 4)); return c ? c[(y << 8) | ((z & 15) << 4) | (x & 15)] : 0; };
const setState = (x, y, z, s) => { const c = cols.get(key(x >> 4, z >> 4)); if (c) c[(y << 8) | ((z & 15) << 4) | (x & 15)] = s; };
const topAt = (x, z) => { for (let y = 255; y > 0; y--) { const s = getState(x, y, z); if (s && (R.T.flags[s] & V.F.SOLID)) return y; } return 0; };
const nbFn = (x, y, z, d) => getState(x + V.HF_DX[d], y, z + V.HF_DZ[d]);
{ // the yard at the origin
  const y0 = topAt(4, 4) + 1, fence = R.byName.oak_fence, stairs = R.byName.oak_stairs, wall = R.byName.cobblestone_wall;
  for (let i = 0; i < 8; i++) { if (fence) setState(2 + i, y0, 2, fence.defaultState); if (wall) setState(2 + i, y0, 11, wall.defaultState); }
  if (stairs) for (let i = 0; i < 4; i++) setState(6, y0 + i, 5 + i, stairs.defaultState);
}
// ---- 1. the same results as before: a hashed walk ----
let h = 2166136261 >>> 0;
const mix = (v) => { h ^= (Math.round(v * 1000) & 0xffff); h = Math.imul(h, 16777619) >>> 0; };
let seed = 12345; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const pos = [4.5, topAt(4, 4) + 1, 4.5];
let hits = 0, steps = 0;
for (let i = 0; i < 1500; i++) {
  const vx = (rnd() - 0.5) * 0.6, vz = (rnd() - 0.5) * 0.6, vy = rnd() < 0.05 ? 0.45 : -0.3;
  const res = PH.move(getState, pos, 0.3, 1.8, vx, vy, vz, 0.6, nbFn, false);
  if (res.hitX || res.hitZ) hits++; if (res.stepped) steps++;
  mix(pos[0]); mix(pos[1]); mix(pos[2]); mix(res.hitX + res.hitY * 2 + res.hitZ * 4 + res.onGround * 8); mix(res.stepped);
  if (pos[1] < 1) pos[1] = topAt(Math.floor(pos[0]), Math.floor(pos[2])) + 1;
}
const ray = PH.raycast(getState, 4.5, topAt(4, 4) + 2.6, 4.5, 0.3, -0.5, 0.8, 8, { nb: nbFn });
if (ray) { mix(ray.dist); mix(ray.face); mix(ray.x); mix(ray.y); mix(ray.z); }
const hex = h.toString(16).padStart(8, '0');
const EXPECT = '5a8c71ea';
check(fin(pos), `1500 random moves: the body is still at a finite spot (${pos.map(v => v.toFixed(2)).join(', ')}), ${hits} wall hits, ${steps} steps up`);
check(hex === EXPECT, `the walk and a raycast give the v0.39 results (hash ${hex}, expected ${EXPECT})`);
// ---- 2. bad numbers in the physics ----
{
  const p = [4.5, topAt(4, 4) + 1, 4.5], before = p.slice();
  for (const v of [[NaN, 0, 0], [0, NaN, 0], [0, 0, Infinity], [NaN, NaN, NaN]]) {
    const r = PH.move(getState, p, 0.3, 1.8, v[0], v[1], v[2], 0.6, nbFn, false);
    check(fin(p) && Math.abs(p[0] - before[0]) < 1e-9 && Math.abs(p[2] - before[2]) < 1e-9 && r && typeof r.hitX === 'boolean', `P.move with velocity [${v.join(', ')}] leaves the body where it is`);
  }
  const t0 = Date.now();
  const p2 = [4.5, topAt(4, 4) + 1, 4.5];
  PH.move(getState, p2, 0.3, 1.8, 3000, -3000, 3000, 0.6, nbFn, false);
  const ms = Date.now() - t0;
  check(fin(p2) && ms < 200, `P.move with a 3000-block velocity (a frame of a 30 000 m/s fall) returns in ${ms} ms with a finite position`);
  check(PH.raycast(getState, 4.5, 70, 4.5, 0, 0, 0, 8) === null, 'P.raycast with a zero direction returns null');
  check(PH.raycast(getState, 4.5, 70, 4.5, NaN, 1, 0, 8) === null && PH.raycast(getState, NaN, 70, 4.5, 0, -1, 0, 8) === null, 'P.raycast with a NaN direction or origin returns null');
  const out = [];
  PH.gather(getState, NaN, 60, 0, NaN, 70, 3, out, nbFn);
  check(out.length === 0, 'P.gather over a NaN region collects nothing');
}
// ---- 3. the player ----
const T = R.T;
const world = { getBlock: getState, isLoaded: (x, z) => cols.has(key(x >> 4, z >> 4)), nbFn: () => nbFn, topAt, col: () => null };
const game = { world, ui: null, audio: null, starships: null, gadgets: null, zoom: false, difficulty: 'normal', worldSpawn: () => [4.5, topAt(4, 4) + 1, 4.5], statusSpeed: 0 };
const input = { sensitivity: 0.0024, invertY: false, captured: false, dragLook: false, mouse: { dx: 0, dy: 0, wheel: 0, down: [false, false, false], clicked: [false, false, false] }, hit: () => false, down: () => false, dbl: () => false };
const p = new V.Player(game);
p.mode = 'creative';
p.teleport(4.5, topAt(4, 4) + 1, 4.5); p.spawn = [4.5, topAt(4, 4) + 1, 4.5];
for (let i = 0; i < 120; i++) p.update(1 / 60, input);
const groundY = p.pos[1];
check(fin(p.pos) && p.onGround && Math.abs(groundY - (topAt(4, 4) + 1)) < 0.01, `the player stands on the ground after 2 s (y ${groundY.toFixed(2)})`);
p.teleport(NaN, NaN, NaN);
check(fin(p.pos) && Math.abs(p.pos[1] - groundY) < 0.01, 'teleport(NaN, NaN, NaN) is refused — the player stays where they were');
p.pos[0] = NaN; p.vel[1] = Infinity;
p.update(1 / 60, input);
check(fin(p.pos) && fin(p.vel) && Math.abs(p.pos[1] - groundY) < 0.5, `a position gone NaN mid-frame is restored to the last good one (${p.pos.map(v => v.toFixed(2)).join(', ')})`);
p.pos[0] = 4.5; p.pos[1] = groundY; p.pos[2] = 4.5;
p.update(1 / 60, input); p.update(1 / 60, input);
p.yaw = NaN; p.pitch = NaN;
p.update(1 / 60, input);
check(Number.isFinite(p.yaw) && Number.isFinite(p.pitch) && fin(p.pos), 'a NaN view angle is reset instead of hiding the whole world');
const q = new V.Player(game); q.mode = 'creative';
q.load({ pos: [null, 'x', undefined], yaw: NaN, health: NaN, food: 'much', inv: null, spawn: [NaN, 1, 2] });
check(fin(q.pos) && Number.isFinite(q.yaw) && q.health === 20 && q.food === 20 && fin(q.spawn), `a corrupt save loads with finite numbers (pos ${q.pos.map(v => (+v).toFixed(1)).join(', ')}, health ${q.health}, food ${q.food})`);
const r = new V.Player(game); r.mode = 'creative';
r.load({ pos: [8.2, 90.5, -3.1], yaw: 1.5, pitch: -0.2, health: 13, food: 9, sat: 2, inv: { slots: [{ id: 'stone', n: 3 }], sel: 2 } });
check(r.pos[0] === 8.2 && r.pos[1] === 90.5 && r.pos[2] === -3.1 && r.yaw === 1.5 && r.pitch === -0.2 && r.health === 13 && r.food === 9 && r.sat === 2 && r.inv.sel === 2 && r.inv.slots[0].id === 'stone', 'a good save loads exactly as before');
console.log(fail ? `FAIL ${fail}` : 'OK — physics and player guards');
process.exit(fail ? 1 : 0);

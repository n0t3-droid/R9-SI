// The windmills' sails turn (t-polish, docs/superpowers/plans/2026-10-08-t-polish.md §2; src/main/landlife.js,
// src/shared/gen_land.js):
//  · the angle curve (LandLife.millStep): continuous (no step larger than the top speed × dt — none at midnight's wrap of
//    the day's ticks either: the angle integrates real seconds), the steady speed proportional to the wind (wind 2 turns
//    twice as fast as wind 1), gusts add, under 0.1 the sails come to rest smoothly; Very Low holds them still; a stand-in
//    game: the mills absorbed from their spawn, turned in the env's wind, a mill among old sail blocks left alone;
//  · the model (life_sails, life_sails_far): four blades 9 m across, in front of the hub, the light one a few dozen faces;
//  · the generator: every mill of seeds 53 and 4242 (vgen 10) has its hub log and its `windmill` spawn and no sail block,
//    the space its sails sweep is free, and — the proof — its chunks are v0.46's (2c103e8) but for the sail cells, now air.
//   bash test/wt_run.sh polish_mill.js 600
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const SEEDS = [53, 4242];
// the chunks round each mill's hub (the sails reach 4 blocks to each side): name per cell, compared with the old generator
const millChunks = (V, seed) => {
  const g = new V.OverworldGen(seed, { worldType: 'default', vgen: 10 });
  const P = V.Land.plan(g), out = [];
  for (const m of P.pieces.filter(p => p.kind === 'windmill')) {
    const [hx, hy, hz] = m.hub, chunks = {};
    for (let cz = (hz - 5) >> 4; cz <= (hz + 5) >> 4; cz++) for (let cx = (hx - 5) >> 4; cx <= (hx + 5) >> 4; cx++) {
      const c = g.generate(cx, cz);
      chunks[cx + ',' + cz] = { blocks: Array.from(c.blocks), spawns: c.spawns || [] };
    }
    out.push({ hub: m.hub, chunks });
  }
  return out;
};
if (process.argv[2] === '--child') {
  // the old generator: the shared code of this checkout with v0.46's gen_land.js in its place (a copy in a temp dir)
  const V = require(process.argv[3]);
  const seed = +process.argv[4];
  fs.writeFileSync(process.argv[5], JSON.stringify(millChunks(V, seed)));   // (a file: a big stdout is cut off at exit)
  process.exit(0);
}

const V = require('./load_shared.js');
global.window = global.window || {};
// the game's side: voxmodels (the grid and its mesher), landlife (the actor, the sails' models)
for (const f of ['voxmodels', 'landlife']) require(path.join(ROOT, 'src/main', f + '.js'));
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const LL = V.LandLife, TAU = Math.PI * 2;
check(!!LL && !!LL.millStep && !!LL.millSpeed, 'the land life has the sails\' turning (LandLife.millStep, millSpeed)');

// ---------------------------------------------------------------- the angle curve
const wrapD = (a, b) => { let d = (b - a) % TAU; if (d < 0) d += TAU; return d; };   // the angle turned from a to b
{
  const M = LL.MILL, dt = 1 / 30;
  // a day of weather in fast motion: calm, a breeze, gusts, a storm, calm again — the angle never jumps
  const windAt = (t) => (t < 20 ? 0.05 : t < 60 ? 1 : t < 100 ? 1 + 0.4 * Math.sin(t) : t < 140 ? 3 : t < 170 ? 0.7 : 0.05);
  const gustAt = (t) => (t > 60 && t < 100 && Math.sin(t * 0.7) > 0.6 ? Math.sin(t * 0.7) : 0);
  const m = { ang: 0, w: 0 };
  let worst = 0, prev = m.ang, prevW = 0, wJump = 0;
  for (let t = 0; t < 220; t += dt) {
    LL.millStep(m, windAt(t), gustAt(t), dt, false);
    worst = Math.max(worst, wrapD(prev, m.ang) / (M.MAX * dt));
    wJump = Math.max(wJump, Math.abs(m.w - prevW));
    prev = m.ang; prevW = m.w;
  }
  check(worst <= 1.0001 && wJump < M.MAX * dt / M.TAU * 1.01, `continuous: no step beyond the top speed × dt (worst ${worst.toFixed(3)} of it), the speed itself without a jump (${wJump.toFixed(4)} rad/s a frame at most)`);
  // steady speeds: wind 1, wind 2, a gust, calm
  const steady = (wind, gust) => { const q = { ang: 0, w: 0 }; for (let i = 0; i < 30 * 40; i++) LL.millStep(q, wind, gust, dt, false); const a0 = q.ang; let turned = 0, p = a0; for (let i = 0; i < 30 * 10; i++) { LL.millStep(q, wind, gust, dt, false); turned += wrapD(p, q.ang); p = q.ang; } return turned / 10; };
  const s1 = steady(1, 0), s2 = steady(2, 0), sg = steady(1, 1), s0 = steady(0.08, 0), sh = steady(0.5, 0);
  check(Math.abs(s2 / s1 - 2) < 0.01 && Math.abs(sh / s1 - 0.5) < 0.01, `proportional to the wind: ${s1.toFixed(3)} rad/s at wind 1 (${(s1 * 60 / TAU).toFixed(1)} turns a minute), ${s2.toFixed(3)} at 2 (×${(s2 / s1).toFixed(3)}), ${sh.toFixed(3)} at 0.5`);
  check(sg > s1 * 1.4 && sg < s1 * 1.5, `a gust adds (${sg.toFixed(3)} rad/s in a full gust at wind 1)`);
  check(s0 < 1e-4 && LL.millSpeed(0.099, 1) === 0 && LL.millSpeed(0.1, 0) > 0, `under a wind of 0.1 the sails stand (${s0.toExponential(1)} rad/s at 0.08)`);
  // the wind drops: the sails slow down over seconds, not at once
  const q = { ang: 0, w: 0 }; for (let i = 0; i < 30 * 30; i++) LL.millStep(q, 1, 0, dt, false);
  const w0 = q.w; for (let i = 0; i < 30; i++) LL.millStep(q, 0, 0, dt, false);
  const w1 = q.w; for (let i = 0; i < 30 * 30; i++) LL.millStep(q, 0, 0, dt, false);
  check(w1 > w0 * 0.6 && w1 < w0 * 0.75 && q.w < w0 * 1e-4, `calm: a second after the wind dies they still turn at ${(w1 / w0 * 100).toFixed(0)} %, after 31 s ${(q.w / w0 * 100).toFixed(3)} %`);
  // Very Low: they stand still
  const v = { ang: 1.234, w: 0.9 }; for (let i = 0; i < 300; i++) LL.millStep(v, 2, 1, dt, true);
  check(v.ang === 1.234 && v.w === 0, 'Very Low: the sails stand still (the angle held, no speed)');
}

// ---------------------------------------------------------------- the actor in a stand-in game: across midnight
{
  const R = V.R, st = (n) => R.byName[n].defaultState, LOG = st('oak_log'), SAIL = st('vx_windmill_sail');
  // two mills: A at (10, 90, 10) facing north, B at (40, 90, 10) facing east with old sail blocks round its hub
  const blocks = new Map([[`10,90,10`, LOG], [`40,90,10`, LOG], [`40,90,9`, SAIL], [`40,90,11`, SAIL], [`40,91,10`, SAIL]]);
  const env = { timeOfDay: 23000, E: { wind: 1, gust: 0 } };
  const g = { settings: { preset: 'high' }, player: { pos: [20, 90, 20] }, env, world: { isLoaded: () => true, getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) || 0 } };
  const L = new LL(g, { mobs: [], summon: () => null });
  global.VR = global.VR || V; V.Land = V.Land || {};
  L.absorb([['windmill', 10, 90, 10, 0], ['windmill', 40, 90, 10, 1]]);
  const dt = 1 / 30;
  let worst = 0, prev = null, ticksSeen = [];
  for (let i = 0; i < 30 * 120; i++) {
    env.timeOfDay = (23000 + i * 20 * dt * 10) % 24000;   // (ten times the day's pace: midnight comes after 50 s)
    if (i % 600 === 0) ticksSeen.push(Math.round(env.timeOfDay));
    L.update(dt);
    const A = L.mills.get('mill:10,90,10');
    if (A.state === 1) { if (prev !== null) worst = Math.max(worst, wrapD(prev, A.ang) / (LL.MILL.MAX * dt)); prev = A.ang; }
  }
  const A = L.mills.get('mill:10,90,10'), B = L.mills.get('mill:40,90,10');
  check(A.state === 1 && B.state === 2, `the mills absorbed from their spawns: A turns (state ${A.state}), B keeps its old sail blocks and gets no model (state ${B.state})`);
  check(worst <= 1.0001 && A.w > 0.8 && B.ang === 0, `through midnight (the day's clock ${ticksSeen.join(' → ')}): A's angle without a jump (worst ${worst.toFixed(3)} of the top step), turning at ${A.w.toFixed(2)} rad/s; B untouched`);
  g.settings.preset = 'potato'; const a0 = A.ang; for (let i = 0; i < 90; i++) L.update(dt);
  check(A.ang === a0, 'Very Low chosen: the sails stop where they are');
  blocks.delete('10,90,10'); L.millCheck();
  check(A.state === 3, 'the hub broken: no sails in the air');
}

// ---------------------------------------------------------------- the model
{
  const M = V.VOXMODELS, mesh = V.meshVoxGrid;
  const fine = M.life_sails(), far = M.life_sails_far();
  const tri = (d) => mesh(d.parts.body.grid).count / 3;
  const tf = tri(fine), tr = tri(far);
  // extent and placement (model units, 1/8 m): the blades' tips 4.3–4.5 m from the axle, every voxel in front of the hub
  const G = fine.parts.body.grid; let rmax = 0, zmax = -1e9, n = 0, rot = 0;
  for (let y = 0; y < G.sy; y++) for (let z = 0; z < G.sz; z++) for (let x = 0; x < G.sx; x++) {
    if (!G.get(x, y, z)) continue; n++;
    const cx = x + 0.5 - G.ox, cy = y + 0.5 - G.oy; rmax = Math.max(rmax, Math.hypot(cx, cy)); zmax = Math.max(zmax, z + 1 - G.oz);
    // a quarter turn about the axle finds the same voxel (four blades alike)
    const rx = Math.round(-cy - 0.5 + G.ox), ry = Math.round(cx - 0.5 + G.oy);
    if (G.get(rx, ry, z)) rot++;
  }
  check(rmax / 8 > 4.3 && rmax / 8 < 4.6 && zmax / 8 <= -0.5 + 1e-9, `the sails 9 m across (the tips ${(rmax / 8).toFixed(2)} m from the axle), all in front of the hub log's face (${(zmax / 8).toFixed(2)} m)`);
  check(rot === n, `four blades alike (a quarter turn maps ${rot} of ${n} voxels onto the model)`);
  // what the 16 sail blocks of t-land cost in a chunk (the mesher: their VX detail near, their far boxes beyond)
  const R = V.R, PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS, SAIL = R.byName.vx_windmill_sail.defaultState;
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000), z0 = new Uint16Array(PSS);
  const put = (x, y, z) => { blocks[(y + PAD) * PSS + (z + PAD) * PS + (x + PAD)] = SAIL; };
  for (let k = 1; k <= 4; k++) { put(8 - k, 8, 8); put(8 + k, 8, 8); put(8, 8 + k, 8); put(8, 8 - k, 8); }
  const ms = V.meshSection({ blocks, light, grass: z0, foliage: z0, water: z0, sy: 5, ox: 0, oz: 0, smooth: true, fancyLeaves: false, vxLod: true });
  const tq = (a) => (a ? a.length / 8 / 2 : 0), oldNear = tq(ms.opaque) + tq(ms.cutout) + tq(ms.vx), oldFar = tq(ms.opaque) + tq(ms.cutout) + tq(ms.vxFar);
  check(tf < 1200 && tr < 300 && tr < tf / 2.5 && tr <= oldFar * 1.6, `the fine model ${tf} triangles, the light one ${tr} (Very Low's, and everyone's beyond 48 blocks) — the 16 sail blocks were ${oldNear} near and ${oldFar} as far boxes, in the chunk's mesh`);
}

// ---------------------------------------------------------------- the generator: hubs, spawns, no sail blocks, a free sweep
const nameOf = (s) => (s ? V.R.types[V.R.T.type[s]].name : 'air');
const DIR4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const now = {};
for (const seed of SEEDS) {
  now[seed] = millChunks(V, seed);
  const g = new V.OverworldGen(seed, { worldType: 'default', vgen: 10 });
  const at = (x, y, z) => { const c = now[seed].flatMap(m => [m.chunks[(x >> 4) + ',' + (z >> 4)]]).find(Boolean) || { blocks: g.generate(x >> 4, z >> 4).blocks }; return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; };
  let ok = 0, sails = 0, blocked = 0;
  const notes = [];
  for (const m of now[seed]) {
    const [hx, hy, hz] = m.hub, ch = m.chunks[(hx >> 4) + ',' + (hz >> 4)];
    const sp = ch.spawns.find(s => s[0] === 'windmill' && s[1] === hx && s[2] === hy && s[3] === hz);
    const f = sp ? sp[4] & 3 : 0, d = DIR4[f], ax = -d[1], az = d[0];
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) if (nameOf(at(hx + dx, hy + dy, hz + dz)) === 'vx_windmill_sail') sails++;
    // the slab the sails sweep (one block out from the hub): the disc of 4.6 round the axle free of solid blocks
    let bl = 0;
    for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) {
      if (Math.hypot(a, b) > 4.6) continue;
      const s = at(hx + d[0] + ax * a, hy + b, hz + d[1] + az * a);
      if (s && (V.R.T.flags[s] & V.F.SOLID)) bl++;
    }
    blocked += bl;
    const log = /_log$/.test(nameOf(at(hx, hy, hz))), wall = (V.R.T.flags[at(hx - d[0], hy, hz - d[1])] & V.F.SOLID) !== 0, open = !(V.R.T.flags[at(hx + d[0], hy, hz + d[1])] & V.F.SOLID);
    if (log && sp && wall && open && !bl) ok++;
    notes.push(`(${hx}, ${hy}, ${hz}) facing ${f}: hub ${log ? 'log' : nameOf(at(hx, hy, hz))}, spawn ${sp ? 'yes' : 'no'}, the tower behind ${wall}, open in front ${open}, ${bl} solid in the sweep`);
  }
  check(now[seed].length >= 2 && ok === now[seed].length && sails === 0, `seed ${seed}: ${now[seed].length} mills — hub, spawn, tower behind, the sweep free, no sail block (${sails}): ${notes.join('; ')}`);
}

// ---------------------------------------------------------------- the proof: the chunks are v0.46's but for the sails
{
  let tmp = null, oldSrc = null;
  try { oldSrc = execFileSync('git', ['-C', ROOT, 'show', '2c103e8:src/shared/gen_land.js'], { maxBuffer: 1 << 24 }).toString(); } catch (e) { /* no git, or the commit is missing */ }
  if (!oldSrc) console.log('  · the proof against v0.46 skipped: its gen_land.js is not in this checkout\'s history');
  else {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'polish_mill-'));
    fs.mkdirSync(path.join(tmp, 'src/shared'), { recursive: true }); fs.mkdirSync(path.join(tmp, 'test'));
    for (const f of fs.readdirSync(path.join(ROOT, 'src/shared'))) fs.copyFileSync(path.join(ROOT, 'src/shared', f), path.join(tmp, 'src/shared', f));
    fs.writeFileSync(path.join(tmp, 'src/shared/gen_land.js'), oldSrc);
    fs.copyFileSync(path.join(ROOT, 'test/load_shared.js'), path.join(tmp, 'test/load_shared.js'));
    for (const seed of SEEDS) {
      const outF = path.join(tmp, 'mills_' + seed + '.json');
      execFileSync(process.execPath, [__filename, '--child', path.join(tmp, 'test/load_shared.js'), String(seed), outF], { stdio: ['ignore', 'ignore', 'inherit'] });
      const old = JSON.parse(fs.readFileSync(outF, 'utf8'));
      let diff = 0, sailToAir = 0, other = 0, spawnsSame = true, oldSails = 0;
      for (let i = 0; i < old.length; i++) for (const k of Object.keys(old[i].chunks)) {
        const A = old[i].chunks[k].blocks, B = now[seed][i].chunks[k].blocks;
        for (let j = 0; j < A.length; j++) { if (nameOf(A[j]) === 'vx_windmill_sail') oldSails++; if (A[j] === B[j]) continue; diff++; if (nameOf(A[j]) === 'vx_windmill_sail' && !B[j]) sailToAir++; else other++; }
        if (JSON.stringify(old[i].chunks[k].spawns) !== JSON.stringify(now[seed][i].chunks[k].spawns)) spawnsSame = false;
      }
      check(other === 0 && sailToAir === diff && sailToAir === oldSails && oldSails >= 28 && spawnsSame, `seed ${seed}: the mills' chunks are v0.46's (2c103e8) but for the sail blocks — ${diff} cells differ, ${sailToAir} of them v0.46's sails now air (of ${oldSails}), ${other} others; the spawns ${spawnsSame ? 'the same' : 'differ'}`);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

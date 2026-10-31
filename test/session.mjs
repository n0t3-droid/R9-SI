// regress: skip — „nie langweilig", played: the scripted sessions of erlebnis §7 (plan docs/superpowers/plans/2026-10-22-e-log.md §2.6). One browser run a wave.
// Two 5-minute sessions in a new default world (seed 4242, the Heartland, vgen 11), Creative · Friedlich, Balanced at 480 × 270 (f-flow: SIZE), de-DE, the weather held clear:
//   builder — look round on the Hangar Hall's deck (the spawn) → out of the portal, over the Gate Plaza, the ways east to the river meadow → the Bauhand: a
//             Bungalow (the bench when no ghost fits) → watch the Baustelle rise → walk on: the farm way north, the stone bridge over the river, on;
//   walk    — the Gate Plaza → the way east and north to Nova Haven (day 0 is its festival evening) → its ring road to the city's plaza (a look round) → the
//             radial road, the east branch, the southern arc, the west branch, the plaza again, the ring west, the way back toward the temple.
// The simulation at the game's full rate (every frame of 1/30 s simulated, none drawn) and a picture every 2 s drawn and captured in the page (the canvas →
// 480 × 270 JPEG; no page.screenshot — it timed out at 150 s on this machine in other runs). f-flow (R50-03; plan docs/superpowers/plans/2026-10-23-f-flow.md
// §2.1): the pictures were the cost — Chromium's WebGL finish() is a flush, the read-back waits for SwiftShader: ~10 s a picture at 960 × 540 under a load of
// 11–16, 600 a session at 2 Hz; now the canvas is the picture's size (SIZE=480x270, Balanced's own scale and TSR) and a picture comes every PIC_EVERY = 2 s
// (150 a session), each one's real cost logged. The world streams ahead of the walker: before every half
// second of play the columns within 64 m must be loaded and the sections within 32 m meshed (the clock waits, the workers do not). The walker is a
// pure-pursuit steer on the real player physics (W held, auto-jump, a jump when stuck, a 4-m hop along the way after 5 s stuck: counted). Parts whose
// feature does not exist yet are skipped and logged (travel by intent VR.Intent and Funke VR.Funke: wave 4), and their minutes leave the targets.
// → test/shots/session_<type>.json (the log, the samples, the parts, the metrics and the verdict against E§7's targets, the three longest gaps described,
//   the run's own numbers), session_<type>_sheet.png (12 frames — one per 25-s slot, at its heaviest event in view or its middle — each labelled; the
//   timeline with every event, the inputs, the movers, landmarks and sky, the gaps; the verdict in the header), session_<type>_01…12.jpg and _gap.jpg;
//   then the log's own cost per frame on Very Low and High: on · the sampler off · off.
// Checks: a Heartland world of vgen ≥ 11; each session ≥ 290 s of play with ~1 sample a second and its events; the JSON and the sheet written; the log
// ≤ 0.05 ms a frame; no page error.
//   nohup bash test/wt_run.sh session.mjs 5400 > .tmp_tests/session.log 2>&1 &
//   ONLY=builder|walk|pilot|adventurer (pilot and adventurer only when asked: e-ctx's trips by intent; a-story's Abenteuer with the story) · DUR=300 · SEED=4242 · NO_BENCH=1 · ALL=1 (every picture too) · DRY=1 (node only: the routes, the walker and the Bauhand on a
//   stand-in, a synthetic sheet in the scratch folder) · SHEET_ONLY=builder|walk (rebuild a sheet from its JSON and frames) · f-flow: SIZE=480x270 (the
//   canvas; 960x540 the old pictures) · PIC_EVERY=2 (s between pictures) · REAL_BUDGET=5400 (s a session) — in the release lane:
//   R9_EXCLUSIVE=1 nohup bash test/wt_run.sh session.mjs 12000 > .tmp_tests/session.log 2>&1 &
//   After each session its pictures go through test/trail_lines.js (the contrails' straight constant-width segments, R50-04) and the checks add f-flow's
//   measures: the most repeated event ≤ 40 % of all, spam ≤ 2 / 10 min, ≥ 6 kinds seen.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHOTS = ROOT + 'test/shots/';
const DIST = process.env.DIST || new URL('../dist/index.html', import.meta.url).href;
const SIZE = (process.env.SIZE || '480x270').split('x').map(Number);   // (f-flow: the canvas — the picture's size)
const SEED = +(process.env.SEED || 4242), DUR = +(process.env.DUR || 300), VW = SIZE[0] || 480, VH = SIZE[1] || 270, PW = 480, PH = 270, SLOTS = 12;
const PIC_EVERY = Math.max(0.5, +(process.env.PIC_EVERY || 2));   // (f-flow: seconds of play between two pictures)
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DRY = !!process.env.DRY, SHEET_ONLY = process.env.SHEET_ONLY || '';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const SS = require(ROOT + 'src/shared/sessionstats.js');
fs.mkdirSync(SHOTS, { recursive: true });

// ============================================================================ the routes (node: the same land plan as the page's workers)
function planRoutes() {
  const V = require(ROOT + 'test/load_shared.js');
  const gen = V.makeGen('overworld', SEED, { vgen: 11 }), LP = V.Land.plan(gen);
  const idOf = (id) => LP.sites.findIndex(s => s.id === id);
  // the way between two sites (the longest of them when the network has two), from a to b, as [x, z]
  const way = (a, b) => {
    const ia = idOf(a), ib = idOf(b); let best = null;
    for (const l of LP.lines) if ((l.a === ia && l.b === ib) || (l.a === ib && l.b === ia)) if (!best || l.pts.length > best.pts.length) best = l;
    if (!best) throw new Error(`no way ${a} → ${b}`);
    const pts = best.pts.map(p => [p[0], p[1]]);
    return best.a === ia ? pts : pts.reverse();
  };
  const near = (pts, q) => { let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
  const upTo = (pts, q) => pts.slice(0, near(pts, q) + 1);
  const from = (pts, q) => pts.slice(near(pts, q));
  const span = (pts, a, b) => { const i = near(pts, a), j = near(pts, b); return i <= j ? pts.slice(i, j + 1) : pts.slice(j, i + 1).reverse(); };
  const join = (...parts) => { const out = []; for (const part of parts) for (const p of part) { const l = out[out.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.5) out.push([+p[0], +p[1]]); } return out; };
  const len = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
  // Nova Haven's roads (its village plan): found by a point each passes near
  const VG = V.VillageGen, city = VG.plan(gen, VG.nearest(gen, 0, -140, 1400));
  const roads = city.roads.map(r => r.map(q => [q[0], q.length > 2 ? q[2] : q[1]]));
  const roadNear = (q) => { let best = null, bd = Infinity; for (const r of roads) { const d = Math.min(...r.map(p => Math.hypot(p[0] - q[0], p[1] - q[1]))); if (d < bd) { bd = d; best = r; } } return best; };
  const ring = roadNear([60, -73]), radial = roadNear([2, -80]), east = roadNear([20, -131]), west = roadNear([-20, -131]), arc = roadNear([-30, -156]);
  const plaza = city.plaza ? [city.plaza.x + 0.5, city.plaza.z + 0.5] : [-0.5, -54.5];
  // the river meadow: the flattest open grass near (272, −40), between farm_c and the river (no tree, no path, no field on a 17 × 17 lot)
  const RT = V.R.T, FL = V.F, CH = new Map();
  const blk = (x, y, z) => { const X = Math.floor(x), Z = Math.floor(z), k = (X >> 4) + ',' + (Z >> 4); let c = CH.get(k); if (!c) { c = gen.generate(X >> 4, Z >> 4); CH.set(k, c); } return y < 0 || y > 255 ? 0 : c.blocks[(y << 8) | ((Z & 15) << 4) | (X & 15)]; };
  const nm = (s) => (s ? V.R.types[RT.type[s]].name : 'air');
  const colAt = (x, z) => { for (let y = 140; y > 50; y--) { const b = blk(x, y, z); if (!b || (RT.flags[b] & (FL.REPLACE | FL.PLANT))) continue; return { y, n: nm(b), leaves: !!(RT.flags[b] & FL.LEAVES) }; } return null; };
  const OPEN = /^(grass_block|dirt|coarse_dirt|podzol|moss_block)$/;
  let M = null;
  for (let x = 244; x <= 300; x += 4) for (let z = -72; z <= -12; z += 4) {
    const c0 = colAt(x, z); if (!c0 || !OPEN.test(c0.n)) continue;
    let ok = true, lo = 999, hi = -999;
    for (let dz = -8; dz <= 8 && ok; dz++) for (let dx = -8; dx <= 8; dx++) { const c = colAt(x + dx, z + dz); if (!c || c.leaves || !OPEN.test(c.n)) { ok = false; break; } lo = Math.min(lo, c.y); hi = Math.max(hi, c.y); }
    if (!ok || hi - lo > 2) continue;
    const score = Math.hypot(x - 272, z + 40) + (hi - lo) * 6;
    if (!M || score < M.score) M = { x: x + 0.5, z: z + 0.5, y: c0.y + 1, score: +score.toFixed(1), flat: hi - lo, top: c0.n };
  }
  if (!M) { const c = colAt(272, -40); M = { x: 272.5, z: -39.5, y: c ? c.y + 1 : 81, score: -1, flat: -1, top: c ? c.n : '?' }; }
  const STAND = [M.x - 11, M.z];
  const l11 = way('temple_e', 'city_e'), l13 = way('temple_e', 'farm_c');
  // farm_c → cross_e: the network has a short spur (out of the farm's yard) and the way north (the longer one)
  const fc = LP.lines.filter(l => (LP.sites[l.a].id === 'farm_c' && LP.sites[l.b].id === 'cross_e') || (LP.sites[l.a].id === 'cross_e' && LP.sites[l.b].id === 'farm_c')).map(l => (LP.sites[l.a].id === 'farm_c' ? l.pts : l.pts.slice().reverse()).map(p => [p[0], p[1]])).sort((a, b) => a.length - b.length);
  const farmShort = fc.length > 1 ? fc[0] : [], l3 = fc[fc.length - 1];
  const l23 = way('cross_e', 'meadow_e'), l7 = way('meadow_e', 'farm_e'), l17 = way('temple_w', 'city_w');
  const GATE = [[0.5, 4.5], [0.5, 20], [0.5, 40], [0.5, 58], [30, 66], [59, 74]];
  const builderA = join(GATE, upTo(l11, l13[0]), l13, [[230, -43], STAND]);
  const builderB = join([STAND, [230, -43]], farmShort, from(l3, farmShort.length ? farmShort[farmShort.length - 1] : [200, -56]), l23, l7);
  const walkA = join([[10.5, 60.5], [30, 66], [59, 74]], l11, span(ring, [112, -97], [1, -65]), [plaza]);
  const walkB = join([plaza], span(radial, [0, -59], [0, -101]), span(east, [0, -101], [13, -158]), span(arc, [9, -155], [-15, -155]), span(west, [-16, -153], [0, -101]), span(radial, [0, -101], [0, -59]), [plaza], span(ring, [1, -65], [-112, -97]), l17.slice().reverse());
  // a-regie (R52-06): the adventurer follows Funke's call — out of the Hangar Hall over the Gate Plaza, then straight
  // toward the nearest disturbed outpost (the generator's own, as the worker's /locate finds it), stopping 70 m short
  // (outside its guardians' 76 m: the lost stray on the way is the encounter, not a fight at the pad)
  const OP = gen.nearestOutpost ? gen.nearestOutpost(0.5, 58) : null;
  let advA = null;
  if (OP) { const a = [-80, 60], dx = OP.x - a[0], dz = OP.z - a[1], d = Math.hypot(dx, dz), L = Math.max(0, d - 70), pts = []; for (let k = 0; k <= L; k += 20) pts.push([a[0] + dx / d * k, a[1] + dz / d * k]); advA = join(GATE.slice(0, 4), [[-40, 59]], pts); }   // (west along the plaza first: the line from the plaza itself crosses the Gate Temple's halls)
  return { M, STAND, builderA, builderB, walkA, walkB, advA, outpost: OP && { x: OP.x, y: OP.y, z: OP.z }, len, plaza, landmarks: V.Vista && V.Vista.landmarks ? V.Vista.landmarks(gen, LP).filter(q => q.great).map(q => ({ id: q.id, x: q.x, z: q.z, base: q.base, top: q.top, r: q.r })) : [] };
}

// ============================================================================ in the page: the walker, the Bauhand, the frames, the pictures
// (a function the page runs as it is; DRY runs it in node on a stand-in — it must not reach outside its arguments)
function pageHelpers(win, VRx) {
  const VR = VRx || win.VR;
  const S = win.__S = { mode: { kind: 'idle' }, done: false, t: 0, pics: [], stat: { hops: 0, jumps: 0 }, log: [], R: null, st: null, B: null };
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const release = (I) => { if (I && I.keys) { I.keys.delete('KeyW'); I.keys.delete('Space'); } };
  const turnTo = (p, x, z, dt, rate) => { const d = wrap(Math.atan2(-(x - p.pos[0]), -(z - p.pos[2])) - p.yaw); p.yaw += Math.max(-rate * dt, Math.min(rate * dt, d)); return Math.abs(d); };
  S.route = function (pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, L: cum[cum.length - 1] || 0, s: 0, seg: 0 }; };
  S.pointAt = function (R, s) {
    const n = R.pts.length; if (n < 2) return R.pts[0] ? R.pts[0].slice() : [0, 0];
    s = Math.max(0, Math.min(R.L, s));
    let i = Math.max(0, Math.min(n - 2, R.seg));
    while (i > 0 && R.cum[i] > s) i--;
    while (i < n - 2 && R.cum[i + 1] < s) i++;
    const a = R.pts[i], b = R.pts[i + 1], l = (R.cum[i + 1] - R.cum[i]) || 1, u = (s - R.cum[i]) / l;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  };
  // how far along the route the player is: the nearest point on the segments round the last one (never backwards)
  S.progress = function (R, x, z) {
    const n = R.pts.length; if (n < 2) return R.L;
    let bs = R.s, bd = Infinity, bi = R.seg;
    for (let i = Math.max(0, R.seg - 2); i <= Math.min(n - 2, R.seg + 40); i++) {
      const a = R.pts[i], b = R.pts[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1e-9;
      const u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / l2)), px = a[0] + ex * u, pz = a[1] + ez * u, d = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (d < bd) { bd = d; bs = R.cum[i] + Math.sqrt(l2) * u; bi = i; }
    }
    if (bs > R.s) { R.s = bs; R.seg = bi; }
    return R.s;
  };
  // the stand height at (x, z) near y0: a solid block with two free above it (null: not loaded or none)
  // a-regie (R52-13): sky — only a stand under the open sky (no solid within 14 blocks above: never inside a house)
  S.groundY = function (x, z, y0, sky) {
    const g = VR.game, w = g.world, T = VR.R.T, F = VR.F, X = Math.floor(x), Z = Math.floor(z);
    const solid = (b) => !!(b && (T.flags[b] & F.SOLID) && !(T.flags[b] & F.REPLACE));
    for (let y = Math.floor(y0) + 8; y > y0 - 24; y--) if (solid(w.getBlock(X, y, Z)) && !solid(w.getBlock(X, y + 1, Z)) && !solid(w.getBlock(X, y + 2, Z))) {
      if (sky) { let open = true; for (let k = 3; k < 16 && open; k++) if (solid(w.getBlock(X, y + k, Z))) open = false; if (!open) continue; }
      return y + 1;
    }
    return null;
  };
  S.solidAt = function (x, y, z) { const g = VR.game, T = VR.R.T, F = VR.F, b = g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !!(b && (T.flags[b] & F.SOLID) && !(T.flags[b] & F.REPLACE)); };
  // a-regie (R52-13): a wall ahead (two blocks high at 1.3 m: no auto-jump takes it) → the first free heading of ±0.6, ±1.2 rad
  S.dodge = function (p) {
    const y = p.pos[1], wallAt = (a, d) => { const x = p.pos[0] - Math.sin(a) * d, z = p.pos[2] - Math.cos(a) * d; return S.solidAt(x, y + 0.5, z) && S.solidAt(x, y + 1.5, z); };
    if (!wallAt(p.yaw, 1.3)) return 0;
    for (const da of [0.6, -0.6, 1.2, -1.2]) if (!wallAt(p.yaw + da, 1.3) && !wallAt(p.yaw + da, 2.6)) return da;
    return 0;
  };
  // a-regie (R52-13): how much of the view a solid holds within 1.5 m of the eye (a 7 × 4 ray grid) — a frame from inside
  // a box or against a wall
  S.occ = function () {
    const g = VR.game, c = g.cam; if (!c || !g.world) return 0;
    const yaw = c.yaw, pit = c.pitch || 0, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit), tv = Math.tan((c.fov || 1.2) / 2), th = tv * (g.renderer && g.renderer.W ? g.renderer.W / g.renderer.H : 16 / 9);
    let hit = 0, n = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 7; i++) {
      const u = (i / 6) * 2 - 1, v = (j / 3) * 2 - 1;
      let dx = -sy * cp + cy * u * th + sy * sp * v * tv, dy = sp + cp * v * tv, dz = -cy * cp - sy * u * th + cy * sp * v * tv; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l; n++;
      for (let t = 0.25; t <= 1.5; t += 0.25) if (S.solidAt(c.x + dx * t, c.y + dy * t, c.z + dz * t)) { hit++; break; }
    }
    return hit / n;
  };
  S.set = function (mode) {
    S.mode = mode || { kind: 'idle' }; S.done = false; S.t = 0;
    const g = VR.game; if (g && g.input) release(g.input);
    if (S.mode.kind === 'walk' && !S.mode.route) { S.mode.route = S.wayTo(S.mode); S.log.push(['way', S.mode.toSite ? 'site' : 'village', S.mode.route.length, S.mode.route[S.mode.route.length - 1].map(Math.round)]); }   // a-session: the way from where the player stands
    if (S.mode.kind === 'walk') { S.R = S.route(S.mode.route); S.st = { s0: 0, t0: 0, jumpT: 0, lastJump: -9 }; }
    if (S.mode.kind === 'outpost') S.ad = null;
    if (S.mode.kind === 'bauhand') S.B = { phase: 'start', ding: S.mode.ding, name: S.mode.name, tries: 0, t: 0, dy: 0, whys: [], plan: null, site: null, sitePhase: '', fallback: false, target: S.mode.target, watchDone: 0 };
    return true;
  };
  function walk(g, p, I, dt) {
    const R = S.R, st = S.st;
    if ((g.wow && g.wow.active) || (VR.StoryPlay && VR.StoryPlay.holds && VR.StoryPlay.holds(g))) { release(I); st.t0 = S.t; return; }   // a wow moment (a-regie: a story scene) holds the view: the player stands
    const s = S.progress(R, p.pos[0], p.pos[2]);
    if (s >= R.L - 1.2) { release(I); S.done = true; return; }
    const tg = S.pointAt(R, s + 3.5);
    let off = turnTo(p, tg[0], tg[1], dt, 3.2);
    const dg = off < 0.6 ? S.dodge(p) : 0; if (dg) { p.yaw += Math.max(-3.2 * dt, Math.min(3.2 * dt, dg)); st.dodges = (st.dodges | 0) + 1; }   // a-regie: round a wall, not into it (only while it heads along the route)
    p.pitch += (-0.06 - p.pitch) * Math.min(1, dt * 3);
    if (off > 1.1) I.keys.delete('KeyW'); else I.keys.add('KeyW');
    if (s > st.s0 + 0.5) { st.s0 = s; st.t0 = S.t; }
    const still = S.t - st.t0;
    if (st.jumpT > 0) { st.jumpT -= dt; if (st.jumpT <= 0) I.keys.delete('Space'); }
    else if (still > 1.5 && S.t - st.lastJump > 1.2) { I.keys.add('Space'); st.jumpT = 0.25; st.lastJump = S.t; S.stat.jumps++; }
    if (still > 5) {
      let q = S.pointAt(R, s + 4), gy = S.groundY(q[0], q[1], p.pos[1], true);   // a-regie: a hop lands under the open sky
      for (let k = 8; gy === null && k <= 24; k += 4) { q = S.pointAt(R, s + k); gy = S.groundY(q[0], q[1], p.pos[1], true); }
      if (gy === null) { q = S.pointAt(R, s + 4); gy = S.groundY(q[0], q[1], p.pos[1]); }   // (a route inside a hall: its floor)
      if (gy !== null) { p.pos[0] = q[0]; p.pos[1] = gy; p.pos[2] = q[1]; if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; } S.stat.hops++; S.log.push(['hop', +(+g.time).toFixed(1), Math.round(q[0]), Math.round(q[1])]); R.s = Math.min(R.L, s + 4); }
      st.s0 = R.s; st.t0 = S.t;
    }
  }
  function bauhand(g, p, I, dt) {
    release(I);
    const B = S.B, BH = VR.Bauhand, tg = B.target; B.t += dt;
    if (!BH) { B.whys.push('no VR.Bauhand'); B.phase = 'failed'; S.done = true; return; }
    const aim = () => { const want = Math.atan2(-(tg[0] - p.pos[0]), -(tg[2] - p.pos[2])) + B.dy, d = wrap(want - p.yaw); p.yaw += Math.max(-3 * dt, Math.min(3 * dt, d)); const eye = p.pos[1] + 1.62, dist = Math.hypot(tg[0] - p.pos[0], tg[2] - p.pos[2]), pt = -Math.atan2(eye - (tg[1] + 0.2), Math.max(4, dist)); p.pitch += (pt - p.pitch) * Math.min(1, dt * 4); };
    switch (B.phase) {
      case 'start': try { BH.hold(B.ding, { name: B.name }); B.phase = 'aim'; B.t = 0; } catch (e) { B.whys.push('hold ' + B.ding + ': ' + (e && e.message)); B.phase = 'retry'; } break;
      case 'aim': {
        aim(); if (B.t < 1) break;
        const gh = BH.ghost;
        if (gh && gh.prep && B.t < 9) break;                              // (the plan is still being prepared)
        if (gh && gh.ok) { let pl = null; try { pl = BH.place(); } catch (e) { B.whys.push('place: ' + (e && e.message)); } if (pl) { B.plan = { id: pl.id, kind: pl.kind, ding: B.ding, ox: pl.ox, oz: pl.oz, F: pl.F, t: +(+g.time).toFixed(1) }; B.phase = 'placed'; B.t = 0; } else { B.whys.push('place refused'); B.phase = 'retry'; } }
        else { B.whys.push(gh ? (gh.why || 'red') : 'no ghost'); B.phase = 'retry'; }
        break;
      }
      case 'retry':
        B.tries++;
        if (B.tries >= 7) { try { BH.putAway(true); } catch (e) { /* already away */ } if (!B.fallback) { B.fallback = true; B.ding = 'm:vm_bench'; B.name = 'Bank'; B.tries = 0; B.dy = 0; B.phase = 'start'; } else { B.phase = 'failed'; S.done = true; } }
        else { B.dy = (B.tries % 2 ? 1 : -1) * Math.ceil(B.tries / 2) * 0.3; B.phase = 'aim'; B.t = 0; }
        break;
      case 'placed': try { BH.putAway(); } catch (e) { /* already away */ } B.phase = 'watch'; B.t = 0; break;
      case 'watch': {
        const bl = g.gadgets && g.gadgets.blue, L = bl && bl.sites, s = L && L.length ? L[L.length - 1] : null;
        if (s && s.box) {
          if (!B.site) B.site = { box: s.box.slice(), mode: s.mode };
          const b = s.box, cx = (b[0] + b[3]) / 2 + 0.5, cz = (b[2] + b[5]) / 2 + 0.5, eye = p.pos[1] + 1.62, dist = Math.hypot(cx - p.pos[0], cz - p.pos[2]);
          turnTo(p, cx, cz, dt, 1.5); p.pitch += (Math.atan2((b[1] + b[4]) / 2 - eye, Math.max(4, dist)) - p.pitch) * Math.min(1, dt * 2);
          B.sitePhase = s.phase;
          if (s.phase === 'done' || s.phase === 'gone' || s.phase === 'cancel') { B.watchDone += dt; if (B.watchDone > 5) { B.phase = 'done'; S.done = true; } }
        } else if (B.t > 8) { B.phase = 'done'; S.done = true; }
        if (B.t > 70) { B.phase = 'done'; S.done = true; }
        break;
      }
      default: S.done = true;
    }
  }
  // e-ctx · a trip by intent: look at the target (VR.Intent's list), tap V, then hands off until the trip is over
  function intent(g, p, I, dt) {
    const M = S.mode, In = VR.Intent; release(I);
    if (!In || !In.start) { S.done = true; return; }
    if (!M.started) {
      // (a-session: M.prefix — the first target whose id starts so; M.pick — the nearest of a kind beyond 40 m)
      if (!M.q || S.t - (M.qT || 0) > 1) {
        const P = p.pos, dd = (t) => Math.hypot(t.pos[0] - P[0], t.pos[2] - P[2]), T0 = In.targets || [];
        M.q = M.prefix ? T0.find(t => String(t.id).startsWith(M.prefix)) : M.pick ? T0.filter(t => t.kind === M.pick && dd(t) > 40).sort((a, b) => dd(a) - dd(b))[0] : T0.find(t => t.id === M.target); M.qT = S.t;
        if (M.q && (M.prefix || M.pick)) M.target = M.q.id;
      }
      const q = M.q;
      if (!q) { if (S.t > 6) { S.log.push(['intent', 'no target', M.target || M.prefix || M.pick]); S.done = true; } return; }
      const e = p.eyePos(), dx = q.pos[0] - e[0], dy = q.pos[1] - e[1], dz = q.pos[2] - e[2];
      p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); if (p.viewYaw !== undefined) p.viewYaw = p.yaw;
      if (M.aimT === undefined) M.aimT = S.t;
      if (S.t - M.aimT > 0.5 && M.pressT === undefined) { I.keys.add('KeyV'); I.pressed.add('KeyV'); M.pressT = S.t; return; }
      if (M.pressT !== undefined && !M.released && S.t - M.pressT > 0.05) { I.keys.delete('KeyV'); I.released.add('KeyV'); M.released = true; return; }
      if (M.released) {
        const c = In.current && In.current();
        if (c) { M.started = S.t; S.log.push(['intent', M.target, c.means, +(+g.time).toFixed(1)]); }
        else if (S.t - M.pressT > 2) { S.log.push(['intent', 'not started', M.target, VR.Ctx && VR.Ctx.current() ? VR.Ctx.current().id : '?']); if (M.direct && !M.tried) { M.tried = true; const ok = In.start(g, q); S.log.push(['fallback', 'Intent.start ' + M.target, ok]); if (ok) M.started = S.t; else S.done = true; } else S.done = true; }   // (a-session: direct — the trip started by hand when the key did not take, logged)
      }
      return;
    }
    const c = In.current && In.current();
    if (!c) { S.log.push(['intent', 'over', M.target, +(+g.time).toFixed(1)]); S.done = true; }
  }
  // ---- a-session: the adventurer's outpost (plan docs/superpowers/plans/2026-10-31-a-session.md §2.1)
  // the outpost of the world's start (meta.advStart.out) or the nearest not freed one within 400 m
  S.adSite = function () {
    const g = VR.game, L = VR.Liberate, p = g.player; if (!L || !L.sites) return null;
    const o = g.meta && g.meta.advStart && g.meta.advStart.out, ref = o ? [o[0], o[2]] : [p.pos[0], p.pos[2]];
    let best = null, bd = 400;
    for (const s of L.sites().values()) { if (!s) continue; const d = Math.hypot(s.x - ref[0], s.z - ref[1]); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  // a straight way (a point every 10 m) from the player to the outpost's beacon (toSite: stop that far short) or to the
  // nearest village not stood in (toVillage), else on ahead 200 m
  S.wayTo = function (M) {
    const g = VR.game, p = g.player, x0 = p.pos[0], z0 = p.pos[2];
    let tg = null, stop = 0;
    if (M.toSite) {
      const s = S.adSite(), o = g.meta && g.meta.advStart && g.meta.advStart.out;
      tg = s ? (s.beacon ? [s.beacon[0] + 0.5, s.beacon[2] + 0.5] : [s.x, s.z]) : o ? [o[0], o[2]] : null; stop = M.toSite;
    } else if (M.toVillage) {
      const V = g.villages; let bd = Infinity;
      if (V && V.sites) for (const v of V.sites) { const d = Math.hypot(v.x - x0, v.z - z0); if (d > 40 && d < bd && d < 1500) { bd = d; tg = [v.x + 0.5, v.z + 0.5]; } }
      stop = M.toVillage;
    }
    if (!tg) tg = [x0 - Math.sin(p.yaw) * 200, z0 - Math.cos(p.yaw) * 200];
    const dx = tg[0] - x0, dz = tg[1] - z0, d = Math.hypot(dx, dz) || 1, L = Math.max(4, d - stop), pts = [];
    for (let k = 0; k < L; k += 10) pts.push([x0 + dx / d * k, z0 + dz / d * k]);
    pts.push([x0 + dx / d * L, z0 + dz / d * L]);
    return pts;
  };
  const OFF = { down: 1, calm: 1, leave: 1, helper: 1 };
  const aim = (p, q, dt, rate) => { const e = [p.pos[0], p.pos[1] + 1.62, p.pos[2]], dx = q[0] - e[0], dy = q[1] - e[1], dz = q[2] - e[2]; const d = wrap(Math.atan2(-dx, -dz) - p.yaw); p.yaw += Math.max(-rate * dt, Math.min(rate * dt, d)); const pt = Math.atan2(dy, Math.hypot(dx, dz)); p.pitch += (pt - p.pitch) * Math.min(1, dt * 5); if (p.viewYaw !== undefined) p.viewYaw = p.yaw; return Math.abs(d); };
  // a screen box [x0, y0, x1, y1] (0..1, y down) of a world box round c (half sizes rx, ry), or null behind the eye
  S.box = function (c, rx, ry) {
    const g = VR.game, r = g.renderer, vp = r && r.viewProj, cam = g.cam; if (!vp || !cam) return null;
    let x0 = 2, y0 = 2, x1 = -2, y1 = -2, n = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const x = c[0] + sx * rx - cam.x, y = c[1] + sy * ry - cam.y, z = c[2] + sz * rx - cam.z, w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      if (w < 0.05) continue; n++;
      const u = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w) * 0.5 + 0.5, v = 1 - (((vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * 0.5 + 0.5);
      x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v);
    }
    if (!n || x1 < 0 || x0 > 1 || y1 < 0 || y0 > 1) return null;
    return [Math.max(0, x0), Math.max(0, y0), Math.min(1, x1), Math.min(1, y1)];
  };
  const overlap = (a, b) => { if (!a || !b) return 0; const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); return w > 0 && h > 0 ? (w * h) / Math.max(1e-6, (a[2] - a[0]) * (a[3] - a[1])) : 0; };
  // how much of the machine's screen box Funke's body and its bubble cover (2 Hz while the adventurer faces a machine)
  function funkeOver(g, m, A) {
    const K = VR.Foes.KINDS[m.foe.k] || { h: 1.5, w: 0.5 }, fb = S.box([m.pos[0], m.pos[1] + K.h / 2, m.pos[2]], K.w + 0.15, K.h / 2 + 0.1); if (!fb) return;
    const fk = g.funke; let o = 0;
    if (fk && fk.visible !== false && fk.pos) o = Math.max(o, overlap(fb, S.box(fk.pos, 0.3, 0.3)));
    const el = typeof document !== 'undefined' && document.getElementById('funkebub');
    const bub = el && el.style.display !== 'none' && el.getBoundingClientRect ? el.getBoundingClientRect() : null, cv = g.renderer && g.renderer.canvas;
    if (bub && bub.width > 0 && cv && cv.clientWidth) { const W = cv.clientWidth, H = cv.clientHeight; o = Math.max(o, overlap(fb, [bub.left / W, bub.top / H, bub.right / W, bub.bottom / H])); }
    const X = A.fx; X.n++; if (o > 0.15) X.cover++; X.worst = Math.max(X.worst, +o.toFixed(2));
  }
  function outpost(g, p, I, dt) {
    const L = VR.Liberate, Fo = VR.Foes, En = g.entities, T = g.time || 0;
    const A = S.ad || (S.ad = { ph: 'seek', t: 0, fought: 0, calmed: 0, hits: 0, clickT: 0, vT: -9, tg: null, tgT: 0, fightT: 0, freed: false, freeT: 0, turns: 0, fallbacks: [], fx: { n: 0, cover: 0, worst: 0 }, fxT: 0, last: [p.pos[0], p.pos[2], 0], jumpT: 0, sites: 0 });
    A.t += dt;
    if (I.keys.has('KeyV') && T - A.vT > 0.1) I.keys.delete('KeyV');   // (a tap: two frames down)
    I.captured = false;
    if (!L || !Fo || !En) { S.done = true; A.why = 'no Liberate/Foes'; return; }
    const site = S.adSite();
    const fall = (w) => { A.fallbacks.push(w + '@' + Math.round(S.t)); S.log.push(['fallback', w, +T.toFixed(1)]); };
    const tapV = () => { I.keys.add('KeyV'); A.vT = T; };
    // walking to a spot: W while it faces it, a jump when stuck
    const go = (x, z, near) => {
      const d = Math.hypot(x - p.pos[0], z - p.pos[2]); if (d <= near) { I.keys.delete('KeyW'); return true; }
      const off = turnTo(p, x, z, dt, 4); if (off > 1.0) I.keys.delete('KeyW'); else I.keys.add('KeyW');
      const lm = A.last; if (Math.hypot(p.pos[0] - lm[0], p.pos[2] - lm[1]) > 0.6) { lm[0] = p.pos[0]; lm[1] = p.pos[2]; lm[2] = S.t; }
      if (A.jumpT > 0) { A.jumpT -= dt; if (A.jumpT <= 0) I.keys.delete('Space'); } else if (S.t - lm[2] > 1.2) { I.keys.add('Space'); A.jumpT = 0.25; lm[2] = S.t; S.stat.jumps++; }
      return false;
    };
    if (!site) { const o = g.meta && g.meta.advStart && g.meta.advStart.out; if (o) go(o[0], o[2], 12); if (A.t > 40) { A.why = 'no site'; S.done = true; } return; }
    const b = site.beacon ? [site.beacon[0] + 0.5, site.beacon[1] + 1.2, site.beacon[2] + 0.5] : [site.x + 0.5, (site.y || p.pos[1]) + 1.2, site.z + 0.5];
    // freed: watch the moment, then done
    if (site.st === 'frei') {
      release(I); if (!A.freed) { A.freed = true; A.freeT = S.t; S.log.push(['freed', site.id, +T.toFixed(1)]); }
      if (!(g.wow && g.wow.active) && !L.moment) aim(p, b, dt, 2);
      if (!L.moment && S.t - A.freeT > 5) S.done = true;
      return;
    }
    // the Lichtleiter open: one conduit on the light's path turned every 0.35 s (a player's clicks)
    if (L.puz) {
      release(I); A.ph = 'puzzle';
      if (L.puz.done) return;
      A.clickT -= dt; if (A.clickT > 0) return; A.clickT = 0.35;
      const pz = L.puz.s.pz; let i = -1;
      for (let k = 0; k < pz.tiles.length; k++) { const tl = pz.tiles[k]; if (tl.path && !tl.lock && L.maskOf(tl) !== L.rotMask(tl.t, tl.sol)) { i = k; break; } }
      if (i >= 0) { L.puzAct('t', i); A.turns++; } else if (A.t - A.tgT > 30) { fall('puzzle stuck'); L.closePuzzle(); }
      return;
    }
    // the calm ring standing: watch the needle, the second tap when it is in the green arc
    if (L.calmSt) {
      release(I); A.ph = 'calm';
      const m = L.calmSt.m; if (m) { const K = Fo.KINDS[m.foe.k]; aim(p, [m.pos[0], m.pos[1] + K.h * 0.55, m.pos[2]], dt, 4); if (S.t - A.fxT > 0.5) { A.fxT = S.t; funkeOver(g, m, A); } }
      if (T - (L.calmSt.t0 || 0) > 0.25 && L.calmPress(L.calmSt, T)) { const ok = L.calmTap(g); if (ok) { A.calmed++; S.log.push(['calmed', m && m.foe.k, +T.toFixed(1)]); A.tg = null; } }
      return;
    }
    const strays = En.mobs.filter(m => m.foe && !m.foe.gone && m.foe.site === site.id && !m.foe.wave && !m.foe.helper);
    const active = strays.filter(m => !OFF[m.foe.st]);
    A.sites = strays.length;
    // ready: to the beacon, [V] — the Lichtleiter
    if (L.state(site) === 'bereit' || (site.strays !== null && site.strays !== undefined && !active.length && strays.length)) {
      A.ph = 'beacon';
      if (!go(b[0], b[2], 3.0)) { p.pitch += (-0.1 - p.pitch) * Math.min(1, dt * 3); return; }
      aim(p, b, dt, 4);
      if (A.beaconT === undefined) A.beaconT = S.t;
      if (S.t - A.beaconT > 0.6 && S.t - A.beaconT < 0.7 + dt) tapV();
      if (S.t - A.beaconT > 2.2 && !L.puz) { fall('openPuzzle'); L.openPuzzle(g, site); A.tgT = A.t; A.beaconT = S.t + 99; }
      return;
    }
    // the strays not there yet: closer to the beacon (they stand up as their outpost is near)
    if (!active.length) { A.ph = 'near'; go(b[0], b[2], 14); if (A.t > 60) { A.why = 'no strays'; S.done = true; } return; }
    // the target: the first one fought (a walker before a sentry, never the crane on its tower), the others calmed
    if (!A.tg || OFF[A.tg.foe.st] || A.tg.foe.gone) {
      if (A.tg && A.tg.foe.st === 'down' && A.ph === 'fight') { A.fought++; S.log.push(['down', A.tg.foe.k, +T.toFixed(1), A.hits]); }
      const P = p.pos, near = (m) => Math.hypot(m.pos[0] - P[0], m.pos[2] - P[2]), pref = (m) => near(m) + (m.foe.k === 'crane' ? 60 : 0) + (A.fought < 1 && m.foe.k === 'driller' ? -12 : 0);
      A.tg = active.slice().sort((x, y) => pref(x) - pref(y))[0]; A.tgT = A.t; A.vTry = 0; A.tout = 0;
      A.ph = A.fought < 1 && A.tg.foe.k !== 'crane' ? 'fight' : 'calmgo';
    }
    const m = A.tg, K = Fo.KINDS[m.foe.k], c = [m.pos[0], m.pos[1] + K.h * 0.55, m.pos[2]], d = Math.hypot(m.pos[0] - p.pos[0], m.pos[2] - p.pos[2]);
    if (S.t - A.fxT > 0.5 && d < 16) { A.fxT = S.t; funkeOver(g, m, A); }
    if (A.ph === 'fight') {
      A.fightT += dt;
      if (A.fightT > 35) { A.ph = 'calmgo'; fall('fight timeout'); return; }
      // to its side (its core is the weak point from the side and behind), then strikes at a player's rhythm
      const sx = Math.cos(m.yaw), sz = -Math.sin(m.yaw), side = ((p.pos[0] - m.pos[0]) * sx + (p.pos[2] - m.pos[2]) * sz) >= 0 ? 1 : -1;
      const spot = [m.pos[0] + sx * side * 2.4, m.pos[2] + sz * side * 2.4];
      if (d > 3.6) { go(spot[0], spot[1], 0.8); aim(p, c, dt, 0); p.pitch += (Math.atan2(c[1] - p.pos[1] - 1.62, Math.max(1, d)) - p.pitch) * Math.min(1, dt * 4); return; }
      I.keys.delete('KeyW'); aim(p, c, dt, 5);
      A.clickT -= dt;
      if (A.clickT <= 0) { const hp0 = m.foe.hp; I.captured = true; I.mouse.clicked[0] = true; I.mouse.releasedBtn[0] = true; I.dragStart = null; A.clickT = 0.42;   /* a-story5 (R55-16): a press and its release — headless has no pointer lock, drag-look counts a click on release */ A.hp0 = hp0; A.hitAsk = (A.hitAsk | 0) + 1; }
      if (A.hp0 !== undefined && m.foe.hp < A.hp0) { A.hits++; A.hp0 = undefined; }
      if (A.hitAsk > 40 && A.hits === 0) { fall('melee never lands'); Fo.hurtMob ? En.hurtMob(m, 4, p.pos) : 0; A.hitAsk = 0; }
      return;
    }
    // calm: close, face it, [V]; the ring did not start → the direct call (logged); a Kranarm on its tower from its foot
    if (A.t - A.tgT > 12) { A.tgT = A.t; A.tout = (A.tout | 0) + 1; if (A.tout >= 2) { fall('powerdown direct ' + m.foe.k); En.hurtMob(m, 99, [m.pos[0] + Math.sin(m.yaw) * 2, m.pos[1] + 0.6, m.pos[2] + Math.cos(m.yaw) * 2]); A.tout = 0; } else { fall('calm direct ' + m.foe.k); L.calmBegin(g, m); } return; }
    if (!go(m.pos[0], m.pos[2], m.foe.k === 'crane' ? 5.5 : 3.0) && !(m.foe.k === 'crane' && d < 6.5 && A.t - A.tgT > 6)) { aim(p, c, dt, 0); return; }
    aim(p, c, dt, 5);
    if (A.vTry === 0 || (S.t - A.vTry > 1.4)) { if (A.vTry && !L.calmSt) { fall('calmBegin'); L.calmBegin(g, m); } tapV(); A.vTry = S.t; }
  }
  S.control = function (dt) {
    const g = VR.game, p = g && g.player, I = g && g.input, M = S.mode; if (!p || !I) return;
    S.t += dt;
    if (p.hold) { release(I); return; }
    if (M.kind === 'look') { release(I); p.yaw += (M.speed || 0.3) * dt; p.pitch += ((M.pitch || 0) - p.pitch) * Math.min(1, dt * 2); if (S.t >= (M.sec || 1)) S.done = true; return; }
    if (M.kind === 'walk') { walk(g, p, I, dt); return; }
    if (M.kind === 'bauhand') { bauhand(g, p, I, dt); return; }
    if (M.kind === 'intent') { intent(g, p, I, dt); return; }   // e-ctx
    if (M.kind === 'outpost') { outpost(g, p, I, dt); return; }   // a-session
    if (M.kind === 'showcase') {   // a-builder: the builder shows the house off — the photo mode's circle round it at the golden hour, a picture
      release(I);
      if (!S.sc) { const b = S.B && S.B.site && S.B.site.box, c = b ? [(b[0] + b[3]) / 2 + 0.5, b[1] + 1.5, (b[2] + b[5]) / 2 + 0.5] : null, r = b ? Math.hypot(b[3] - b[0], b[5] - b[2]) / 2 + 7 : 0, h = b ? b[4] - b[1] + 4 : 0; S.sc = { ok: !!(VR.Showcase && VR.Showcase.start(g, { centre: c, golden: true, r, h })), c }; S.log.push(['showcase', S.sc.ok, c && c.map(Math.round)]); if (!S.sc.ok) { S.done = true; S.sc = null; } return; }
      if (S.t >= (M.sec || 30)) { VR.Showcase.stop(g); S.sc = null; S.done = true; }
      return;
    }
    release(I);
  };
  // n frames of 1/30 s, the last one drawn and captured when asked
  S.frames = function (n, render) {
    const g = VR.game; if (!g || g.state !== 'play') return { t: g ? g.time : 0, state: g ? g.state : 'none', done: S.done };
    let rms = 0;
    for (let i = 0; i < n; i++) {
      const last = !!render && i === n - 1;
      win.__norender = !last;
      S.control(1 / 30);
      if (S.acceptStory && VR.Story && VR.Story.offer && VR.Story.offer(g)) VR.Story.watch(g);   // a-story: the adventurer takes a beat Funke offers ([V])
      const t0 = performance.now();
      g.last = t0 - 1000 / 30; g.loop(t0);
      if (last) { try { g.renderer.gl.finish(); } catch (e) { /* no GL in a stand-in */ } rms = performance.now() - t0; S.capture(); }
    }
    win.__norender = true;
    const p = g.player;
    return { t: g.time, rms, done: S.done, x: p.pos[0], y: p.pos[1], z: p.pos[2], hold: !!p.hold, wow: !!(g.wow && g.wow.active) };
  };
  S.capture = function () {
    const g = VR.game, src = g.canvas || (typeof document !== 'undefined' ? document.getElementById('gl') : null); if (!src || !src.width) return false;
    const c = S.cv || (S.cv = document.createElement('canvas')); c.width = 480; c.height = 270;
    try { c.getContext('2d').drawImage(src, 0, 0, 480, 270); S.pics.push({ t: g.time, url: c.toDataURL('image/jpeg', 0.74), occ: +S.occ().toFixed(2) }); return true; } catch (e) { S.log.push(['capture', String(e && e.message)]); return false; }
  };
  // (a-regie: a picture over 30 % occluded gives way to a clear one within 3 s; else it is marked)
  S.picsAt = function (ts) { return ts.map(t => { let best = null, bd = Infinity; for (const q of S.pics) { const d = Math.abs(q.t - t) + (q.occ > 0.3 ? 3 : 0); if (d < bd) { bd = d; best = q; } } return best ? { t: best.t, url: best.url, occ: best.occ || 0 } : null; }); };
  // the world ahead: columns missing within r chunks, sections still to mesh within rm
  S.ready = function (r, rm) {
    const g = VR.game, w = g.world, p = g.player; if (!w || !p) return { miss: 99, dirty: 0 };
    const pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let miss = 0, dirty = 0;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dz * dz; if (d2 > r * r) continue;
      const c = w.col(pcx + dx, pcz + dz); if (!c) { miss++; continue; }
      if (d2 <= rm * rm) for (const s of c.sec) if (s && (s.dirty || s.pending)) dirty++;
    }
    return { miss, dirty };
  };
  S.pump = function (r, rm) { const g = VR.game, p = g.player; try { g.world.update(p.pos[0], p.pos[1], p.pos[2], performance.now()); } catch (e) { /* the next frame */ } return S.ready(r, rm); };
  S.status = function () { const B = S.B; return { mode: S.mode.kind, done: S.done, t: +S.t.toFixed(2), stat: Object.assign({}, S.stat), log: S.log.slice(-30), B: B ? { phase: B.phase, ding: B.ding, tries: B.tries, whys: B.whys.slice(-14), plan: B.plan, site: B.site, sitePhase: B.sitePhase, fallback: B.fallback } : null, route: S.R ? { L: +S.R.L.toFixed(1), s: +S.R.s.toFixed(1) } : null, ad: S.ad ? { ph: S.ad.ph, fought: S.ad.fought, calmed: S.ad.calmed, hits: S.ad.hits, turns: S.ad.turns, freed: S.ad.freed, sites: S.ad.sites, why: S.ad.why || '', fallbacks: S.ad.fallbacks.slice(-12), fx: S.ad.fx } : null }; };
  return S;
}

// ============================================================================ the analysis, the frames, the sheet (node)
const SUB_DE = { birds: 'Vögel', chimneys: 'Kaminrauch', lanterns: 'Laternenanzünder', cat: 'Katze', pigeons: 'Tauben', cart: 'Schwebekarren', meteor: 'Sternschnuppe', balloon: 'Ballon', bells: 'Glocken', fireworks: 'Feuerwerk', kids: 'Kinder', musician: 'Musikant', dog: 'Hund', skyray: 'Himmelsrochen', fisher: 'Angler', flyby: 'Vorbeiflug', lowpass: 'Tiefflug', convoy: 'Konvoi', defence: 'Abwehr', landing: 'Landung', festival: 'Fest', site: 'Baustelle', site_done: 'Haus steht' };
const PLACE_DE = { plaza: 'Platz', street: 'Straße', hall: 'Halle', hangar: 'Hangar', hills: 'Hügel', isles: 'Inseln', water: 'Wasser', wild: 'Land', '': '—' };
const LM_DE = { temple: 'Tor-Tempel', citadel: 'Zitadelle', isles: 'Himmelsinseln', nova: 'Nova Haven', station: 'Bergstation', hills: 'Kuppelhügel', lighthouse: 'Leuchtturm', falls: 'Wasserfall', lookout: 'Aussichtsturm' };
const SKY_DE = { low_sun: 'tiefe Sonne', giant: 'Ringplanet', blue: 'blauer Planet', meteor: 'Sternschnuppe', skyray: 'Himmelsrochen', fireworks: 'Feuerwerk' };
const TYPE_DE = { builder: 'Bauen', walk: 'Spaziergang', adventurer: 'Abenteuer', pilot: 'Pilot' };
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const clock = (tod) => { const h = ((tod / 1000) + 6) % 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; };
const evName = (e) => SUB_DE[e.sub] || (e.kind === 'discovery' ? 'Entdeckt ' + e.sub : e.kind === 'milestone' ? 'Meilenstein ' + e.sub : e.kind === 'wow' ? 'Wow ' + (LM_DE[e.sub] || e.sub) : e.sub || e.kind);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// the time a session was played: a session its real-time budget cut short ends there, not at DUR
const playedT = (rec) => Math.min(rec.dur, rec.played > 0 ? rec.played : rec.dur);
// a frame: the events of its slot [a, b), the sample nearest its time, the part it falls in
function frameAt(rec, i, t, a, b) {
  const events = rec.events.filter(e => e.t >= a && e.t < b);
  const sample = rec.samples.reduce((m, q) => (!m || Math.abs(q.t - t) < Math.abs(m.t - t) ? q : m), null);
  const part = (rec.parts.filter(p => !p.skipped && p.t0 <= t).slice(-1)[0] || {}).de || '';
  return { i, t, a, b, events, sample, part };
}
// the twelve frames: one per slot of the played time / 12, at the slot's heaviest event in view (a second after it
// began) or its middle
function chooseFrames(rec) {
  const T1 = playedT(rec), out = [];
  for (let k = 0; k < SLOTS; k++) {
    const a = k * T1 / SLOTS, b = (k + 1) * T1 / SLOTS;
    const best = rec.events.filter(e => e.t >= a && e.t < b && e.inView).sort((p, q) => q.w - p.w || p.t - q.t)[0];
    out.push(frameAt(rec, k + 1, best ? Math.min(b - 0.25, best.t + 1) : (a + b) / 2, a, b));
  }
  return out;
}
function frameLabels(f, rec) {
  const s = f.sample || {};
  const l1 = `${f.occ > 0.3 ? `⚠ verdeckt ${Math.round(f.occ * 100)} % · ` : ''}${f.i} · ${mmss(f.t)} · ${PLACE_DE[s.place] !== undefined ? PLACE_DE[s.place] : s.place || '—'} · ${f.part}`;
  const evs = f.events.slice().sort((p, q) => q.w - p.w || p.t - q.t).slice(0, 4).map(e => `${evName(e)} ${e.w}${e.inView ? '✓' : '✗'}`);
  const more = f.events.length > 4 ? ` +${f.events.length - 4}` : '';
  const env = [s.movers ? `${s.movers} Beweger` : '0 Beweger', s.landmark ? LM_DE[s.landmark] || s.landmark : '', s.sky ? SKY_DE[s.sky] || s.sky : ''].filter(Boolean).join(' · ');
  return [cut(l1, 74), cut((evs.length ? evs.join(' · ') + more : '— nichts —') + '  |  ' + env, 92)];
}
async function buildSheet(rec, frames, out) {
  const sharp = (await import('/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js')).default;
  const G = 8, LH = 44, COLS = 4, ROWS = 3, HEAD = 78, TL = 150;
  const SW = COLS * PW + (COLS + 1) * G, SH = HEAD + ROWS * (PH + LH + G) + G + TL;
  const comps = [];
  const m = rec.metrics, v = rec.verdict, gl = m.gaps.longest, T1 = playedT(rec), cutShort = T1 < rec.dur - 1;
  let svg = `<svg width="${SW}" height="${SH}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'DejaVu Sans',sans-serif}</style>`;
  const T = (x, y, s, size, fill, weight) => { svg += `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}"${weight ? ` font-weight="${weight}"` : ''}>${esc(s)}</text>`; };
  T(G, 26, `Sitzung · ${TYPE_DE[rec.type] || rec.type} (${rec.type}) — Saat ${rec.seed} · Ausgewogen ${(rec.size || [VW, VH]).join('×')} · ${mmss(T1)} Spielzeit${cutShort ? ` von ${mmss(rec.dur)} (Zeitbudget)` : ''} · ${clock(rec.tod0)} → ${clock(rec.tod1)} Uhr · Tag ${rec.day} · ${rec.build || ''}`, 18, '#f0f0f5', 600);
  const mt = `Ereignisse ≥ 2 im Blick ${m.weighted.perMin.toFixed(2)}/min · längste Lücke ${Math.round(gl.d)} s (${mmss(gl.a)}–${mmss(gl.b)}) · p90 ${Math.round(m.gaps.p90)} s · Beweger ${m.movers.toFixed(2)} · Wahrzeichen/Himmel ${m.lmSky.toFixed(2)} · Vielfalt ${m.variety.n} · Spam ${m.spam.n} · freihändig ${m.handsFree.toFixed(2)}`;
  T(G, 50, mt, 14, '#c9cbd6');
  T(G, 70, `Ziele (${v.base}) erreicht: ${v.met} / ${v.total} — ${v.rows.filter(r => !r.ok).map(r => r.key).join(', ') || 'alle'}`, 14, v.met === v.total ? '#7ce39a' : '#ff9a8a', 600);
  frames.forEach((f, i) => {
    const cx = G + (i % COLS) * (PW + G), cy = HEAD + Math.floor(i / COLS) * (PH + LH + G) + G;
    if (f.file && fs.existsSync(f.file)) comps.push({ file: f.file, left: cx, top: cy });
    else { svg += `<rect x="${cx}" y="${cy}" width="${PW}" height="${PH}" fill="#1a1b24"/>`; T(cx + 12, cy + 24, f.gone ? 'nicht gespielt' : 'kein Bild', 14, '#888'); }
    const [l1, l2] = f.labels;
    svg += `<rect x="${cx}" y="${cy + PH}" width="${PW}" height="${LH}" fill="#14151d"/>`;
    T(cx + 6, cy + PH + 17, l1, 13, '#eef0f6', 600); T(cx + 6, cy + PH + 36, l2, 11.5, '#aab0c0');
    if (f.t >= gl.a && f.t <= gl.b && gl.d >= 30) { svg += `<rect x="${cx + PW - 128}" y="${cy + 6}" width="122" height="22" rx="4" fill="#c0392b" opacity="0.9"/>`; T(cx + PW - 122, cy + 22, `LÜCKE ${Math.round(gl.d)} s`, 13, '#fff', 700); }
  });
  // the timeline: inputs, movers, landmark/sky, the events (weighted in view green, the rest grey), the gaps ≥ 45 s red
  const y0 = SH - TL + 6, x0 = 70, x1 = SW - 16, X = (t) => x0 + (x1 - x0) * Math.max(0, Math.min(1, t / T1));
  T(G, y0 + 8, 'Eingabe', 11, '#aab0c0'); T(G, y0 + 24, 'Beweger', 11, '#aab0c0'); T(G, y0 + 40, 'Wahrz./Himmel', 10, '#aab0c0'); T(G, y0 + 72, 'Ereignisse', 11, '#aab0c0');
  const IC = { micro: '#8a8f9c', build: '#ffb347', idle: '#5fd38d', intent: '#4fc3ff' };
  for (const s of rec.samples) { const xa = X(s.t - 1), xb = X(s.t); svg += `<rect x="${xa.toFixed(1)}" y="${y0}" width="${Math.max(0.6, xb - xa).toFixed(1)}" height="10" fill="${IC[s.input] || '#555'}"/>`; if (s.movers) svg += `<rect x="${xa.toFixed(1)}" y="${y0 + 16}" width="${Math.max(0.6, xb - xa).toFixed(1)}" height="8" fill="#c8a2ff"/>`; if (s.landmark || s.sky) svg += `<rect x="${xa.toFixed(1)}" y="${y0 + 32}" width="${Math.max(0.6, xb - xa).toFixed(1)}" height="8" fill="#ffd36e"/>`; }
  for (const gp of m.gaps.list) if (gp.d >= 45) { svg += `<rect x="${X(gp.a).toFixed(1)}" y="${y0 + 48}" width="${(X(gp.b) - X(gp.a)).toFixed(1)}" height="40" fill="#e74c3c" opacity="0.22"/>`; T(X(gp.a) + 3, y0 + 86, `${Math.round(gp.d)} s`, 11, '#ff8f80', 700); }
  svg += `<line x1="${x0}" y1="${y0 + 80}" x2="${x1}" y2="${y0 + 80}" stroke="#555a66" stroke-width="1"/>`;
  for (const e of rec.events) { const wt = e.w >= 2 && e.inView, h = wt ? 6 + 6 * e.w : 6; svg += `<line x1="${X(e.t).toFixed(1)}" y1="${y0 + 80}" x2="${X(e.t).toFixed(1)}" y2="${(y0 + 80 - h).toFixed(1)}" stroke="${wt ? '#5fe08a' : '#6b7080'}" stroke-width="${wt ? 2 : 1}"/>`; }
  for (const f of frames) { if (f.gone) continue; svg += `<circle cx="${X(f.t).toFixed(1)}" cy="${y0 + 98}" r="7" fill="#2b2f3d"/>`; T(X(f.t) - (f.i >= 10 ? 7 : 3.5), y0 + 102, String(f.i), 10, '#eef0f6'); }
  for (let t = 0; t <= T1; t += 30) T(X(t) - 10, y0 + 118, mmss(t), 10, '#7d8292');
  T(x0, y0 + 136, 'grün: Gewicht ≥ 2 im Blick · grau: Gewicht 1 / außer Sicht · rot: Lücke ≥ 45 s · Eingabe: grau Tasten, orange Bauen, grün Zuschauen', 10, '#7d8292');
  svg += '</svg>';
  const parts = [];
  for (const c of comps) parts.push({ input: await sharp(c.file).resize(PW, PH).toBuffer(), left: c.left, top: c.top });
  parts.push({ input: Buffer.from(svg), left: 0, top: 0 });
  await sharp({ create: { width: SW, height: SH, channels: 3, background: '#0b0c12' } }).composite(parts).png().toFile(out);
  return { w: SW, h: SH };
}
// a session's record → the metrics, the verdict, the gaps described, the frames chosen
// (keep: the frames already pictured — SHEET_ONLY — keep their times and pictures; a frame without its slot written down
// had the slot of dur / 12 (the first runs), and one that falls after the played time is marked as not played)
function analyze(rec, keep) {
  const T1 = playedT(rec);
  rec.metrics = SS.analyze({ events: rec.events, samples: rec.samples, t0: 0, t1: T1, exclude: rec.exclude || [] });
  rec.verdict = SS.verdict(rec.metrics, rec.type);
  rec.gaps = rec.metrics.gaps.list.slice().sort((a, b) => b.d - a.d).slice(0, 3).map(g => SS.describeGap(g, rec.samples, rec.events));
  const old = keep && rec.frames && rec.frames.length ? rec.frames : null;
  const fr = old ? old.map((f, k) => { const a = f.a !== undefined ? f.a : k * rec.dur / SLOTS, b = Math.min(T1, f.b !== undefined ? f.b : (k + 1) * rec.dur / SLOTS); return Object.assign(frameAt(rec, f.i, f.t, a, b), { file: f.file, pic: f.pic, gone: a >= T1 - 1e-6 }); }) : chooseFrames(rec);
  rec.frames = fr.map(f => ({ i: f.i, t: +f.t.toFixed(2), a: +f.a.toFixed(2), b: +f.b.toFixed(2), labels: f.gone ? [`${f.i} · nicht gespielt`, 'das Zeitbudget der Sitzung war vorher aufgebraucht'] : frameLabels(f, rec), file: f.gone ? undefined : f.file, pic: f.gone ? undefined : f.pic, gone: f.gone || undefined }));
  return rec;
}
const summary = (rec) => {
  const m = rec.metrics, gl = m.gaps.longest;
  return `${rec.type}: ${(+m.weighted.n).toFixed(1)} weighted seen (${m.weighted.full === undefined ? '' : m.weighted.full + ' full, '}${m.weighted.perMin.toFixed(2)}/min), longest gap ${gl.d.toFixed(0)} s (${mmss(gl.a)}–${mmss(gl.b)}), p90 ${m.gaps.p90.toFixed(0)} s, movers ${m.movers.toFixed(2)}, landmark/sky ${m.lmSky.toFixed(2)}, variety ${m.variety.n} (${m.variety.kinds.join(',')}), spam ${m.spam.n}, hands-free ${m.handsFree.toFixed(2)}${m.repeat ? `, repeat ${m.repeat.name} ${m.repeat.share.toFixed(2)}` : ''} — targets ${rec.verdict.met}/${rec.verdict.total}`;
};

// ============================================================================ DRY: everything node can check before the one browser run
if (DRY) {
  const OUT = process.env.DRY_OUT || (ROOT + '.tmp_tests/session_dry/');
  fs.mkdirSync(OUT, { recursive: true });
  const R = planRoutes();
  console.log('meadow', JSON.stringify(R.M), 'stand', R.STAND.map(v => +v.toFixed(1)), 'landmarks', R.landmarks.map(q => q.id).join(','));
  for (const k of ['builderA', 'builderB', 'walkA', 'walkB']) {
    const P = R[k]; let jump = 0; for (let i = 1; i < P.length; i++) jump = Math.max(jump, Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    console.log(`  ${k}: ${P.length} points, ${R.len(P).toFixed(0)} m, from (${P[0].map(v => v.toFixed(0))}) to (${P[P.length - 1].map(v => v.toFixed(0))}), longest step ${jump.toFixed(1)} m`);
    check(P.length >= 3 && R.len(P) > 100, `${k}: a route of ${R.len(P).toFixed(0)} m`);
  }
  check(R.M && R.M.flat >= 0 && R.M.flat <= 2, `the river meadow: open, flat grass at (${R.M.x}, ${R.M.z}), relief ${R.M.flat}`);
  // the walker on a stand-in: a point that walks 4.3 m/s along its yaw while W is held
  const keys = new Set(), fg = { state: 'play', time: 0, player: { pos: [0.5, 81, 4.5], yaw: Math.PI, pitch: 0, vel: [0, 0, 0], hold: null }, input: { keys }, world: { getBlock: (x, y) => (y <= 80 ? 1 : 0) }, wow: null, gadgets: null };
  const fvr = { game: fg, R: { T: { flags: [0, 1] } }, F: { SOLID: 1, REPLACE: 2 } };
  const W = {}; pageHelpers(W, fvr); const S = W.__S;
  const walkIt = (route, maxS, blockAt) => {
    fg.player.pos = [route[0][0], 81, route[0][1]]; S.set({ kind: 'walk', route }); let t = 0, dev = 0;
    for (; t < maxS && !S.done; t += 1 / 30) {
      S.control(1 / 30); fg.time += 1 / 30;
      if (keys.has('KeyW')) { const p = fg.player, nx = p.pos[0] - Math.sin(p.yaw) * 4.3 / 30, nz = p.pos[2] - Math.cos(p.yaw) * 4.3 / 30; if (!(blockAt && blockAt(nx, nz))) { p.pos[0] = nx; p.pos[2] = nz; } }
      const q = S.pointAt(S.R, S.R.s); dev = Math.max(dev, Math.hypot(fg.player.pos[0] - q[0], fg.player.pos[2] - q[1]));
    }
    return { t, dev, done: S.done, hops: S.stat.hops, L: S.R.L };
  };
  for (const k of ['builderA', 'builderB', 'walkA', 'walkB']) {
    const h0 = S.stat.hops, r = walkIt(R[k], 600);
    console.log(`  walker on ${k}: ${r.done ? 'arrived' : 'NOT arrived'} after ${r.t.toFixed(0)} s (${(r.L / r.t).toFixed(2)} m/s), the farthest off the way ${r.dev.toFixed(2)} m, hops ${r.hops - h0}`);
    check(r.done && r.dev < 3 && r.hops === h0 && r.L / r.t > 3.4, `the walker follows ${k} to its end (${(r.L / r.t).toFixed(2)} m/s, ≤ ${r.dev.toFixed(1)} m off, no hop)`);
  }
  const wall = (x, z) => z > 30 && z < 31.5;   // a wall across the hall's way out: the walker jumps, then hops past it
  const h1 = S.stat.hops, j1 = S.stat.jumps, rw = walkIt(R.builderA.slice(0, 6), 120, wall);
  check(rw.done && S.stat.hops > h1 && S.stat.jumps > j1, `stuck at a wall: it jumps (${S.stat.jumps - j1}) and hops along the way (${S.stat.hops - h1}), and arrives`);
  // the Bauhand on a stand-in: a ghost that turns cyan after a moment, a site that rises and stands
  let ghostAt = 0;
  const site = { mode: 'show', phase: 'earth', box: [270, 81, -46, 280, 88, -36] };
  fvr.Bauhand = { state: 'closed', ghost: null, hold(ding) { this.state = 'holding'; this.ding = ding; ghostAt = fg.time + 1.5; }, place() { fg.gadgets = { blue: { sites: [site] } }; return { id: 'bh1', kind: 'house', ox: 270, oz: -46, F: 81 }; }, putAway() { this.state = 'closed'; } };
  Object.defineProperty(fvr.Bauhand, 'ghost', { get() { return fvr.Bauhand.state === 'holding' && fg.time > ghostAt ? { ok: fg.time > ghostAt + 2, why: 'zu steil' } : null; }, configurable: true });
  fg.player.pos = [R.STAND[0], 81, R.STAND[1]]; S.set({ kind: 'bauhand', ding: 'h:6', name: 'Bungalow', target: [R.M.x, R.M.y, R.M.z] });
  for (let t = 0; t < 90 && !S.done; t += 1 / 30) { S.control(1 / 30); fg.time += 1 / 30; if (fg.gadgets && site.phase === 'earth' && S.B.t > 3) site.phase = 'build'; if (site.phase === 'build' && S.B.t > 12) site.phase = 'done'; }
  const st = S.status();
  console.log('  bauhand on a stand-in', JSON.stringify(st.B));
  check(S.done && st.B.phase === 'done' && st.B.plan && st.B.plan.kind === 'house' && st.B.site && st.B.whys.length >= 1, `the Bauhand part: holds, retries a red ghost (${st.B.whys.join('; ')}), places the house, watches the site to its end`);
  // a synthetic session → the analysis and the sheet
  const sharp = (await import('/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js')).default;
  const rec = { type: 'builder', seed: SEED, dur: 300, tod0: 2500, tod1: 8500, day: 0, build: 'dry', parts: [{ name: 'spawn', de: 'Ankunft', t0: 0, t1: 8 }, { name: 'meadow', de: 'Zur Flusswiese', t0: 8, t1: 100 }, { name: 'bauhand', de: 'Bauhand: Bungalow', t0: 100, t1: 160 }, { name: 'walkon', de: 'Weiter', t0: 160, t1: 300 }], events: [], samples: [] };
  const kinds = ['ambient', 'travel', 'social', 'sky', 'build', 'discovery'], subs = ['birds', 'flyby', 'kids', 'balloon', 'site', 'plains'];
  for (let t = 3; t < 300; t += 7 + (t % 23)) { const i = Math.floor(t) % 6; if (t > 120 && t < 200) continue; rec.events.push({ n: rec.events.length + 1, t, kind: kinds[i], sub: subs[i], w: 1 + (i % 3), inView: i % 4 !== 0, frac: 0.01, x: 0, y: 0, z: 0, src: 'dry' }); }
  for (let t = 1; t <= 300; t++) rec.samples.push({ t, movers: t % 3 ? 1 : 0, mv: 'v1', landmark: t % 5 ? '' : 'temple', sky: t > 250 ? 'low_sun' : '', input: t < 8 ? 'idle' : t < 100 ? 'micro' : t < 160 ? (t < 110 ? 'build' : 'idle') : 'micro', x: t, z: -t, place: t < 100 ? 'hangar' : 'wild', tod: 2500 + t * 20 });
  analyze(rec);
  console.log('  ' + summary(rec));
  const frames = [];
  for (const f of rec.frames) { const file = `${OUT}dry_${String(f.i).padStart(2, '0')}.jpg`; await sharp({ create: { width: PW, height: PH, channels: 3, background: { r: 40 + f.i * 15, g: 90, b: 140 } } }).jpeg().toFile(file); frames.push(Object.assign({ file }, f)); }
  const dim = await buildSheet(rec, frames, OUT + 'dry_sheet.png');
  check(fs.existsSync(OUT + 'dry_sheet.png') && dim.w > 1900, `a synthetic sheet: ${OUT}dry_sheet.png (${dim.w} × ${dim.h})`);
  check(rec.gaps.length === 3 && rec.gaps[0].d >= rec.gaps[1].d && rec.frames.length === 12, `the three longest gaps described (${rec.gaps.map(g => Math.round(g.d)).join(', ')} s), twelve frames chosen`);
  check(typeof SS.table([['builder', rec.metrics]]) === 'string', 'the metrics table for the plan');
  console.log(SS.table([['builder', rec.metrics], ['walk', rec.metrics]]));
  console.log(`(${secs()})`);
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
}

// ============================================================================ SHEET_ONLY: a sheet again from a session's JSON and frames
if (SHEET_ONLY) {
  const rec = JSON.parse(fs.readFileSync(`${SHOTS}session_${SHEET_ONLY}.json`, 'utf8'));
  analyze(rec, true);
  const frames = rec.frames.map(f => Object.assign({}, f, { file: f.gone ? null : `${SHOTS}session_${rec.type}_${String(f.i).padStart(2, '0')}.jpg` }));
  await buildSheet(rec, frames, `${SHOTS}session_${rec.type}_sheet.png`);
  fs.writeFileSync(`${SHOTS}session_${rec.type}.json`, JSON.stringify(rec, null, 1));   // (the metrics again: a cut-short session's end is its played time)
  console.log('sheet', `${SHOTS}session_${rec.type}_sheet.png`, summary(rec));
  process.exit(0);
}

// ============================================================================ the browser run
const { chromium } = await import('/home/dev/.npm-global/lib/node_modules/playwright/index.mjs');
const ROUTES = planRoutes();
console.log(`routes (${secs()}): meadow ${JSON.stringify(ROUTES.M)}; builder ${ROUTES.len(ROUTES.builderA).toFixed(0)} + ${ROUTES.len(ROUTES.builderB).toFixed(0)} m; walk ${ROUTES.len(ROUTES.walkA).toFixed(0)} + ${ROUTES.len(ROUTES.walkB).toFixed(0)} m; adventurer ${ROUTES.advA ? ROUTES.len(ROUTES.advA).toFixed(0) : "-"} m to the outpost ${JSON.stringify(ROUTES.outpost)}; landmarks ${ROUTES.landmarks.map(q => q.id).join(',')}`);
let BUILD = ''; try { BUILD = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { BUILD = '?'; }
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const RUN = { renders: [], picEvery: Math.max(1, Math.round(PIC_EVERY / 0.5)), waits: 0, waitS: 0, picReal: [] };
// a-session: a world opened in a page loaded again — the default „Sitzung" (Kreativ · Friedlich) or (adv) a fresh
// Abenteuer world as the create form's „Abenteuer — mit Begegnungen" (band Normal) makes it: Überleben, peaceful, the
// record waiting in VR.Adventure.pendingCreate (adventure.js beforeCreate), the start near its first outpost (first.js)
async function openWorld(adv) {
  await page.goto(DIST);
  for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title')).catch(() => false)) break; }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.autoJump = 'on'; g.settings.wowMoments = true; g.applySettings('*'); });
  if (adv) await ev((seed) => { const A = VR.Adventure; if (A) A.pendingCreate = { at: Date.now(), band: 'normal', enc: 'normal' }; VR.game.createWorld({ name: 'Abenteuer', mode: 'survival', difficulty: 'peaceful', type: 'default', seed: String(seed), cheats: false, kit: true, first: true }); }, SEED);   // (first: made from the start screen — its own start)
  else await ev((seed) => VR.game.createWorld({ name: 'Sitzung', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: String(seed), cheats: true, kit: true }), SEED);
  let inPlay = false;
  for (let i = 0; i < 300 && !inPlay; i++) { await wait(1000); inPlay = await ev(() => !!(VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)).catch(() => false); }
  // (a-session, f-hud's self-review 3: the minimap 4 s after the world starts — its luma sd as test/critic_ux.mjs reads it)
  let mapSd = null;
  if (adv && inPlay) { await wait(4000); mapSd = await ev(() => { const mm = document.getElementById('minimap'); if (!mm || !mm.width) return -1; try { const d = mm.getContext('2d').getImageData(0, 0, mm.width, mm.height).data; let m = 0, m2 = 0, n = 0; for (let i = 0; i < d.length; i += 8) { if (d[i + 3] < 10) continue; const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; m += L; m2 += L * L; n++; } if (!n) return 0; m /= n; return +Math.sqrt(Math.max(0, m2 / n - m * m)).toFixed(1); } catch (e) { return -2; } }).catch(() => -3); }
  const meta = await ev(() => { const g = VR.game, A = VR.Adventure; return { state: g.state, vgen: (g.meta && g.meta.vgen) | 0, type: g.meta && g.meta.type, mode: g.meta && g.meta.mode, adv: !!(A && A.on && A.on()), enc: A && A.enc ? A.enc() : null, advStart: g.meta && g.meta.advStart || null, tod: Math.round(g.env.timeOfDay), preset: g.settings.preset, eventlog: !!VR.EventLog, pos: g.player.pos.map(v => +v.toFixed(1)), W: g.renderer.W, H: g.renderer.H }; });
  meta.mapSd4 = mapSd;
  console.log(`world (${secs()}): ${JSON.stringify(meta)}`);
  if (adv) check(inPlay && meta.adv && meta.enc === 'normal' && meta.advStart && meta.advStart.d >= 150 && meta.advStart.d <= 320, `a fresh Abenteuer world (mit Begegnungen, ${meta.mode}), its start ${meta.advStart && meta.advStart.d} m before the first outpost, ${meta.tod} on the clock`);
  else check(inPlay && meta.vgen >= 11 && meta.type === 'default' && meta.eventlog, `a new default world (the Heartland, vgen ${meta.vgen}) with VR.EventLog, Balanced (${meta.preset}, ${meta.W}×${meta.H})`);
  if (adv && mapSd !== null) check(mapSd > 10, `Abenteuer: the minimap drawn 4 s after the start (luma sd ${mapSd} > 10)`);
  if (!inPlay || !meta.eventlog) { console.log(`--- logs (${logs.length})`); for (const l of logs.slice(0, 20)) console.log(l); await browser.close(); console.log('FAILED ' + Math.max(1, fails)); process.exit(1); }
  // the clock is ours: no animation frames, the renderer only draws when asked; the weather held; uploads boosted; the world's known landmarks
  await ev((lms) => {
    const g = VR.game;
    window.requestAnimationFrame = () => 0;
    if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
    window.__norender = true;
    g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0;
    if (g.renderer.q) g.renderer.q.upload = 24;
    if (VR.EventLog) VR.EventLog.landmarks = lms.filter(q => !['temple', 'citadel', 'isles', 'nova', 'station', 'hills'].includes(q.id));
  }, ROUTES.landmarks);
  await page.evaluate(`(${pageHelpers.toString()})(window)`);
  return meta;
}
const wantWorld = !ONLY || ONLY.includes('builder') || ONLY.includes('walk') || ONLY.includes('pilot');
let META = wantWorld ? await openWorld(false) : null;
const settle = async (maxS, r, rm) => { const t = Date.now(); let s = null; while (Date.now() - t < maxS * 1000) { s = await ev(([r, rm]) => window.__S.pump(r, rm), [r, rm]); if (s.miss === 0 && s.dirty === 0) break; await wait(60); } return s; };

// half a second of play: the world ahead first, then 15 frames, the last drawn and captured (2 Hz; 1 Hz when a picture costs > 1.5 s)
let chunkN = 0, sessionReal0 = Date.now(), overBudget = false;
const REAL_BUDGET = +(process.env.REAL_BUDGET || 5400) * 1000;   // a session's own wall-clock budget: a stall must not cost the run its files (f-flow: 90 min)
async function play(t0, tEnd, untilDone) {
  let last = null;
  for (;;) {
    if (Date.now() - sessionReal0 > REAL_BUDGET) { overBudget = true; const t = (await ev(() => VR.game.time)) - t0; console.log(`  !! the session's real-time budget is spent at ${t.toFixed(0)} s of play`); return { t, last: last || { done: true } }; }
    let s = await ev(() => window.__S.ready(4, 2));
    // (columns missing: up to 20 s; only sections to mesh — a Baustelle keeps rewriting them —: up to 6 s)
    if (s.miss || s.dirty > 8) { const w0 = Date.now(), cap = s.miss ? 20000 : 6000; while ((s.miss || s.dirty > 8) && Date.now() - w0 < cap) { await wait(50); s = await ev(() => window.__S.pump(4, 2)); } RUN.waits++; RUN.waitS += (Date.now() - w0) / 1000; }
    const pic = chunkN++ % RUN.picEvery === 0, c0 = Date.now();
    last = await ev(([n, r]) => window.__S.frames(n, r), [15, pic]);
    if (pic) {
      RUN.renders.push(last.rms); RUN.picReal.push(Date.now() - c0);   // (f-flow: what a drawn half second really costs — the read-back waits for the GPU)
      if (RUN.picReal.length % 30 === 0) { const q = RUN.picReal.slice(-30).sort((a, b) => a - b); console.log(`  (the last 30 pictures: ${q[15]} ms a drawn half second, the median; ${q[29]} the worst)`); }
    }
    const t = last.t - t0;
    if (t >= tEnd - 1e-3 || (untilDone && last.done) || last.state) return { t, last };
  }
}
// a session: its setup, its parts in order, a look round to the end; then its log, samples, metrics, frames and sheet
async function session(type, setup, script) {
  console.log(`== ${type} (${secs()})`);
  const real0 = Date.now(), r0 = RUN.renders.length, w0 = [RUN.waits, RUN.waitS];
  sessionReal0 = real0; overBudget = false;
  const rec = { type, seed: SEED, preset: 'balanced', size: [VW, VH], dur: DUR, build: BUILD, parts: [], notes: setup.notes || [], exclude: [] };
  await ev((o) => { const g = VR.game, p = g.player; p.flying = false; if (o.at) { p.teleport(o.at[0], o.at[1], o.at[2]); } if (o.yaw !== undefined) { p.yaw = o.yaw; p.viewYaw = o.yaw; } if (o.at) p.pitch = 0; if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; } if (o.tod !== undefined) g.env.setTime(o.tod); g.env.rain = 0; g.env.rainTarget = 0; window.__S.pics = []; window.__S.log = []; window.__S.stat = { hops: 0, jumps: 0 }; window.__S.set({ kind: 'idle' }); }, setup);
  const st = await settle(90, 6, 3);
  await ev(() => window.__S.frames(30, false));   // (a second to land on the ground)
  console.log(`  settled ${JSON.stringify(st)} (${secs()})`);
  const start = await ev(() => { const g = VR.game, L = VR.EventLog; return { t: g.time, tod: g.env.timeOfDay, day: g.env.day | 0, cost: Object.assign({}, L.cost), count: L.count, n: L.nSamples }; });
  const t0 = start.t; rec.tod0 = Math.round(start.tod); rec.day = start.day;
  let tNow = 0;
  for (const part of script) {
    if (tNow >= DUR - 0.25 || overBudget) break;
    const P = { name: part.name, de: part.de, t0: +tNow.toFixed(2) };
    if (part.need) {
      const has = await ev(part.need).catch(() => false);
      if (!has || !part.mode) { P.skipped = true; P.why = has ? `${part.name} exists now — script this part (it has no steps yet)` : part.why; P.t1 = P.t0; rec.parts.push(P); console.log(`  · ${part.name}: skipped — ${P.why}`); continue; }
    }
    try {
      await ev((m) => window.__S.set(m), part.mode);
      const r = await play(t0, Math.min(DUR, tNow + (part.max || DUR)), true);
      tNow = r.t; P.t1 = +tNow.toFixed(2); P.status = await ev(() => window.__S.status());
      if (r.last.state) P.why = 'the game left play: ' + r.last.state;
    } catch (e) { P.failed = String(e && e.message || e).slice(0, 300); P.t1 = +tNow.toFixed(2); tNow = (await ev(() => VR.game.time).catch(() => t0 + tNow)) - t0; }
    rec.parts.push(P);
    console.log(`  · ${part.name} ${P.t0}–${P.t1} s${P.failed ? ' FAILED ' + P.failed : ''} ${JSON.stringify(P.status && { stat: P.status.stat, route: P.status.route, B: P.status.B && { phase: P.status.B.phase, ding: P.status.B.ding, tries: P.status.B.tries, whys: P.status.B.whys.slice(-4), site: !!P.status.B.site } })} (${secs()})`);
  }
  if (tNow < DUR - 0.25 && !overBudget) {
    await ev(() => window.__S.set({ kind: 'look', sec: 999, speed: 0.25 }));
    const P = { name: 'linger', de: 'Umsehen bis zum Ende', t0: +tNow.toFixed(2) };
    const r = await play(t0, DUR, false); tNow = r.t; P.t1 = +tNow.toFixed(2); rec.parts.push(P);
  }
  await ev(() => window.__S.set({ kind: 'idle' }));
  const end = await ev(([t0]) => { const g = VR.game, L = VR.EventLog; return { t: g.time, tod: g.env.timeOfDay, events: L.events(0).filter(e => e.t >= t0 - 1e-6), samples: L.samples(t0 - 1e-6), cost: Object.assign({}, L.cost), error: L.error, stat: window.__S.stat, log: window.__S.log, pos: g.player.pos.slice(), regie: VR.Regie && VR.Regie.stats ? VR.Regie.stats(g) : null, acts: VR.RegieActs ? JSON.parse(JSON.stringify(VR.RegieActs.stats)) : null, foes: VR.Foes && VR.Foes.stats ? Object.assign({}, VR.Foes.stats) : null }; }, [t0]);
  rec.tod1 = Math.round(end.tod);
  rec.regie = { stats: end.regie, acts: end.acts, foes: end.foes };   // a-regie: what the Regie started and why its own acts waited
  rec.played = +(end.t - t0).toFixed(2);
  rec.events = end.events.filter(e => e.t - t0 <= DUR + 1e-6).map(e => Object.assign({}, e, { t: +(e.t - t0).toFixed(3) }));
  rec.samples = end.samples.filter(s => s.t - t0 <= DUR + 1e-6).map(s => Object.assign({}, s, { t: +(s.t - t0).toFixed(3) }));
  const c0 = start.cost, c1 = end.cost, fr = c1.frames - c0.frames, sm = c1.samples - c0.samples;
  rec.cost = { frames: fr, msPerFrame: +((c1.ms - c0.ms) / Math.max(1, fr)).toFixed(5), worstMs: +c1.worst.toFixed(3), samples: sm, msPerSample: +((c1.sampleMs - c0.sampleMs) / Math.max(1, sm)).toFixed(4), emits: c1.emits - c0.emits, msPerEmit: +((c1.emitMs - c0.emitMs) / Math.max(1, c1.emits - c0.emits)).toFixed(4), errors: (c1.errors | 0) - (c0.errors | 0), error: end.error || null };
  const rs = RUN.renders.slice(r0).sort((a, b) => a - b);
  const pr = RUN.picReal.slice(r0).sort((a, b) => a - b);
  rec.run = { overBudget, realS: Math.round((Date.now() - real0) / 1000), pictures: rs.length, renderMsMedian: rs.length ? Math.round(rs[rs.length >> 1]) : 0, picRealMsMedian: pr.length ? pr[pr.length >> 1] : 0, picEveryS: PIC_EVERY, waits: RUN.waits - w0[0], waitS: Math.round(RUN.waitS - w0[1]), hops: end.stat.hops, jumps: end.stat.jumps, walkerLog: end.log.slice(-40), end: end.pos.map(v => +v.toFixed(1)) };
  analyze(rec);
  // the twelve frames and the one in the middle of the longest gap
  const gl = rec.metrics.gaps.longest, times = rec.frames.map(f => t0 + f.t).concat([t0 + (gl.a + gl.b) / 2]);
  const pics = await ev((ts) => window.__S.picsAt(ts), times);
  const frames = [];
  for (let k = 0; k < rec.frames.length; k++) {
    const f = rec.frames[k], q = pics[k], file = `${SHOTS}session_${type}_${String(f.i).padStart(2, '0')}.jpg`;
    if (q && q.url) { fs.writeFileSync(file, Buffer.from(q.url.split(',')[1], 'base64')); f.file = file.replace(ROOT, ''); f.pic = +(q.t - t0).toFixed(2); f.occ = q.occ; }
    frames.push(Object.assign({}, f, { file: q && q.url ? file : null }));
  }
  const gq = pics[pics.length - 1];
  if (gq && gq.url) { fs.writeFileSync(`${SHOTS}session_${type}_gap.jpg`, Buffer.from(gq.url.split(',')[1], 'base64')); rec.gapFrame = { t: +(gq.t - t0).toFixed(2), file: `test/shots/session_${type}_gap.jpg` }; }
  if (process.env.ALL) { const all = await ev(() => window.__S.pics.map(q => [q.t, q.url])); fs.mkdirSync(`${SHOTS}session_${type}`, { recursive: true }); all.forEach(([t, u]) => fs.writeFileSync(`${SHOTS}session_${type}/t${String(Math.round((t - t0) * 10)).padStart(5, '0')}.jpg`, Buffer.from(u.split(',')[1], 'base64'))); }
  // a-session: the adventurer's picture every 15 s of play (test/shots/session_adventurer/f_000.jpg …), named by the time
  if (type === 'adventurer' || process.env.EVERY15) {
    const ts = []; for (let k = 0; k * 15 <= rec.played + 0.01; k++) ts.push(t0 + k * 15);
    const q15 = await ev((ts) => window.__S.picsAt(ts), ts), dir = `${SHOTS}session_${type}/`; fs.mkdirSync(dir, { recursive: true });
    rec.every15 = [];
    q15.forEach((q, k) => { if (!q || !q.url) return; const f = `${dir}f_${String(k * 15).padStart(3, '0')}.jpg`; fs.writeFileSync(f, Buffer.from(q.url.split(',')[1], 'base64')); rec.every15.push({ t: k * 15, pic: +(q.t - t0).toFixed(1), occ: q.occ, file: f.replace(ROOT, '') }); });
  }
  await ev(() => { window.__S.pics = []; });
  let sheet = null;
  try { sheet = await buildSheet(rec, frames, `${SHOTS}session_${type}_sheet.png`); } catch (e) { console.log('  !! the sheet: ' + String(e && e.message || e).slice(0, 300)); }
  fs.writeFileSync(`${SHOTS}session_${type}.json`, JSON.stringify(rec, null, 1));
  console.log('  ' + summary(rec));
  console.log(`  gaps: ${rec.gaps.map(g => `${Math.round(g.d)} s ${mmss(g.a)}–${mmss(g.b)} at ${JSON.stringify(g.places)} movers ${g.movers.toFixed(1)} lm ${JSON.stringify(g.landmarks)} sky ${g.sky.toFixed(2)} input ${JSON.stringify(Object.fromEntries(Object.entries(g.inputs).map(([k, v]) => [k, +v.toFixed(2)])))}`).join(' | ')}`);
  console.log(`  cost: ${JSON.stringify(rec.cost)} · run: ${JSON.stringify(Object.assign({}, rec.run, { walkerLog: rec.run.walkerLog.length }))} (${secs()})`);
  check(rec.played >= 290, `${type}: ${rec.played.toFixed(0)} s of play`);
  console.log(`  regie: ${JSON.stringify(rec.regie)}`);
  const occF = frames.filter(f => f.occ > 0.3);
  check(occF.length === 0, `${type}: no sheet frame over 30 % occluded within 1.5 m of the eye (${occF.map(f => f.i + ': ' + Math.round(f.occ * 100) + ' %').join(', ') || 'none'})`);
  check(rec.samples.length >= rec.played * 0.95 - 2 && rec.events.length > 0, `${type}: ${rec.samples.length} samples and ${rec.events.length} events recorded`);
  check(fs.existsSync(`${SHOTS}session_${type}.json`) && !!sheet, `${type}: session_${type}.json and session_${type}_sheet.png written (${frames.filter(f => f.file).length} of 12 frames)`);
  check(rec.cost.errors === 0, `${type}: the log never failed (${rec.cost.errors} errors${rec.cost.error ? ': ' + rec.cost.error.split('\n')[0] : ''})`);
  check(rec.cost.msPerFrame <= 0.05, `${type}: the log costs ${(rec.cost.msPerFrame * 1000).toFixed(1)} µs a frame (≤ 50), ${rec.cost.msPerSample} ms a sample, over ${rec.cost.frames} frames`);
  // f-flow: R50-03's measures and R50-04's line detector over the session's pictures
  const M3 = rec.metrics;
  check(M3.repeat.share <= 0.40, `${type}: the most repeated event ${M3.repeat.name} is ${(M3.repeat.share * 100).toFixed(0)} % of the ${M3.events.n} events (≤ 40)`);
  check(M3.spam.per10 <= 2, `${type}: spam ${M3.spam.n} pair(s), ${M3.spam.per10.toFixed(2)} per 10 minutes (≤ 2)`);
  check(M3.variety.n >= 6, `${type}: ${M3.variety.n} kinds seen (≥ 6): ${M3.variety.kinds.join(', ')}`);
  try {
    const TL = require(ROOT + 'test/trail_lines.js'), files = frames.filter(f => f.file).map(f => f.file).concat(fs.existsSync(`${SHOTS}session_${type}_gap.jpg`) ? [`${SHOTS}session_${type}_gap.jpg`] : []);
    const per = []; for (const f of files) { const r = await TL.measure(f); per.push({ file: f.replace(ROOT, ''), longest: r.longest, segs: r.sky.slice(0, 3) }); }
    rec.trails = { longest: per.reduce((m, q) => Math.max(m, q.longest), 0), per };
    fs.writeFileSync(`${SHOTS}session_${type}.json`, JSON.stringify(rec, null, 1));
    check(rec.trails.longest <= 150, `${type}: no straight constant-width trail segment over 150 px in its ${per.length} pictures (the longest ${rec.trails.longest} px)`);
  } catch (e) { console.log('  !! the line detector: ' + String(e && e.message || e).slice(0, 200)); }
  return rec;
}

const M = ROUTES.M, notes = ['travel by intent (VR.Intent, wave 4 e-ctx) does not exist yet: every walk is done with W — micro-control', 'the vista spawn (t-first, wave 2) is not in this base: the spawn is the Hangar Hall\'s deck', 'weather held clear (zenFreezeWeather) for comparable runs; t-wild\'s animals and t-sky3\'s meteors are not in this base and not hooked'];
const intentPart = { name: 'intent', de: 'Reise per Absicht', need: () => !!(window.VR && VR.Intent && VR.Intent.start), why: 'VR.Intent fehlt (Welle 4, e-ctx): gegangen wird mit W' };
const funkePart = { name: 'funke', de: 'Funke fragen', need: () => !!(window.VR && VR.Funke), why: 'VR.Funke fehlt (Welle 4, e-funke)' };
const recs = {};
try {
  if (!ONLY || ONLY.includes('builder')) recs.builder = await session('builder', { tod: 2500, notes }, [
    { name: 'spawn', de: 'Ankunft: Blick in die Halle', mode: { kind: 'look', sec: 8, speed: 0.4 }, max: 8 },
    intentPart,
    { name: 'meadow', de: 'Zur Flusswiese', mode: { kind: 'walk', route: ROUTES.builderA }, max: 200 },
    { name: 'bauhand', de: 'Bauhand: Bungalow', mode: { kind: 'bauhand', ding: 'h:6', name: 'Bungalow', target: [M.x, M.y, M.z] }, max: 80 },
    funkePart,
    { name: 'showcase', de: 'Schaufenster: Rundflug zur goldenen Stunde', need: () => !!(window.VR && VR.Showcase && VR.Showcase.start), why: 'VR.Showcase fehlt (a-builder)', mode: { kind: 'showcase', sec: 30 }, max: 32 },   // a-builder
    { name: 'walkon', de: 'Weiter: Feldweg, Brücke', mode: { kind: 'walk', route: ROUTES.builderB }, max: DUR },
  ]);
  if (!ONLY || ONLY.includes('walk')) recs.walk = await session('walk', { tod: 9200, at: [10.5, 81, 60.5], yaw: 0, notes }, [
    { name: 'plaza', de: 'Torplatz: umsehen', mode: { kind: 'look', sec: 8, speed: 0.35 }, max: 8 },
    intentPart,
    { name: 'to_nova', de: 'Weg nach Nova Haven', mode: { kind: 'walk', route: ROUTES.walkA }, max: 200 },
    { name: 'city_plaza', de: 'Stadtplatz: umsehen', mode: { kind: 'look', sec: 15, speed: 0.45 }, max: 15 },
    { name: 'city', de: 'Durch die Stadt', mode: { kind: 'walk', route: ROUTES.walkB }, max: DUR },
  ]);
  // e-ctx · the pilot (erlebnis §7), Herzwelt's part: trips by intent — V on the citadel from the Gate Plaza, then the isles,
  // then Nova Haven; the orbit, Basalt and Heimkehr from space wait for u-ascent / u-moons1 (their minutes leave the targets)
  if (ONLY && ONLY.includes('pilot')) recs.pilot = await session('pilot', { tod: 5200, at: [0.5, 81, 48.5], yaw: 0.85, notes: ['e-ctx: the Herzwelt part of the pilot session — trips by intent (VR.Intent): the citadel, the isles, Nova Haven; orbit, Basalt and Heimkehr from space are later waves'] }, [
    { name: 'plaza', de: 'Torplatz: umsehen', mode: { kind: 'look', sec: 6, speed: 0.3 }, max: 6 },
    { name: 'to_citadel', de: 'Reise zur Turmzitadelle', need: () => !!(window.VR && VR.Intent && VR.Intent.start), why: 'VR.Intent fehlt (Welle 4, e-ctx)', mode: { kind: 'intent', target: 'citadel' }, max: 150 },
    { name: 'citadel', de: 'An der Zitadelle: umsehen', mode: { kind: 'look', sec: 10, speed: 0.3 }, max: 10 },
    { name: 'to_isles', de: 'Reise zu den Himmelsinseln', need: () => !!(window.VR && VR.Intent && VR.Intent.start), why: 'VR.Intent fehlt', mode: { kind: 'intent', target: 'isles' }, max: 150 },
    { name: 'isles', de: 'Bei den Inseln: umsehen', mode: { kind: 'look', sec: 8, speed: 0.3 }, max: 8 },
    { name: 'to_nova', de: 'Reise nach Nova Haven', need: () => !!(window.VR && VR.Intent && VR.Intent.start), why: 'VR.Intent fehlt', mode: { kind: 'intent', target: 'nova' }, max: DUR },
  ]);
  // a-story · the adventurer (erlebnis §7; plan docs/superpowers/plans/2026-10-29-a-story.md): an Abenteuer world (Begegnungen normal), the story on —
  // Funke offers chapter 1 in the Hangar Hall after 20 s of calm and the adventurer takes it ([V]); the ways to Nova Haven and through the city (c1.b2 out
  // there, 5 min after the first). Only when asked (ONLY=adventurer; DUR=600 for ten minutes: two beats)
  if (ONLY && ONLY.includes('adventurer')) {
    // a-session (plan docs/superpowers/plans/2026-10-31-a-session.md §2.1): a real new adventurer — a fresh Abenteuer world
    // (mit Begegnungen), its own start 200–300 m before the first outpost in the morning; a look at the arrival, then
    // Funke's way to the outpost, one stray fought, the others calmed, the Lichtleiter at the beacon, the moment; the
    // story's offer taken when Funke makes it; a look round, then on to the nearest village
    META = await openWorld(true);
    await ev(() => { window.__S.acceptStory = true; });
    recs.adventurer = await session('adventurer', { notes: ['a-session: a fresh Abenteuer world (mit Begegnungen, band Normal) at its own start ' + JSON.stringify(META.advStart) + ', ' + META.tod + ' on the clock; the minimap 4 s after the start: luma sd ' + META.mapSd4, 'a-story: the story offered by Funke and taken at once', 'a-session: Funke\'s way to the outpost, one stray fought (clicks), the others calmed ([V] and the ring), the Lichtleiter, the moment; then the nearest village'] }, [
      { name: 'arrive', de: 'Ankunft: umsehen', mode: { kind: 'look', sec: 8, speed: 0.12 }, max: 8 },
      { name: 'to_outpost', de: 'Funkes Weg: [V] zum Außenposten', mode: { kind: 'intent', prefix: 'out:', direct: true }, max: 120 },
      { name: 'to_outpost2', de: 'Zu Fuß: die letzten Meter', mode: { kind: 'walk', toSite: 26 }, max: 60 },
      { name: 'outpost', de: 'Am Außenposten: kämpfen, beruhigen, Lichtleiter', mode: { kind: 'outpost' }, max: 150 },
      { name: 'after', de: 'Befreit: umsehen', mode: { kind: 'look', sec: 15, speed: 0.3 }, max: 15 },
      { name: 'onward', de: 'Weiter: [V] zum nächsten Dorf', mode: { kind: 'intent', pick: 'village', direct: true }, max: DUR },
      { name: 'onward2', de: 'Zu Fuß weiter', mode: { kind: 'walk', toVillage: 12 }, max: DUR },
    ]);
    await ev(() => { window.__S.acceptStory = false; });
    const R = recs.adventurer, st = R && R.metrics ? R.metrics : null;
    if (st) {
      const beats = R.events.filter(e => e.kind === 'story' && e.src !== 'offer').length;
      check(beats / (R.played / 600) >= 1, `adventurer: ${beats} story beat(s) in ${R.played.toFixed(0)} s (≥ 1 per 10 min)`);
      check(st.gaps.longest.d <= 60, `adventurer: the longest gap ${st.gaps.longest.d.toFixed(0)} s (≤ 60)`);
      const op = (R.parts.find(q => q.name === 'outpost') || {}).status, ad = op && op.ad;
      check(!!ad && ad.fought >= 1 && ad.calmed >= 1 && ad.freed, `adventurer: at the outpost — ${ad ? ad.fought : 0} fought (${ad ? ad.hits : 0} hits), ${ad ? ad.calmed : 0} calmed, ${ad && ad.freed ? 'freed' : 'not freed'} (${ad ? JSON.stringify(ad.fallbacks) : '-'})`);
      const fx = ad && ad.fx;
      if (fx && fx.n) check(fx.cover / fx.n <= 0.1, `adventurer: Funke or its bubble over the machine in ${fx.cover} of ${fx.n} fight samples (≤ 10 %; the worst overlap ${fx.worst})`);
    }
  }
} catch (e) { check(false, 'the sessions ran (' + String(e && e.stack || e).slice(0, 600) + ')'); }

// ============================================================================ the log's cost: Very Low and High — on · sampler off · off
if (!process.env.NO_BENCH && (Date.now() - T0) / 1000 < 4500) {   // (the bench only while the run has time left: the sessions' files come first)
  const bench = {};
  for (const preset of ['potato', 'high']) {
    try {
      await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
      await settle(25, 4, 0);
      bench[preset] = await ev(() => {
        const g = VR.game, L = VR.EventLog; window.__S.set({ kind: 'look', sec: 9999, speed: 0.2 });
        const one = (on, samp, n) => { L.on = on; L.sampling = samp; const c0 = Object.assign({}, L.cost); let loop = 0; for (let i = 0; i < n; i++) { window.__S.control(1 / 30); const t = performance.now(); g.last = t - 1000 / 30; g.loop(t); loop += performance.now() - t; } const c1 = L.cost, f = c1.frames - c0.frames; return { loop: loop / n, log: f ? (c1.ms - c0.ms) / f : 0, samples: c1.samples - c0.samples, sample: c1.samples > c0.samples ? (c1.sampleMs - c0.sampleMs) / (c1.samples - c0.samples) : 0 }; };
        const R = { on: [], samplerOff: [], off: [] };
        for (let k = 0; k < 2; k++) { R.on.push(one(true, true, 150)); R.samplerOff.push(one(true, false, 150)); R.off.push(one(false, false, 150)); }
        L.on = true; L.sampling = true; window.__S.set({ kind: 'idle' });
        const avg = (A, f) => +(A.reduce((s, q) => s + q[f], 0) / A.length).toFixed(4);
        const out = {}; for (const k in R) out[k] = { loopMs: avg(R[k], 'loop'), logMs: avg(R[k], 'log'), sampleMs: avg(R[k], 'sample') };
        return out;
      });
      console.log(`  bench ${preset}: ${JSON.stringify(bench[preset])} (${secs()})`);
    } catch (e) { console.log(`  !! bench ${preset}: ${String(e && e.message || e).slice(0, 200)}`); }
  }
  for (const k in recs) { recs[k].bench = bench; fs.writeFileSync(`${SHOTS}session_${k}.json`, JSON.stringify(recs[k], null, 1)); }
  for (const p in bench) check(bench[p].on.logMs <= 0.05, `${p}: the log ${(bench[p].on.logMs * 1000).toFixed(1)} µs a frame with its sampler, ${(bench[p].samplerOff.logMs * 1000).toFixed(1)} µs without (frame ${bench[p].on.loopMs} ms on, ${bench[p].off.loopMs} ms off)`);
}
// ============================================================================ f-flow (R50-04): the contrail itself
// after the sessions and the bench: Balanced again, 960 × 540, 13:30, where the walk ended, the eye 11° up; a low pass
// forced across the view (the life director's 'flyover', its contrail); three pictures — 0.5, 2.5 and 4.5 s after its
// nearest point (test/shots/session_trail_1..3.png) — and the line detector over them (no constant-width segment > 150 px)
if (!process.env.NO_TRAIL) {
  try {
    await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.applySettings('*'); window.__S.set({ kind: 'idle' }); });
    await page.setViewportSize({ width: 960, height: 540 });
    await ev(() => { const g = VR.game, p = g.player; window.dispatchEvent(new Event('resize')); p.pitch = 0.2; g.env.setTime(7500); g.env.rain = 0; g.env.rainTarget = 0; });
    await settle(40, 6, 3);
    await ev(() => window.__S.frames(30, false));
    const f = await ev(() => { const D = VR.game.lifeDirector; if (!D) return { ok: false }; D.update(0.01); const ok = !!D.force('flyover', { k: 777001 }); return { ok, tag: ok ? 'ld777001' : null }; });
    const lead = () => ev((tag) => { const T = VR.game.traffic, s = T.ships.find(z => z.tag === tag && !z.wing); return s ? { t: +s.t.toFixed(3), arch: s.arch, d: +Math.hypot(s.pos[0] - VR.game.player.pos[0], s.pos[2] - VR.game.player.pos[2]).toFixed(0) } : { none: true, pending: T.pending | 0 }; }, f.tag);
    let q = { none: true };
    for (let i = 0; i < 120 && f.ok && q.none; i++) { q = await lead(); if (q.none) { await wait(500); await ev(() => window.__S.frames(2, false)); } }
    for (let i = 0; i < 90 && f.ok && !q.none && q.t < 0.5; i++) { await ev(() => window.__S.frames(10, false)); q = await lead(); }
    const shots = [], TL = require(ROOT + 'test/trail_lines.js');
    for (let k = 1; k <= 3 && f.ok && !q.none; k++) {
      await ev((n) => window.__S.frames(n, false), k === 1 ? 14 : 59);   // (the count from here: the page has no k)
      const url = await ev(() => { const g = VR.game; window.__norender = false; const t0 = performance.now(); g.last = t0 - 1000 / 30; g.loop(t0); window.__norender = true; try { g.renderer.gl.finish(); } catch (e) { /* none */ } const src = g.canvas || document.getElementById('gl'), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c.toDataURL('image/png'); });
      const file = `${SHOTS}session_trail_${k}.png`; fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      const r = await TL.measure(file); shots.push({ file: file.replace(ROOT, ''), longest: r.longest, segs: r.sky.slice(0, 3).map(s => `${s.len} px ${s.deg}° w${s.width}`) });
    }
    console.log(`  the contrail: ${JSON.stringify({ forced: f, lead: q, shots })} (${secs()})`);
    check(shots.length === 3 && shots.every(s => s.longest <= 150), `the contrail of a forced low pass: ${shots.length} pictures, its longest straight constant-width segment ${shots.length ? Math.max(...shots.map(s => s.longest)) : '-'} px (≤ 150)`);
  } catch (e) { console.log('  !! the contrail pictures: ' + String(e && e.message || e).slice(0, 300)); }
}
if (Object.keys(recs).length) console.log('\n' + SS.table(Object.entries(recs).map(([k, r]) => [k, r.metrics])));
// e-access (waves §6.6): the targets as a release gate — SESSION_GATE=1 (the release lane, test/regress.sh R9_RELEASE=1):
// the builder must meet every E§7 target (FAILED otherwise), the adventurer is warned about
if (process.env.SESSION_GATE) {
  const G = SS.gate(Object.fromEntries(Object.entries(recs).map(([k, r]) => [k, r.verdict])));
  for (const l of G.lines) console.log('  ' + (l.startsWith('warn') && !l.endsWith('✓') ? '⚠ ' : '') + l);
  check(G.fails === 0, `the release gate: ${G.fails} gated session(s) short of the targets, ${G.warns} warned`);
}
console.log(`--- logs (${logs.length})`); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => l.startsWith('[pageerror]')), `no page error (${logs.filter(l => l.startsWith('[pageerror]')).length})`);
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

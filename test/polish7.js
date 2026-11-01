// f-polish7 — the open items of o-seamless2, o-wander2, f-polish6 (docs/superpowers/plans/2026-11-01-f-polish7.md):
//  1 · the caravan's seat: the canopy only a fringe at the frame's top, the road and the land fill the view (a ray cast
//      through the seat model's voxels from the rider's eye, as journey.mjs looks: yaw +0.35, pitch −0.07, 70°, 16:9)
//  2 · the Himmelsleiter's space phase: the planet's limb in view until ≈ 62 %, the station from 72 %, the black gap short
//  3 · the Wanderregisseur on Very Low: ≤ 0.05 ms a frame, no frame with a big staging search (getBlock calls a frame)
//      — a forest of trunks, leaves and tall grass, a 2-minute walk (node)
//  4 · moments in woods staged on open ground (no trunk, no low leaves, little tall plants about the figure; the line to
//      its head free of leaves and plants' lower halves, to its feet free of solids); animals and the scrap ≥ 6 % of the frame
//  5 · R56-13: the held block on Very Low — each face's tint toward its grey (First2.faceTint)
//   bash test/wt_run.sh polish7.js 300
const V = require('./load_shared.js');
const fs = require('fs');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['voxmodels', 'lifekit', 'lifedirector', 'wander', 'journey_core', 'first2']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const K = V.JourneyCore, W = V.Wander, VM = V.VOXMODELS;

console.log('1 · the caravan seat');
{
  // the old seat model (o-seamless2: the canopy cleared over the front half only)
  const old = () => { const m = VM.life_cart(), gr = m.parts.body.grid; for (let y = 7; y < gr.sy; y++) for (let z = 0; z <= 12; z++) for (let x = 0; x < gr.sx; x++) gr.c[gr.i(x, y, z)] = 0; return m; };
  const view = (m) => {
    const gr = m.parts.body.grid, s = 1.35 / 8, S = K.SEAT;
    const eye = [gr.ox + S.side / s, S.eye / s, gr.oz - S.fwd / s];   // (model voxels: +x right, −z ahead, y over the floor)
    const a = 0.35, p = -0.07, f = [-Math.sin(a) * Math.cos(p), Math.sin(p), -Math.cos(a) * Math.cos(p)], r = [Math.cos(a), 0, -Math.sin(a)];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]; if (u[1] < 0) { u[0] = -u[0]; u[1] = -u[1]; u[2] = -u[2]; }
    const tv = Math.tan(35 * Math.PI / 180), th = tv * 16 / 9, NX = 96, NY = 54;
    let cart = 0, top = 0, topHigh = 0, lowOpen = 0, low = 0;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const sx = ((i + 0.5) / NX * 2 - 1) * th, sy = (1 - (j + 0.5) / NY * 2) * tv;
      const d = [f[0] + r[0] * sx + u[0] * sy, f[1] + r[1] * sx + u[1] * sy, f[2] + r[2] * sx + u[2] * sy], L = Math.hypot(d[0], d[1], d[2]);
      let hit = -1;
      for (let t = 0.3; t < 40; t += 0.2) {
        const x = Math.floor(eye[0] + d[0] / L * t), y = Math.floor(eye[1] + d[1] / L * t), z = Math.floor(eye[2] + d[2] / L * t);
        if (x < 0 || y < 0 || z < 0 || x >= gr.sx || y >= gr.sy || z >= gr.sz) { if (y >= gr.sy || y < 0) break; continue; }
        if (gr.c[gr.i(x, y, z)]) { hit = y; break; }
      }
      if (hit >= 0) cart++;
      if (hit >= 9) { top++; if (j < NY * 0.2) topHigh++; }
      if (j >= NY / 2) { low++; if (hit < 0) lowOpen++; }
    }
    const n = NX * NY;
    return { cart: +(cart / n).toFixed(3), canopy: +(top / n).toFixed(3), fringe: top ? +(topHigh / top).toFixed(2) : 1, lowOpen: +(lowOpen / low).toFixed(3) };
  };
  check(typeof K.cartSeat === 'function', 'K.cartSeat (the seat model) exists');
  const b = view(old()), a = K.cartSeat ? view(K.cartSeat(VM.life_cart())) : null;
  console.log('    before ' + JSON.stringify(b) + ' · after ' + JSON.stringify(a));
  if (a) {
    check(a.canopy > 0.01 && a.canopy <= 0.09 && a.fringe >= 0.85, 'the canopy only a fringe at the frame\'s top (' + (a.canopy * 100).toFixed(1) + ' % of the frame, ' + (a.fringe * 100).toFixed(0) + ' % of it in the top 20 %)');
    check(a.cart <= 0.3 && a.lowOpen >= 0.55, 'the road and the land fill the view: the cart ' + (a.cart * 100).toFixed(1) + ' % of the frame, the lower half ' + (a.lowOpen * 100).toFixed(0) + ' % open');
  }
}

console.log('2 · the Himmelsleiter\'s space phase');
{
  check(typeof K.liftFov === 'function' && typeof K.dip === 'function', 'K.liftFov, K.dip');
  const p0 = -0.47, D2R = Math.PI / 180;
  let limbTo = 0, stationFrom = null, jump = 0, prev = K.liftLook(0, p0);
  for (let k = 0; k <= 1.0001; k += 0.01) {
    const pt = K.liftLook(k, p0, K.dipAt(k)), fov = K.liftFov ? K.liftFov(k, 70 * D2R) : 70 * D2R, dip = K.dipAt(k);
    jump = Math.max(jump, Math.abs(pt - prev)); prev = pt;
    const bottom = pt - fov / 2, topE = pt + fov / 2;
    if (-dip >= bottom + 0.04 && -dip <= topE - 0.04 && (k < 0.15 || -dip <= pt) && limbTo >= k - 0.0101) limbTo = k;   // (in view; past the switch's first 15 % in the lower half)
    if (stationFrom === null && Math.PI / 2 <= topE - 0.03) stationFrom = k;
  }
  console.log('    the limb in view to ' + (limbTo * 100).toFixed(0) + ' %, the station from ' + (stationFrom * 100).toFixed(0) + ' %, the largest step ' + jump.toFixed(3) + ' rad / 1 %');
  check(limbTo >= 0.6, 'the planet\'s limb in view (the lower half) until ≥ 60 % of the space phase (' + (limbTo * 100).toFixed(0) + ' %; was 18 %, the station from 37 % as a dot)');
  check(stationFrom !== null && stationFrom <= 0.72 && stationFrom - limbTo <= 0.1, 'the station in view from ≤ 72 % (' + (stationFrom * 100).toFixed(0) + ' %), the gap between ≤ 10 % (≈ 3 s, the tether\'s lights lead up)');
  check(jump < 0.13 && Math.abs(K.liftLook(0, p0) - p0) < 1e-9 && K.liftLook(1, p0) > 1.2, 'continuous (your pitch at the switch; a step ≤ 0.13 rad per 1 %), the berth looked up at (' + K.liftLook(1, p0).toFixed(2) + ' rad)');
  const src = fs.readFileSync(__dirname + '/../src/main/journey.js', 'utf8');
  check(/K\.liftFov\(ks/.test(src) && /K\.dip\(alt/.test(src) && /function tetherUp/.test(src) && /tetherUp\(X, W, H, view/.test(src) && /ks > 0\.55 \? H \* 0\.018/.test(src), 'journey.js: the look and the fov from the core, the tether\'s lights up, the station a lit wheel once in view');
}

// ---------------------------------------------------------------- a forest for the director
const R = V.R, ST = (n) => R.byName[n].defaultState, GR = ST('grass_block'), LOG = ST('oak_log'), LEAF = ST('oak_leaves'), TG = ST('short_grass'), DIRT = ST('dirt');
const hh = (x, z, s) => { let v = (x * 374761393 + z * 668265263 + s * 982451653) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
const trunk = (x, z) => (((x % 5) + 5) % 5 === 0 && ((z % 5) + 5) % 5 === 0 && hh(x, z, 1) < 0.7 && !(x > 40 && x < 52 && z > -6 && z < 10));   // (a clearing at x 40…52)
let gets = 0;
const world = { getBlock(x, y, z) { gets++; if (y < 64) return DIRT; if (y === 64) return GR; if (trunk(x, z) && y < 70) return LOG;
  if (y >= 67 && y <= 71) { for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (trunk(x + dx, z + dz) && (y > 67 || (dx * dx + dz * dz <= 1))) return LEAF; }
  if (y === 65 && hh(x, z, 2) < 0.35) return TG; return 0; }, topAt(x, z) { return trunk(x, z) ? 71 : 64; } };
const occ = (x, y, z) => { const b = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); if (!b) return 0; const f = R.T.flags[b], F = V.F; if (f & F.LEAVES) return 1; if ((f & F.SOLID) && !(f & F.REPLACE)) return 2; return (f & (F.PLANT | F.REPLACE)) ? 1 : 0; };
function walk(preset, secs) {
  const g = { meta: { seed: 4242, id: 'p7' }, dim: 'overworld', state: 'play', time: 0, settings: { preset, wander: true, fov: 70 }, world,
    player: { pos: [0.5, 65, 2.5], yaw: -Math.PI / 2, flying: false, inv: { add() {} } }, env: { timeOfDay: 6000, E: {}, wx: null }, ui: { screen: null }, entities: null };
  const D = new W.Actor(g); gets = 0;
  const dt = 1 / 60, N = Math.round(secs * 60); let tot = 0, mx = 0, mxGets = 0; const fr = [];
  const staged = [];
  const st0 = D.start.bind(D);
  D.start = function (kind, k, force) { const m = st0(kind, k, force); if (m && m.pos) staged.push({ kind, pos: m.pos.slice(), eye: D.eye.slice() }); return m; };
  for (let i = 0; i < N; i++) {
    g.time += dt; g.player.pos[0] += 1.4 * dt; g.player.pos[2] = 2.5 + Math.sin(g.time * 0.05) * 6;
    const g0 = gets, t0 = performance.now(); D.update(dt); const e = performance.now() - t0; tot += e; fr.push(e); if (e > mx) mx = e; if (gets - g0 > mxGets) mxGets = gets - g0;
  }
  fr.sort((a, b) => a - b); const keep = fr.slice(0, Math.floor(N * 0.99));
  return { ms: tot / N, trim: keep.reduce((a, b) => a + b, 0) / keep.length, p99: fr[Math.floor(N * 0.99)], max: mx, maxGets: mxGets, started: D.st.started, quiet: D.st.quiet, beats: D.st.beats | 0, staged, D };
}

console.log('3 · the Wanderregisseur\'s cost (a forest, a 2-minute walk, node)');
{
  walk('potato', 20); walk('high', 20);   // (warm-up)
  const vl = walk('potato', 120), hi = walk('high', 120);
  console.log(`    Very Low ${vl.ms.toFixed(4)} ms a frame (without the slowest 1 %: ${vl.trim.toFixed(4)}, p99 ${vl.p99.toFixed(3)}, max ${vl.max.toFixed(2)} ms, ${vl.maxGets} getBlock), ${vl.started} moments, ${vl.beats} beats · High ${hi.ms.toFixed(4)} ms (max ${hi.max.toFixed(2)}, ${hi.maxGets} getBlock), ${hi.started} moments`);
  check(vl.trim <= 0.05, 'Very Low: the director ≤ 0.05 ms a frame (' + vl.trim.toFixed(4) + ' ms without the slowest 1 % — the machine\'s GC and load; all: ' + vl.ms.toFixed(4) + ')');
  check(vl.maxGets <= 400, 'Very Low: no frame with a big staging search (≤ 400 getBlock a frame: ' + vl.maxGets + ' — the search spread over frames, W.BUDGET; before: 4986)');
  check(hi.maxGets <= 800, 'High: ≤ 800 getBlock a frame (' + hi.maxGets + '; before: 5547)');
  check(vl.started >= 3 && hi.started >= 3, 'moments still start in the woods (' + vl.started + ' / ' + hi.started + ')');
  check(W.EVERY[0] >= 2 && W.BUDGET[0] <= 4, 'Very Low: the bookkeeping every ' + W.EVERY[0] + ' frames, ' + W.BUDGET[0] + ' candidates a frame');

  console.log('4 · staged on open ground, big enough');
  const all = vl.staged.concat(hi.staged);
  let open = 0, lines = 0; const bad = [];
  for (const s of all) {
    const ok = W.openAt(occ, s.pos[0], s.pos[1], s.pos[2]); if (ok) open++;
    const fh = W.figH(s.kind), hd = [s.pos[0], s.pos[1] + Math.min(1.4, fh * 0.75), s.pos[2]], ft = [s.pos[0], s.pos[1] + Math.min(0.35, fh * 0.3), s.pos[2]];
    const soft = (x, y, z) => { const o = occ(x, y, z); return o === 2 || (o === 1 && (world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === LEAF || y - Math.floor(y) < 0.5)); };
    const ln = W.clearLine(soft, s.eye, hd) && W.clearLine((x, y, z) => occ(x, y, z) === 2, s.eye, ft); if (ln) lines++;
    if (!ok || !ln) bad.push(s.kind + '@' + s.pos.map(Math.round).join(','));
  }
  check(all.length >= 6 && open === all.length && lines === all.length, `every staged moment on open ground (${open}/${all.length}), its head in sight past trunks, leaves, tall grass, its feet past trunks (${lines}/${all.length})${bad.length ? ' — ' + bad.slice(0, 4).join(' ') : ''}`);
  const dd = all.map(s => Math.hypot(s.pos[0] - s.eye[0], s.pos[2] - s.eye[2]));
  check(dd.every(d => d >= 7.9 && d <= 15.1), 'within 8–15 m (' + dd.map(d => d.toFixed(0)).join(' ') + ')');
  const ht = (n) => { const m = VM[n](); let hy = 0; for (const p in m.parts) { const L = (m.layout && m.layout[p]) || [0, 0, 0]; hy = Math.max(hy, m.parts[p].grid.sy + Math.max(0, L[1] - m.parts[p].grid.oy)); } return hy / (m.unit || 16); };
  const real = { pet: ht('life_dog') * W.STAGE.animal, crossing: W.figH('crossing'), scrap: ht('wander_scrap') * W.SCRAP_S };   // (the fox's model is wildlife.js's, not loaded here: its 0.7 m)
  const rows = Object.keys(real).map(n => { const R2 = W.stageRange(W.figH(n)); return [n, real[n], R2[1], W.share(real[n], R2[1])]; });
  console.log('    ' + rows.map(r => `${r[0]} ${r[1].toFixed(2)} m drawn, staged ≤ ${r[2].toFixed(1)} m → ${(r[3] * 100).toFixed(1)} %`).join(' · '));
  check(rows.every(r => r[3] >= 0.06) && W.STAGE.animal > 1.35, 'the animals (drawn × ' + W.STAGE.animal + ', was 1.35) and the map scrap ≥ 6 % of the frame\'s height where staged (their drawn heights)');
  check(ht('wander_scrap') > 0.8, 'the map scrap stands pinned to a stake (' + ht('wander_scrap').toFixed(2) + ' m, was flat on the ground)');
  const wsrc = fs.readFileSync(__dirname + '/../src/main/wander.js', 'utf8');
  check(/4\.5 \+ i \* 1\.2/.test(wsrc), 'the crossing starts 4.5 m to the side (in the frame as it starts; was 9 m)');
}

console.log('5 · R56-13: the held block on Very Low');
{
  const F = V.First2;
  check(typeof F.faceTint === 'function' && F.HAND_KEEP_VL <= 0.5, 'First2.faceTint, keep ' + F.HAND_KEEP_VL);
  const sat = (c) => (Math.max(...c) - Math.min(...c)) / Math.max(...c);
  // a grass top (grey texture × green tint), a sandstone face (colour in the texture), a grass side (the mask 30 %)
  const A = [0.5, 0.5, 0.5, 1, 0.78, 0.62, 0.36, 1, 0.38, 0.27, 0.17, 0.3];
  const cases = [[0, [0.45, 0.85, 0.3], -1], [1, [1, 1, 1], -1], [2, [0.45, 0.85, 0.3], -1]];
  const out = cases.map(([l, t, sh]) => { const k = sh < 0 ? A[l * 4 + 3] : 1, c0 = [0, 1, 2].map(i => A[l * 4 + i] * (1 + (t[i] - 1) * k)), n = F.faceTint(A, l, t, sh, F.HAND_KEEP_VL), c1 = [0, 1, 2].map(i => A[l * 4 + i] * (1 + (n[i] - 1) * k)); return [sat(c0), sat(c1)]; });
  console.log('    the faces\' saturation: ' + out.map(o => o[0].toFixed(2) + ' → ' + o[1].toFixed(2)).join(' · '));
  check(out.every(o => o[1] <= o[0] * 0.62 + 0.01), 'each face ≥ 38 % less saturated (its own tint toward its grey)');
  const esrc = fs.readFileSync(__dirname + '/../src/main/entities.js', 'utf8');
  check(/vlHand\(mesh\)/.test(esrc) && /drawMesh\(r, p, vlm \|\| mesh/.test(esrc) && /hT = !vlm/.test(esrc), 'entities.drawHand: Very Low draws the per-face mesh (no new program; the lights\' tint only as the fallback)');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

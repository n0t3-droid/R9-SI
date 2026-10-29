// Die Ankunft (f-arrival; plan docs/superpowers/plans/2026-10-23-f-arrival.md; review docs/reviews/v0.49.md R50-02,
// R50-06) — node only, real blocks where the eye is the judge:
//   1 · the floating tree tops: no leaf in the wow vistas' view cones of seeds 53 and 4242 floats — a leaf with no leaf,
//       log or solid block among its six neighbours, or a leaf group of up to 12 with none of them touching a log or the
//       ground (vgen 13; vgen 12's counted, the before)
//   2 · old worlds keep every chunk: vgen 12's chunks under those cones (seed 53) hash as pinned before this front touched
//       the generator (vgen 13's own pin: test/gen_same.js EXPECT13)
//   3 · the arrival a new world opens on (the worker's records VR.Vista.arrivals → VR.First.pick → its camera), measured
//       with rays through the generated chunks (block by block to 140 blocks and in the landmark's footprint, the land's
//       surface beyond; the landmark = its own blocks above its base): the landmark ≥ 8 % of the frame, ≤ 10 % of it
//       hidden, nothing within 6 m in the frame's upper half — seeds 53, 4242, 31337, 7 (the before: vgen 12, t-first's
//       pick by score, the vista's own composition)
//   4 · VR.First.pick: the sight-ok wow vista with the best score; none ok → the best score; no records → none
//   5 · Heimkehr's facing (VR.Travel.facing): at Herzwelt's spawn of seed 4242 (the Hangar Hall, its craft 2 m behind
//       the pad) the view leaves the craft and the nearest geometry in the frame's centre third is ≥ 8 m away (the
//       ground under the feet not counted); a wall 2 m ahead turns the view; a vista's walk faces its view, at its pitch
//   6 · (CAMS=<file.json> only) the cameras test/first.mjs read from the pages, measured as in 3
//   bash test/wt_run.sh arrival.js 1800        (SEEDS=53,4242,… the arrival's seeds · ONLY=1,2,… some parts)
require('./dom_stub.js');
const V = require('./load_shared.js');
global.performance = global.performance || require('perf_hooks').performance;
for (const f of ['i18n.js', 'lang_en.js', 'lang_de.js', 'settings_reg.js', 'skybodies.js', 'weather.js', 'env.js', 'klang.js', 'audio.js', 'wowmoment.js', 'first.js', 'travel.js']) { try { require('../src/main/' + f); } catch (e) { console.log('  (' + f + ': ' + e.message + ')'); } }
const R = V.R, F = V.F, RT = R.T, LAND = V.Land, VI = V.Vista, FI = V.First, SEA = V.C.SEA;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, on = (k) => !ONLY || ONLY.includes(String(k));
const SEEDS = (process.env.SEEDS || '53,4242,31337,7').split(',').map(Number);
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const DEG = Math.PI / 180;
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const hx = (v) => v.toString(16).padStart(8, '0');
const nameOf = (s) => (s ? R.types[RT.type[s]].name : 'air');
const isLeaf = (s) => !!(s && (RT.flags[s] & F.LEAVES));
const isLog = (s) => !!s && /_log$|_wood$|_stem$|hyphae$/.test(nameOf(s));
const holds = (s) => { if (!s || isLeaf(s)) return false; const f = RT.flags[s]; return isLog(s) || !!((f & F.OPAQUE) || ((f & F.SOLID) && !(f & F.PLANT))); };
const hits = (s) => { if (!s) return false; const f = RT.flags[s]; return !!((f & (F.OPAQUE | F.LEAVES | F.FLUID)) || ((f & F.SOLID) && !(f & F.PLANT))); };
function world(g) {
  const CH = new Map();
  const chunk = (cx, cz) => { const k = cx * 65536 + cz; let c = CH.get(k); if (!c) { c = g.generate(cx, cz).blocks; CH.set(k, c); if (CH.size > 1600) CH.delete(CH.keys().next().value); } return c; };
  const blockAt = (x, y, z) => (y < 0 || y > 255 ? 0 : chunk(x >> 4, z >> 4)[(y << 8) | ((z & 15) << 4) | (x & 15)]);
  const SURF = new Map();
  const surfAt = (x, z) => { const X = x >> 2, Z = z >> 2, k = X * 65536 + Z; let h = SURF.get(k); if (h === undefined) { h = g.surfaceY(X * 4 + 2, Z * 4 + 2); SURF.set(k, h); } return h; };
  return { chunk, blockAt, surfAt, CH };
}
// the wow vistas' view cones: 120 blocks toward the landmark, ±20° (the chunks they cross, in a fixed order)
function coneChunks(P) {
  const out = [], seen = new Set();
  for (const v of P.vistas.filter(q => q.wow)) {
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    for (let s = 0; s <= 120; s += 8) for (let a = -20; a <= 20; a += 5) {
      const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG), dx = fx * ca - fz * sa, dz = fz * ca + fx * sa;
      const cx = Math.floor((v.eye[0] + dx * s) / 16), cz = Math.floor((v.eye[2] + dz * s) / 16), k = cx * 65536 + cz;
      if (!seen.has(k)) { seen.add(k); out.push([cx, cz]); }
    }
  }
  return out;
}
// the floating leaves of a chunk: single leaves with no hold among their six neighbours, and leaf groups (face-connected,
// up to 12) none of whose cells touches a log or a solid block
function floatingIn(W, cx, cz) {
  const b = W.chunk(cx, cz), found = [], LEAFSTATE = W.leafState || (W.leafState = new Map());   // (cell → 1 held, 2 floating: a group classified once, across chunks)
  const key = (x, y, z) => (x * 65536 + z) * 256 + y;
  const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let y = 2; y < 254; y++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
    const s0 = b[(y << 8) | (lz << 4) | lx]; if (!isLeaf(s0)) continue;
    const x = cx * 16 + lx, z = cz * 16 + lz, k0 = key(x, y, z); if (LEAFSTATE.has(k0)) continue;
    // its group: the face-connected leaves, until one touches a hold (a log, the ground, a wall), meets a group already
    // held, or the group outgrows 12 (a crown)
    const vis = new Map([[k0, [x, y, z]]]), q = [[x, y, z]]; let held = false;
    while (q.length && !held && vis.size <= 12) {
      const [px, py, pz] = q.pop();
      for (const [dx, dy, dz] of N6) {
        const nx = px + dx, ny = py + dy, nz = pz + dz, s = W.blockAt(nx, ny, nz);
        if (holds(s)) { held = true; break; }
        if (!isLeaf(s)) continue;
        const k = key(nx, ny, nz), st = LEAFSTATE.get(k);
        if (st === 1) { held = true; break; }
        if (!vis.has(k)) { vis.set(k, [nx, ny, nz]); q.push([nx, ny, nz]); }
      }
    }
    if (vis.size > 12) held = true;
    for (const k of vis.keys()) LEAFSTATE.set(k, held ? 1 : 2);
    if (!held) found.push({ at: [x, y, z], n: vis.size, name: nameOf(s0) });
  }
  return found;
}

// ================================================================ 1 + 2 · the floating tree tops; old worlds keep their chunks
// vgen 12's chunks under the wow cones of seed 53, hashed before this front's first change (generator v0.49 + u-home)
const PIN12 = '827635fd';
if (on(1) || on(2)) {
  console.log('1 · the floating tree tops · 2 · vgen 12 kept');
  for (const SEED of [53, 4242]) {
    const row = {};
    for (const vgen of [12, 13]) {
      const g = V.makeGen('overworld', SEED, { vgen }), P = LAND.plan(g), W = world(g), cones = coneChunks(P);
      let h = 2166136261 >>> 0, leaves = 0; const fl = [];
      for (const [cx, cz] of cones) {
        const b = W.chunk(cx, cz);
        if (SEED === 53 && vgen === 12) h = fnv(h, b);
        for (let i = 0; i < b.length; i++) if (isLeaf(b[i])) leaves++;
        for (const f of floatingIn(W, cx, cz)) fl.push(f);
      }
      row[vgen] = { chunks: cones.length, leaves, fl, h: hx(h) };
    }
    const kinds = (fl) => { const m = new Map(); for (const f of fl) m.set(f.name, (m.get(f.name) || 0) + f.n); return [...m].map(([n, c]) => n + ' ' + c).join(', ') || 'none'; };
    console.log(`     seed ${SEED}: ${row[12].chunks} chunks in the wow cones · vgen 12: ${row[12].leaves} leaves, ${row[12].fl.length} floating (${kinds(row[12].fl)}) · vgen 13: ${row[13].leaves} leaves, ${row[13].fl.length} floating (${kinds(row[13].fl)}) (${secs()})`);
    if (on(1)) check(row[13].fl.length === 0, `seed ${SEED}, vgen 13: no floating leaf in the wow vistas' cones (${row[13].fl.length}${row[13].fl.length ? ': ' + row[13].fl.slice(0, 4).map(f => f.name + '@' + f.at.join(',') + (f.n > 1 ? '×' + f.n : '')).join(' ') : ''}; vgen 12 had ${row[12].fl.length})`);
    if (on(2) && SEED === 53) check(row[12].h === PIN12, `vgen 12 keeps every chunk under seed 53's wow cones (${row[12].chunks} chunks hash ${row[12].h}, pinned ${PIN12})`);
  }
}

// ================================================================ 3 · the arrival, measured with real blocks
// rays from the camera through the generated chunks (block by block to 140 blocks and inside the landmark's footprint —
// its members' discs, r + 6 —, the land's surface beyond, the lakes at the sea's level); the landmark = its own blocks
// above its base inside the footprint; hidden = its rays stopped nearer by anything outside the footprint
const ASPECT = 16 / 9;
function truth(g, P, v, cam, W, H) {
  const Wd = world(g), L = VI.landmarks(g, P).find(l => l.id === v.lm), lmk = (L.members || [L]).map(q => ({ x: q.x, z: q.z, r: Math.min(60, q.r + 6) })), BASE = (L.base || 0) + 1;
  const NEAR = 140, FAR = 1300;
  const cast = (e, d, mode) => {
    let x = Math.floor(e[0]), y = Math.floor(e[1]), z = Math.floor(e[2]);
    const sx = d[0] > 0 ? 1 : -1, sy = d[1] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1;
    const tdx = Math.abs(1 / (d[0] || 1e-9)), tdy = Math.abs(1 / (d[1] || 1e-9)), tdz = Math.abs(1 / (d[2] || 1e-9));
    let tx = (d[0] > 0 ? x + 1 - e[0] : e[0] - x) * tdx, ty = (d[1] > 0 ? y + 1 - e[1] : e[1] - y) * tdy, tz = (d[2] > 0 ? z + 1 - e[2] : e[2] - z) * tdz, s = 0;
    for (let k = 0; k < 6000; k++) {
      if (s > FAR || (y > 262 && d[1] >= 0) || y < 0) return null;
      const inLm = lmk.some(q => (x - q.x) * (x - q.x) + (z - q.z) * (z - q.z) <= q.r * q.r);
      if (mode === 1) { if (inLm && y >= BASE) { const b = Wd.blockAt(x, y, z); if (hits(b)) return { s, b, lm: true }; } }
      else if (s <= NEAR || inLm) { const b = Wd.blockAt(x, y, z); if (hits(b)) return { s, b, lm: inLm }; }
      else if (y <= Math.max(Wd.surfAt(x, z), SEA)) return { s, b: -1, lm: false };
      if (tx < ty && tx < tz) { s = tx; tx += tdx; x += sx; } else if (ty < tz) { s = ty; ty += tdy; y += sy; } else { s = tz; tz += tdz; z += sz; }
    }
    return null;
  };
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), f = [-Math.sin(cam.yaw) * cp, sp, -Math.cos(cam.yaw) * cp], r = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], th = Math.tan(cam.fov * DEG / 2);
  let lm = 0, hid = 0, near = 0; const by = new Map(), d = [0, 0, 0];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = ((i + 0.5) / W * 2 - 1) * th * ASPECT, b = (1 - (j + 0.5) / H * 2) * th;
    d[0] = f[0] + r[0] * a + u[0] * b; d[1] = f[1] + r[1] * a + u[1] * b; d[2] = f[2] + r[2] * a + u[2] * b; const l = Math.hypot(d[0], d[1], d[2]); d[0] /= l; d[1] /= l; d[2] /= l;
    const full = cast(cam.eye, d, 0), m = cast(cam.eye, d, 1);
    if (j < H / 2 && full && full.s < 6) near++;
    if (m) { lm++; if (full && full.s < m.s - 1.5 && !full.lm) { hid++; const n = full.b > 0 ? nameOf(full.b) : 'land'; by.set(n, (by.get(n) || 0) + 1); } }
  }
  return { share: lm / (W * H), hidden: lm ? hid / lm : 1, near: near / (W * H / 2), by: [...by].sort((p, q) => q[1] - p[1]).slice(0, 3).map(([n, c]) => n + ' ' + c).join(', ') || '—', chunks: Wd.CH.size };
}
const pct = (v) => (v * 100).toFixed(1) + ' %';
const TW = +(process.env.TW || 128), TH = Math.round(TW * 9 / 16);
if (on(3)) {
  console.log('3 · the arrival, measured with real blocks (' + TW + ' × ' + TH + ' rays)');
  const out = [];
  for (const SEED of SEEDS) {
    // before: vgen 12, t-first's pick (the best score), the vista's own composition
    const g0 = V.makeGen('overworld', SEED, { vgen: 12 }), P0 = LAND.plan(g0);
    const best0 = P0.vistas.filter(v => v.wow).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))[0];
    const tb = best0 ? truth(g0, P0, best0, { eye: best0.eye, yaw: best0.yaw, pitch: best0.pitch, fov: best0.fov }, TW, TH) : null;
    // after: vgen 13, the worker's records, the game's pick, its arrival's camera
    const g = V.makeGen('overworld', SEED, { vgen: 13 }), P = LAND.plan(g), t0 = Date.now();
    const recs = VI.arrivals(g, P), ms = Date.now() - t0, v = FI.pick(recs), A = v ? FI.arrivalOf(v) : null;
    if (!v) { check(false, `seed ${SEED}: a vista to open on`); continue; }
    const ta = truth(g, P, v, { eye: A.eye, yaw: A.yaw, pitch: A.pitch, fov: A.fov }, TW, TH);
    const measured = recs.filter(q => q.sight).length;
    console.log(`     seed ${SEED} · before: ${best0 ? best0.id + ' ' + best0.lm + ' ' + best0.d + ' m at ' + best0.fov + '°' : '—'}: the landmark ${tb ? pct(tb.share) : '—'} of the frame, ${tb ? pct(tb.hidden) : '—'} hidden (${tb ? tb.by : ''}), upper half within 6 m ${tb ? pct(tb.near) : '—'}`);
    console.log(`     seed ${SEED} · after:  ${v.id} ${v.lm} ${v.d} m at ${A.fov}° (the sight test measured ${measured} vista${measured === 1 ? '' : 's'} in ${ms} ms; the model: ${v.sight ? pct(v.sight.share) + ' / ' + pct(v.sight.hidden) + ' hidden / near ' + pct(v.sight.near) : '—'}): the landmark ${pct(ta.share)} of the frame, ${pct(ta.hidden)} hidden (${ta.by}), upper half within 6 m ${pct(ta.near)} (${secs()})`);
    check(ta.share >= 0.08 && ta.hidden <= 0.10 && ta.near === 0, `seed ${SEED}: the arrival shows its landmark — ${pct(ta.share)} of the frame (≥ 8 %), ${pct(ta.hidden)} of it hidden (≤ 10 %), nothing within 6 m in the upper half (${pct(ta.near)})`);
    out.push({ seed: SEED, before: best0 ? { id: best0.id, lm: best0.lm, d: best0.d, fov: best0.fov, eye: best0.eye, yaw: best0.yaw, pitch: best0.pitch, truth: tb } : null, after: { id: v.id, lm: v.lm, d: v.d, cam: { eye: A.eye, yaw: A.yaw, pitch: A.pitch, fov: A.fov }, look: { yaw: v.yaw, pitch: v.pitch }, model: v.sight, truth: ta, ms } });
  }
  try { const SH = __dirname.replace(/\/\.tmp_tests$/, '/test') + '/shots'; require('fs').mkdirSync(SH, { recursive: true }); require('fs').writeFileSync(SH + '/arrival.json', JSON.stringify(out, null, 1)); } catch (e) { /* a convenience */ }
}

// ================================================================ 4 · FI.pick
if (on(4)) {
  console.log('4 · VR.First.pick');
  const mk = (id, score, wow, sight) => ({ id, score, wow, sight, eye: [0, 80, 0], yaw: 1, pitch: 0.1, fov: 50, arrive: sight ? { eye: [0, 80, 0], yaw: 1.1, pitch: 0.2, fov: 34 } : undefined });
  const L1 = [mk('v0', 6, true, { ok: false }), mk('v1', 5, true, { ok: true }), mk('v2', 4, true, { ok: true }), mk('v3', 9, false, { ok: true })];
  check(FI.pick(L1).id === 'v1', 'the sight-ok wow vista with the best score (a better-scored one hidden, a quiet one never)');
  check(FI.pick([mk('v0', 6, true, { ok: false }), mk('v1', 5, true, { ok: false })]).id === 'v0' && FI.pick([mk('v0', 6, true), mk('v1', 7, true)]).id === 'v1', 'none ok, or no sight measured (an older worker): the best score, as before');
  check(FI.pick([]) === null && FI.pick(null) === null && FI.pick([mk('q', 3, false, { ok: true })]) === null, 'no wow vista: none (the generator\'s spawn)');
  const A = FI.arrivalOf(L1[1]);
  check(A.id === 'v1' && A.fov === 34 && A.yaw === 1.1 && A.pitch === 0.2 && A.look && A.look.yaw === 1 && A.look.pitch === 0.1 && FI.arrivalOf(mk('w', 1, true)).fov === 50, 'the arrival plays the moment from its own camera (the vista\'s composition kept for the eyes after it); without one the composition');
}

// ================================================================ 5 · Heimkehr faces out
if (on(5)) {
  console.log('5 · Heimkehr\'s facing (VR.Travel.facing)');
  const TR = V.Travel;
  if (!TR || !TR.facing) check(false, 'VR.Travel.facing exists');
  else {
    // Herzwelt's spawn of an old-style world (seed 4242): the Hangar Hall's pad, the hangar's craft (an entity: a box round
    // its spawn record, a shuttle's 24 × 24 × 11 while its design is built) 14.5 blocks north of it
    const g = V.makeGen('overworld', 4242, { vgen: 13 }), W = world(g), sp = g.findSpawn(), eye = [sp[0], sp[1] + 1.62, sp[2]];
    let craft = null; for (let cz = -2; cz <= 1 && !craft; cz++) for (let cx = -2; cx <= 1 && !craft; cx++) for (const s of (g.generate(cx, cz).spawns || [])) if (s[0] === 'starship' && s[6] === 'hangar') craft = [s[2], s[3], s[4]];
    const boxes = craft ? [[craft[0] - 12, craft[1] - 1, craft[2] - 12, craft[0] + 12, craft[1] + 10, craft[2] + 12]] : [];
    const get = (x, y, z) => W.blockAt(x, y, z);
    // (the before: dims.mjs's picture faced yaw 0, north — into the craft)
    const before = TR.facing(get, eye, boxes, { yaw0: 0, feet: sp[1], want: 1e9, n: 1 });
    const f = TR.facing(get, eye, boxes, { feet: sp[1] });
    const toCraft = craft ? Math.atan2(-(craft[0] - eye[0]), -(craft[2] - eye[2])) : 0, off = Math.abs(Math.atan2(Math.sin(f.yaw - toCraft), Math.cos(f.yaw - toCraft))) / DEG;
    console.log(`     the spawn ${sp.slice(0, 3).join(', ')}, the craft at ${craft ? craft.join(', ') : '—'}: facing north (the before) the frame's middle third meets something at ${before.clear.toFixed(1)} m; the scan faces ${(f.yaw / DEG).toFixed(0)}° (${off.toFixed(0)}° off the craft) with ${f.clear.toFixed(1)} m`);
    check(!!craft && before.clear < 8, `the before: nose to nose with the hangar's craft (${before.clear.toFixed(1)} m)`);
    check(f.clear >= 8 && off > 40, `Heimkehr to Herzwelt's spawn faces out: the nearest geometry in the frame's middle third ${f.clear.toFixed(1)} m away (≥ 8), ${off.toFixed(0)}° away from the craft`);
    const k = TR.facing(get, eye, boxes, { yaw0: sp[3], feet: sp[1] });
    check(k.kept && Math.abs(k.yaw - sp[3]) < 1e-9 && k.clear >= 8, `the world's own spawn yaw (the generator's ${(sp[3] / DEG).toFixed(0)}°, toward the portal) is kept when it has room (${k.clear.toFixed(1)} m)`);
    // a wall 2 m ahead (a bed against a wall) turns the view; open land everywhere else
    const wallGet = (x, y, z) => (y <= 63 ? 1 : (z === -3 && y <= 80 && Math.abs(x) <= 30) ? 1 : 0);
    const fw = TR.facing(wallGet, [0.5, 65.62, 0.5], [], { yaw0: 0, feet: 64 });
    check(!fw.kept && fw.clear >= 8 && Math.abs(Math.atan2(Math.sin(fw.yaw), Math.cos(fw.yaw))) > 60 * DEG, `a wall 2 m ahead: the view turns away (${(fw.yaw / DEG).toFixed(0)}°, ${fw.clear.toFixed(1)} m)`);
    // a new world's home is its vista's walk (t-first): its view is kept (seed 53's arrival)
    const g53 = V.makeGen('overworld', 53, { vgen: 13 }), P53 = LAND.plan(g53), v = FI.pick(VI.arrivals(g53, P53)), A = FI.arrivalOf(v), feet = FI.feet(v), W53 = world(g53);
    const fv = TR.facing((x, y, z) => W53.blockAt(x, y, z), [feet[0], feet[1] + 1.62, feet[2]], [], { yaw0: A.yaw, pitch0: v.pitch, feet: feet[1], keep0: true });
    check(fv.kept && Math.abs(fv.yaw - A.yaw) < 1e-9 && fv.pitch === v.pitch, `a vista start's home: its walk's view kept, at the walk's pitch (${v.id} ${v.lm}; its low walls, bench and lanterns ${fv.clear.toFixed(1)} m ahead at the middle third's foot and sides, the landmark beyond)`);
    // the pitch counts: a view tilted up passes over a wall 3 m ahead that a level view meets
    const wall3 = (x, y, z) => (y <= 63 ? 1 : (z === -3 && y === 64) ? 1 : 0);
    const lv = TR.facing(wall3, [0.5, 65.62, 0.5], [], { yaw0: 0, feet: 64, want: 1e9, n: 1 }), up = TR.facing(wall3, [0.5, 65.62, 0.5], [], { yaw0: 0, pitch0: 0.3, feet: 64, want: 1e9, n: 1 });
    check(lv.clear < 4 && up.clear > 8 && up.pitch === 0.3, `the middle third at the view's own pitch: a knee-high wall 3 m ahead ${lv.clear.toFixed(1)} m level, ${up.clear.toFixed(1)} m looking 17° up`);
  }
}

// ================================================================ 6 · the browser's cameras (test/first.mjs part D)
// CAMS=<file.json> [{tag, seed, vgen, id, lm, cam: {eye, yaw, pitch, fov (degrees)}}…] — the camera each page drew its
// arrival with, measured as in 3; written to <file>.truth.json (first.mjs runs this with ONLY=6)
if (process.env.CAMS) {
  const fs = require('fs'), list = JSON.parse(fs.readFileSync(process.env.CAMS, 'utf8')), res = [];
  console.log('6 · the browser\'s cameras (' + list.length + ', ' + TW + ' × ' + TH + ' rays)');
  for (const c of list) {
    const g = V.makeGen('overworld', +c.seed, { vgen: +c.vgen }), P = LAND.plan(g), rec = P.vistas.find(q => q.id === c.id);
    const lm = c.lm || (rec && rec.lm);
    if (!lm || !VI.landmarks(g, P).some(l => l.id === lm)) { console.log(`     ${c.tag}: no landmark ${lm} in seed ${c.seed}'s plan (vgen ${c.vgen})`); res.push(Object.assign({}, c, { truth: null })); continue; }
    const t = truth(g, P, { lm }, c.cam, TW, TH);
    res.push(Object.assign({}, c, { lm, truth: t }));
    console.log(`     ${c.tag}: seed ${c.seed} (vgen ${c.vgen}) ${c.id} ${lm} at ${(+c.cam.fov).toFixed(1)}°: the landmark ${pct(t.share)} of the frame, ${pct(t.hidden)} hidden (${t.by}), upper half within 6 m ${pct(t.near)} (${secs()})`);
  }
  fs.writeFileSync(process.env.CAMS.replace(/\.json$/, '') + '.truth.json', JSON.stringify(res, null, 1));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

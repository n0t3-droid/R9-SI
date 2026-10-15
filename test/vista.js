// Aussichten (t-vista, vgen 11; plan docs/superpowers/plans/2026-10-15-t-vista.md) — every rule a check:
//   1. sightlines: walking either way along every way, a landmark is in view (±45° of the way's direction, in range,
//      its top over the land, the woods' windows open) at least every 60 blocks; the eye-catchers at the outward ends
//      stand in their chunks (windmills at every farm, the belvederes, the monopteros, the obelisks), the gates where
//      the ways leave the plaza and enter the city
//   2. windows: the corridors are free of trunks and leaves under the sight line in the generated chunks; the woods
//      still cover 15–35 % of the open land
//   3. vista points: about one every 200 blocks of way, ≥ 90 apart; each a spur with its bench, lanterns and walls in
//      its chunk; from each the landmark's top is above the horizon line and unoccluded within 300 m by the heightfield,
//      and the line of sight is free of blocks in the generated chunks within 120 blocks; listed as a 'vista' spawn
//   4. silhouettes: the domed hall's lantern spire (the beacon ≥ 1.5 times the dome's height), the fluted towers' light
//      bands, the citadel's taller spires and side pinnacles, a fall off every isle into the void, the lighthouse ≥ 40
//      high on the lake's far coast; the horizon tiles and the far ring's forms reach the landmarks' tops; Very Low's
//      horizon in the hills view at most ×1.03 the triangles of vgen 10
//   (the later sections — layers, the wow moments — come with their steps)
//   bash test/wt_run.sh vista.js 900        (SEED=… another world; ONLY=1,2 some sections)
const V = require('./load_shared.js');
const R = V.R, LAND = V.Land, VI = V.Vista, SEA = V.C.SEA;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const nameOf = (s) => (s ? R.types[R.T.type[s]].name : 'air');
const SEED = +(process.env.SEED || 4242);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const want = (k) => !ONLY || ONLY.includes(k);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(1) + ' s';
const g = V.makeGen('overworld', SEED, { vgen: 11 });
check(!!VI && VI.on(g) && !VI.on(V.makeGen('overworld', SEED, { vgen: 10 })) && LAND.on(g), 'the vista layer is on for vgen 11 (with the land) and off for vgen 10');
const t0 = Date.now();
const P = LAND.plan(g);
const pms = Date.now() - t0;
console.log(`  the plan: ${P.lines.length} ways, ${P.vistas.length} vista points, ${P.windows.length} windows, ${P.pieces.length} pieces (${pms} ms, the vista piece ${P.vistaMs} ms)`);
check(pms < 9000, `the plan with the vistas is made in under 9 s (${pms} ms)`);
const CH = new Map();
const chunk = (cx, cz) => { const k = cx + ',' + cz; let c = CH.get(k); if (!c) { c = g.generate(cx, cz); CH.set(k, c); } return c; };
const blockAt = (x, y, z) => { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (y < 0 || y > 255) return 0; const c = chunk(x >> 4, z >> 4); return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; };
const F = V.F, RT = R.T;
const opaque = (b) => b && ((RT.flags[b] & (F.OPAQUE | F.LEAVES)) || ((RT.flags[b] & F.SOLID) && !(RT.flags[b] & F.PLANT)));
const pieces = (k) => P.pieces.filter(p => p.kind === k);
// a line from a to b: the first block in the way (null: free), skipping the last `skip` blocks
const firstHit = (a, b, skip, from) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.ceil(d / 0.5); for (let i = Math.ceil((from || 0) / 0.5); i < n - Math.ceil((skip || 0) / 0.5); i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t, s = blockAt(x, y, z); if (opaque(s)) return [Math.floor(x), Math.floor(y), Math.floor(z), nameOf(s), +(t * d).toFixed(1)]; } return null; };

// ---------------------------------------------------------------- 1 · sightlines and eye-catchers
if (want(1)) {
  console.log('1 · sightlines: a landmark in view every 60 blocks; the eye-catchers and gates');
  const c10 = (() => { const g10 = V.makeGen('overworld', SEED, { vgen: 10 }), P10 = LAND.plan(g10); return VI.coverage(g10, P10, true); })();
  const c0 = VI.coverage(g, P, false), c1 = VI.coverage(g, P, true);
  console.log(`  coverage (samples every 4 blocks, both directions): vgen 10 ${(c10.share * 100).toFixed(1)} % (worst blind run ${c10.worst}, ${c10.runs.length} runs over 60) · vgen 11 terrain only ${(c0.share * 100).toFixed(1)} % · with the woods ${(c1.share * 100).toFixed(1)} %`);
  check(c1.runs.length === 0 && c1.worst <= 60, `walking either way along every way, a landmark is in view at least every 60 blocks, the woods counted (worst blind run ${c1.worst} blocks; ${c1.runs.length} runs over 60${c1.runs.length ? ': ' + c1.runs.slice(0, 4).map(r => `way ${r.line} ${r.dir > 0 ? '→' : '←'} ${r.len} at (${P.lines[r.line].pts[r.from].map(Math.round).join(', ')})`).join('; ') : ''}; vgen 10: ${c10.runs.length} runs, worst ${c10.worst})`);
  check(c1.share > c10.share + 0.05, `more of every walk sees a landmark than in vgen 10 (${(c1.share * 100).toFixed(1)} % against ${(c10.share * 100).toFixed(1)} %)`);
  // the eye-catchers, in their chunks
  const farms = P.sites.filter(s => s.kind === 'farm'), mills = pieces('windmill');
  check(farms.every(f => mills.some(m => m.farm === f.id)), `a windmill at every farm (${mills.length}: ${mills.map(m => m.farm).join(', ')})`);
  let millOk = 0; for (const m of mills) { const [hx, hy, hz] = m.hub; if (/_log$/.test(nameOf(blockAt(hx, hy, hz))) && (chunk(hx >> 4, hz >> 4).spawns || []).some(s => s[0] === 'windmill' && s[1] === hx && s[3] === hz)) millOk++; }
  check(millOk === mills.length, `every windmill's hub and its 'windmill' spawn are in the chunks (${millOk} of ${mills.length})`);
  const bel = pieces('belvedere'), mono = pieces('monopteros'), obs = pieces('obelisk');
  let belOk = 0; for (const b of bel) { let lant = 0, stone = 0; for (let y = b.y; y <= b.top; y++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const n = nameOf(blockAt(b.x + dx, y, b.z + dz)); if (n === 'lantern') lant++; else if (/stone_brick|chiseled|polished_andesite/.test(n)) stone++; } if (lant >= 4 && stone > 60 && nameOf(blockAt(b.x, b.top, b.z)) === 'lantern') belOk++; }
  check(bel.length >= 2 && belOk === bel.length && bel.some(b => b.name === 'belvedere_n') && bel.some(b => b.name === 'belvedere_falls'), `the belvederes stand at the north crossroads and over the falls' spring (${bel.map(b => `${b.name} (${b.x}, ${b.z}) ${b.top - b.y} high`).join(', ')}; ${belOk} whole in their chunks)`);
  let monoOk = 0; for (const m of mono) { let cols = 0; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8, cx = Math.round(m.x + Math.cos(a) * 4), cz = Math.round(m.z + Math.sin(a) * 4); if (/quartz/.test(nameOf(blockAt(cx, m.y + 3, cz)))) cols++; } if (cols === 8 && nameOf(blockAt(m.x, m.top, m.z)) === 'lantern') monoOk++; }
  check(mono.length === 1 && monoOk === 1, `the monopteros in the east grove: eight columns, the dome, its lantern (${mono.map(m => `(${m.x}, ${m.z})`).join('')})`);
  let obOk = 0; for (const o of obs) if (nameOf(blockAt(o.x, o.top, o.z)) === 'lantern' && /quartz/.test(nameOf(blockAt(o.x, o.y + 4, o.z)))) obOk++;
  check(obOk === obs.length, `${obs.length} obelisks on the rises ahead of the ways that still looked into empty country, whole in their chunks (${obOk}; ${obs.map(o => `(${o.x}, ${o.z})`).join(' ')})`);
  const gates = pieces('gate');
  let gateOk = 0; for (const gt of gates) { let lit = 0, head = true; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { for (let y = gt.y + 5; y <= gt.y + 8; y++) if (nameOf(blockAt(gt.x + dx, y, gt.z + dz)) === 'lantern') lit++; } for (let y = gt.y + 1; y <= gt.y + 3; y++) if (opaque(blockAt(gt.x, y, gt.z))) head = false; if (lit >= 2 && head) gateOk++; }
  check(gates.length >= 4 && gateOk === gates.length, `gates over the ways where they leave the temple's plaza and enter Nova Haven (${gates.length}: ${gates.map(gt => gt.style + ' (' + gt.x + ', ' + gt.z + ')').join(', ')}; ${gateOk} with their lanterns and the way free under them)`);
  console.log(`  (${secs()})`);
}

// ---------------------------------------------------------------- 2 · windows
if (want(2)) {
  console.log('2 · windows: the corridors free of trees, the woods still woods');
  // every 5th way window: from its eye toward its landmark, as far as it was opened, nothing under the line in the chunks
  const LM = VI.landmarks(g, P), ws = P.windows.filter(w => w.line !== undefined && w.len > 20);
  let tried = 0, clear = 0; const bad = [];
  for (let k = 0; k < ws.length; k += 5) {
    const w = ws[k], Ln = P.lines[w.line], L = LM.find(l => l.id === w.lm); if (!L) continue;
    const q = L.members ? L.members.reduce((a, b) => (Math.hypot(b.x - w.x, b.z - w.z) < Math.hypot(a.x - w.x, a.z - w.z) ? b : a)) : L;
    const e = [w.x + 0.5, Ln.y[w.i] + 1.62, w.z + 0.5], d = Math.hypot(q.x - e[0], q.z - e[2]), s = Math.min(w.len, d - 4), tgt = [e[0] + (q.x - e[0]) * s / d, e[1] + (q.top - e[1]) * s / d, e[2] + (q.z - e[2]) * s / d];
    tried++;
    const hit = firstHit(e, tgt, 0, 3);
    if (!hit || !/leaves|_log$/.test(hit[3])) clear++; else if (bad.length < 4) bad.push(`(${w.x}, ${w.z}) → ${w.lm}: ${hit[3]} at ${hit[4]}`);
  }
  check(tried >= 5 && clear >= tried * 0.9, `the sight windows are free of trunks and leaves under the line in the chunks (${clear} of ${tried} checked${bad.length ? '; e.g. ' + bad.join(', ') : ''})`);
  let open = 0, wood = 0, woodNow = 0;
  for (let z = -640; z <= 640; z += 6) for (let x = -640; x <= 640; x += 6) { if (x * x + z * z > 640 * 640 || LAND.zoneAt(g, x, z)) continue; const kb = LAND.keepAt(P, x, z); if (kb & ~32) continue; if (g.surfaceY(x, z) <= SEA + 1) continue; open++; if (LAND.woodAt(g, x, z).d > 0.5) { wood++; if (!(kb & 32)) woodNow++; } }
  const c0 = wood / open, c1 = woodNow / open;
  check(c1 >= 0.15 && c1 <= 0.35 && c0 - c1 < 0.05, `the woods still cover ${(c1 * 100).toFixed(1)} % of the open land (15–35 %; ${(c0 * 100).toFixed(1)} % before the windows; ${P.windows.length} windows)`);
  console.log(`  (${secs()})`);
}

// ---------------------------------------------------------------- 3 · vista points
if (want(3)) {
  console.log('3 · vista points: a spur toward a great landmark every ~200 blocks');
  let len = 0; for (const Ln of P.lines) len += Ln.pts.length;
  const vs = P.vistas;
  let minD = 1e9; for (const a of vs) for (const b of vs) if (a !== b) minD = Math.min(minD, Math.hypot(a.x - b.x, a.z - b.z));
  check(vs.length >= len / 300 && vs.length <= len / 120, `${vs.length} vista points on ${len} blocks of way (one per ${Math.round(len / vs.length)}; every ~200: between one per 120 and one per 300), the nearest two ${minD.toFixed(0)} apart`);
  check(minD >= 90, `no two vista points closer than 90 blocks (${minD.toFixed(0)})`);
  const lms = new Set(vs.map(v => v.lm));
  check(lms.size >= 5, `they face ${lms.size} different landmarks (${[...lms].join(', ')})`);
  // in the chunks: the bench at the widening, the lanterns, the walls; the 'vista' spawn
  let built = 0; const bad = [];
  for (const v of vs) {
    let bench = 0, lant = 0, wall = 0, pave = 0;
    for (let dz = -12; dz <= 12; dz++) for (let dx = -12; dx <= 12; dx++) {
      const x = v.x + dx, z = v.z + dz; if (Math.hypot(dx, dz) > 12) continue;
      const a = nameOf(blockAt(x, v.y + 1, z)), b = nameOf(blockAt(x, v.y + 2, z)), c = nameOf(blockAt(x, v.y + 3, z)), f = nameOf(blockAt(x, v.y, z));
      if (a === 'vx_bench') bench++; if (b === 'lantern' || c === 'lantern') lant++; if (/wall|balustrade/.test(a)) wall++; if (/flagstone|plaza/.test(f)) pave++;
    }
    const sp = (chunk(v.x >> 4, v.z >> 4).spawns || []).some(s => s[0] === 'vista' && s[1] === v.id);
    if (bench >= 1 && lant >= 4 && wall >= 10 && pave >= 12 && sp) built++; else if (bad.length < 4) bad.push(`${v.id} bench ${bench} lanterns ${lant} walls ${wall} paving ${pave} spawn ${sp}`);
  }
  check(built === vs.length, `every vista's spur stands in its chunk with its bench, lanterns, walls and paving, and its chunk lists the 'vista' spawn (${built} of ${vs.length}${bad.length ? '; ' + bad.join('; ') : ''})`);
  // the landmark's top above the horizon line and unoccluded within 300 m by the heightfield; the line of sight free of
  // blocks in the generated chunks within 120 blocks
  const Rr = VI.rasters(g);
  let hz = 0, occ = 0, free = 0; const why = [];
  for (const v of vs) {
    const [ex, ey, ez] = v.eye, [qx, qy, qz] = v.aim, d = Math.hypot(qx - ex, qz - ez), el = (qy - ey) / d;
    if (VI.horizonOk(g, Rr, ex, ey, ez, { x: qx, z: qz, top: qy })) hz++; else if (why.length < 4) why.push(v.id + ' under the horizon');
    let ok = true; for (let s = 2; s <= Math.min(300, d - 6); s += 2) { const x = ex + (qx - ex) * s / d, z = ez + (qz - ez) * s / d; if (g.surfaceY(Math.round(x), Math.round(z)) + 1 > ey + el * s) { ok = false; if (why.length < 4) why.push(`${v.id} → ${v.lm}: the land at ${s}`); break; } }
    if (ok) occ++;
    const hit = firstHit([ex, ey, ez], [ex + (qx - ex) * Math.min(120, d - 5) / d, ey + (qy - ey) * Math.min(120, d - 5) / d, ez + (qz - ez) * Math.min(120, d - 5) / d], 0, 1.5);
    if (!hit) free++; else if (why.length < 6) why.push(`${v.id} → ${v.lm}: ${hit[3]} at ${hit[4]}`);
  }
  check(hz === vs.length, `from every vista point the landmark's top is above the horizon line behind it (${hz} of ${vs.length})`);
  check(occ === vs.length, `from every vista point the line to the landmark's top clears the land (the generated surface) within 300 m (${occ} of ${vs.length}${why.length ? '; ' + why.join('; ') : ''})`);
  check(free >= vs.length - 1, `from every vista point the line of sight is free of blocks in the generated chunks within 120 blocks (${free} of ${vs.length})`);
  // the composition: the landmark's top in the upper third of the frame
  let third = 0; for (const v of vs) { const [ex, ey, ez] = v.eye, [qx, qy, qz] = v.aim, d = Math.hypot(qx - ex, qz - ez), a = Math.atan2(qy - ey, d) - v.pitch, ndc = Math.tan(a) / Math.tan(v.fov * Math.PI / 360); if (ndc > 1 / 3 && ndc < 1) third++; }
  check(third === vs.length, `the composition puts the landmark's top in the upper third of the frame (${third} of ${vs.length})`);
  console.log('  ' + vs.map(v => `${v.id} ${v.lm} (${v.x}, ${v.z}) ${v.d} m, rise ${v.rise}, ${v.frame}`).join('\n  '));
  console.log(`  (${secs()})`);
}

// ---------------------------------------------------------------- 4 · silhouettes and far forms
if (want(4)) {
  console.log('4 · the landmarks read from afar: the dome\'s lantern spire, the towers\' light bands, the citadel, the isles\' falls, the lighthouse, the far forms');
  const Y = V.Heart.PLAT, g10 = V.makeGen('overworld', SEED, { vgen: 10 });
  const colOf = (gg, x, y0, y1, z) => { const c = gg.generate(x >> 4, z >> 4), out = []; for (let y = y0; y <= y1; y++) out.push(nameOf(c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)])); return out; };
  // the domed hall: its dome's top, the lantern and the spire with the beacon 1.5 times the dome's height
  const col = colOf(g, 69, Y + 1, Y + 40, -5), top = (arr, re) => { let t = -1; arr.forEach((n, i) => { if (re.test(n)) t = i; }); return t; };
  const beacon = top(col, /^beacon_red$/), domeTop = (() => { const c10 = colOf(g10, 69, Y + 1, Y + 20, -5); return top(c10, /temple_stone/); })();
  let amber = 0, pil = 0; for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) for (let y = Y + 20; y <= Y + 23; y++) { const n = nameOf(blockAt(69 + dx, y, -5 + dz)); if (n === 'amber_window') amber++; else if (n === 'temple_pilaster') pil++; }
  const ratio = (beacon + 1) / (domeTop + 1);
  check(beacon >= 0 && ratio >= 1.5 && amber >= 16 && pil >= 8, `the domed hall's lantern spire: the beacon ${beacon + 1} over the plaza, ${ratio.toFixed(2)} times the dome's ${domeTop + 1} (≥ 1.5); the lantern ${amber} amber panes between ${pil} pilasters`);
  const col10 = colOf(g10, 69, Y + 1, Y + 40, -5);
  check(top(col10, /^beacon_red$/) === Y + 28 - (Y + 1), `vgen 10 keeps its dome with the antenna (the beacon at ${top(col10, /^beacon_red$/) + Y + 1})`);
  // the fluted towers: every other rib a cyan light strip, the doubled rings
  const towerCount = (gg, tx, tz, re) => { let n = 0; for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) { const c = gg.generate((tx + dx) >> 4, (tz + dz) >> 4), cl = (((tz + dz) & 15) << 4) | ((tx + dx) & 15); for (let y = Y + 1; y <= Y + 90; y++) if (re.test(nameOf(c.blocks[(y << 8) | cl]))) n++; } return n; };
  const tw = [[50, -24], [-50, -24], [24, -37], [-24, -37]].map(([x, z]) => [towerCount(g, x, z, /^neon_cyan$/), towerCount(g, x, z, /^temple_light_bar$/), towerCount(g10, x, z, /^temple_light_bar$/)]);
  check(tw.every(t => t[0] >= 150 && t[1] > t[2]), `the temple's fluted towers carry light bands: cyan strips on every other rib (${tw.map(t => t[0]).join(', ')} blocks), the amber rings doubled (${tw.map(t => t[1] + ' against ' + t[2]).join(', ')})`);
  // the citadel's cluster
  const CIT = V.CitadelGen, s11 = CIT.heartSite(g, V.Heart.CITADEL), s10 = CIT.heartSite(g10, V.Heart.CITADEL), m11 = s11.towers.find(t => t.kind === 'main');
  const sec11 = s11.towers.filter(t => t.kind === 'sec').map(t => t.h / m11.h), sec10 = s10.towers.filter(t => t.kind === 'sec').map(t => t.h / m11.h), fl = s11.towers.filter(t => t.kind === 'flank');
  check(Math.min(...sec11) >= 0.6 && Math.min(...sec11) > Math.max(...sec10) - 0.12 && fl.length === 8, `the citadel's secondary spires ${sec11.map(f => f.toFixed(2)).join(', ')} of the main (vgen 10: ${sec10.map(f => f.toFixed(2)).join(', ')}), ${fl.length} side pinnacles on the main spire's setbacks`);
  let flOk = 0; for (const T of fl) { const b0 = s11.y + 1 + T.t0; let stone = 0; for (let y = b0 + 2; y <= b0 + T.h - 2; y++) if (/spire_/.test(nameOf(blockAt(T.x, y, T.z)))) stone++; if (stone >= T.h - 5 && nameOf(blockAt(T.x, b0 + T.h + 1, T.z)) === 'beacon_red') flOk++; }
  check(flOk === fl.length, `every side pinnacle stands in its chunk with its beacon (${flOk} of ${fl.length})`);
  // the isles' falls: one off every isle at least, streaming into the void, the same as the far forms draw
  const isles = V.IslesGen.list(g), falls = VI.isleFalls(g), W = R.byName.water.id, L = R.byName.lava.id;
  let fallOk = 0; for (const f of falls) { let best = 0, bx = 0, bz = 0; for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { let fluid = 0; for (let y = f.foot + 6; y <= f.top; y++) { const b = blockAt(f.x + ox + 0.5, y, f.z + oz + 0.5), t = b ? R.T.type[b] : -1; if (t === W || t === L) fluid++; } if (fluid > best) { best = fluid; bx = ox; bz = oz; } } const air = !blockAt(f.x + bx + 0.5, f.foot - 2, f.z + bz + 0.5) && !blockAt(f.x + bx + 0.5, f.foot - 30, f.z + bz + 0.5); if (best >= (f.top - f.foot - 6) * 0.75 && air) fallOk++; }
  check(isles.every(I => falls.some(f => f.isle === I.name)) && fallOk === falls.length, `every one of the ${isles.length} isles pours a fall into the void (${falls.length} falls; ${fallOk} in the chunks as the far forms draw them, the air open under their feet)`);
  // the lighthouse: tall, on the lake's far coast
  const lh = pieces('lighthouse')[0], Lk = LAND.LAKE;
  check(!!lh && lh.top - lh.y >= 40 && lh.x > Lk.x + 60 && nameOf(blockAt(lh.lamp[0], lh.lamp[1], lh.lamp[2])) === 'tide_lantern', `a tall lighthouse on the lake's far (east) coast: (${lh && lh.x}, ${lh && lh.z}), ${lh && lh.top - lh.y} high, its lamp lit`);
  // the far forms: the horizon tile and the far ring's form over each landmark reach its top (vgen 10: the temple's tile
  // stays low — the temple was drawn by the chunks alone)
  const LMs = VI.landmarks(g, P).filter(l => /^(temple|dome|lighthouse|lookout|belvedere|monopteros|obelisk|mill)/.test(l.id));
  let lodOk = 0, farOk = 0; const lodBad = [];
  for (const l of LMs) {
    const t0 = V.LOD.build(g, { level: 0, tx: Math.floor(l.x / 128), tz: Math.floor(l.z / 128) }), t2 = V.LOD.build(g, { level: 2, tx: Math.floor(l.x / 512), tz: Math.floor(l.z / 512) });
    if (t0.maxY >= l.top - 4 && t2.maxY >= l.top - 4) lodOk++; else if (lodBad.length < 4) lodBad.push(`${l.id} top ${l.top}: ${t0.maxY} / ${t2.maxY}`);
    if (l.id === 'temple' || l.id === 'dome') { farOk++; continue; }   // (the far ring draws the temple from its skyline)
    const f = V.Far.form(g, { tx: Math.floor(l.x / 64), tz: Math.floor(l.z / 64), cell: 4 }); if (f && f.maxY >= l.top - 4) farOk++; else if (lodBad.length < 6) lodBad.push(`${l.id} far ${f && f.maxY}`);
  }
  const tT10 = V.LOD.build(g10, { level: 0, tx: 0, tz: -1 });
  check(lodOk === LMs.length && farOk === LMs.length && tT10.maxY < 100, `the horizon tiles (levels 0 and 2) and the far ring's forms over the temple, the dome, the lighthouse, the lookout, the belvederes, the monopteros, the obelisks and the windmills reach their tops (${lodOk} and ${farOk} of ${LMs.length}${lodBad.length ? '; ' + lodBad.join(', ') : ''}; vgen 10's temple tile tops at ${tT10.maxY})`);
  const fallForms = falls.filter(f => { const t = V.LOD.build(g, { level: 1, tx: Math.floor(f.x / 256), tz: Math.floor(f.z / 256) }); return t && t.maxY >= f.top - 2; }).length;
  check(fallForms === falls.length, `the isles' falls stand in the horizon tiles (${fallForms} of ${falls.length})`);
  // Very Low's horizon in the hills view (land.js §7's tile set: horizon setting 2, the tiles in the look south): the
  // landmarks' boxes cost next to nothing
  const N = 32, tsz = (Lv) => N * (4 << Lv), CX = 0.5, CZ = -292.5, Rh = 2048, Lr = 3, split = 1.35, tiles = [];
  const dist = (Lv, tx, tz) => { const S = tsz(Lv), xa = tx * S, za = tz * S; return Math.hypot(Math.max(xa - CX, 0, CX - (xa + S)), Math.max(za - CZ, 0, CZ - (za + S))); };
  const visit = (Lv, tx, tz) => { const d = dist(Lv, tx, tz); if (d > Rh) return; if (Lv > 0 && d < split * tsz(Lv)) { for (const [a, b] of [[tx * 2, tz * 2], [tx * 2 + 1, tz * 2], [tx * 2, tz * 2 + 1], [tx * 2 + 1, tz * 2 + 1]]) visit(Lv - 1, a, b); return; } tiles.push([Lv, tx, tz]); };
  for (let tz = Math.floor((CZ - Rh) / tsz(Lr)); tz <= Math.floor((CZ + Rh) / tsz(Lr)); tz++) for (let tx = Math.floor((CX - Rh) / tsz(Lr)); tx <= Math.floor((CX + Rh) / tsz(Lr)); tx++) visit(Lr, tx, tz);
  const inLook = ([Lv, tx, tz]) => { const S = tsz(Lv); for (const [px, pz] of [[tx * S + S / 2, tz * S + S / 2], [tx * S, tz * S], [tx * S + S, tz * S], [tx * S, tz * S + S], [tx * S + S, tz * S + S]]) { const dx = px - CX, dz = pz - CZ, d = Math.hypot(dx, dz) || 1; if (dz / d > Math.cos(62 * Math.PI / 180)) return true; } return false; };
  const view = tiles.filter(inLook), tris = (gg) => { let n = 0; for (const [Lv, tx, tz] of view) { const t = V.LOD.build(gg, { level: Lv, tx, tz }); if (t && !t.empty) n += t.count / 3; } return n; };
  const a10 = tris(g10), a11 = tris(g);
  check(a11 <= a10 * 1.03, `Very Low's horizon in the hills view: ${Math.round(a11)} triangles against vgen 10's ${Math.round(a10)} (×${(a11 / a10).toFixed(3)}, at most ×1.03; ${view.length} tiles)`);
  console.log(`  (${secs()})`);
}

console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

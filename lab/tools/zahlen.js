// ============================================================================
// R9-SI Lab · Zahlen für die Bilder: was die Diagramme im README zeigen, gemessen mit dem Code des Spiels.
// The numbers behind the README's charts, measured with the game's own code (node, no browser):
//   horizon  random eyes on land in three worlds (two thirds a walker anywhere, one third in a village or town), view
//            distance 10 (the Mittel preset: mini-voxel detail within 44 blocks, boxes beyond). Every section is meshed
//            by the game's mesher; for four of the game's settings the share of the quads in sections hidden behind
//            hills (src/shared/hzcull.js, pure geometry: every column known):
//              cubes, a still eye (E 0, δ 0.05) · smooth slopes, still (E [0,1,0], δ 0.05) · smooth slopes, walking
//              (δ 0.5) · round looks at speed (E 1, δ 1)
//   town     the owner's town Fliederfeld, 7 × 7 chunks round its middle, meshed at Ultra (mini-voxel detail within 96
//            blocks: all of it): its quads per layer
//   node lab/tools/zahlen.js [--task horizon,town] [--views 18] [--out docs/media/data/zahlen.json]
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path');
const W = require('../lib/world.js');
const VR = W.VR, R = W.R, F = W.F, HC = VR.HzCull;
const PAD = VR.MESH_PAD, PS = VR.MESH_PS, PSS = PS * PS;
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const TASKS = String(A.task || 'horizon,town').split(','), VIEWS = +(A.views || 18), OUT = A.out || path.join(__dirname, '../../docs/media/data/zahlen.json');
const OCC = (s) => !!s && (R.T.flags[s] & F.OPAQUE) !== 0 && (R.T.flags[s] & F.FULL) !== 0;
const SETTINGS = [
  { id: 'cubes', E: 0, delta: 0.05 },
  { id: 'smooth', E: [0, 1, 0], delta: 0.05 },
  { id: 'walk', E: [0, 1, 0], delta: 0.5 },
  { id: 'harsh', E: 1, delta: 1 },
];
function rng(seed) {   // (mulberry32, as the random lab)
  let s = seed >>> 0;
  const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  return f;
}
// a padded section for the mesher, from generated columns with their light (as the game's worker builds it)
function padded(g, cx, cz, sy) {
  const nb = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = W.chunk(g, cx + dx, cz + dz); if (!c.light) c.light = VR.computeColumnLight(c.blocks, true); nb.push(c); }
  const blocks = new Uint16Array(PS * PSS), light = new Uint16Array(PS * PSS), grass = new Uint16Array(PSS), foliage = new Uint16Array(PSS), water = new Uint16Array(PSS);
  const y0 = sy * 16 - PAD;
  for (let pz = 0; pz < PS; pz++) {
    const lz = pz - PAD, czi = lz < 0 ? 0 : lz > 15 ? 2 : 1, iz = (lz + 16) & 15;
    for (let px = 0; px < PS; px++) {
      const lx = px - PAD, cxi = lx < 0 ? 0 : lx > 15 ? 2 : 1, ix = (lx + 16) & 15, nn = nb[czi * 3 + cxi], ci = (iz << 4) | ix, ti = pz * PS + px;
      grass[ti] = nn.tints.grass[ci]; foliage[ti] = nn.tints.foliage[ci]; water[ti] = nn.tints.water[ci];
      for (let py = 0; py < PS; py++) { const y = y0 + py, o = py * PSS + pz * PS + px; if (y < 0 || y > 255) { light[o] = y > 255 ? 0xf000 : 0; continue; } const i = (y << 8) | ci; blocks[o] = nn.blocks[i]; light[o] = nn.light[i]; }
    }
  }
  return { blocks, light, grass, foliage, water, sy, ox: cx * 16, oz: cz * 16, fancyLeaves: true, smooth: true, vxLod: true };
}
const nq = (a) => (a && a.length ? a.length >> 5 : 0);
// one section's quads: the layers the renderer draws at this distance (detail within vxLod, its boxes beyond)
function sectionQuads(g, cx, cz, sy, eye, vxLod) {
  const m = VR.meshSection(padded(g, cx, cz, sy));
  const d = Math.hypot(cx * 16 + 8 - eye[0], sy * 16 + 8 - eye[1], cz * 16 + 8 - eye[2]);
  const vx = d <= vxLod ? nq(m.vx) : nq(m.vxFar);
  return { opaque: nq(m.opaque), cutout: nq(m.cutout), trans: nq(m.trans), vx, total: nq(m.opaque) + nq(m.cutout) + nq(m.trans) + vx };
}

function horizon() {
  const worlds = [3616214791, 1, 12345], rows = [], r = rng(20261128);
  for (let v = 0; v < VIEWS; v++) {
    const seed = worlds[v % worlds.length], g = W.gen(seed, W.newestVgen()), place = v % 3 === 2;
    let px = 0, pz = 0, top = null;
    for (let k = 0; k < 200; k++) {
      px = r.int(-3000, 3000); pz = r.int(-3000, 3000);
      if (place) { const s = W.sitesNear(g, px, pz, 1500)[0]; if (s) { px = s.x + r.int(-12, 12); pz = s.z + r.int(-12, 12); } }
      const t = W.top(g, px, pz);
      if (t.s && !(R.T.flags[t.s] & F.FLUID) && t.y > VR.C.SEA) { top = t; break; }
    }
    if (!top) continue;
    const eye = [px + 0.5, top.y + 1 + 1.62, pz + 0.5], rd = 10, pcx = px >> 4, pcz = pz >> 4, t0 = Date.now();
    const runs = new Map(), runOf = (cx, cz) => { const k = cx + ',' + cz; let o = runs.get(k); if (!o) { o = HC.runs(W.chunk(g, cx, cz).blocks, 256, OCC); runs.set(k, o); } return o; };
    const cols = [];
    for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) if (dx * dx + dz * dz <= (rd + 0.5) * (rd + 0.5)) cols.push([pcx + dx, pcz + dz]);
    // the targets: every section with blocks (its content top from the runs' reader), and its quads
    const tg = [], q = [];
    for (const [cx, cz] of cols) { const o = runOf(cx, cz); for (let sy = 0; sy < 16; sy++) if (o.top[sy] >= 0) { tg.push(cx * 16, cx * 16 + 16, sy * 16, o.top[sy], cz * 16, cz * 16 + 16); q.push(sectionQuads(g, cx, cz, sy, eye, 44).total); } }
    const nT = q.length, all = q.reduce((a, b) => a + b, 0), res = {};
    for (const S of SETTINGS) {
      const occ = [];
      for (const [cx, cz] of cols) {
        const cells = HC.cells(runOf(cx, cz).run, (ox, oz) => runOf(cx + ox, cz + oz).run, S.E);
        for (let k = 0; k < 21; k++) { const b = cells[k * 2], t = cells[k * 2 + 1]; if (t <= b) continue; const [x0, z0, sz] = HC.cellRect(k); occ.push(cx * 16 + x0, cx * 16 + x0 + sz, cz * 16 + z0, cz * 16 + z0 + sz, b, t); }
      }
      const hid = new Uint8Array(nT); HC.cull(eye, S.delta, new Float64Array(occ), occ.length / 6, new Float64Array(tg), nT, hid);
      let hq = 0, hs = 0; for (let i = 0; i < nT; i++) if (hid[i]) { hq += q[i]; hs++; }
      res[S.id] = { quads: all ? +(hq / all).toFixed(4) : 0, sections: +(hs / nT).toFixed(4) };
    }
    rows.push({ seed, at: [px, +eye[1].toFixed(2), pz], place, sections: nT, quads: all, hidden: res });
    console.log(`view ${v + 1}/${VIEWS} seed ${seed} at ${px},${pz}${place ? ' (place)' : ''}: ${nT} sections, ${all} quads — ` + SETTINGS.map((S) => `${S.id} ${(res[S.id].quads * 100).toFixed(1)} %`).join(', ') + `  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  const mean = {}; for (const S of SETTINGS) { mean[S.id] = { quads: +(rows.reduce((a, x) => a + x.hidden[S.id].quads, 0) / rows.length).toFixed(4), sections: +(rows.reduce((a, x) => a + x.hidden[S.id].sections, 0) / rows.length).toFixed(4) }; }
  return { views: rows.length, rd: 10, vxLod: 44, settings: SETTINGS, mean, rows };
}

function town() {
  const seed = 3616214791, g = W.gen(seed, W.newestVgen()), s = W.findSite(g, { name: 'Fliederfeld', near: [294, -1044], r: 800 });
  const at = s ? [s.x, s.z] : [294, -1044], ccx = at[0] >> 4, ccz = at[1] >> 4, sum = { opaque: 0, cutout: 0, trans: 0, vx: 0 };
  const eye = [at[0], 80, at[1]];
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) for (let sy = 0; sy < 16; sy++) {
    const B = W.chunk(g, ccx + dx, ccz + dz).blocks; let any = false; const base = sy << 12; for (let i = 0; i < 4096; i++) if (B[base + i]) { any = true; break; }
    if (!any) continue;
    const r = sectionQuads(g, ccx + dx, ccz + dz, sy, eye, 1e9); sum.opaque += r.opaque; sum.cutout += r.cutout; sum.trans += r.trans; sum.vx += r.vx;
  }
  const tot = sum.opaque + sum.cutout + sum.trans + sum.vx;
  const share = (n) => +(n / tot).toFixed(4);
  console.log(`town Fliederfeld at ${at}: ${tot} quads — blocks ${(share(sum.opaque) * 100).toFixed(1)} %, mini-voxel ${(share(sum.vx) * 100).toFixed(1)} %, plants and water ${(share(sum.cutout + sum.trans) * 100).toFixed(1)} %`);
  return { name: 'Fliederfeld', seed, at, chunks: 49, quads: tot, layers: sum, share: { blocks: share(sum.opaque), vx: share(sum.vx), plantsWater: share(sum.cutout + sum.trans) } };
}

const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
out.made = new Date().toISOString().slice(0, 10); out.vgen = W.newestVgen();
if (TASKS.includes('horizon')) out.horizon = horizon();
if (TASKS.includes('town')) out.town = town();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('wrote', OUT);

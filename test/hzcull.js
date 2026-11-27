// Horizontschatten (src/shared/hzcull.js): the sections hidden behind solid ground are not drawn — and none of them could
// have been seen. Found in the lab (lab/tools/horizon.js); this test is its proof.
//  a · a wall between the eye and a section hides it; a section that rises over the wall, or stands beside it, or holds
//      the eye, stays; an occluder as far as the target is never used for it (the tie goes to the target)
//  b · the eye's slack: a hidden verdict holds for every eye within δ (rays from many eyes in the ball)
//  c · generated worlds (the newest generator, a walker's eye, a hilltop, a valley, a flight, a village): voxel rays from
//      eyes within δ to the visible surface of every hidden section — not one clear; the hidden share of the faces
//      (the triangles' stand-in) at least 3 % on average with the harshest slack (E 1, δ 1; render distance 5)
//  d · cells: the erosion E keeps a cell only where its whole window (± E) is solid; a missing neighbour costs only the
//      cells that reach into it
//   node test/hzcull.js
'use strict';
const V = require('./load_shared.js');
const W = require('../lab/lib/world.js');
const HC = V.HzCull, R = V.R, F = V.F;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) { fails++; console.log('  ✗ ' + msg + (info ? '  — ' + info : '')); } else console.log('  ✓ ' + msg); };
const OCC = (s) => !!s && (R.T.flags[s] & F.OPAQUE) !== 0 && (R.T.flags[s] & F.FULL) !== 0;
let seed = 99; const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };   // (the eyes within δ)
let vseed = 4711; const vrnd = () => { vseed = (vseed * 1103515245 + 12345) >>> 0; return vseed / 4294967296; };   // (the views: their own stream, so the rays drawn before never move them)

// ---- a · the plain cases (occluders and targets by hand)
console.log('a · the plain cases');
{
  const eye = [0.5, 70, 0.5], occ = new Float64Array([20, 24, -40, 40, 0, 90]);   // a wall 4 thick, 80 wide, up to y 90, at x 20–24
  const T = (x0, y0, y1, z0) => [x0, x0 + 16, y0, y1, z0, z0 + 16];
  const tg = new Float64Array([].concat(T(40, 64, 80, -8), T(40, 64, 128, -8), T(40, 64, 80, 120), T(-8, 64, 80, -8), T(18, 64, 80, -8)));
  const hid = new Uint8Array(5);
  HC.cull(eye, 0, occ, 1, tg, 5, hid);
  check(hid[0] === 1, 'a section behind a long wall is hidden (the wall\'s arc cut into pieces: the piece in front is near)');
  check(hid[1] === 0, 'a section that rises over the wall stays');
  check(hid[2] === 0, 'a section beside the wall stays');
  check(hid[3] === 0, 'the section that holds the eye stays');
  check(hid[4] === 0, 'a section reaching into the wall\'s distance is not hidden by it (targets first on a tie)');
  // the same wall with the eye's slack: δ 1 still hides the far section; δ 2.5 (the wall shrinks to nothing) does not
  HC.cull(eye, 1, occ, 1, tg, 5, hid); check(hid[0] === 1, 'δ 1: still hidden');
  HC.cull(eye, 2.5, occ, 1, tg, 5, hid); check(hid[0] === 0, 'δ 2.5: a 4-thick wall shrinks away, nothing hidden');
}

// ---- the world's occluders and targets round an eye (from generated chunks), and the proof
function scene(g, eye, rd, E) {
  const pcx = Math.floor(eye[0]) >> 4, pcz = Math.floor(eye[2]) >> 4, runs = new Map();
  const runOf = (cx, cz) => { const k = cx + ',' + cz; let r = runs.get(k); if (!r) { const ch = W.chunk(g, cx, cz); r = HC.runs(ch.blocks, (ch.blocks.length / 256) | 0, OCC); runs.set(k, r); } return r; };
  const occ = [], tg = [], secs = [];
  for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
    if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5)) continue;
    const cx = pcx + dx, cz = pcz + dz, r = runOf(cx, cz);
    const cells = HC.cells(r.run, (ox, oz) => (Math.abs(dx + ox) <= rd + 1 && Math.abs(dz + oz) <= rd + 1 ? runOf(cx + ox, cz + oz).run : null), E);
    for (let k = 0; k < 21; k++) { const b = cells[k * 2], t = cells[k * 2 + 1]; if (t <= b) continue; const [x0, z0, sz] = HC.cellRect(k); occ.push(cx * 16 + x0, cx * 16 + x0 + sz, cz * 16 + z0, cz * 16 + z0 + sz, b, t); }
    for (let sy = 0; sy < r.top.length; sy++) { const top = r.top[sy]; if (top < 0) continue; tg.push(cx * 16, cx * 16 + 16, sy * 16, top, cz * 16, cz * 16 + 16); secs.push({ cx, sy, cz, top }); }
  }
  return { occ: new Float64Array(occ), nOcc: occ.length / 6, tg: new Float64Array(tg), secs };
}
// a voxel ray from a to b: clear unless an opaque full block lies on it before b's cell (Amanatides–Woo)
function clear(g, a, b) {
  let x = Math.floor(a[0]), y = Math.floor(a[1]), z = Math.floor(a[2]);
  const tx = Math.floor(b[0]), ty = Math.floor(b[1]), tz = Math.floor(b[2]);
  if (OCC(W.block(g, x, y, z))) return false;   // (an eye inside rock sees nothing: such eyes are not drawn from)
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = Math.abs(1 / (dx || 1e-12)), tdy = Math.abs(1 / (dy || 1e-12)), tdz = Math.abs(1 / (dz || 1e-12));
  let mx = sx > 0 ? (x + 1 - a[0]) * tdx : (a[0] - x) * tdx, my = sy > 0 ? (y + 1 - a[1]) * tdy : (a[1] - y) * tdy, mz = sz > 0 ? (z + 1 - a[2]) * tdz : (a[2] - z) * tdz;
  for (let i = 0; i < 4000; i++) {
    if (x === tx && y === ty && z === tz) return true;
    if (mx < my && mx < mz) { x += sx; mx += tdx; } else if (my < mz) { y += sy; my += tdy; } else { z += sz; mz += tdz; }
    if (Math.min(mx, my, mz) > 1 && x === tx && y === ty && z === tz) return true;
    if (x === tx && y === ty && z === tz) return true;
    if (OCC(W.block(g, x, y, z))) return false;
  }
  return true;
}
// the visible surface points of a section: centres of faces toward a cell that is not opaque, nudged into that cell
function surface(g, s, k) {
  const pts = [], X0 = s.cx * 16, Y0 = s.sy * 16, Z0 = s.cz * 16, D = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const all = [];
  for (let y = Y0; y < Math.min(Y0 + 16, s.top); y++) for (let z = Z0; z < Z0 + 16; z++) for (let x = X0; x < X0 + 16; x++) {
    if (!W.block(g, x, y, z)) continue;
    for (const [ux, uy, uz] of D) if (!OCC(W.block(g, x + ux, y + uy, z + uz))) all.push([x + 0.5 + ux * 0.501, y + 0.5 + uy * 0.501, z + 0.5 + uz * 0.501]);
  }
  const step = Math.max(1, Math.floor(all.length / k));
  for (let i = 0; i < all.length && pts.length < k; i += step) pts.push(all[i]);
  return { pts, faces: all.length };
}
function proveView(g, eye, rd, E, delta, k) {
  const sc = scene(g, eye, rd, E), hid = new Uint8Array(sc.secs.length);
  HC.cull(eye, delta, sc.occ, sc.nOcc, sc.tg, sc.secs.length, hid);
  let rays = 0, bad = null, fAll = 0, fHid = 0;
  for (let i = 0; i < sc.secs.length; i++) {
    const s = sc.secs[i], sf = surface(g, s, hid[i] ? k : 0);
    fAll += sf.faces; if (!hid[i]) continue; fHid += sf.faces;
    for (const p of sf.pts) {
      for (let e = 0; e < 3; e++) {
        // the eye itself, then eyes within δ (a random direction, a random radius)
        let v = [0, 0, 0];
        if (e && delta > 0) { let a, b, c, l; do { a = rnd() * 2 - 1; b = rnd() * 2 - 1; c = rnd() * 2 - 1; l = Math.hypot(a, b, c); } while (l > 1 || l < 1e-3); const r = delta * Math.cbrt(rnd()) / l; v = [a * r, b * r, c * r]; }
        const ey = [eye[0] + v[0], eye[1] + v[1], eye[2] + v[2]];
        rays++;
        if (clear(g, ey, p)) { bad = { s: [s.cx, s.sy, s.cz], p, eye: ey }; break; }
      }
      if (bad) break;
    }
    if (bad) break;
  }
  return { rays, bad, hidden: hid.reduce((a, b) => a + b, 0), secs: sc.secs.length, faceShare: fAll ? fHid / fAll : 0 };
}

// ---- b · the eye's slack, with a hand-built world: a ridge 6 thick
console.log('b · the eye\'s slack (rays from eyes within δ)');
{
  const g = W.gen(3616214791, W.newestVgen());
  // a valley eye: the lowest of a few spots near the user's town, an eye 1.62 over the ground
  let best = null; for (let i = 0; i < 30; i++) { const x = 294 + Math.floor((vrnd() - 0.5) * 600), z = -1044 + Math.floor((vrnd() - 0.5) * 600), t = W.top(g, x, z); if (!(R.T.flags[t.s] & F.FLUID) && (!best || t.y < best[1])) best = [x + 0.5, t.y, z + 0.5]; }
  const eye = [best[0], best[1] + 1 + 1.62, best[2]];
  for (const delta of [0.05, 0.5, 1.5]) { const r = proveView(g, eye, 5, 1, delta, 12); check(!r.bad, `δ ${delta}: ${r.hidden}/${r.secs} hidden, ${r.rays} rays, none clear`, r.bad && JSON.stringify(r.bad)); }
}

// ---- c · generated worlds
console.log('c · generated worlds (E 1, δ 1)');
{
  const vg = W.newestVgen(), shares = [];
  const seeds = [3616214791, 1, 12345];
  for (const sd of seeds) {
    const g = W.gen(sd, vg);
    const views = [];
    const cx = Math.floor((vrnd() - 0.5) * 4000), cz = Math.floor((vrnd() - 0.5) * 4000);
    // a walker, a hilltop, a valley, a flight; and a village when one is near
    const pts = []; for (let i = 0; i < 24; i++) { const x = cx + Math.floor((vrnd() - 0.5) * 500), z = cz + Math.floor((vrnd() - 0.5) * 500); const t = W.top(g, x, z); if (!(R.T.flags[t.s] & F.FLUID)) pts.push([x + 0.5, t.y, z + 0.5]); }
    if (!pts.length) continue;
    pts.sort((a, b) => a[1] - b[1]);
    views.push(['walker', [pts[pts.length >> 1][0], pts[pts.length >> 1][1] + 2.62, pts[pts.length >> 1][2]]]);
    views.push(['hilltop', [pts[pts.length - 1][0], pts[pts.length - 1][1] + 2.62, pts[pts.length - 1][2]]]);
    views.push(['valley', [pts[0][0], pts[0][1] + 2.62, pts[0][2]]]);
    views.push(['flight', [pts[1][0], pts[1][1] + 40, pts[1][2]]]);
    const site = W.sitesNear(g, cx, cz, 900)[0];
    if (site) { const t = W.top(g, site.x, site.z); views.push(['village', [site.x + 0.5, t.y + 2.62, site.z + 0.5]]); }
    for (const [kind, eye] of views) {
      const r = proveView(g, eye, 5, 1, 1, 10);
      shares.push(r.faceShare);
      check(!r.bad, `seed ${sd} ${kind}: ${r.hidden}/${r.secs} sections hidden (${(r.faceShare * 100).toFixed(1)} % of the faces), ${r.rays} rays, none clear`, r.bad && JSON.stringify(r.bad));
    }
  }
  const mean = shares.reduce((a, b) => a + b, 0) / Math.max(1, shares.length);
  check(mean >= 0.03, `mean hidden share of the faces ${(mean * 100).toFixed(1)} % (≥ 3 %: the harshest slack — E 1 every way, δ 1 — at render distance 5, flights and hilltops included)`);
}

// ---- d · cells
console.log('d · cells');
{
  // a flat chunk: every column solid from 0 to 64 (run [0, 64)); a hole at block column (4, 4) (a corner of four cells)
  const run = new Int16Array(512); for (let c = 0; c < 256; c++) { run[c * 2] = 0; run[c * 2 + 1] = 64; }
  const flat = run.slice(); const holed = run.slice(); holed[((4 << 4) | 4) * 2 + 1] = 0;
  const nbAll = () => flat, nbNone = () => null;
  let c = HC.cells(flat, nbAll, 1);
  check(c[1] === 63 && c[0] === 1 && c[41] === 63, 'flat ground: every cell solid in [1, 63) (E 1)');
  c = HC.cells(holed, nbAll, 1);
  // the hole at (4, 4) lies in cell 5 (x 4–7, z 4–7) and in the windows (± 1) of cells 0, 1 and 4
  const dead = []; for (let k = 0; k < 16; k++) if (c[k * 2 + 1] <= c[k * 2]) dead.push(k);
  check(dead.join(',') === '0,1,4,5' || dead.join(',') === '5,0,1,4' || JSON.stringify(dead) === JSON.stringify([0, 1, 4, 5]), 'a hole costs the cells whose window holds it (0, 1, 4, 5)', JSON.stringify(dead));
  check(c[16 * 2 + 1] <= c[16 * 2] && c[17 * 2 + 1] > c[17 * 2] && c[20 * 2 + 1] <= c[20 * 2], 'and the 8 × 8 and 16 × 16 cells holding them');
  c = HC.cells(flat, nbNone, 1);
  const live = []; for (let k = 0; k < 16; k++) if (c[k * 2 + 1] > c[k * 2]) live.push(k);
  check(live.join(',') === '5,6,9,10', 'no neighbours known: only the inner four cells (their windows stay inside)', live.join(','));
  c = HC.cells(flat, nbNone, 0);
  check(c[1] === 64 && c[41] === 64, 'E 0: every cell, the band unshrunk');
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);

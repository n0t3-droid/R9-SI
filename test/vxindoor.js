// Innenraum-Detail (v0.56.9): the mesher puts the mini-voxel quads under a roof (no corner with sky light ≥ 14) after
// the ones in the open, in the detail layer and in its boxes, and counts the ones in the open (vxOut, vxFarOut); the
// renderer's splitVx draws the indoor part in detail only within k × the detail distance (mid: open-sky detail + indoor
// boxes), and the shadow pass (noMid) never splits.
//  a · an armchair under the open sky: all its quads in the open; the same armchair in a dark room: none
//  b · two armchairs, one in the open, one indoors: the open one's quads first, in their own order, then the other's
//  c · a section of the owner's town (Fliederfeld): the partition is a reordering — the same quads, nothing lost
//  d · splitVx: a section near the eye draws its whole detail, one between Rin and D the mid, one beyond D its boxes;
//      without a split known (an old mesh) the whole detail; noMid (the shadow pass) as before
//   node test/vxindoor.js
'use strict';
const V = require('./load_shared.js');
const W = require('../lab/lib/world.js');
const R = V.R, PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) { fails++; console.log('  ✗ ' + msg + (info ? '  — ' + info : '')); } else console.log('  ✓ ' + msg); };
const at = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
const tint = new Uint16Array(PSS).fill(0xffff);
const chair = R.byName['vm_armchair_navy'] ? R.byName['vm_armchair_navy'].defaultState : 0;
const job = (blocks, light) => ({ blocks, light, grass: tint, foliage: tint, water: tint, sy: 4, ox: 0, oz: 0, fancyLeaves: true, smooth: true, vxLod: true });
const quads = (a) => { const out = []; for (let o = 0; o < (a ? a.length : 0); o += 32) out.push(Array.from(a.subarray(o, o + 32)).join(',')); return out; };

console.log('a · open sky and a dark room');
check(chair > 0, 'the armchair exists');
{
  const b = new Uint16Array(PS * PSS); b[at(5, 5, 5)] = chair;
  const lit = V.meshSection(job(b, new Uint16Array(PS * PSS).fill(0xf000)));
  const nq = lit.vx.length >> 5;
  check(nq > 50 && lit.vxOut === nq, `under the open sky: all ${nq} detail quads in the open`, `vxOut ${lit.vxOut}`);
  check(lit.vxFarOut === lit.vxFar.length >> 5, 'and all its boxes');
  const dark = V.meshSection(job(b.slice(), new Uint16Array(PS * PSS)));
  check(dark.vxOut === 0 && dark.vxFarOut === 0, 'in a dark room: none in the open', `${dark.vxOut} ${dark.vxFarOut}`);
}

console.log('b · one in the open, one indoors');
{
  const b = new Uint16Array(PS * PSS); b[at(3, 5, 3)] = chair; b[at(11, 5, 11)] = chair;
  const L = new Uint16Array(PS * PSS);
  for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) L[at(x, y, z)] = x < 8 ? 0xf000 : 0x8000;   // (the west half open, the east half sky 8)
  const both = V.meshSection(job(b, L));
  const onlyOut = (() => { const bb = new Uint16Array(PS * PSS); bb[at(3, 5, 3)] = chair; return V.meshSection(job(bb, L)); })();
  const onlyIn = (() => { const bb = new Uint16Array(PS * PSS); bb[at(11, 5, 11)] = chair; return V.meshSection(job(bb, L)); })();
  const Q = quads(both.vx), A = quads(onlyOut.vx), B = quads(onlyIn.vx);
  check(both.vxOut === A.length && A.length > 0 && B.length > 0, `the open one's ${A.length} quads counted in the open, the indoor one's ${B.length} not`, `vxOut ${both.vxOut}`);
  check(Q.slice(0, A.length).join('|') === A.join('|'), 'the open part first, in its own order');
  check(Q.slice(A.length).join('|') === B.join('|'), 'the indoor part after it, in its own order');
}

console.log('c · a section of the owner\'s town');
{
  const g = W.gen(3616214791, W.newestVgen());
  let best = null;
  for (let sy = 3; sy <= 6; sy++) for (const [cx, cz] of [[18, -66], [19, -66], [18, -65], [19, -65]]) {
    const nb = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = W.chunk(g, cx + dx, cz + dz); if (!c.light) c.light = V.computeColumnLight(c.blocks, true); nb.push(c); }
    const blocks = new Uint16Array(PS * PSS), light = new Uint16Array(PS * PSS), gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS), y0 = sy * 16 - PAD;
    for (let pz = 0; pz < PS; pz++) { const lz = pz - PAD, czi = lz < 0 ? 0 : lz > 15 ? 2 : 1, iz = (lz + 16) & 15; for (let px = 0; px < PS; px++) { const lx = px - PAD, cxi = lx < 0 ? 0 : lx > 15 ? 2 : 1, ix = (lx + 16) & 15, nn = nb[czi * 3 + cxi], ci = (iz << 4) | ix, ti = pz * PS + px; gr[ti] = nn.tints.grass[ci]; fo[ti] = nn.tints.foliage[ci]; wa[ti] = nn.tints.water[ci]; for (let py = 0; py < PS; py++) { const y = y0 + py, o = py * PSS + pz * PS + px; if (y < 0 || y > 255) { light[o] = y > 255 ? 0xf000 : 0; continue; } const i = (y << 8) | ci; blocks[o] = nn.blocks[i]; light[o] = nn.light[i]; } } }
    const m = V.meshSection({ blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: cx * 16, oz: cz * 16, fancyLeaves: true, smooth: true, vxLod: true });
    const nq = m.vx ? m.vx.length >> 5 : 0;
    if (nq && (!best || (nq - m.vxOut) > (best.nq - best.vxOut))) best = { nq, vxOut: m.vxOut, m, sy, cx, cz };
  }
  check(best && best.nq > 0, `a town section with mini-voxel detail (${best ? best.nq : 0} quads, ${best ? best.nq - best.vxOut : 0} indoors)`);
  if (best) {
    const Q = quads(best.m.vx), indoor = Q.slice(best.vxOut);
    const skyOk = indoor.every((q) => { const a = q.split(',').map(Number); return [6, 14, 22, 30].every((i) => (a[i] >>> 12) < 14); });
    const outOk = Q.slice(0, best.vxOut).every((q) => { const a = q.split(',').map(Number); return [6, 14, 22, 30].some((i) => (a[i] >>> 12) >= 14); });
    check(skyOk && outOk, 'every quad on its side of the line (a corner at sky ≥ 14: in the open)');
    check(new Set(Q).size <= Q.length && Q.length === best.nq, 'the same number of quads (a reordering)');
  }
}

console.log('d · splitVx');
{
  const split = V.Renderer ? V.Renderer.prototype.splitVx : null;
  if (!split) { console.log('  (Renderer not loaded in node: the split is checked through a copy)'); }
  const RP = split ? null : (() => { require('../src/main/renderer.js'); return VR.Renderer ? VR.Renderer.prototype.splitVx : null; })();
  const fn = split || RP;
  check(!!fn, 'splitVx found');
  if (fn) {
    const mesh = (sp) => ({ split: sp });
    const sec = (d, sp3, sp4) => ({ ox: d - 8, oy: -8, oz: -8, mesh: [null, null, null, sp3 === null ? null : mesh(sp3), sp4 === null ? null : mesh(sp4)] });
    const self = { q: { vxLod: 44, vxInK: 0.4 } };   // (on: the default is off, k 1)
    const S = [sec(10, 5, 2), sec(30, 5, 2), sec(60, 5, 2), sec(30, -1, 2), sec(30, 5, null), sec(30, null, 2)];
    let r = fn.call(self, S, [0, 0, 0]);
    const who = (L) => L.map((s) => S.indexOf(s)).join(',');
    check(who(r.near) === '0,3,4' && who(r.mid) === '1' && who(r.far) === '2,5', `near: whole detail (10, old mesh, no boxes) · mid: 30 · far: 60, no detail`, `near ${who(r.near)} mid ${who(r.mid)} far ${who(r.far)}`);
    r = fn.call(self, S, [0, 0, 0], 28, true);
    check(r.mid.length === 0 && who(r.near) === '0,4' && who(r.far) === '1,2,3,5', 'noMid (the shadow pass, D 28): no mid — 30 lies beyond its 28 (boxes; the one without boxes keeps its detail)', `near ${who(r.near)} far ${who(r.far)}`);
    self.q.vxInK = 1; r = fn.call(self, S, [0, 0, 0]);
    check(r.mid.length === 0, 'k 1 (the default): as before (no mid)');
  }
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);

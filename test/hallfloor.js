// t-polish2 · the hall's floor (gap 1 of docs/superpowers/plans/2026-10-16-t-polish2.md): Weißstadt's nave — the street,
// the plaza's paved ring outside the marble disc, the cross street — is laid in polished porcelain tile with polished
// andesite bands at vgen 12 (new worlds), so t-material's mirror finds a clear reflecting floor (t1_22); vgen ≤ 11 worlds
// keep every chunk.
//  a · vgen 11's hall city (seed 53, the meadow site of cell (−2, −1)): 25 chunks over the hall hashed as the base made them
//  b · vgen 12: the street's cells porcelain with andesite bands (every eight rows across, the kerb lines), the plaza's
//      marble disc and its travertine rings as before, its ring outside the disc and the cross street porcelain
//  c · vgen 12 changes nothing but those floor cells (every other cell of the plan the same as vgen 11)
//  d · new worlds are vgen 12 or later (game.js createWorld; f-arrival: 13)
//  e · the two floors are polished in t-material's table: a clear coat ≥ 0.6, the sharp polish
//   bash test/wt_run.sh hallfloor.js 300
const V = require('./load_shared.js');
const fs = require('fs');
const VG = V.VillageGen, R = V.R, H = VG.HALL;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const nm = (s) => (s > 0 && R.types[R.T.type[s]]) ? R.types[R.T.type[s]].name : 'air';
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const SEED = 53, CELL = [-2, -1];
const EXPECT11 = '095bff57';   // recorded on v042 after v0.48 (92835e8), before this change

console.log('a · vgen 11 keeps its chunks');
const g11 = V.makeGen('overworld', SEED, { vgen: 11 }), g12 = V.makeGen('overworld', SEED, { vgen: 12 });
const s11 = VG.site(g11, CELL[0], CELL[1]), s12 = VG.site(g12, CELL[0], CELL[1]);
check(s11 && s11.style === 'hall' && s12 && s12.style === 'hall' && s11.x === s12.x && s11.z === s12.z, 'the hall city stands at the same place in both', s11 && `${s11.x}, ${s11.z}`);
{
  let h = 2166136261 >>> 0, n = 0;
  for (let cz = Math.floor((s11.z - 100) / 16); cz <= Math.floor((s11.z + 100) / 16); cz += 3) for (let cx = Math.floor((s11.x - 100) / 16); cx <= Math.floor((s11.x + 100) / 16); cx += 3) { h = fnv(h, g11.generate(cx, cz).blocks); n++; }
  const hex = h.toString(16).padStart(8, '0');
  check(hex === EXPECT11, `${n} chunks over the hall at vgen 11 hash as before`, hex + (hex === EXPECT11 ? '' : ', expected ' + EXPECT11));
}

console.log('b · vgen 12: the nave\'s floor');
const cellsOf = (plan) => {
  const m = new Map();
  for (const b of plan.chunks.values()) {
    for (let i = 0; i < b.f.length; i += 5) for (let y = b.f[i + 2]; y <= b.f[i + 3]; y++) m.set(b.f[i] + ',' + y + ',' + b.f[i + 1], b.f[i + 4]);
    for (let i = 0; i < b.o.length; i += 4) m.set(b.o[i] + ',' + b.o[i + 1] + ',' + b.o[i + 2], b.o[i + 3]);
  }
  return m;
};
const p11 = VG.plan(g11, s11), p12 = VG.plan(g12, s12);
const c11 = cellsOf(p11), c12 = cellsOf(p12), h12 = p12.hall, F = h12.F;
const W2 = (u, v) => { const q = ROT[h12.r](u, v); return [h12.cx + q[0], h12.cz + q[1]]; };
const floor = (cells, u, v) => { const [x, z] = W2(u, v); return nm(cells.get(x + ',' + F + ',' + z) || 0); };
check(H.FLOOR_VGEN === 12 && typeof VG.hallFloorOn === 'function' && VG.hallFloorOn(g12) && !VG.hallFloorOn(g11), 'the polished floor is vgen 12\'s (VG.HALL.FLOOR_VGEN, VG.hallFloorOn)');
{
  const kinds = {}; let n = 0, band = 0, bandOk = 0, edge = 0, edgeOk = 0;
  for (let v = -70; v <= 36; v++) {
    if (Math.abs(v) <= H.PV) continue;
    for (let u = -H.ST; u <= H.ST; u++) {
      const b = floor(c12, u, v); kinds[b] = (kinds[b] || 0) + 1; n++;
      if (Math.abs(u) === H.ST) { edge++; if (b === 'polished_andesite') edgeOk++; }
      else if (((v % 8) + 8) % 8 === 0) { band++; if (b === 'polished_andesite') bandOk++; }
    }
  }
  console.log('     the street\'s cells at vgen 12:', JSON.stringify(kinds));
  check((kinds.porcelain_tile || 0) + (kinds.polished_andesite || 0) === n && kinds.porcelain_tile > n * 0.6, `the street is porcelain tile with andesite bands (${n} cells)`);
  check(edge > 100 && edgeOk === edge && band > 40 && bandOk === band, `andesite along both kerb lines and across the street every eight rows (${edgeOk}/${edge} kerb, ${bandOk}/${band} band cells)`);
  const k11 = {}; for (let v = -70; v <= 36; v++) { if (Math.abs(v) <= H.PV) continue; for (let u = -H.ST; u <= H.ST; u++) { const b = floor(c11, u, v); k11[b] = (k11[b] || 0) + 1; } }
  check(!k11.porcelain_tile && (k11.paver_grey || 0) > 0, 'vgen 11\'s street stays grey pavers', JSON.stringify(k11));
}
{
  let disc = 0, discSame = 0, ring = 0, ringP = 0;
  for (let v = -H.PV; v <= H.PV; v++) for (let u = -H.ST - 8; u <= H.ST + 8; u++) {
    const d = Math.hypot(u, v), a = floor(c11, u, v), b = floor(c12, u, v);
    if (!/marble_white|travertine|paver|granite|porcelain|andesite/.test(a)) continue;
    if (d <= H.PR) { disc++; if (a === b) discSame++; } else { ring++; if (b === 'porcelain_tile') ringP++; }
  }
  check(disc > 300 && discSame === disc, `the plaza's marble disc and its travertine rings as before (${discSame} of ${disc})`);
  check(ring > 20 && ringP === ring, `the plaza's paving outside the disc is porcelain (${ringP} of ${ring})`);
}

console.log('c · nothing else changes');
{
  let diff = 0, floorDiff = 0, other = [];
  const keys = new Set([...c11.keys(), ...c12.keys()]);
  for (const k of keys) {
    const a = c11.get(k) || 0, b = c12.get(k) || 0; if (a === b) continue;
    diff++;
    const [x, y, z] = k.split(',').map(Number);
    if (y === F && /paver|granite/.test(nm(a)) && /porcelain|andesite/.test(nm(b))) floorDiff++; else if (other.length < 4) other.push(k + ' ' + nm(a) + '→' + nm(b));
  }
  check(diff > 0 && floorDiff === diff, `only floor cells of pavers become porcelain or andesite (${floorDiff} of ${diff} changed cells)`, other.join(' · ') || undefined);
}

console.log('d · new worlds');
{
  const src = fs.readFileSync(__dirname + '/../src/main/game.js', 'utf8');
  // (f-arrival made new worlds vgen 13 — the polished floor is in every vgen from 12 on: the default may only grow)
  const m = /vgen: o\.vgen \? \+o\.vgen : (\d+) \}/.exec(src);
  check(!!m && +m[1] >= 12, `game.js creates new worlds at vgen 12 or later (vgen ${m ? m[1] : '?'})`);
}

console.log('e · polished in the material table');
{
  for (const f of ['tex_pbr']) require('../src/main/' + f + '.js');
  const P = V.PBR, a = P.of('porcelain_tile'), b = P.of('polished_andesite');
  check(a.coat >= 0.6 && b.coat >= 0.6 && P.crBits(a.cr) === 0 && P.crBits(b.cr) === 0 && a.metal === 0, 'porcelain tile and polished andesite: a clear coat ≥ 0.6, the sharp polish', JSON.stringify([a, b]));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

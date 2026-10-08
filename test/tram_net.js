// The rail network the trams run on (src/shared/gen_rails.js, its providers in gen_citadel.js), without a browser:
//  (a) every placed line is one track: consecutive points are one block apart (8-connected), no gaps, no line through a
//      third town (the line's own towns are its two ends)
//  (b) every line ends at stations: the first and the last 9 points are a flat platform (the isles' bridges excepted:
//      they leave their rims on a slope, and the rim is the platform), and each end is a town's station (within the
//      town's radius + 24), the Heartland's plinth or plaza, a viaduct's end on the ground, or a rim of an isle
//  (c) the track bridges where the land drops: at every point 4 or more blocks above the ground there is a support (a
//      pillar or an arch spring) within 7 blocks under the deck, in the blocks the line really generates
//  (d) the Heartland's citadel viaducts carry a track from world generator 6 on: the rail block lies on each deck's
//      centre in the generated chunks; the old generator (vgen 5) has no track and no citadel line; the line is only
//      listed near the viaducts (a far point gets none of them)
//  (e) every town with a placed link has a placed line at its station (the trams reach each linked town)
//  (f) crossings: two lines within a block of each other in plan and at most 3 blocks apart in height. The Heartland has
//      one, a known gap (no junction is built): the citadel viaduct 0 under the Canyon Loop at about (-183, 251). The
//      track test skips the blocks within 6 of it. (A village link through the citadel zone is refused in new worlds.)
//  bash test/wt_run.sh tram_net.js 300
const V = require('./load_shared.js');
const RG = V.RailGen, VG = V.VillageGen, R = V.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const t0 = Date.now();

// (a) + (b) on every line of the heart and the village worlds around it
function lineChecks(name, g, R0, cx, cz) {
  const lines = RG.near(g, cx, cz, R0);
  let gaps = 0, unflat = 0, badEnds = 0, third = 0;
  for (const d of lines) {
    const P = d.pts, n = P.length / 3;
    for (let i = 1; i < n; i++) {
      const dx = Math.abs(P[i * 3] - P[(i - 1) * 3]), dz = Math.abs(P[i * 3 + 2] - P[(i - 1) * 3 + 2]);
      if (dx > 1 || dz > 1 || (dx === 0 && dz === 0 && P[i * 3 + 1] === P[(i - 1) * 3 + 1])) gaps++;
    }
    const k = Math.min(8, n - 1);
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= k; i++) { lo = Math.min(lo, P[i * 3 + 1]); hi = Math.max(hi, P[i * 3 + 1]); }
    let lo2 = 1e9, hi2 = -1e9;
    for (let i = n - 1 - k; i < n; i++) { lo2 = Math.min(lo2, P[i * 3 + 1]); hi2 = Math.max(hi2, P[i * 3 + 1]); }
    // the isles' bridges leave their rims on a slope of their own: the rim is the platform, so they are not counted here
    if ((hi - lo > 1 || hi2 - lo2 > 1) && !/^isle-/.test(d.key)) unflat++;
    // the ends: a station — a town's (within its radius + 24), the Heartland's plinth, the Gate Plaza's rim, or a
    // viaduct's end where its deck lands on the ground (the canyon's mesas)
    const stationAt = (x, z, y) => {
      const C = VG.cell(g), ci = Math.floor(x / C), cj = Math.floor(z / C);
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const t = VG.site(g, ci + di, cj + dj); if (!t) continue;
        const rad = VG.siteRad ? VG.siteRad(g, t) : VG.rad(g);
        if (Math.hypot(t.x - x, t.z - z) <= rad + 24) return true;
      }
      if (Math.hypot(x - V.Heart.CITADEL.x, z - V.Heart.CITADEL.z) < 60) return true;
      if (Math.abs(Math.abs(x) - 58) < 10 && Math.abs(z - 140) < 10) return true;
      if (VR.IslesGen && VR.IslesGen.list) for (const I of VR.IslesGen.list(g)) { const sh = g.islandShape(I, x, z); if (sh && sh.top >= y - 2) return true; }
      return g.surfaceY(x, z) >= y - 4;
    };
    const endOk = (x, z, y) => stationAt(x, z, y);
    const e0 = [P[0], P[1], P[2]], e1 = [P[(n - 1) * 3], P[(n - 1) * 3 + 1], P[(n - 1) * 3 + 2]];
    if (!endOk(e0[0], e0[2], e0[1]) || !endOk(e1[0], e1[2], e1[1])) { badEnds++; if (badEnds <= 3) console.log('    end not a station: ' + d.key + ' at ' + e0.join(',') + ' / ' + e1.join(',')); }
  }
  check(lines.length > 0, name + ': the window holds ' + lines.length + ' lines');
  check(gaps === 0, name + ': every line is one track, no gaps (' + gaps + ' breaks)');
  check(unflat === 0, name + ': both ends of every line are flat platforms (' + unflat + ' not flat)');
  check(badEnds === 0, name + ': every end is a station (' + badEnds + ' lines end in the air)');
  return lines;
}

const g6 = V.makeGen('overworld', 12345, { vgen: 6 });
const L6 = lineChecks('vgen 6 · the Heartland with its towns', g6, 1300, 0, 0);
check(L6.some(d => /heart-loop/.test(d.key)), 'the Canyon Loop is among them');
check(L6.some(d => /heart-viaduct-0/.test(d.key)) && L6.some(d => /heart-viaduct-1/.test(d.key)), 'both citadel viaducts are among them');

// (c) the bridges: the internal lines (their blocks come from RG.ops)
let unsupported = 0, high = 0, checkedLines = 0;
const seen = new Set();
for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
  const s = VG.site(g6, i, j); if (!s) continue;
  for (const lk of RG.linksOf(g6, s)) {
    if (seen.has(lk.key)) continue; seen.add(lk.key);
    const Ln = RG.line(g6, lk); if (!Ln) continue;
    checkedLines++;
    const ops = RG.ops(g6, Ln);
    const under = new Map();   // "x,z" → the placed block ys under the deck (the pillars and the arch springs)
    for (const b of ops.values()) {
      for (let k = 0; k < b.f.length; k += 5) for (let y = b.f[k + 2]; y <= b.f[k + 3]; y++) { const key = b.f[k] + ',' + b.f[k + 1]; if (!under.has(key)) under.set(key, []); under.get(key).push(y); }
      for (let k = 0; k < b.o.length; k += 4) { const key = b.o[k] + ',' + b.o[k + 2]; if (!under.has(key)) under.set(key, []); under.get(key).push(b.o[k + 1]); }
    }
    Ln.pts.forEach((p, i) => {
      const y = Ln.Y[i], gr = Ln.ground[i];
      if (y - gr < 4) return;
      high++;
      // the support is under the deck's width (the trestles stand at the sides; the arches span the middle)
      let ok = false;
      for (let a = -2; a <= 2 && !ok; a++) for (let b = -2; b <= 2 && !ok; b++) { const ys = under.get((p[0] + a) + ',' + (p[1] + b)) || []; if (ys.some(q => q <= y - 2 && q >= y - 8)) ok = true; }
      if (!ok) unsupported++;
    });
  }
}
check(checkedLines > 0 && high > 0, 'bridges: ' + checkedLines + ' lines, ' + high + ' points high above the land');
check(unsupported === 0, 'every point high above the land stands on a pillar or an arch spring (' + unsupported + ' bare)');

// (d) the citadel viaducts in the generated chunks of a vgen-6 world (the track is the deck's centre, one block up)
const railId = (id) => { const t = R.types[R.T.type[id]]; return !!t && t.name === 'rail'; };
const viaLines = L6.filter(d => /heart-viaduct/.test(d.key));
const chunkCache = new Map();
const chunkOf = (g, cx, cz) => { const k = cx + ',' + cz; if (!chunkCache.has(k)) chunkCache.set(k, g.generate(cx, cz)); return chunkCache.get(k); };
// (f) the crossings: a point of one line within a block of a point of another at the same height (the same block)
const crossAt = (d, e) => { const Q = e.pts, m = Q.length / 3, P = d.pts, n = P.length / 3; for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if (Math.abs(P[i * 3] - Q[j * 3]) <= 1 && Math.abs(P[i * 3 + 2] - Q[j * 3 + 2]) <= 1 && Math.abs(P[i * 3 + 1] - Q[j * 3 + 1]) <= 3) return [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; return null; };
const crossings = [];
for (let a = 0; a < L6.length; a++) for (let b = a + 1; b < L6.length; b++) { const c = crossAt(L6[a], L6[b]); if (c) crossings.push([L6[a].key, L6[b].key, c]); }
console.log('    crossings: ' + (crossings.map(c => c[0] + ' × ' + c[1] + ' at ' + c[2].join(',')).join(' · ') || 'none'));
const known = (c) => { const k = c[0] + '|' + c[1]; return /heart-loop/.test(k) && /heart-viaduct-0/.test(k); };
check(crossings.length === 1 && crossings.every(known), 'exactly the known crossing: the viaduct 0 under the Canyon Loop');
const onCross = (x, z) => crossings.some(c => Math.abs(c[2][0] - x) <= 6 && Math.abs(c[2][2] - z) <= 6);
let trackTotal = 0, trackOk = 0;
for (const d of viaLines) {
  const P = d.pts, n = P.length / 3;
  for (let i = 0; i < n; i += 6) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (onCross(x, z)) continue;
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16), c = chunkOf(g6, cx, cz);
    const lx = x - cx * 16, lz = z - cz * 16;
    trackTotal++;
    if (c && c.blocks && railId(c.blocks[(y << 8) | (lz << 4) | lx])) trackOk++;
  }
}
check(viaLines.length === 2 && trackTotal > 0, 'the two viaducts are sampled (' + trackTotal + ' points, the crossing aside)');
check(trackOk === trackTotal, 'the rail track lies on the viaduct deck in the generated chunks (' + trackOk + '/' + trackTotal + ')');
const g5 = V.makeGen('overworld', 12345, { vgen: 5 });
const L5 = RG.near(g5, 0, 0, 1300);
check(!L5.some(d => /heart-viaduct/.test(d.key)), 'an old world (vgen 5) gets no citadel line');
const far = RG.near(g6, 3000, 3000, 200);
check(!far.some(d => /heart-viaduct/.test(d.key)), 'a far point (3000, 3000) lists none of the viaducts');
const g5c = chunkOf(g5, Math.floor(-300 / 16), Math.floor(330 / 16));
let oldTrack = 0;
for (let y = 100; y < 120; y++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) if (railId(g5c.blocks[(y << 8) | (lz << 4) | lx])) oldTrack++;
check(oldTrack === 0, 'an old world keeps its viaduct chunks as they were (no rail block there)');

// (e) every town with a placed link has a placed line at its station
let linked = 0, reached = 0;
for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
  const s = VG.site(g6, i, j); if (!s) continue;
  const lk = RG.linkFrom(g6, s); if (!lk) continue;
  linked++;
  const any = RG.linksOf(g6, s).some(l => RG.line(g6, l));
  if (any) reached++;
}
const cut = [];
for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const s = VG.site(g6, i, j); if (!s || !RG.linkFrom(g6, s)) continue; if (!RG.linksOf(g6, s).some(l => RG.line(g6, l))) cut.push(s.name); }
console.log('    towns without a line: ' + (cut.join(', ') || 'none') + ' (their only link runs through the citadel zone)');
check(linked > 0 && reached === linked - cut.length && cut.length <= 1, 'every linked town but at most one has a line at its station (' + reached + ' of ' + linked + ')');
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');

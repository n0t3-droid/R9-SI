// VR.computeColumnLight must give exactly the light the v0.39 algorithm gave (kept here as the reference), for
// generated land, the town, the open sea, a tall player-built column and a dimension without sky — while running
// faster: a reusable queue instead of a fresh 1 MB one per column, and no scanning of the empty sky above the land.
//   bash test/wt_run.sh light_same.js
const V = require('./load_shared.js');
const R = V.R;
// ---- the v0.39 reference, verbatim ----
function refLight(blocks, hasSky) {
  const T = R.T, filter = T.filter, emit = T.emit;
  const N = blocks.length, H = N >> 8, TOP = H - 1;
  const light = new Uint16Array(N);
  let QN = 1 << 18; while (QN < N * 4) QN <<= 1;
  const QM = QN - 1;
  const q = new Int32Array(QN);
  let qh = 0, qt = 0;
  const push = (i) => { q[qt] = i; qt = (qt + 1) & QM; };
  if (hasSky) {
    for (let col = 0; col < 256; col++) {
      let v = 15;
      for (let y = TOP; y >= 0; y--) {
        const i = (y << 8) | col;
        const f = filter[blocks[i]];
        if (f >= 15) { v = 0; } else if (f > 0) { v = v - f; if (v < 0) v = 0; }
        if (v === 0) { light[i] = 0; if (f >= 15) { for (let yy = y - 1; yy >= 0; yy--) light[(yy << 8) | col] = 0; break; } continue; }
        light[i] = v << 12;
      }
    }
    for (let y = 0; y < H; y++) {
      for (let col = 0; col < 256; col++) {
        const i = (y << 8) | col;
        const s = light[i] >>> 12;
        if (s < 2) continue;
        const x = col & 15, z = col >> 4;
        let need = false;
        if (x > 0 && (light[i - 1] >>> 12) < s - 1 && filter[blocks[i - 1]] < 15) need = true;
        else if (x < 15 && (light[i + 1] >>> 12) < s - 1 && filter[blocks[i + 1]] < 15) need = true;
        else if (z > 0 && (light[i - 16] >>> 12) < s - 1 && filter[blocks[i - 16]] < 15) need = true;
        else if (z < 15 && (light[i + 16] >>> 12) < s - 1 && filter[blocks[i + 16]] < 15) need = true;
        else if (y > 0 && (light[i - 256] >>> 12) < s - 1 && filter[blocks[i - 256]] < 15) need = true;
        if (need) push(i);
      }
    }
    while (qh !== qt) {
      const i = q[qh]; qh = (qh + 1) & QM;
      const s = light[i] >>> 12;
      if (s <= 1) continue;
      const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
      for (let d = 0; d < 6; d++) {
        let n;
        if (d === 0) { if (x === 15) continue; n = i + 1; } else if (d === 1) { if (x === 0) continue; n = i - 1; }
        else if (d === 2) { if (y === TOP) continue; n = i + 256; } else if (d === 3) { if (y === 0) continue; n = i - 256; }
        else if (d === 4) { if (z === 15) continue; n = i + 16; } else { if (z === 0) continue; n = i - 16; }
        const f = filter[blocks[n]];
        if (f >= 15) continue;
        const nv = (d === 3 && s === 15 && f === 0) ? 15 : s - 1 - f;
        if (nv > (light[n] >>> 12)) { light[n] = (light[n] & 0x0fff) | (nv << 12); push(n); }
      }
    }
  }
  qh = qt = 0;
  for (let i = 0; i < N; i++) { const e = emit[blocks[i]]; if (e) { light[i] = (light[i] & 0xf000) | e; push(i); } }
  while (qh !== qt) {
    const i = q[qh]; qh = (qh + 1) & QM;
    const l = light[i];
    const r = (l >> 8) & 15, g = (l >> 4) & 15, b = l & 15;
    if (r <= 1 && g <= 1 && b <= 1) continue;
    const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
    for (let d = 0; d < 6; d++) {
      let n;
      if (d === 0) { if (x === 15) continue; n = i + 1; } else if (d === 1) { if (x === 0) continue; n = i - 1; }
      else if (d === 2) { if (y === TOP) continue; n = i + 256; } else if (d === 3) { if (y === 0) continue; n = i - 256; }
      else if (d === 4) { if (z === 15) continue; n = i + 16; } else { if (z === 0) continue; n = i - 16; }
      const f = filter[blocks[n]];
      if (f >= 15) continue;
      const dec = 1 + f;
      const nl = light[n];
      const nr = r - dec, ng = g - dec, nb = b - dec;
      const cr = (nl >> 8) & 15, cg = (nl >> 4) & 15, cb = nl & 15;
      if (nr > cr || ng > cg || nb > cb) { light[n] = (nl & 0xf000) | (Math.max(nr, cr) << 8) | (Math.max(ng, cg) << 4) | Math.max(nb, cb); push(n); }
    }
  }
  return light;
}
// ---- columns ----
const cols = [];
const g = V.makeGen('overworld', 4242, { vgen: 5 });
for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) cols.push(['land ' + cx + ',' + cz, g.generate(cx, cz).blocks, true]);
const gv = V.makeGen('overworld', 12345, { vgen: 5 });
for (let cz = -14; cz <= -12; cz++) for (let cx = 0; cx <= 2; cx++) cols.push(['town ' + cx + ',' + cz, gv.generate(cx, cz).blocks, true]);
const go = V.makeGen('overworld', 12345, {});
cols.push(['sea -26,8', go.generate(-26, 8).blocks, true]);
// a tower built up to the world top with lanterns, in a column that grew to 320 blocks (world.js growColumn)
{
  const b = new Uint16Array(320 << 8); b.set(g.generate(3, 3).blocks);
  const stone = R.byName.stone.defaultState, lantern = (R.byName.lantern || R.byName.torch).defaultState, glass = R.byName.glass.defaultState;
  for (let y = 60; y < 318; y++) for (let dz = 4; dz < 9; dz++) for (let dx = 4; dx < 9; dx++) b[(y << 8) | (dz << 4) | dx] = (dx === 6 && dz === 6) ? 0 : (y % 7 === 3 && dx === 4) ? glass : stone;
  for (let y = 62; y < 318; y += 9) b[(y << 8) | (6 << 4) | 6] = lantern;
  cols.push(['tower 320 high', b, true]);
  const e = new Uint16Array(65536); cols.push(['empty air', e, true]);
  const f = new Uint16Array(65536).fill(stone); for (let i = 0; i < 2000; i++) f[(i * 7919) % 65536] = lantern; cols.push(['solid rock with lanterns', f, true]);
}
cols.push(['no sky (drift)', g.generate(5, -5).blocks, false]);
cols.push(['no sky, empty', new Uint16Array(65536), false]);
let fail = 0;
for (const [name, blocks, sky] of cols) {
  const a = refLight(blocks, sky), b = V.computeColumnLight(blocks, sky);
  let diff = -1; if (a.length !== b.length) diff = -2; else for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { diff = i; break; }
  const ok = diff === -1;
  if (!ok) fail++;
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : diff === -2 ? ' (length differs)' : ` (first difference at cell ${diff}: ref ${a[diff].toString(16)} now ${b[diff].toString(16)})`));
}
// speed (cpu time, best of 5): the generated columns
const gen = cols.filter(c => c[0].startsWith('land') || c[0].startsWith('town') || c[0].startsWith('sea'));
const time = (f) => { let best = 1e9; for (let r = 0; r < 5; r++) { const c0 = process.cpuUsage(); for (const [, b, s] of gen) f(b, s); const c1 = process.cpuUsage(c0); best = Math.min(best, (c1.user + c1.system) / 1000 / gen.length); } return best; };
const tRef = time(refLight), tNew = time(V.computeColumnLight);
console.log(`     ${gen.length} generated columns: ${tNew.toFixed(2)} ms per column (v0.39 reference ${tRef.toFixed(2)} ms)`);
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);

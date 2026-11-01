// w-golden · the golden shots' SSIM (test/golden_ssim.js) on made-up pictures: identical → 1; a little noise → high;
// a small object removed from a wide view → the mean stays high, the worst tile falls; another hue → chroma falls,
// luma barely; the verdict names what failed.   node test/golden_ssim_unit.js
const S = require('./golden_ssim.js');
let fails = 0; const check = (ok, m) => { if (!ok) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const W = 320, H = 180;
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
// a "vista": a sky gradient, hills, a texture of fields
function scene(o = {}) {
  const px = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 3, hill = 110 + 18 * Math.sin(x / 23) + 9 * Math.sin(x / 7);
    let r, g, b;
    if (y < hill) { r = 120 + y * 0.4; g = 160 + y * 0.3; b = 230; }
    else { const f = ((x >> 3) + (y >> 2)) & 1; r = 60 + f * 20; g = 120 + f * 25; b = 50; if (o.hue) { r = 140 + f * 20; g = 90 + f * 25; b = 50; } }
    if (o.tower && x >= 250 && x < 262 && y >= 60 && y < hill) { r = 90; g = 85; b = 95; }
    if (o.noise) { const n = (rnd() - 0.5) * o.noise; r += n; g += n; b += n; }
    px[k] = Math.max(0, Math.min(255, r)); px[k + 1] = Math.max(0, Math.min(255, g)); px[k + 2] = Math.max(0, Math.min(255, b));
  }
  return px;
}
const A = scene({ tower: true });
const same = S.compare(A, A, W, H);
check(Math.abs(same.y - 1) < 1e-6 && Math.abs(same.c - 1) < 1e-6 && Math.abs(same.tile - 1) < 1e-6, `identical: y ${same.y.toFixed(4)} c ${same.c.toFixed(4)} tile ${same.tile.toFixed(4)}`);
const noisy = S.compare(A, scene({ tower: true, noise: 6 }), W, H);
check(noisy.y > 0.9 && noisy.tile > 0.85, `a little noise (±3): y ${noisy.y.toFixed(3)} tile ${noisy.tile.toFixed(3)}`);
const gone = S.compare(A, scene({}), W, H);
check(gone.y > 0.95, `the tower removed: the mean stays high (${gone.y.toFixed(3)})`);
check(gone.tile < 0.8 && gone.tileAt[0] === 6, `… the worst tile falls, at the tower's column (${gone.tile.toFixed(3)} at [${gone.tileAt}])`);
check(S.verdict(gone, { y: 0.9, c: 0.9, tile: 0.85 }).some(s => /worst tile/.test(s)), 'the verdict names the tile');
check(S.verdict(noisy, { y: 0.9, c: 0.9, tile: 0.8 }).length === 0, 'the noisy picture passes the same thresholds');
const hue = S.compare(A, scene({ tower: true, hue: true }), W, H);
check(hue.c < hue.y && hue.c < 0.95, `another hue on the fields: chroma ${hue.c.toFixed(3)} below luma ${hue.y.toFixed(3)}`);
let threw = false; try { S.compare(A, A.subarray(0, 100), W, H); } catch (e) { threw = true; }
check(threw, 'pictures of different sizes are refused');
const t0 = Date.now(); for (let i = 0; i < 5; i++) S.compare(A, scene({}), W, H); const ms = (Date.now() - t0) / 5;
check(ms < 150, `fast: ${ms.toFixed(0)} ms a 320 × 180 comparison`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

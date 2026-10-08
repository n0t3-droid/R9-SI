// Picture statistics for the trailer look (t-look). The same numbers are taken from the trailer frames
// (docs/trailer/frames, 640 px) and from the game's shots (resized to the frames' 640 × 348), so the grade is tuned
// against the frames by measurement as well as by eye:
//   L      mean luma (Rec. 709 on the gamma-encoded values, 0–255); p5, p50, p95 of the luma; spread = p95 − p5
//   S      mean HSV saturation (0–1) over all pixels; S90 the 90th percentile (how many pixels are vivid)
//   white  share of pixels with every channel ≥ 220 (the haze and the blown highlights)
//   clip   share of pixels with a channel at ≥ 250; dark: share with luma < 20 (crushed blacks)
//   sky    the top fifth of the picture: mean L, S, the cast R−B and G−B (0–255)
//   ground the bottom quarter: the same
// usage:  node test/look_stats.js [picture files…]   the table (no files: the trailer frames)
//         node test/look_stats.js --bands            the frames' p10 / p50 / p90 per shot kind, as JSON
// Test (no arguments): the frames decode, the numbers are in range and the kinds are populated — ALL OK.
const fs = require('fs'), path = require('path');
const sharp = require('/home/claude/.npm-global/lib/node_modules/sharp');
const FRAMES = path.join(__dirname, '..', 'docs', 'trailer', 'frames');
const W = 640, H = 348;

// the frames by what they show (from the contact sheet of docs/trailer/frames): the exterior with the sky in view,
// the lawns and the palm city (the meadow's kind), and the interiors (not measured against the outdoor shots)
const KINDS = {
  sky: ['t1_01', 't1_03', 't1_05', 't1_07', 't1_09', 't1_10', 't1_11', 't3_01', 't3_02', 't3_03', 't3_04'],
  lawn: ['t1_21', 't1_22', 't1_24', 't2_23', 't2_25', 't3_05', 't3_06', 't3_07', 't3_08', 't3_09'],
  interior: ['t1_12', 't1_13', 't1_16', 't1_17', 't1_19', 't1_26', 't1_27', 't1_29', 't1_30', 't2_14', 't2_20', 't2_28', 't3_10'],
};

async function load(file) {
  const { data, info } = await sharp(file).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}

// the mean colour of a band of rows, with its luma, saturation and cast
function region(d, w, y0, y1) {
  let n = 0, r = 0, g = 0, b = 0, s = 0, L = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 3, R = d[p], G = d[p + 1], B = d[p + 2];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    r += R; g += G; b += B; s += mx ? (mx - mn) / mx : 0; L += 0.2126 * R + 0.7152 * G + 0.0722 * B; n++;
  }
  return { R: r / n, G: g / n, B: b / n, L: L / n, S: s / n, rb: (r - b) / n, gb: (g - b) / n };
}

function statsOf(d, w, h) {
  const n = w * h, hist = new Uint32Array(256), sHist = new Uint32Array(101);
  let sumL = 0, sumS = 0, white = 0, clip = 0, dark = 0;
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const R = d[p], G = d[p + 1], B = d[p + 2];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    const Lq = Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B);
    const s = mx ? (mx - mn) / mx : 0;
    hist[Lq]++; sHist[Math.round(s * 100)]++; sumL += Lq; sumS += s;
    if (mn >= 220) white++;
    if (mx >= 250) clip++;
    if (Lq < 20) dark++;
  }
  const pct = (hh, q) => { const t = q * n; let acc = 0; for (let k = 0; k < hh.length; k++) { acc += hh[k]; if (acc >= t) return k; } return hh.length - 1; };
  const sky = region(d, w, 0, Math.round(h * 0.2)), ground = region(d, w, Math.round(h * 0.75), h);
  return {
    L: sumL / n, p5: pct(hist, 0.05), p50: pct(hist, 0.5), p95: pct(hist, 0.95),
    S: sumS / n, S90: pct(sHist, 0.9) / 100,
    white: white / n, clip: clip / n, dark: dark / n,
    sky, ground,
  };
}

// the flat row of numbers the table and the bands use
function row(st) {
  return {
    L: st.L, p5: st.p5, p95: st.p95, spread: st.p95 - st.p5, S: st.S, S90: st.S90,
    white: st.white, clip: st.clip, dark: st.dark,
    skyL: st.sky.L, skyS: st.sky.S, skyRB: st.sky.rb, skyGB: st.sky.gb,
    gndL: st.ground.L, gndS: st.ground.S, gndRB: st.ground.rb,
  };
}
const COLS = ['L', 'p5', 'p95', 'spread', 'S', 'S90', 'white', 'clip', 'dark', 'skyL', 'skyS', 'skyRB', 'skyGB', 'gndL', 'gndS', 'gndRB'];
const fmt = (k, v) => (['white', 'clip', 'dark'].includes(k) ? (100 * v).toFixed(1) + '%' : ['S', 'S90', 'skyS', 'gndS'].includes(k) ? v.toFixed(3) : v.toFixed(1));

async function measure(file) { const p = await load(file); return row(statsOf(p.d, p.w, p.h)); }

// the frames' stats (name → row) and their bands per kind: p10, p50, p90 of every column across the kind's frames
async function frameStats() {
  const out = {};
  for (const f of fs.readdirSync(FRAMES).filter(x => /\.jpg$/.test(x)).sort()) out[f.replace(/\.jpg$/, '')] = await measure(path.join(FRAMES, f));
  return out;
}
function bandsOf(stats) {
  const bands = {};
  for (const [kind, names] of Object.entries(KINDS)) {
    bands[kind] = {};
    for (const c of COLS) {
      const v = names.map(nm => stats[nm][c]).sort((a, b) => a - b);
      const q = (t) => { const x = t * (v.length - 1), i = Math.floor(x), j = Math.min(v.length - 1, i + 1); return v[i] + (v[j] - v[i]) * (x - i); };
      bands[kind][c] = { p10: q(0.1), p50: q(0.5), p90: q(0.9) };
    }
  }
  return bands;
}
function table(rows) {
  const head = ['picture'.padEnd(26), ...COLS.map(c => c.padStart(7))].join(' ');
  const lines = [head];
  for (const [name, r] of rows) lines.push([name.slice(0, 26).padEnd(26), ...COLS.map(c => fmt(c, r[c]).padStart(7))].join(' '));
  return lines.join('\n');
}

module.exports = { load, statsOf, row, measure, frameStats, bandsOf, table, KINDS, COLS, fmt };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args[0] === '--bands') { console.log(JSON.stringify(bandsOf(await frameStats()), null, 1)); return; }
    if (args.length) { const rows = []; for (const f of args) rows.push([path.basename(f), await measure(f)]); console.log(table(rows)); return; }
    // the test: the frames decode, every number is finite, and the kinds hold the frames the chart says they do
    const st = await frameStats(), names = Object.keys(st);
    const rows = names.map(nm => [nm, st[nm]]);
    console.log(table(rows));
    const bands = bandsOf(st);
    console.log('\nbands (p10 / p50 / p90):');
    for (const kind of Object.keys(KINDS)) console.log('  ' + kind.padEnd(9) + ['L', 'S', 'S90', 'skyS', 'white', 'skyRB'].map(c => c + ' ' + fmt(c, bands[kind][c].p10) + '/' + fmt(c, bands[kind][c].p50) + '/' + fmt(c, bands[kind][c].p90)).join('  '));
    let ok = names.length === 34;
    const finite = names.every(nm => COLS.every(c => Number.isFinite(st[nm][c])));
    const inRange = names.every(nm => st[nm].L > 10 && st[nm].L < 245 && st[nm].S >= 0 && st[nm].S <= 1 && st[nm].white < 0.9);
    console.log((ok ? '  ✓' : '  ✗') + ' the 34 trailer frames decode (' + names.length + ')');
    console.log((finite ? '  ✓' : '  ✗') + ' every number is finite');
    console.log((inRange ? '  ✓' : '  ✗') + ' the luma, saturation and white share are in range');
    // the frames are saturated: the exterior sky frames are more vivid than the washed-out grey-white they are not
    const skyS = KINDS.sky.map(nm => st[nm].S).reduce((a, b) => a + b, 0) / KINDS.sky.length;
    const sane = skyS > 0.2;
    console.log((sane ? '  ✓' : '  ✗') + ' the outdoor frames are saturated (mean S ' + skyS.toFixed(3) + ')');
    ok = ok && finite && inRange && sane;
    console.log(ok ? 'ALL OK' : 'FAILED 1');
    process.exit(ok ? 0 : 1);
  })().catch(e => { console.error(e); console.log('FAILED 1'); process.exit(1); });
}

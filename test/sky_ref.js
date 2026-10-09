// The trailer's sky, measured (t-sky). For each trailer frame with sky in view, the sky is sampled in rectangles clear
// of buildings, palms, ships, planets, clouds and the sun's disc (listed per frame below, checked by eye on overlays:
// --overlay <dir>), in 8 height bands from the frame's horizon line (H: where the land meets the sky; band 0 sits on
// it) to the top of the frame (band 7). Per band: the mean colour (sRGB 0–255) and the trimmed mean (the 10 % darkest
// and 10 % brightest pixels dropped, so a star or a planet's limb does not move the band); its CIELAB (D65, CIE76 ΔE)
// colour, luminance L*, chroma C* and hue h. Per frame, the space in the top two bands: the stars (the share of pixels
// at least 22 luma above their 5 × 5 neighbourhood, per 1000 pixels), the local contrast (the RMS of the luma's high
// pass: luma − its 5 × 5 mean) and the nebula (the mean ΔE of the 3 × 3-blurred pixels from the band's mean colour).
// The targets: per band the median over the day frames (the city by day, the citadel) and over the dusk frames (the
// canyon with the sun on the horizon) of the frames' trimmed means; the isles' frames are a third kind (golden: the sun
// low at the right, the land in full sun) and the cross-fade t1_26 has no horizon (recorded, in no target).
// Writes docs/trailer/sky_ref.json with --write; the test (no arguments) measures again and checks the reference
// against the measurement and the targets against the trailer's look: by day bright white-cyan at the horizon, light
// then medium blue, deep navy space at the top with stars and nebula; at dusk a warm horizon under a dark top.
// The browser test (test/trailer_skycurve.mjs) samples the game's pictures with the same functions (exports below).
// usage: node test/sky_ref.js [--write] [--overlay <dir>]
const fs = require('fs'), path = require('path');
const sharp = require('/home/claude/.npm-global/lib/node_modules/sharp');
const FRAMES_DIR = path.join(__dirname, '..', 'docs', 'trailer', 'frames');
const REF = path.join(__dirname, '..', 'docs', 'trailer', 'sky_ref.json');
const NB = 8;

// the frames: kind, horizon row H, and the clear-sky rectangles [x0, y0, x1, y1) in frame pixels (640 × 348 / 360)
const FRAMES = {
  t3_05: { kind: 'day', H: 165, rects: [[175, 0, 255, 80], [255, 0, 340, 42], [343, 0, 380, 122], [468, 58, 498, 108], [482, 140, 498, 162]], what: 'the palm city street by day (t3_05): white-cyan horizon over the hills, blue, navy with stars and nebula' },
  t3_06: { kind: 'day', H: 152, rects: [[558, 0, 640, 148], [335, 0, 380, 110], [470, 32, 526, 82], [200, 32, 250, 75]], what: 'the city street to the terraced hills (t3_06)' },
  t1_22: { kind: 'day', H: 150, rects: [[70, 0, 100, 112], [410, 0, 545, 50], [482, 50, 545, 72]], what: 'the city from the hall door (t1_22): the horizon hidden behind the buildings' },
  t1_24: { kind: 'day', H: 150, rects: [[602, 0, 640, 148], [562, 0, 602, 96], [528, 0, 562, 55], [0, 0, 85, 98]], what: 'the palm terrace of villas (t1_24)' },
  t2_23: { kind: 'day', H: 128, rects: [[530, 0, 600, 82], [555, 82, 585, 105], [478, 0, 528, 33]], what: 'the city walk (t2_23)' },
  t1_05: { kind: 'day', H: 232, rects: [[0, 0, 90, 135], [210, 0, 300, 45], [340, 0, 372, 100], [440, 0, 640, 75], [500, 80, 640, 138], [432, 190, 488, 230], [180, 192, 205, 228]], what: 'the Spire Citadel by day (t1_05): pale horizon, blue, navy top, nebula at the right' },
  t1_01: { kind: 'dusk', H: 118, rects: [[108, 0, 145, 70], [160, 0, 240, 80], [255, 0, 318, 82], [212, 82, 300, 95], [440, 0, 470, 30], [600, 62, 640, 90]], what: 'the canyon flyover (t1_01): the sun on the right horizon, violet, a navy top with the nebula' },
  t1_03: { kind: 'dusk', H: 140, rects: [[0, 0, 78, 130], [100, 0, 160, 125], [282, 0, 330, 60], [440, 0, 550, 45], [602, 0, 640, 55], [532, 95, 556, 128]], what: 'the canyon to the citadel (t1_03)' },
  t3_01: { kind: 'dusk', H: 120, rects: [[125, 0, 250, 90], [250, 0, 335, 85], [140, 90, 200, 110], [440, 0, 485, 22]], what: 'the canyon vista (t3_01)' },
  t3_02: { kind: 'dusk', H: 122, rects: [[0, 0, 200, 95], [332, 0, 352, 55], [492, 0, 515, 100], [515, 60, 640, 100], [0, 96, 75, 118], [500, 100, 640, 114]], what: 'the canyon vista, blurred (t3_02)' },
  t1_07: { kind: 'golden', H: 72, rects: [[195, 0, 240, 34], [300, 38, 358, 58], [455, 0, 515, 30], [590, 30, 640, 60]], what: 'the Sky Isles (t1_07): the sun low at the right, lavender-blue, violet top' },
  t1_09: { kind: 'golden', H: 75, rects: [[140, 0, 265, 28], [268, 40, 305, 54], [335, 42, 398, 68], [495, 0, 590, 30]], what: 'the Sky Isles (t1_09)' },
  t1_26: { kind: 'none', H: 150, rects: [[505, 0, 552, 88]], what: 'a cross-fade from the city to the white interior (t1_26): navy sky with stars, no horizon in view' },
};

// ------------------------------------------------------------ colour
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
function lab(rgb) {
  const r = lin(rgb[0]), g = lin(rgb[1]), b = lin(rgb[2]);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
// CIELAB → sRGB 0–255 (for the targets, which are medians in Lab)
function rgbOf(L) {
  const fy = (L[0] + 16) / 116, fx = fy + L[1] / 500, fz = fy - L[2] / 200;
  const inv = (t) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27));
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z, b = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  const enc = (v) => 255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  return [enc(r), enc(g), enc(b)];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);   // CIE76
const lch = (L) => ({ L: L[0], C: Math.hypot(L[1], L[2]), h: ((Math.atan2(L[2], L[1]) * 180 / Math.PI) + 360) % 360 });
const luma = (R, G, B) => 0.2126 * R + 0.7152 * G + 0.0722 * B;

// ------------------------------------------------------------ pictures
async function load(file, w, h) {
  let s = sharp(file);
  if (w) s = s.resize(w, h, { fit: 'fill' });
  const { data, info } = await s.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}
// the rows of band k (0 on the horizon … NB − 1 at the top) for a horizon at row H
const bandRows = (H, k) => [Math.round(H * (NB - 1 - k) / NB), Math.round(H * (NB - k) / NB)];
// a mask from rectangles (frames) — the game's pictures pass their own mask function
const rectMask = (rects) => (x, y) => { for (const r of rects) if (x >= r[0] && x < r[2] && y >= r[1] && y < r[3]) return true; return false; };

function bandOf(img, y0, y1, inMask) {
  const px = [];
  for (let y = Math.max(0, y0); y < Math.min(img.h, y1); y++) for (let x = 0; x < img.w; x++) {
    if (!inMask(x, y)) continue;
    const p = (y * img.w + x) * 3;
    px.push([img.d[p], img.d[p + 1], img.d[p + 2]]);
  }
  if (px.length < 40) return { n: px.length };
  const mean = [0, 0, 0];
  for (const c of px) { mean[0] += c[0]; mean[1] += c[1]; mean[2] += c[2]; }
  for (let i = 0; i < 3; i++) mean[i] /= px.length;
  px.sort((a, b) => luma(a[0], a[1], a[2]) - luma(b[0], b[1], b[2]));
  const lo = Math.floor(px.length * 0.1), hi = Math.ceil(px.length * 0.9);
  const trim = [0, 0, 0];
  for (let i = lo; i < hi; i++) { trim[0] += px[i][0]; trim[1] += px[i][1]; trim[2] += px[i][2]; }
  for (let i = 0; i < 3; i++) trim[i] /= (hi - lo);
  const L = lab(trim), c = lch(L);
  return { n: px.length, mean: mean.map(v => +v.toFixed(1)), rgb: trim.map(v => +v.toFixed(1)), lab: L.map(v => +v.toFixed(2)), L: +c.L.toFixed(2), C: +c.C.toFixed(2), h: +c.h.toFixed(1) };
}
function curveOf(img, H, inMask) {
  const bands = [];
  for (let k = 0; k < NB; k++) { const [y0, y1] = bandRows(H, k); bands.push(Object.assign({ k, y0, y1 }, bandOf(img, y0, y1, inMask))); }
  return bands;
}
// the space in rows [y0, y1): stars, the luma's local contrast and the nebula's colour variation
function spaceOf(img, y0, y1, inMask) {
  const W = img.w, at = (x, y) => { const p = (y * W + x) * 3; return luma(img.d[p], img.d[p + 1], img.d[p + 2]); };
  let n = 0, stars = 0, hp2 = 0;
  const cols = [];
  for (let y = Math.max(2, y0); y < Math.min(img.h - 2, y1); y++) for (let x = 2; x < W - 2; x++) {
    if (!inMask(x, y)) continue;
    // the 5 × 5 neighbourhood must lie in the sky too (an edge of a rectangle next to a palm is not a star)
    let ok = true, s = 0;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) { if (!inMask(x + dx, y + dy)) { ok = false; break; } s += at(x + dx, y + dy); }
    if (!ok) continue;
    const l = at(x, y), m = s / 25;
    n++; hp2 += (l - m) * (l - m);
    if (l - m >= 22) stars++;
    // the 3 × 3 blurred colour for the nebula's variation
    const c = [0, 0, 0];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const p = ((y + dy) * W + x + dx) * 3; c[0] += img.d[p]; c[1] += img.d[p + 1]; c[2] += img.d[p + 2]; }
    cols.push([c[0] / 9, c[1] / 9, c[2] / 9]);
  }
  if (n < 40) return { n };
  const mean = [0, 0, 0];
  for (const c of cols) { mean[0] += c[0]; mean[1] += c[1]; mean[2] += c[2]; }
  for (let i = 0; i < 3; i++) mean[i] /= cols.length;
  const Lm = lab(mean);
  let neb = 0;
  for (const c of cols) neb += dE(lab(c), Lm);
  return { n, stars: +(stars / n * 1000).toFixed(2), contrast: +Math.sqrt(hp2 / n).toFixed(2), nebula: +(neb / cols.length).toFixed(2) };
}

// ------------------------------------------------------------ the frames and the targets
async function measureFrames() {
  const out = {};
  for (const [name, F] of Object.entries(FRAMES)) {
    const img = await load(path.join(FRAMES_DIR, name + '.jpg'));
    const mask = rectMask(F.rects);
    const bands = curveOf(img, F.H, mask);
    // the space: the top two bands (rows 0 … 2H/8)
    out[name] = { kind: F.kind, H: F.H, w: img.w, h: img.h, rects: F.rects, what: F.what, bands, space: spaceOf(img, 0, bandRows(F.H, NB - 2)[1], mask) };
  }
  return out;
}
const median = (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function targetOf(frames, kind) {
  const names = Object.keys(frames).filter(n => frames[n].kind === kind);
  const bands = [];
  for (let k = 0; k < NB; k++) {
    const vals = names.map(n => frames[n].bands[k]).filter(b => b.rgb);
    if (!vals.length) { bands.push({ k, n: 0 }); continue; }
    // the median of each CIELAB component over the frames (a perceptual middle: an RGB median mixes the frames' hues)
    const L = [0, 1, 2].map(i => median(vals.map(b => b.lab[i])));
    const rgb = rgbOf(L).map(v => +v.toFixed(1)), c = lch(L);
    // the spread: the frames' ΔE from the target (how much the trailer itself varies in this band)
    const spread = median(vals.map(b => dE(b.lab, L)));
    bands.push({ k, frames: vals.length, rgb, lab: L.map(v => +v.toFixed(2)), L: +c.L.toFixed(2), C: +c.C.toFixed(2), h: +c.h.toFixed(1), spread: +spread.toFixed(2) });
  }
  const sp = names.map(n => frames[n].space).filter(s => s.n);
  const space = sp.length ? { stars: +median(sp.map(s => s.stars)).toFixed(2), contrast: +median(sp.map(s => s.contrast)).toFixed(2), nebula: +median(sp.map(s => s.nebula)).toFixed(2) } : null;
  return { frames: names, bands, space };
}
async function reference() {
  const frames = await measureFrames();
  return { about: 'test/sky_ref.js: the trailer frames\' sky in 8 bands from the horizon (band 0) to the top (band 7); rgb = trimmed mean (sRGB 0-255), lab = CIELAB D65, CIE76', bands: NB, targets: { day: targetOf(frames, 'day'), dusk: targetOf(frames, 'dusk'), golden: targetOf(frames, 'golden') }, frames };
}

// a curve against a target: ΔE per band (bands missing on either side are null)
function compare(curve, target) {
  return target.bands.map((t, k) => (t.lab && curve[k] && curve[k].lab ? +dE(curve[k].lab, t.lab).toFixed(2) : null));
}

async function overlay(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, F] of Object.entries(FRAMES)) {
    const m = await sharp(path.join(FRAMES_DIR, name + '.jpg')).metadata();
    const S = 2, W = m.width, Hh = m.height;
    let svg = `<svg width="${W * S}" height="${Hh * S}" xmlns="http://www.w3.org/2000/svg">`;
    for (const r of F.rects) svg += `<rect x="${r[0] * S}" y="${r[1] * S}" width="${(r[2] - r[0]) * S}" height="${(r[3] - r[1]) * S}" fill="none" stroke="#f00" stroke-width="2"/>`;
    for (let k = 1; k < NB; k++) { const y = bandRows(F.H, k)[1]; svg += `<line x1="0" y1="${y * S}" x2="${W * S}" y2="${y * S}" stroke="#0ff" stroke-opacity="0.5"/>`; }
    svg += `<line x1="0" y1="${F.H * S}" x2="${W * S}" y2="${F.H * S}" stroke="#ff0" stroke-width="2"/></svg>`;
    await sharp(path.join(FRAMES_DIR, name + '.jpg')).resize(W * S, Hh * S).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toFile(path.join(dir, name + '_sky.jpg'));
  }
}

module.exports = { NB, FRAMES, lab, rgbOf, dE, lch, load, bandRows, rectMask, bandOf, curveOf, spaceOf, measureFrames, targetOf, reference, compare, REF };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args[0] === '--overlay') { await overlay(args[1] || '.tmp_tests/sky_overlay'); console.log('overlays written'); return; }
    const ref = await reference();
    const fmtB = (b) => (b.rgb ? `${b.rgb.map(v => Math.round(v)).join(',').padEnd(12)} L${b.L.toFixed(0).padStart(3)} C${b.C.toFixed(0).padStart(3)} h${b.h.toFixed(0).padStart(4)}` : '—'.padEnd(26));
    for (const [n, f] of Object.entries(ref.frames)) {
      console.log(`${n} ${f.kind.padEnd(6)} H ${f.H}  stars ${f.space.stars} contrast ${f.space.contrast} nebula ${f.space.nebula}`);
      console.log('   ' + f.bands.map((b, k) => k + ':' + (b.rgb ? b.rgb.map(v => Math.round(v)).join(',') + '(' + b.n + ')' : '—')).join('  '));
    }
    for (const kind of ['day', 'dusk', 'golden']) {
      const t = ref.targets[kind];
      console.log(`\ntarget ${kind} (${t.frames.join(' ')}) space ${JSON.stringify(t.space)}`);
      for (const b of t.bands) console.log(`  band ${b.k}  ${fmtB(b)}  frames ${b.frames || 0}  spread ΔE ${b.spread}`);
    }
    if (args[0] === '--write') { fs.writeFileSync(REF, JSON.stringify(ref, null, 1) + '\n'); console.log('\nwrote ' + REF); }
    let fails = 0;
    const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
    console.log('');
    // the reference on disk is this measurement (reproducible)
    let stored = null;
    try { stored = JSON.parse(fs.readFileSync(REF, 'utf8')); } catch (e) { /* none yet */ }
    check(!!stored, 'docs/trailer/sky_ref.json exists');
    if (stored) {
      let worst = 0;
      for (const kind of ['day', 'dusk']) for (let k = 0; k < NB; k++) { const a = stored.targets[kind].bands[k], b = ref.targets[kind].bands[k]; if (a.lab && b.lab) worst = Math.max(worst, dE(a.lab, b.lab)); else if (!!a.lab !== !!b.lab) worst = 99; }
      check(worst < 0.05, `the stored targets are this measurement (largest ΔE ${worst.toFixed(3)})`);
    }
    const D = ref.targets.day.bands, K = ref.targets.dusk.bands;
    check(D.every(b => b.frames >= 3) && K.every(b => b.frames >= 2), 'every band of the targets has frames (day ≥ 3, dusk ≥ 2)');
    // by day: the horizon bright and cool (white-cyan), the top deep navy, the luminance falling band by band
    check(D[0].L > 70 && D[0].lab[2] < 0, `day: the horizon band is bright and cool (L* ${D[0].L}, b* ${D[0].lab[2]})`);
    check(D[NB - 1].L < 25 && D[NB - 1].lab[2] < -15, `day: the top band is deep navy (L* ${D[NB - 1].L}, b* ${D[NB - 1].lab[2]})`);
    let mono = 0; for (let k = 1; k < NB; k++) if (D[k].L > D[k - 1].L + 2) mono++;
    check(mono === 0, `day: the luminance falls from the horizon to the top (${D.map(b => b.L.toFixed(0)).join(' > ')})`);
    check(D[3].h > 230 && D[3].h < 300 && D[3].C > 30, `day: the middle is a saturated blue (band 3 hue ${D[3].h}°, C* ${D[3].C})`);
    // at dusk: a warm horizon (more red than the day's, a pink-peach hue) and the same dark top
    check(K[0].lab[1] > D[0].lab[1] + 5 && K[0].L > 45, `dusk: the horizon band is warm and bright (a* ${K[0].lab[1]} vs day ${D[0].lab[1]}, L* ${K[0].L})`);
    check(K[NB - 1].L < 35 && K[NB - 1].L < K[0].L - 30, `dusk: the top band is dark (L* ${K[NB - 1].L}, the horizon ${K[0].L})`);
    // the space shows: stars and nebula in the top bands of the day and dusk frames
    check(ref.targets.day.space.contrast > 3 && ref.targets.dusk.space.contrast > 3, `the space shows at the top (local contrast day ${ref.targets.day.space.contrast}, dusk ${ref.targets.dusk.space.contrast})`);
    console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);
    process.exit(fails ? 1 : 0);
  })().catch(e => { console.error(e); console.log('FAILED 1'); process.exit(1); });
}

// The README's pictures, drawn from the game's own code and from measured data — no number typed in by hand except the
// GPU measurement (the game's /kosten on a real PC, below) and the in-game horizon count:
//   terrain_profile.svg  a kilometre cut through the world of seed 3616214791: the generator's surfaceY(x, z)
//   noise_octaves.svg    fractal noise as the terrain sums it: VR.Fractal's octaves (src/shared/noise.js) and their sum
//   horizon.svg          Horizontschatten: the share of quads behind hills, 18 random eyes (docs/media/data/zahlen.json,
//                        made by lab/tools/zahlen.js with the game's mesher and src/shared/hzcull.js)
//   horizon_map.svg      the land round one eye from above, the hidden part darkened (lab/tools/hzmap.js)
//   sky_tone.svg         why the sky is blue (λ⁻⁴ and the game's optical depths) · the tone curve (the shader's ACES fit)
//   sound.svg            a plucked string rendered by VR.KS (Karplus–Strong) · reverberation by Eyring (VR.RoomAcoustics)
//   kepler.svg           a transfer orbit coasted by VR.Universe.coast (universal variables): equal times, equal areas
//   gpu_costs.svg        what a frame costs on a Ryzen APU at Ultra, part by part (the game's /kosten, 27 Nov 2026)
//   town_quads.svg       who fills a town's geometry (docs/media/data/zahlen.json)
//   node docs/media/make_charts.js
'use strict';
const fs = require('fs'), path = require('path');
const OUT = __dirname, ROOT = path.join(__dirname, '../..');
const V = require('../../test/load_shared.js');
require('../../src/main/klangphys.js');
const W = require('../../lab/lib/world.js');
const P = require('../../lab/lib/png.js');
const hzmap = require('../../lab/tools/hzmap.js');
const DATA = JSON.parse(fs.readFileSync(path.join(OUT, 'data/zahlen.json'), 'utf8'));
const C = { bg: '#ffffff', ink: '#1b2130', muted: '#5b6478', faint: '#8a93a6', grid: '#e3e7ee', teal: '#0f8a8f', orange: '#e0752f', violet: '#7a46c8', water: '#3b82c4', red: '#c8443a' };
const FONT = 'font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const f1 = (v) => v.toFixed(1);
// GitHub in dark mode: the neutral colours turn dark (CSS beats presentation attributes), the accents stay
const DARK = `<style>@media (prefers-color-scheme: dark) { .bg { fill: #0d1117; stroke: #30363d; } [fill="${C.ink}"] { fill: #e6edf3; } [stroke="${C.ink}"] { stroke: #e6edf3; } [fill="${C.muted}"] { fill: #9aa4b2; } [stroke="${C.grid}"] { stroke: #30363d; } [fill="#f4f6f9"] { fill: #161b22; } }</style>`;
const card = (w, h, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT}>
${DARK}
<rect class="bg" x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="${C.bg}" stroke="${C.grid}"/>
<text x="20" y="30" font-size="16" font-weight="700" fill="${C.ink}">${esc(title)}</text>
${sub ? `<text x="20" y="49" font-size="12" fill="${C.muted}">${esc(sub)}</text>` : ''}
${body}
</svg>
`;
const text = (x, y, s, o = {}) => `<text x="${f1(x)}" y="${f1(y)}" font-size="${o.size || 12}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''} fill="${o.fill || C.ink}"${o.italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
const line = (x1, y1, x2, y2, col, o = {}) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${col}"${o.w ? ` stroke-width="${o.w}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
const poly = (pts, col, o = {}) => `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join(' ')}${o.close ? ' Z' : ''}" fill="${o.fill || 'none'}" stroke="${o.fill && !o.stroke ? 'none' : col}"${o.w ? ` stroke-width="${o.w}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.op ? ` opacity="${o.op}"` : ''}/>`;
const save = (name, svg) => { fs.writeFileSync(path.join(OUT, name), svg); console.log('wrote', name, svg.length, 'bytes'); };
// a plot frame: maps data → pixels, draws the grid and the axis labels
function frame(x0, y0, w, h, xr, yr, o = {}) {
  const X = (v) => x0 + ((v - xr[0]) / (xr[1] - xr[0])) * w, Y = (v) => y0 + h - ((v - yr[0]) / (yr[1] - yr[0])) * h;
  let g = '';
  for (const v of o.yt || []) g += line(x0, Y(v), x0 + w, Y(v), C.grid) + text(x0 - 6, Y(v) + 4, o.yf ? o.yf(v) : v, { size: 11, anchor: 'end', fill: C.muted });
  for (const v of o.xt || []) g += text(X(v), y0 + h + 15, o.xf ? o.xf(v) : v, { size: 11, anchor: 'middle', fill: C.muted });
  if (o.xl) g += text(x0 + w, y0 + h + 30, o.xl, { size: 11, anchor: 'end', fill: C.muted });
  if (o.yl) g += text(x0, y0 - 8, o.yl, { size: 11, fill: C.muted });
  return { X, Y, g };
}

// ---- 1 · a kilometre of terrain: surfaceY along x, z fixed (the owner's world, through Fliederfeld's latitude)
{
  const g = W.gen(3616214791, W.newestVgen()), z = -1044, x0 = -200, N = 1024, SEA = V.C.SEA;
  const hs = []; for (let i = 0; i <= N; i += 2) hs.push(g.surfaceY(x0 + i, z));
  const lo = Math.min(SEA - 6, ...hs) - 2, hi = Math.max(...hs) + 4;
  const F = frame(50, 64, 650, 162, [0, N], [lo, hi], { yt: [40, 60, 80, 100].filter((v) => v > lo && v < hi), xt: [0, 256, 512, 768, 1024], xf: (v) => v + ' m' });
  const land = [[0, lo], ...hs.map((v, i) => [i * 2, v]), [N, lo]].map(([a, b]) => [F.X(a), F.Y(b)]);
  let s0 = -1, run = 0, best = [0, 0]; hs.forEach((v, i) => { if (v < SEA) { if (run === 0) s0 = i; run++; if (run > best[1]) best = [s0, run]; } else run = 0; });
  const seaX = F.X((best[0] + best[1] / 2) * 2);
  const body = F.g + `<rect x="50" y="${f1(F.Y(SEA))}" width="650" height="${f1(F.Y(lo) - F.Y(SEA))}" fill="${C.water}" opacity="0.28"/>` + line(50, F.Y(SEA), 700, F.Y(SEA), C.water, { dash: '4 3' })
    + poly(land, C.teal, { fill: C.teal, close: true, op: 0.88 }) + text(seaX, F.Y(SEA) + 16, `Meer · sea level ${SEA}`, { size: 11, anchor: 'middle', fill: C.water });
  save('terrain_profile.svg', card(720, 262, 'Ein Kilometer Gelände · a kilometre of terrain', `seed 3616214791, z = ${z} · the generator's surfaceY(x, z), every 2 m (src/shared/gen_overworld.js)`, body));
}

// ---- 2 · fractal noise: VR.Fractal's octaves (own seeds, ×½ amplitude, ×2 frequency) and their normalised sum
{
  const Fr = new V.Fractal(42, 4, 1 / 90), N = 360, Z = 7.3;
  const rows = Fr.oct.map((o) => { const r = []; for (let i = 0; i <= N; i++) r.push(o.s.n2(i * o.f, Z * o.f) * o.amp); return r; });
  const sum = []; for (let i = 0; i <= N; i++) sum.push(Fr.n2(i, Z));
  const X = (i) => 150 + (i / N) * 550, laneH = 30, gap = 10;
  let body = '', y = 82;
  const lane = (r, y0, amp, col, w) => poly(r.map((v, i) => [X(i), y0 - v * amp]), col, { w });
  Fr.oct.forEach((o, k) => {
    body += text(20, y + 4, `Oktave ${k + 1}`, { size: 12, weight: 600 }) + text(88, y + 4, `×${['1', '½', '¼', '⅛'][k]} · ${Math.pow(2, k)}f`, { size: 11, fill: C.muted });
    body += line(150, y, 700, y, C.grid) + lane(rows[k], y, laneH / 2, C.muted, 1.4); y += laneH + gap;
  });
  y += 14; body += text(20, y + 4, 'Summe · sum', { size: 12, weight: 700, fill: C.teal }) + line(150, y, 700, y, C.grid) + lane(sum, y, laneH * 1.1, C.teal, 2.4);
  save('noise_octaves.svg', card(720, 330, 'Fraktales Rauschen · fractal noise', 'four octaves of the game\'s own simplex noise, each with its own seed (VR.Fractal, src/shared/noise.js)', body));
}

// ---- 3 · Horizontschatten: the share of quads behind hills, every eye a dot (lab/tools/zahlen.js)
{
  const H = DATA.horizon, rowsDef = [['cubes', 'Würfel, Auge steht', 'cubes, eye still (δ 0.05)'], ['smooth', 'weiche Hänge, steht', 'smooth slopes, still'], ['walk', 'beim Gehen', 'walking (δ 0.5)'], ['harsh', 'runde Formen, schnell', 'round looks, fast (δ 1)']];
  const F = frame(250, 70, 430, 168, [0, 40], [0, 4], { xt: [0, 10, 20, 30, 40], xf: (v) => v + ' %' });
  let body = '';
  for (const v of [10, 20, 30, 40]) body += line(F.X(v), 70, F.X(v), 238, C.grid);
  body += F.g.replace(/<line[^>]*\/>/g, '');
  rowsDef.forEach(([id, de, en], k) => {
    const yc = 70 + 21 + k * 42, m = H.mean[id].quads * 100;
    body += text(236, yc - 2, de, { anchor: 'end', size: 12, weight: 600 }) + text(236, yc + 13, en, { anchor: 'end', size: 11, fill: C.muted });
    for (const r of H.rows) body += `<circle cx="${f1(F.X(r.hidden[id].quads * 100))}" cy="${f1(yc + ((r.at[0] * 7 + r.at[2]) % 9 - 4) * 1.6)}" r="3.2" fill="${C.violet}" opacity="0.45"/>`;
    body += line(F.X(m), yc - 12, F.X(m), yc + 12, C.ink, { w: 2.5 }) + text(F.X(m) + 8, yc - 8, `${m.toFixed(1)} %`, { size: 12, weight: 700 });
  });
  body += text(20, 274, `${H.views} random eyes on land in 3 worlds (a third in towns), view distance ${H.rd} · a dot = one eye, a bar = the mean`, { size: 11, fill: C.muted });
  body += text(20, 290, 'In the game near Fliederfeld: 137 of 333 sections not drawn, −9.8 % triangles, −1.3 ms per frame (Ryzen APU)', { size: 11, fill: C.muted });
  body += text(20, 306, 'Proof (test/hzcull.js): voxel rays from every eye within δ to every hidden section — not one gets through', { size: 11, fill: C.muted });
  save('horizon.svg', card(720, 322, 'Horizontschatten · horizon culling', 'the share of all quads that lie behind hills — not drawn, the picture identical pixel for pixel', body));
}

// ---- 4 · the horizon map: the land round an eye, the hidden part darkened
{
  const at = [562.5, 69.62, -1359.5], r = hzmap({ seed: 3616214791, at, rd: 10, delta: 0.05, style: 'dim' });
  const uri = P.dataURI(P.scale(r.img, 2)), S = 336;
  let body = `<image x="20" y="62" width="${S}" height="${S}" href="${uri}"/>`;
  const L = 384; let y = 92;
  body += `<circle cx="${L + 7}" cy="${y - 4}" r="5" fill="#ffffff" stroke="${C.ink}"/>` + text(L + 22, y, 'das Auge · the eye (a walker by the lake)', { size: 12 }); y += 30;
  body += `<rect x="${L}" y="${y - 13}" width="14" height="14" fill="#3a2f2a"/>` + text(L + 22, y - 1, 'dunkel · dark: behind the ridge, not drawn', { size: 12 }); y += 40;
  body += text(L, y, `${r.hidden} of ${r.sections}`, { size: 26, weight: 700, fill: C.violet }); y += 20;
  body += text(L, y, 'sections with blocks hidden (underground included)', { size: 12, fill: C.muted }); y += 40;
  body += text(L, y, 'How: per direction round the eye, the steepest', { size: 12 }); y += 17;
  body += text(L, y, 'slope of the ground in front; a section whose whole', { size: 12 }); y += 17;
  body += text(L, y, 'slope range lies below it is skipped. Valid for every', { size: 12 }); y += 17;
  body += text(L, y, 'eye within δ of this one: shrink walls, grow targets.', { size: 12 }); y += 34;
  body += text(L, y, 'seed 3616214791 · view distance 10 · 21 × 21 chunks', { size: 11, fill: C.muted }); y += 15;
  body += text(L, y, 'node lab/tools/hzmap.js --style dim', { size: 11, fill: C.muted });
  save('horizon_map.svg', card(720, 414, 'Was hinter dem Hügel liegt · what lies behind the hill', 'the land from above in its real block colours (src/shared/hzcull.js, the game\'s settings)', body));
}

// ---- 5 · the sky and the picture: λ⁻⁴ with the shader's optical depths · the ACES fit of the composite shader
{
  const SH = fs.readFileSync(path.join(ROOT, 'src/main/space_shaders.js'), 'utf8'), SC = fs.readFileSync(path.join(ROOT, 'src/main/shaders.js'), 'utf8');
  const tau = /TAU_R = vec3\(([\d.]+), ([\d.]+), ([\d.]+)\)/.exec(SH).slice(1).map(Number);
  const ac = /vec3 aces\(vec3 x\) \{ const float a = ([\d.]+), b = ([\d.]+), c = ([\d.]+), d = ([\d.]+), e = ([\d.]+);/.exec(SC).slice(1).map(Number);
  // left: Rayleigh optical depth ∝ λ⁻⁴, scaled to the game's blue; the game's three channels (Rayleigh + ozone) as dots
  const A = frame(62, 78, 268, 180, [380, 720], [0, 0.5], { yt: [0, 0.1, 0.2, 0.3, 0.4, 0.5], xt: [400, 500, 600, 700], xf: (v) => v + ' nm', yl: 'optical depth τ (zenith)' });
  let body = A.g;
  for (let l = 380; l < 720; l += 4) { const hue = 270 - ((l - 380) / 340) * 270; body += `<rect x="${f1(A.X(l))}" y="${f1(A.Y(0) - 6)}" width="${f1(A.X(l + 4) - A.X(l) + 0.5)}" height="6" fill="hsl(${hue.toFixed(0)},80%,55%)"/>`; }
  const k = tau[2] * Math.pow(440, 4), curve = []; for (let l = 380; l <= 720; l += 5) curve.push([A.X(l), A.Y(k / Math.pow(l, 4))]);
  body += poly(curve, C.water, { w: 2.2 }) + text(A.X(470), A.Y(0.42), 'τ ∝ λ⁻⁴ (Rayleigh)', { size: 12, fill: C.water, weight: 600 });
  [[680, tau[0], C.red], [550, tau[1], C.teal], [440, tau[2], C.water]].forEach(([l, v, col]) => { body += `<circle cx="${f1(A.X(l))}" cy="${f1(A.Y(v))}" r="5.5" fill="${col}" stroke="#fff" stroke-width="1.5"/>` + text(A.X(l) + 9, A.Y(v) - 7, v.toFixed(3), { size: 11, fill: C.ink }); });
  body += text(62, 300, 'dots: the game\'s R G B at 680 / 550 / 440 nm', { size: 11, fill: C.muted }) + text(62, 315, '(Rayleigh + ozone: red and green a little higher)', { size: 11, fill: C.muted });
  // right: the tone curve
  const B = frame(420, 78, 270, 180, [0, 6], [0, 1], { yt: [0, 0.5, 1], xt: [0, 1, 2, 3, 4, 5, 6], yl: 'screen', xl: 'light in the scene (HDR)' });
  body += B.g;
  const acesF = (x) => Math.min(1, Math.max(0, (x * (ac[0] * x + ac[1])) / (x * (ac[2] * x + ac[3]) + ac[4])));
  const pts = (fn) => { const p = []; for (let x = 0; x <= 6.001; x += 0.05) p.push([B.X(x), B.Y(fn(x))]); return p; };
  body += poly(pts((x) => Math.min(1, x)), C.faint, { w: 1.4, dash: '4 3' }) + poly(pts((x) => x / (1 + x)), C.muted, { w: 1.4 }) + poly(pts(acesF), C.orange, { w: 2.6 });
  body += text(B.X(2.2), B.Y(0.83), 'ACES (the game)', { size: 12, fill: C.orange, weight: 600 }) + text(B.X(4.2), B.Y(4.2 / 5.2) + 16, 'x / (1 + x)', { size: 11, fill: C.muted }) + text(B.X(1.12), B.Y(1) + 14, 'clip', { size: 11, fill: C.faint });
  body += text(420, 300, `f(x) = x(${ac[0]}x + ${ac[1]}) / (x(${ac[2]}x + ${ac[3]}) + ${ac[4]})`, { size: 11, fill: C.muted }) + text(420, 315, 'brights roll off softly instead of clipping', { size: 11, fill: C.muted });
  save('sky_tone.svg', card(720, 334, 'Warum der Himmel blau ist · und wie Licht zum Bild wird', 'left: src/main/space_shaders.js (TAU_R) · right: the composite shader\'s tone curve (src/main/shaders.js)', body));
}

// ---- 6 · sound: a plucked string from VR.KS · Eyring's reverberation time for the game's wall materials
{
  const sr = 48000, f = 196, T60 = 0.9, x = V.KS.render(f, sr, { dur: 1.2, t60: T60, bright: 0.55, pick: 0.13, seed: 7 });
  const A = frame(40, 78, 290, 168, [0, 1.2], [-1, 1], { xt: [0, 0.3, 0.6, 0.9, 1.2], xf: (v) => v + ' s', yt: [-1, 0, 1] });
  let body = A.g;
  const cols = 290, per = Math.floor(x.length / cols), up = [], dn = [];
  for (let c = 0; c < cols; c++) { let mx = -1, mn = 1; for (let i = c * per; i < (c + 1) * per; i++) { if (x[i] > mx) mx = x[i]; if (x[i] < mn) mn = x[i]; } up.push([40 + c, A.Y(mx)]); dn.push([40 + c, A.Y(mn)]); }
  body += poly(up.concat(dn.reverse()), C.violet, { fill: C.violet, close: true, op: 0.75 });
  const env = []; for (let t = 0; t <= 1.2; t += 0.01) env.push([A.X(t), A.Y(0.85 * Math.pow(10, -3 * t / T60))]);
  body += poly(env, C.ink, { w: 1.4, dash: '5 3' }) + text(A.X(0.42), A.Y(0.62), 'envelope 10^(−3t / T60): −60 dB at T60', { size: 11, fill: C.ink });
  body += text(40, 288, `G3 · ${f} Hz · T60 ${T60} s: noise burst → delay line N = fs / f`, { size: 11, fill: C.muted }) + text(40, 303, '→ averaging filter × ρ, the highs die first', { size: 11, fill: C.muted });
  // right: T60 against the mean free path for the absorption classes
  const RA = V.RoomAcoustics, mats = [['stone', 'Stein · stone', C.ink], ['wood', 'Holz · wood', C.orange], ['leaves', 'Laub · leaves', C.teal], ['soft', 'Wolle · wool', C.violet]];
  const B = frame(420, 78, 270, 168, [0, 12], [0, 4.2], { xt: [0, 3, 6, 9, 12], xf: (v) => v + ' m', yt: [0, 1, 2, 3, 4], yf: (v) => v + ' s', yl: 'T60 · mean free path 4V / S →' });
  body += B.g;
  mats.forEach(([id, lab, col], k) => {
    const p = []; for (let m = 0.3; m <= 12.001; m += 0.1) p.push([B.X(m), B.Y(RA.eyring(m, RA.ALPHA[id]))]);
    body += poly(p, col, { w: 2.2 });
    const m = id === 'stone' ? 11.6 : 11.8, t = RA.eyring(m, RA.ALPHA[id]); body += text(B.X(m), B.Y(t) + (id === 'soft' ? 21 : -7), `${lab} α ${RA.ALPHA[id]}`, { size: 11, fill: col, anchor: 'end' });
  });
  body += text(420, 288, 'T60 = 0.161 V / (−S ln(1 − ᾱ) + 4mV), 0.25…4 s', { size: 11, fill: C.muted }) + text(420, 303, 'path and ᾱ: 48 rays cast from the ear', { size: 11, fill: C.muted });
  save('sound.svg', card(720, 322, 'Klang aus Formeln · sound from formulas', 'left: a string the game plucks (VR.KS, src/main/klangphys.js) · right: how long a room rings (VR.RoomAcoustics)', body));
}

// ---- 7 · Kepler: a transfer orbit coasted by the game's universal-variable solver
{
  const U = V.Universe, mu = U.MU_EARTH, Re = 6371e3, rp = Re + 400e3, ra = Re + 35786e3, a = (rp + ra) / 2;
  const vp = Math.sqrt(mu * (2 / rp - 1 / a)), T = 2 * Math.PI * Math.sqrt(a * a * a / mu);
  const r0 = [rp, 0, 0], v0 = [0, vp, 0], r = [0, 0, 0], v = [0, 0, 0];
  const S = 290 / (ra + rp), cx = 40 + 290 * (ra / (ra + rp)) + 10, cy = 214;
  const PX = (p) => [cx + p[0] * S * 0.98, cy - p[1] * S * 0.98];
  let body = '';
  const path = []; for (let k = 0; k <= 400; k++) { U.coast(r0, v0, mu, (k / 400) * T, r, null); path.push(PX(r)); }
  body += poly(path, C.faint, { w: 1.2 });
  body += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(Re * S * 0.98)}" fill="${C.water}"/>`;
  const step = 1800, n = Math.floor(T / step);
  for (let k = 0; k <= n; k++) { U.coast(r0, v0, mu, k * step, r, null); const q = PX(r); body += `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="3.4" fill="${C.orange}"/>`; }
  // two equal-time wedges (one hour each): near the planet and far out — the same area
  const wedge = (t0, col) => { const p = [[cx, cy]]; for (let k = 0; k <= 30; k++) { U.coast(r0, v0, mu, t0 + (k / 30) * 3600, r, null); p.push(PX(r)); } return poly(p, col, { fill: col, close: true, op: 0.22 }); };
  body = wedge(-1800, C.orange) + wedge(T / 2 - 1800, C.orange) + body;
  // energy after 100 orbits, coasted in 997 uneven steps (the solver's own accuracy)
  let rr = r0.slice(), vv = v0.slice(); const E0 = vp * vp / 2 - mu / rp; const tot = 100 * T, ns = 997;
  for (let k = 0; k < ns; k++) U.coast(rr, vv, mu, tot / ns, rr, vv);
  const E1 = (vv[0] ** 2 + vv[1] ** 2 + vv[2] ** 2) / 2 - mu / Math.hypot(...rr), dE = Math.abs((E1 - E0) / E0);
  const L = 400; let y = 100;
  body += text(L, y, 'Gleiche Zeiten, gleiche Flächen', { size: 14, weight: 700 }); y += 18;
  body += text(L, y, 'equal times sweep equal areas (Kepler II)', { size: 12, fill: C.muted }); y += 30;
  body += `<circle cx="${L + 5}" cy="${y - 4}" r="4" fill="${C.orange}"/>` + text(L + 16, y, 'one dot every 30 minutes', { size: 12 }); y += 20;
  body += `<rect x="${L}" y="${y - 10}" width="11" height="11" fill="${C.orange}" opacity="0.3"/>` + text(L + 16, y, 'one hour near the planet and one far out', { size: 12 }); y += 34;
  body += text(L, y, `${(T / 3600).toFixed(2)} h`, { size: 22, weight: 700, fill: C.violet }) + text(L + 90, y, 'one orbit, 400 → 35 786 km', { size: 12 }); y += 30;
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const [mant, ex] = dE.toExponential(1).split('e');
  body += text(L, y, `${mant} · 10${String(+ex).split('').map((ch) => SUP[ch]).join('')}`, { size: 22, weight: 700, fill: C.violet }) + text(L + 128, y, 'energy error after', { size: 12 }); y += 15;
  body += text(L + 128, y, '100 orbits in 997 steps', { size: 12 }); y += 32;
  body += text(L, y, 'real units, the game\'s own solver: universal', { size: 11, fill: C.muted }); y += 15;
  body += text(L, y, 'variables with Stumpff C(z), S(z), solved by Newton', { size: 11, fill: C.muted });
  save('kepler.svg', card(720, 356, 'Bahnen ohne Integrator · orbits without an integrator', 'a geostationary transfer orbit, coasted exactly by VR.Universe.coast (src/shared/universe.js)', body));
}

// ---- 8 · what a frame costs on a Ryzen APU at Ultra (the game's /kosten in Fliederfeld, 27 Nov 2026: measured, typed in)
{
  const rows = [['Sichtweite 16 → 12', 'view distance', 21.5], ['Wasser 2 → 1', 'water mirror', 14.2], ['Auflösung × 0,8', 'resolution', 10.4], ['Feines Laub aus', 'fancy leaves', 9.4], ['Schattenkarte 3 → 2', 'shadow map', 4.7], ['Material 3 → 2', 'materials', 4.6], ['Mini-Voxel 96 → 44', 'mini-voxel detail', 2.7], ['Lichtstrahlen aus', 'light rays', 2.5]];
  const L = 300, pw = 330, bh = 22, gp = 10, T = 66;
  let body = '';
  rows.forEach(([de, en, v], i) => { const y = T + i * (bh + gp); body += text(L - 10, y + 15, de, { anchor: 'end', weight: 600 }) + text(L - 10 - de.length * 6.6 - 8, y + 15, en, { anchor: 'end', size: 11, fill: C.muted }) + `<rect x="${L}" y="${y}" width="${f1((v / 24) * pw)}" height="${bh}" rx="4" fill="${C.orange}"/>` + text(L + (v / 24) * pw + 8, y + 15, `−${v.toFixed(1)} ms`, { weight: 700 }); });
  body += text(20, 340, 'The whole frame: 95.1 ms of GPU time (opaque 40.9 · water 24.7 · plants 15.5 · far land 5.9).', { size: 11, fill: C.muted });
  body += text(20, 356, 'Each row: one Ultra setting down one step, measured A/B/A on the real card. Lesson: quads are not where this GPU spends its time.', { size: 11, fill: C.muted });
  save('gpu_costs.svg', card(720, 372, 'Was ein Bild kostet · what a frame costs', 'AMD Radeon (Ryzen APU), Ultra, a town at night — the game measuring itself with /kosten', body));
}

// ---- 9 · who fills a town's geometry (lab/tools/zahlen.js)
{
  const T = DATA.town, parts = [[T.share.blocks, C.teal, 'Blöcke · blocks'], [T.share.vx, C.violet, 'Mini-Voxel · furniture, roofs, palms, floors'], [T.share.plantsWater, C.muted, 'Pflanzen, Wasser · plants, water']];
  const L = 20, pw = 680, y = 66, bh = 34; let x = L, body = '';
  parts.forEach(([p, col]) => { const w = p * pw; body += `<rect x="${f1(x)}" y="${y}" width="${f1(w)}" height="${bh}" fill="${col}"/>`; if (p > 0.08) body += text(x + w / 2, y + 22, `${(p * 100).toFixed(1)} %`, { anchor: 'middle', weight: 700, fill: '#fff', size: 13 }); x += w; });
  parts.forEach(([p, col, lab], k) => { const ly = 126 + k * 19; body += `<rect x="${L}" y="${ly - 10}" width="11" height="11" fill="${col}"/>` + text(L + 18, ly, `${lab} — ${(p * 100).toFixed(1)} %`, { size: 12, fill: C.ink }); });
  body += text(400, 145, `${(T.quads / 1e6).toFixed(2)} million quads in 7 × 7 chunks,`, { size: 12, fill: C.muted }) + text(400, 164, 'meshed by the game\'s own mesher at Ultra', { size: 12, fill: C.muted });
  save('town_quads.svg', card(720, 196, `Wer die Stadt füllt · who fills a town (${T.name})`, 'where the geometry of a town comes from', body));
}

// ---- 10 · the facts strip: counted now, from the sources (lines, tests, blocks, biomes, formulas, the game's size)
{
  const walk = (d, ext, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, ext, acc); else if (ext.test(e.name)) acc.push(p); } return acc; };
  const lines = walk(path.join(ROOT, 'src'), /\.js$/).reduce((a, f) => a + fs.readFileSync(f, 'utf8').split('\n').length - 1, 0);
  const tests = fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /\.(js|mjs)$/.test(f)).length;
  const book = fs.readFileSync(path.join(ROOT, 'docs/math/r9si_mathematik.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const formulas = (book.match(/\\\[[\s\S]*?\\\]/g) || []).length + (book.match(/\\\([\s\S]*?\\\)/g) || []).length;
  const mb = fs.statSync(path.join(ROOT, 'play/R9-SI.html')).size / 1e6;
  const nf = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const facts = [['1', 'HTML-Datei', `one file, ${mb.toFixed(1)} MB`], ['0', 'Installation', 'nothing to install'], ['0', 'Abhängigkeiten', 'no dependencies'], [nf(V.R.types.length), 'Blockarten', 'block types'],
    [String(Object.keys(V.BIOMES).length), 'Biome', 'biomes'], [nf(lines), 'Zeilen Code', 'lines of JavaScript'], [String(tests), 'Tests', 'test files'], [String(formulas), 'Formeln', 'formulas in the book']];
  let body = '';
  facts.forEach(([n, de, en], i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 20 + col * 172, y = 20 + row * 82;
    body += `<rect x="${x}" y="${y}" width="160" height="70" rx="10" fill="#f4f6f9"/>` + text(x + 14, y + 34, n, { size: 26, weight: 800, fill: [C.teal, C.orange, C.violet, C.ink][col] }) + text(x + 14, y + 52, de, { size: 12, weight: 600 }) + text(x + 14, y + 65, en, { size: 10.5, fill: C.muted });
  });
  save('facts.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="184" viewBox="0 0 720 184" ${FONT}>\n${DARK}\n<rect class="bg" x="0.5" y="0.5" width="719" height="183" rx="12" fill="${C.bg}" stroke="${C.grid}"/>\n${body}\n</svg>\n`);
}

// ---- 11 · the buttons (one SVG each, so each can carry its own link)
{
  const icon = {
    play: '<path d="M0 -11 L17 0 L0 11 Z" fill="#fff" transform="translate(-6 0)"/>',
    down: '<path d="M-3 -12 h6 v11 h6 l-9 10 l-9 -10 h6 z M-11 12 h22 v3 h-22 z" fill="#fff"/>',
    book: '<path d="M-13 -10 q7 -3 13 1 v20 q-6 -4 -13 -1 z M13 -10 q-7 -3 -13 1 v20 q6 -4 13 -1 z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/>',
    lab: '<path d="M-4 -12 h8 M-2.5 -12 v8 l-8 15 q-1 3 2 3 h17 q3 0 2 -3 l-8 -15 v-8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><path d="M-7.5 6 h15 l2.5 5 q0.5 2 -1.5 2 h-17 q-2 0 -1.5 -2 z" fill="#fff"/>',
  };
  const btn = (name, col, ic, big, small) => save(`btn_${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="186" height="50" viewBox="0 0 186 50" ${FONT}>
<rect x="1" y="1" width="184" height="48" rx="11" fill="${col}"/>
<g transform="translate(24 25) scale(0.85)">${icon[ic]}</g>
<text x="46" y="22" font-size="15" font-weight="700" fill="#fff">${esc(big)}</text>
<text x="46" y="38" font-size="11" fill="#fff" opacity="0.88">${esc(small)}</text>
</svg>
`);
  btn('play', C.teal, 'play', 'Jetzt spielen', 'play in your browser');
  btn('download', C.orange, 'down', 'R9-SI.html', 'download · double-click');
  btn('book', C.violet, 'book', 'Mathe-Heft', 'every formula · PDF');
  btn('lab', C.ink, 'lab', 'Das Labor', 'measure the world · lab/');
}

// Aussichten — the postcard test (t-vista, vgen 11; plan docs/superpowers/plans/2026-10-15-t-vista.md §5).
// Twelve vista points of a new default world (seed 4242) — the wow vistas first (the landmark big from there: the game
// swings the view to them), the best of each landmark first (two at most), then the next best — photographed from their
// compositions (the eye over the way at the walk's start, a little over a standing eye, looking down the walk between
// its lantern posts, the landmark's top in the upper third, the lens 46–62° by the landmark's size) at the golden hour
// and at night, on the High preset as a player gets it (only the dynamic resolution held off; the wow moments off for
// the pictures):
//   after:  the world as created now (vgen 11: the vistas, the windows, the silhouettes)
//   before: the same build, the same seed, a vgen-10 world (t-land's land as shipped in v0.46), the same cameras
// → test/shots/vista_<id>_<golden|night>_<before|after>.png (1280 × 720) and test/shots/vista_sheet.jpg (a row per vista:
// before and after at the golden hour, before and after at night).
// The beauty proxy per picture (node, from the pixels and the camera; test/shots/vista_scores.json):
//   contrast    the luminance's RMS contrast and its 5–95 % range
//   hue         the hue variety: the entropy of the saturated pixels' hues (12 bins, 0…1) × their share (to 15 %),
//               and the colourfulness (Hasler & Süsstrunk)
//   upper third the landmark's box projected: its top in the upper third of the frame, inside it — and its line of
//               sight clear through the chunks loaded (in the page)
//   lead        a leading line: the strongest oblique lines (a Hough transform of the edges under the horizon) through
//               the point where the horizon meets the landmark's direction, against control points (≥ ×1.7)
// the thresholds for contrast and hue from the trailer's 34 stills (docs/trailer/frames: their 10th percentile).
// The wow moment once in the page: the player at a vista's start, the moment starts, the camera swings to the picture,
// the caption names the place, the meta keeps the vista → test/shots/vista_wow.png.
// The Very Low (potato) cost: the hills view (hills_1 of test/land.mjs) in a vgen-10 and a vgen-11 world of this build
// on fresh pages side by side, settled, measured in turns (the median of nine rounds) → test/shots/vista_cost.json.
// Checks: the worlds are vgen 11 / 10, every picture written and not blank, the proxies (after: contrast and hue at the
// trailer's 10th percentile in ≥ 9 of 12, the landmark in the upper third with its line clear in ≥ 11, a leading line
// in ≥ 8; the mean postcard score after ≥ before), the wow moment, Very Low at the hills view not slower (median ≤ ×1.05,
// or its lower half, or its triangles ≤ ×1.03), no page error.
//   nohup bash test/wt_run.sh vista.mjs 7200 > .tmp_tests/vista.log 2>&1 &
//   ONLY=v0,v4 · NO_AFTER=1 · NO_BEFORE=1 · NO_WOW=1 · NO_COST=1 · COST_ONLY=1 · SCORE_ONLY=1 (the scores and the sheet from the
//   pictures there, no browser) · ROUNDS=9 · N=16 · SEED=4242 · CAMS_ONLY=1
// regress: skip  (a showcase: the pictures are the evidence; the gates are the node tests, test/vista.js, test/wowmoment.js)
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const SEED = process.env.SEED || '4242', N = +(process.env.N || 16), ROUNDS = +(process.env.ROUNDS || 9);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DIST = process.env.DIST || 'file:///home/dev/vr/dist/index.html';
const SHOTS = '/home/dev/vr/test/shots';
const GOLDEN = 12500, NIGHT = 16000, EYE = 1.62, FOV = 62, ASPECT = 1280 / 720;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---------------------------------------------------------------- the vistas (node: the same seed, the same plan as the page's workers)
const V = require('/home/dev/vr/test/load_shared.js');
const g11 = V.makeGen('overworld', +SEED, { vgen: 11 }), P = V.Land.plan(g11);
const pick = () => {
  // (the wow vistas first — the postcards the game stages with a swing — then the quiet ones, each by its score)
  const by = P.vistas.slice().sort((a, b) => (b.wow ? 1 : 0) - (a.wow ? 1 : 0) || b.score - a.score), out = [], n = {};
  for (const cap of [2, 3]) for (const v of by) { if (out.length >= 12) break; if (out.includes(v) || (n[v.lm] || 0) >= cap) continue; out.push(v); n[v.lm] = (n[v.lm] || 0) + 1; }
  return out;
};
const VISTAS = pick().filter(v => !ONLY || ONLY.includes(v.id)).map(v => {
  const Ln = P.lines[v.line], a = Ln.pts[Math.max(0, v.i - 6)], b = Ln.pts[Math.min(Ln.pts.length - 1, v.i + 6)];
  return { id: v.id, lm: v.lm, x: v.x, y: v.y, z: v.z, d: v.d, score: v.score, frame: v.frame, eye: v.eye, yaw: v.yaw, pitch: v.pitch, fov: v.fov || FOV, aim: v.aim, box: v.box, u: v.u, wow: v.wow !== false, wayYaw: Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])) };
});
console.log(`the vistas (${P.vistas.length} in the world, ${P.vistas.filter(v => v.wow).length} with a wow moment; ${VISTAS.length} photographed): ` + VISTAS.map(v => `${v.id} ${v.lm} ${v.d} m ${v.fov}°${v.wow ? ' ★' : ''}`).join(' · '));
if (process.env.CAMS_ONLY) { for (const v of VISTAS) console.log(JSON.stringify(v)); process.exit(0); }

// ---------------------------------------------------------------- the camera's projection (the game's: vertical fov, 16:9)
const basis = (yaw, pitch) => { const cp = Math.cos(pitch), sp = Math.sin(pitch), f = [-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp], r = [Math.cos(yaw), 0, -Math.sin(yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]; return { f, r, u }; };
// a world point → [x, y] in 0…1 of the frame (y from the top), or null behind the eye
const project = (v, q) => {
  const { f, r, u } = basis(v.yaw, v.pitch), d = [q[0] - v.eye[0], q[1] - v.eye[1], q[2] - v.eye[2]];
  const zc = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (zc <= 0.1) return null;
  const t = Math.tan(v.fov * Math.PI / 360), xc = d[0] * r[0] + d[1] * r[1] + d[2] * r[2], yc = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
  return [0.5 + 0.5 * xc / (zc * t * ASPECT), 0.5 - 0.5 * yc / (zc * t)];
};
// the landmark's box in the frame: its top in the upper third, its middle inside
const boxInFrame = (v) => {
  const [x0, y0, z0, x1, y1, z1] = v.box; let top = 9, bot = -9, l = 9, rr = -9;
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) { const p = project(v, [x, y, z]); if (!p) continue; top = Math.min(top, p[1]); bot = Math.max(bot, p[1]); l = Math.min(l, p[0]); rr = Math.max(rr, p[0]); }
  const a = project(v, v.aim), cx = a ? a[0] : (l + rr) / 2;
  return { top: +top.toFixed(3), bottom: +bot.toFixed(3), left: +l.toFixed(3), right: +rr.toFixed(3), aimX: a ? +a[0].toFixed(3) : null, aimY: a ? +a[1].toFixed(3) : null, upperThird: !!a && a[1] >= 0 && a[1] <= 1 / 3 + 0.01 && cx > 0.05 && cx < 0.95 };
};

// ---------------------------------------------------------------- the beauty proxy (node, from the pixels)
const AW = 320, AH = 180;
async function pixelScore(path, v) {
  const { data, info } = await sharp(path).resize(AW, AH, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, n = W * H, ch = info.channels, L = new Float32Array(n), hist = new Float64Array(12);
  let s = 0, s2 = 0, sat = 0, rgS = 0, rgS2 = 0, ybS = 0, ybS2 = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * ch] / 255, g = data[i * ch + 1] / 255, b = data[i * ch + 2] / 255, l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    L[i] = l; s += l; s2 += l * l;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, S = mx > 0 ? d / mx : 0;
    if (S > 0.2 && mx > 0.15 && d > 0) { let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; hist[Math.floor(h / 30) % 12]++; sat++; }
    const rg = (r - g) * 255, yb = (0.5 * (r + g) - b) * 255; rgS += rg; rgS2 += rg * rg; ybS += yb; ybS2 += yb * yb;
  }
  const mean = s / n, rms = Math.sqrt(Math.max(0, s2 / n - mean * mean)), sorted = Float32Array.from(L).sort();
  let ent = 0; for (const c of hist) if (c > 0) { const p = c / sat; ent -= p * Math.log(p); } ent = sat ? ent / Math.log(12) : 0;
  const satShare = sat / n, mrg = rgS / n, myb = ybS / n, srg = Math.sqrt(Math.max(0, rgS2 / n - mrg * mrg)), syb = Math.sqrt(Math.max(0, ybS2 / n - myb * myb));
  const out = { mean: +mean.toFixed(3), rms: +rms.toFixed(4), range: +(sorted[Math.floor(n * 0.95)] - sorted[Math.floor(n * 0.05)]).toFixed(3), hueEnt: +ent.toFixed(3), satShare: +satShare.toFixed(3), hue: +(ent * Math.min(1, satShare / 0.15)).toFixed(3), colourful: +(Math.sqrt(srg * srg + syb * syb) + 0.3 * Math.sqrt(mrg * mrg + myb * myb)).toFixed(1) };
  if (!v) return out;
  // the leading line: a Hough transform of the strong edges under the horizon — on a 160 × 90 copy, softened (σ 1) so the
  // grass's and the paving's texture fall under the threshold, the gradient of the luminance and the two colour
  // opponents (a green verge against a grey wall counts), the top 12 % — lines by angle (1°) and offset (2-px bins, so a
  // staircase of blocks along a line still counts as the line); of the lines through the point T where the horizon meets
  // the spur's direction (the landmark's x), the strongest oblique one on either side (15°…78° from the horizontal, its
  // points spanning a fifth of the ground's height): its share of the edge points against the same at control points
  // along the horizon (≥ ×1.7; t-land's pictures: a way running into the picture ×1.6–2.6, views without one ×0.85–1.6)
  const vp = project(v, [v.eye[0] + v.u[0] * 4000, v.eye[1], v.eye[2] + v.u[1] * 4000]), lm = project(v, v.aim);
  if (!vp || !lm) return Object.assign(out, { lead: 0, leadRatio: 0, leadOk: false });
  const SW = 160, SH = 90, sm = await sharp(path).resize(SW, SH, { fit: 'fill' }).blur(1).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sc = sm.info.channels, C = [new Float32Array(SW * SH), new Float32Array(SW * SH), new Float32Array(SW * SH)];
  for (let i = 0; i < SW * SH; i++) { const r = sm.data[i * sc] / 255, g = sm.data[i * sc + 1] / 255, b = sm.data[i * sc + 2] / 255; C[0][i] = 0.2126 * r + 0.7152 * g + 0.0722 * b; C[1][i] = (r - g) * 0.8; C[2][i] = ((r + g) / 2 - b) * 0.8; }
  const sob = (A, i) => { const gx = (A[i - SW + 1] + 2 * A[i + 1] + A[i + SW + 1]) - (A[i - SW - 1] + 2 * A[i - 1] + A[i + SW - 1]), gy = (A[i + SW - 1] + 2 * A[i + SW] + A[i + SW + 1]) - (A[i - SW - 1] + 2 * A[i - SW] + A[i - SW + 1]); return gx * gx + gy * gy; };
  const yH = Math.max(0, Math.min(SH - 6, vp[1] * SH)), xT = Math.max(0, Math.min(SW, vp[0] * SW)), mags = [], P = [];
  for (let y = Math.max(1, Math.ceil(yH + 2)); y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) { const i = y * SW + x, m = Math.sqrt(sob(C[0], i) + sob(C[1], i) + sob(C[2], i)); mags.push(m); P.push([x, y, m]); }
  if (P.length < 50) return Object.assign(out, { lead: 0, leadRatio: 0, leadOk: false });
  const thr = mags.slice().sort((a, b) => a - b)[Math.floor(mags.length * 0.88)], E = P.filter(q => q[2] >= thr && q[2] > 1e-4), span = SH - yH;
  const NT = 180, RB = 2, R0 = 300, NR = Math.ceil(600 / RB), acc = new Float32Array(NT * NR), ymin = new Float32Array(NT * NR).fill(1e9), ymax = new Float32Array(NT * NR).fill(-1);
  const CS = [], SN = []; for (let t = 0; t < NT; t++) { CS.push(Math.cos(t * Math.PI / 180)); SN.push(Math.sin(t * Math.PI / 180)); }
  for (const [x, y] of E) for (let t = 0; t < NT; t++) { const k = t * NR + Math.floor((x * CS[t] + y * SN[t] + R0) / RB); acc[k]++; if (y < ymin[k]) ymin[k] = y; if (y > ymax[k]) ymax[k] = y; }
  const vote = (xt) => {
    const best = [0, 0];
    for (let t = 0; t < NT; t++) {
      const phi = (t + 90) % 180, a2 = phi > 90 ? 180 - phi : phi; if (a2 < 15 || a2 > 78) continue;   // the line's direction
      const side = phi > 90 ? 0 : 1, rc = Math.floor((xt * CS[t] + yH * SN[t] + R0) / RB);
      for (let r = rc - 1; r <= rc + 1; r++) { if (r < 0 || r >= NR) continue; const k = t * NR + r; if (acc[k] > best[side] && ymax[k] - ymin[k] >= span * 0.2) best[side] = acc[k]; }
    }
    return (best[0] + best[1]) / E.length;
  };
  const lead = vote(xT), ctl = []; for (let k = 1; k <= 9; k++) { const xc = SW * k / 10; if (Math.abs(xc - xT) > 0.1 * SW) ctl.push(vote(xc)); }
  const base = ctl.length ? ctl.reduce((a, b) => a + b, 0) / ctl.length : 0;
  return Object.assign(out, { lead: +lead.toFixed(3), leadRatio: +(lead / Math.max(0.002, base)).toFixed(2), leadOk: lead >= 0.06 && lead / Math.max(0.002, base) >= 1.7 });
}
const notBlank = async (path) => { try { const q = await pixelScore(path, null); return q.rms > 0.02; } catch (e) { return false; } };
// the bright pixels in the landmark's box (night: its lights)
async function boxLights(path, v) {
  const b = boxInFrame(v); if (!(b.right > 0 && b.left < 1 && b.bottom > 0 && b.top < 1)) return 0;
  const { data, info } = await sharp(path).resize(AW, AH, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const x0 = Math.max(0, Math.floor(b.left * AW)), x1 = Math.min(AW - 1, Math.ceil(b.right * AW)), y0 = Math.max(0, Math.floor(b.top * AH)), y1 = Math.min(AH - 1, Math.ceil(b.bottom * AH));
  let k = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * AW + x) * info.channels, l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255; if (l > 0.55) k++; }
  return k;
}

// ---------------------------------------------------------------- the trailer's stills: the thresholds
const TRAILER = '/home/dev/vr/docs/trailer/frames';
const tStats = [];
for (const f of fs.readdirSync(TRAILER).filter(f => /\.(jpg|png)$/.test(f)).sort()) tStats.push(await pixelScore(TRAILER + '/' + f, null));
const pct = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * p)))]; };
const TH = { rms: pct(tStats.map(q => q.rms), 0.1), hue: pct(tStats.map(q => q.hue), 0.1), rmsMed: pct(tStats.map(q => q.rms), 0.5), hueMed: pct(tStats.map(q => q.hue), 0.5), colourfulMed: pct(tStats.map(q => q.colourful), 0.5) };
console.log(`the trailer's ${tStats.length} stills: contrast (RMS) p10 ${TH.rms.toFixed(4)} median ${TH.rmsMed.toFixed(4)} · hue variety p10 ${TH.hue.toFixed(3)} median ${TH.hueMed.toFixed(3)} · colourfulness median ${TH.colourfulMed}`);

// ---------------------------------------------------------------- the scores and the sheet (also SCORE_ONLY=1, from the pictures there)
const pathOf = (v, tod, tag) => `${SHOTS}/vista_${v.id}_${tod}_${tag}.png`;
async function scoreAll(sight) {
  const rows = [];
  for (const v of VISTAS) {
    const bx = boxInFrame(v), row = { id: v.id, lm: v.lm, d: v.d, frame: v.frame, box: bx };
    for (const tag of ['before', 'after']) for (const tod of ['golden', 'night']) {
      const p = pathOf(v, tod, tag); if (!fs.existsSync(p)) continue;
      const q = await pixelScore(p, v), sg = sight && sight[tag] && sight[tag][v.id];
      q.clear = sg ? sg.clear : null; q.upper = bx.upperThird && (sg ? sg.clear >= 0.6 : true);
      if (tod === 'night') q.lights = await boxLights(p, v);
      // the postcard score: contrast and hue against the trailer's medians, the landmark up there and seen, a leading line
      q.postcard = +((Math.min(1, q.rms / TH.rmsMed) + Math.min(1, q.hue / Math.max(0.01, TH.hueMed)) + (q.upper ? 1 : 0) + (q.leadOk ? 1 : 0)) / 4).toFixed(3);
      row[tag + '_' + tod] = q;
    }
    rows.push(row);
  }
  return rows;
}
async function sheet(rows) {
  const CW = 320, CH = 180, LBL = 18, HEAD = 24, cols = [['before', 'golden'], ['after', 'golden'], ['before', 'night'], ['after', 'night']];
  const H = HEAD + rows.length * (CH + LBL), comps = [];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const text = (w, h, s, bg, size) => ({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="5" y="${h - 5}" font-family="DejaVu Sans, sans-serif" font-size="${size}" fill="#e8eef8">${esc(s)}</text></svg>`) });
  comps.push(Object.assign(text(1280, HEAD, `Aussichten (t-vista) · seed ${SEED} · before: vgen 10 · after: vgen 11 · columns: before golden · after golden · before night · after night`, '#0b1020', 13), { left: 0, top: 0 }));
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r], y = HEAD + r * (CH + LBL);
    for (let c = 0; c < cols.length; c++) {
      const [tag, tod] = cols[c], v = VISTAS.find(q => q.id === row.id), p = pathOf(v, tod, tag), q = row[tag + '_' + tod];
      if (fs.existsSync(p)) comps.push({ input: await sharp(p).resize(CW, CH, { fit: 'fill' }).toBuffer(), left: c * CW, top: y + LBL });
      const lab = q ? `${row.id} ${row.lm} ${row.d} m · ${tag} ${tod} · C ${q.rms.toFixed(3)} H ${q.hue.toFixed(2)} ${q.upper ? '⅓✓' : '⅓✗'} ${q.leadOk ? 'lead✓' : 'lead✗'} · ${q.postcard}` : `${row.id} ${tag} ${tod}: —`;
      comps.push(Object.assign(text(CW, LBL, lab, tag === 'after' ? '#13233a' : '#222', 10.5), { left: c * CW, top: y }));
    }
  }
  await sharp({ create: { width: 1280, height: H, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 80 }).toFile(`${SHOTS}/vista_sheet.jpg`);
  return `${SHOTS}/vista_sheet.jpg`;
}
function report(rows) {
  const n = rows.length, cnt = (tag, tod, f) => rows.filter(r => r[tag + '_' + tod] && f(r[tag + '_' + tod])).length, has = (tag, tod) => rows.filter(r => r[tag + '_' + tod]).length;
  const mean = (tag, tod, k) => { const a = rows.map(r => r[tag + '_' + tod]).filter(Boolean).map(q => q[k]); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; };
  console.log('the postcards (C contrast RMS · H hue variety · ⅓ the landmark in the upper third, its line clear · lead · the postcard score 0…1):');
  for (const r of rows) {
    const f = (q) => q ? `C ${q.rms.toFixed(3)} H ${q.hue.toFixed(2)} col ${q.colourful} ⅓ ${q.upper ? 'yes' : 'no'}${q.clear !== null ? ` (clear ${q.clear})` : ''} lead ${q.lead}/×${q.leadRatio}${q.leadOk ? ' ✓' : ''}${q.lights !== undefined ? ` lights ${q.lights}` : ''} → ${q.postcard}` : '—';
    console.log(`  ${r.id} ${r.lm} ${r.d} m (${r.frame}; the box top at ${r.box.aimY} of the height): golden before ${f(r.before_golden)} | after ${f(r.after_golden)}`);
    console.log(`  ${' '.repeat(r.id.length)} night  before ${f(r.before_night)} | after ${f(r.after_night)}`);
  }
  const s = {};
  for (const tag of ['before', 'after']) for (const tod of ['golden', 'night']) s[tag + '_' + tod] = { n: has(tag, tod), contrast: cnt(tag, tod, q => q.rms >= TH.rms), hue: cnt(tag, tod, q => q.hue >= TH.hue), upper: cnt(tag, tod, q => q.upper), lead: cnt(tag, tod, q => q.leadOk), postcard: +mean(tag, tod, 'postcard').toFixed(3), rms: +mean(tag, tod, 'rms').toFixed(4), hueMean: +mean(tag, tod, 'hue').toFixed(3), lights: +mean(tag, tod, 'lights').toFixed(1) };
  console.log('summary ' + JSON.stringify(s));
  return { n, s };
}

// ---------------------------------------------------------------- a page with a world (test/land.mjs's machinery)
let browser = null;
// (the browser's module only when a page is wanted: SCORE_ONLY=1 starts none)
const launch = async () => { const { chromium } = await import('/home/dev/.npm-global/lib/node_modules/playwright/index.mjs'); return chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] }); };
async function openWorld(dist, preset, vgen) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  // (by the clock, not by rounds: run 1's first vista stopped after 260 quick rounds — a minute — with 4269 sections
  // still to mesh on this shared machine; the near chunks complete, then the far ring and the horizon until farMaxS)
  const settle = async (maxS = 300, farMaxS = 90) => {
    let s = null; const t0 = Date.now();
    await boost(true);
    for (let i = 0; ; i++) {
      await step(20);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const near = s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0, el = (Date.now() - t0) / 1000;
      s.i = i; s.s = Math.round(el);
      if (near && i > 2 && ((s.hz === 0 && s.far === 0) || el >= farMaxS)) break;
      if (el >= maxS) break;
      await wait(150);
    }
    await boost(false);
    return s;
  };
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) { let wt = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) wt++; } if (!wt) break; r.vxResidency(list, cam); }
    return n;
  });
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
  await ev(`VR.game.createWorld({name:'Aussicht',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true,vgen:${vgen}})`);
  for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; g.settings.wowMoments = false; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  const pose = (x, feet, z, yaw, pitch, fov, tod) => ev(([x, y, z, yaw, pitch, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.viewYaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(tod); }, [x, feet, z, yaw, pitch, fov, tod]);
  const picture = async (path, tod, frames = 3) => {
    const vx = await warmVx();
    await ev(([frames, tod]) => { window.__norender = false; const g = VR.game, Vg = g.villages, p = g.player; g.env.setTime(tod); const keep = Vg && Vg.agents ? Vg.agents : null; if (keep) Vg.agents = keep.filter(a => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 8); for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); if (keep) Vg.agents = keep; window.__norender = true; }, [frames, tod]);
    for (let k = 0; k < 2; k++) {
      try { await page.screenshot({ path, timeout: 150000 }); return vx; } catch (e) {
        const alive = await Promise.race([ev(() => Math.round(performance.now())).then(() => 'answers', () => 'error'), wait(20000).then(() => 'silent')]);
        console.log(`  !! screenshot ${path.replace(/^.*\//, '')} failed (${String(e.message || e).split('\n')[0].slice(0, 120)}); the page ${alive}`);
        if (alive !== 'answers') throw e;
      }
    }
    return vx;
  };
  // the line from the eye to points of the landmark through the chunks loaded: the share clear (the landmark's own
  // blocks — its radius — and what lies beyond the chunks are not counted)
  const sight = (eye, pts, skipEnd) => ev(([eye, pts, skipEnd]) => {
    const w = VR.game.world, R = VR.R, F = VR.F, out = [];
    for (const q of pts) {
      const d = Math.hypot(q[0] - eye[0], q[1] - eye[1], q[2] - eye[2]), n = Math.ceil(d / 0.5); let hit = null;
      for (let i = 2; i < n - Math.ceil(skipEnd / 0.5); i++) {
        const t = i / n, x = eye[0] + (q[0] - eye[0]) * t, y = eye[1] + (q[1] - eye[1]) * t, z = eye[2] + (q[2] - eye[2]) * t;
        if (w.isLoaded && !w.isLoaded(Math.floor(x), Math.floor(z))) break;
        const s = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)), fl = s ? R.T.flags[s] : 0;
        if (s && ((fl & (F.OPAQUE | F.LEAVES)) || ((fl & F.SOLID) && !(fl & F.PLANT)))) { hit = [R.types[R.T.type[s]].name, +(t * d).toFixed(1)]; break; }
      }
      out.push(hit);
    }
    return out;
  }, [eye, pts, skipEnd]);
  return { ctx, page, logs, ev, wait, step, settle, warmVx, pose, picture, sight, ok };
}
const samplePts = (v) => { const [x0, y0, z0, x1, y1, z1] = v.box, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rx = (x1 - x0) / 2, rz = (z1 - z0) / 2, h = y1 - y0, yy = y1 - 0.12 * h; return [v.aim, [cx - 0.3 * rx, yy, cz], [cx + 0.3 * rx, yy, cz], [cx, yy, cz - 0.3 * rz], [cx, yy, cz + 0.3 * rz]]; };

// ---------------------------------------------------------------- the pictures of one world
const sightRec = { before: {}, after: {} };
try { const old = JSON.parse(fs.readFileSync(`${SHOTS}/vista_sight.json`, 'utf8')); Object.assign(sightRec.before, old.before || {}); Object.assign(sightRec.after, old.after || {}); } catch (e) { /* none yet */ }
async function shoot(tag, vgen, keepOpen) {
  const A = await openWorld(DIST, 'high', vgen);
  check(A.ok, `${tag}: the world is loaded (${secs()})`);
  const meta = await A.ev(() => { const g = VR.game; return { vgen: (g.meta && g.meta.vgen) || 0, vista: !!(VR.Vista && VR.Vista.on && VR.Vista.on({ vgen: g.meta.vgen, singleBiome: -1, flat: false })), wow: !!g.wow, preset: g.settings.preset, wowMoments: g.settings.wowMoments }; });
  console.log(tag, 'world', JSON.stringify(meta));
  check(tag === 'after' ? meta.vgen === 11 && meta.vista && meta.wow : meta.vgen === 10 && !meta.vista, `${tag}: a vgen-${meta.vgen} world${tag === 'after' ? ' with the vistas (a new world\'s default) and the wow moments\' actor' : ' (t-land\'s land, no vistas)'}`);
  await A.settle(120, 20);
  let pics = 0, wanted = 0; const blank = [];
  for (const v of VISTAS) {
    const t0 = Date.now();
    await A.pose(v.eye[0], v.eye[1] - EYE, v.eye[2], v.yaw, v.pitch, v.fov, GOLDEN);
    const st = await A.settle(wanted === 0 ? 420 : 300, wanted === 0 ? 150 : 90); await A.step(6);
    console.log(`  · ${v.id} ${v.lm}: settled ${JSON.stringify(st)} (${secs()})`);
    for (const [tod, T] of [['golden', GOLDEN], ['night', NIGHT]]) {
      const path = pathOf(v, tod, tag); wanted++;
      try { await A.picture(path, T); } catch (e) { console.log(`  !! ${v.id} ${tod}: no picture (${String(e.message || e).split('\n')[0].slice(0, 160)})`); continue; }
      if (fs.existsSync(path)) { pics++; if (!(await notBlank(path))) blank.push(path.replace(/^.*\//, '')); }
    }
    const hits = await A.sight(v.eye, samplePts(v), Math.min(60, (v.box[3] - v.box[0]) / 2 + 6));
    sightRec[tag][v.id] = { clear: +(hits.filter(h => !h).length / hits.length).toFixed(2), hits: hits.filter(Boolean).slice(0, 3) };
    console.log(`  ${v.id} ${v.lm} (${v.d} m): pictures ${((Date.now() - t0) / 1000).toFixed(0)} s · the line to the landmark ${JSON.stringify(sightRec[tag][v.id])} (${secs()})`);
    try { fs.writeFileSync(`${SHOTS}/vista_sight.json`, JSON.stringify(sightRec, null, 1)); } catch (e) { /* a convenience */ }
  }
  check(pics === wanted && wanted > 0, `${tag}: every picture is written (${pics} of ${wanted})`);
  check(blank.length === 0, `${tag}: no picture is blank (${blank.length}${blank.length ? ': ' + blank.join(', ') : ''})`);
  if (keepOpen) return A;
  await closePage(tag, A);
  return null;
}
async function closePage(tag, A) {
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${tag} logs (${A.logs.length})`); for (const l of A.logs.slice(0, 10)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  await A.ctx.close();
}

// ---------------------------------------------------------------- the wow moment in the page
async function wow(A) {
  const v = VISTAS.slice().reverse().find(q => q.wow) || VISTAS[VISTAS.length - 1];   // (the last wow vista photographed: its chunks are loaded)
  await A.pose(v.x + 0.5, v.y + 1, v.z + 0.5, v.wayYaw, 0, 75, GOLDEN);
  const st = await A.settle(240, 60);
  const pre = await A.ev((id) => { const g = VR.game, w = g.wow; return { has: !!w, known: w ? w.list.has(id) : false, n: w ? w.list.size : 0, seen: (g.meta.wowSeen || []).slice(), screen: g.ui.screen, blocking: g.ui.blocking, state: w ? w.state() : null }; }, v.id);
  console.log(`  · the wow moment at ${v.id} (${v.lm}): settled ${JSON.stringify(st)} · ${JSON.stringify(pre)} (${secs()})`);
  check(pre.has && pre.known, `the wow moments' actor knows the vista from its chunk's spawns (${pre.n} vistas known)`);
  await A.ev(() => { VR.game.settings.wowMoments = true; });
  await A.step(30, 33);   // a second: the look four times a second finds the vista, the rise begins
  const mid = await A.ev(() => { const g = VR.game, w = g.wow; return { active: !!(w && w.active), id: w && w.active ? w.active.id : null, t: w ? +w.t.toFixed(2) : 0, seen: (g.meta.wowSeen || []).slice(), cap: w && w.capText ? w.capText.textContent : '', state: w ? w.state() : null }; });
  check(mid.active && mid.id === v.id, `standing at the vista's start the moment begins (${JSON.stringify({ active: mid.active, id: mid.id, t: mid.t })}${mid.active ? '' : '; ' + JSON.stringify(mid.state)})`);
  check(mid.seen.includes(v.id), `the world's meta keeps the vista as seen (${JSON.stringify(mid.seen)})`);
  check(mid.cap.length > 3, `the caption names the place („${mid.cap}")`);
  if (mid.active) {
    const need = Math.max(0, Math.round((2.0 - mid.t) / 0.033)); if (need) await A.step(need, 33);   // into the hold
    const path = `${SHOTS}/vista_wow.png`;
    await A.picture(path, GOLDEN, 1);
    const cam = await A.ev(() => { const c = VR.game.cam, w = VR.game.wow; return { yaw: c.yaw, pitch: c.pitch, fov: c.fov, x: c.x, y: c.y, z: c.z, t: w.t, op: w.dom ? +w.dom.style.opacity : -1 }; });
    const dyaw = Math.abs(Math.atan2(Math.sin(cam.yaw - v.yaw), Math.cos(cam.yaw - v.yaw))), dpos = Math.hypot(cam.x - v.eye[0], cam.y - v.eye[1], cam.z - v.eye[2]);
    check(dyaw < 0.02 && Math.abs(cam.pitch - v.pitch) < 0.02 && Math.abs(cam.fov - v.fov * Math.PI / 180) < 0.01 && dpos < 1.2, `in the hold the camera is the vista's picture (yaw off ${dyaw.toFixed(3)}, pitch off ${Math.abs(cam.pitch - v.pitch).toFixed(3)}, ${dpos.toFixed(2)} blocks from its eye, the caption's opacity ${cam.op}, t ${cam.t.toFixed(2)} s) → ${path.replace(/^.*test\//, 'test/')}`);
    await A.step(90, 33);
    const end = await A.ev(() => { const g = VR.game, w = g.wow; return { active: !!(w && w.active), cap: w && w.dom ? w.dom.style.display : '' }; });
    check(!end.active && end.cap === 'none', 'after four seconds the view is the player\'s again and the caption gone');
    await A.ev(() => { VR.game.settings.wowMoments = false; });
  }
}

// ---------------------------------------------------------------- run
if (!process.env.SCORE_ONLY && !process.env.COST_ONLY) {
  browser = await launch();
  if (!process.env.NO_AFTER) {
    const A = await shoot('after', 11, !process.env.NO_WOW);
    if (A) { try { await wow(A); } catch (e) { check(false, `the wow moment in the page (${String(e.message || e).slice(0, 300)})`); } await closePage('after', A); }
  }
  if (!process.env.NO_BEFORE) await shoot('before', 10, false);
}
// the scores, the sheet
{
  const rows = await scoreAll(sightRec), R0 = report(rows), s = R0.s, a = s.after_golden, b = s.before_golden;
  try { fs.writeFileSync(`${SHOTS}/vista_scores.json`, JSON.stringify({ seed: SEED, trailer: TH, summary: s, rows }, null, 1)); } catch (e) { /* a convenience */ }
  const sh = await sheet(rows); console.log('the sheet: ' + sh.replace(/^.*test\//, 'test/'));
  if (a.n) {
    check(a.contrast >= Math.min(9, a.n - 1), `after, golden hour: the contrast reaches the trailer stills' 10th percentile (RMS ${TH.rms.toFixed(4)}) in ${a.contrast} of ${a.n} (before ${b.contrast} of ${b.n})`);
    check(a.hue >= Math.min(9, a.n - 1), `after, golden hour: the hue variety reaches the trailer stills' 10th percentile (${TH.hue.toFixed(3)}) in ${a.hue} of ${a.n} (before ${b.hue} of ${b.n})`);
    check(a.upper >= a.n - 1, `after, golden hour: the landmark's box in the upper third with its line clear in ${a.upper} of ${a.n} (before ${b.upper} of ${b.n})`);
    check(a.lead >= Math.min(8, a.n - 2), `after, golden hour: a leading line toward the landmark in ${a.lead} of ${a.n} (before ${b.lead} of ${b.n})`);
    if (b.n) check(a.postcard >= b.postcard, `the mean postcard score after ${a.postcard} ≥ before ${b.postcard} (night: ${s.after_night.postcard} against ${s.before_night.postcard})`);
  }
}

// ---------------------------------------------------------------- the Very Low cost: the hills view, vgen 10 against vgen 11
if (!process.env.NO_COST && !process.env.SCORE_ONLY) {
  if (!browser) browser = await launch();
  const S = { name: 'hills_1', x: 0.5, z: -292.5, eyeY: 136, at: [0, 84, -105], fov: 60, tod: GOLDEN };
  const pages = [], rec = { scene: S };
  try {
    const A2 = await openWorld(DIST, 'potato', 11); check(A2.ok, `a vgen-11 world is loaded on Very Low for the cost (${secs()})`); pages.push(['v11', A2]);
    const B = await openWorld(DIST, 'potato', 10); check(B.ok, `a vgen-10 world is loaded on Very Low for the cost (${secs()})`); pages.push(['v10', B]);
    const measure = (Pg, n) => Pg.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let k = -2, sum = 0, d = 0, t = 0, ht = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}, hs = g.horizon ? g.horizon.stats : {}; sum += dt; d += st.draws || 0; t += st.tris || 0; ht += hs.tris || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n), hzTris: Math.round(ht / n), hzTiles: hs.drawn || 0 }); } } catch (e) { no(String(e)); } }; f(); }), n);
    const dx = S.at[0] - S.x, dy = S.at[1] - S.eyeY, dz = S.at[2] - S.z, yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    for (const [, Pg] of pages) {
      await Pg.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [S.x, S.z]); await Pg.settle(60, 10);
      await Pg.pose(S.x, S.eyeY - EYE, S.z, yaw, pitch, S.fov, S.tod);
      const st = await Pg.settle(300, 240); await Pg.step(6);
      console.log(`  · hills_1 on Very Low settled ${JSON.stringify(st)} (${secs()})`);
    }
    const rounds = {};
    for (let r = 0; r < ROUNDS; r++) { const order = r & 1 ? pages.slice().reverse() : pages; for (const [lbl, Pg] of order) (rounds[lbl] = rounds[lbl] || []).push(await measure(Pg, N)); }
    const out = {};
    for (const lbl of Object.keys(rounds)) { const ms = rounds[lbl].map(q => q.ms).sort((a, b) => a - b), mid = rounds[lbl][ROUNDS >> 1], lo = ms.slice(0, Math.ceil(ms.length / 2)); out[lbl] = { msMedian: ms[ms.length >> 1], msLow: +(lo.reduce((a, b) => a + b, 0) / lo.length).toFixed(2), ms, draws: mid.draws, tris: mid.tris, hzTris: mid.hzTris, hzTiles: mid.hzTiles }; }
    if (out.v10 && out.v11) { out.ratio = +(out.v11.msMedian / out.v10.msMedian).toFixed(3); out.lowRatio = +(out.v11.msLow / out.v10.msLow).toFixed(3); out.trisRatio = +(out.v11.tris / out.v10.tris).toFixed(3); }
    rec.cost = out;
    console.log(`very low · hills_1: ${JSON.stringify(out)}`);
    if (out.ratio) check(out.ratio <= 1.05 || out.lowRatio <= 1.05 || out.trisRatio <= 1.03, `Very Low at the hills view is not slower with the vistas (vgen 11 median ${out.v11.msMedian} ms against vgen 10 ${out.v10.msMedian} ms: ×${out.ratio}; the lower half ${out.v11.msLow} against ${out.v10.msLow}: ×${out.lowRatio}; triangles ${out.v11.tris} against ${out.v10.tris}: ×${out.trisRatio}; the horizon's ${out.v11.hzTris} against ${out.v10.hzTris}; draws ${out.v11.draws} against ${out.v10.draws})`);
    try { fs.writeFileSync(`${SHOTS}/vista_cost.json`, JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ }
    // the pictures last, one page at a time
    for (const [lbl, Pg] of pages.slice().reverse()) {
      await Pg.pose(S.x, S.eyeY - EYE, S.z, yaw, pitch, S.fov, S.tod); const st = await Pg.settle(240, 200);
      console.log(`  · hills_1 (${lbl}, Very Low) settled for its picture ${JSON.stringify(st)}`);
      try { await Pg.picture(`${SHOTS}/vista_potato_hills_1_${lbl}.png`, S.tod, 12); } catch (e) { console.log(`  !! no Very Low picture (${lbl})`); }
      await closePage(`${lbl} (Very Low page)`, Pg);
    }
  } catch (e) { check(false, `the Very Low cost is measured (${String(e.message || e).slice(0, 300)})`); }
}
if (browser) await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

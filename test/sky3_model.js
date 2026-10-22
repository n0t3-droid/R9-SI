// t-sky3 · the sky's band model (docs/superpowers/plans/2026-10-16-t-sky3.md §5 g): skyColor's gradient and glows — the
// three stops, the haze band, the sun's glow, the day aureole and halo, t-sky3's layers (the sun-side band, the earth's
// shadow and its belt) — mirrored in JS, through the composite (the exposure, the grade, the vivid tone map, the
// saturation, the gamma) and t-light2's grade by the hour (the curve, the split toning, the mid-tones' saturation, the
// vignette), sampled as test/sky3.mjs measures the game's pictures (640 × 360, the camera pitched up 12°, the game's vertical
// field of 75°, the bands of test/sky_ref.js from the horizon line H, the sun's cone and the planets masked). Not mirrored: the
// cosmic layer (the nebula, the stars), the bloom and the light in the air — test/sky3.js g takes them as
// the residual of run 1 (the v0.48 build's measured bands less this model's) where the build's space is the same.
// A module: require('./sky3_model.js') → { view, bands, display, skyHDR }.
const SR = require('./sky_ref.js');
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mixv = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const aces = (x) => clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1);
// shaders.js COMMON's hash12 and vnoise (float64 here: the same pattern's statistics, not its exact texels)
const fract = (x) => x - Math.floor(x);
function hash12(x, y) { let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031); const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33); a += d; b += d; c += d; return fract((a + b) * c); }
function vnoise(x, y) { const i = Math.floor(x), j = Math.floor(y); let fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = hash12(i, j), b = hash12(i + 1, j), c = hash12(i, j + 1), d = hash12(i + 1, j + 1); return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy; }
// the high cirrus (skyColor, u_cirrus on: Balanced and up) and t-sky3's tint by the hour
function cirrus(col, dir, E, U, toSun) {
  if (dir[1] <= 0.1) return col;
  const qx = dir[0] / (dir[1] + 0.1), qz = dir[2] / (dir[1] + 0.1), dr = E.cloudDrift || [(E.time || 0) * 0.9, 0];
  const a = vnoise(qx * 0.35 + qz * 0.2 + dr[0] / 4000 * 0.35 + dr[1] / 4000 * 0.2, qz * 5 + 3 + dr[1] / 4000 * 5), b = vnoise(qx * 0.6 - 7, qz * 13 - 1);
  const m3 = vnoise(qx * 0.22 + 17, qz * 0.22 + 17);
  let st = ss(0.74, 0.9, a * 0.7 + b * 0.38) * ss(0.55, 0.72, m3);
  st *= ss(0.14, 0.28, dir[1]) * (1 - ss(0.55, 0.8, dir[1]));
  const night = E.night || 0, rain = E.rain || 0;
  let cir = [0.82, 0.86, 1].map((v, i) => v * (0.25 + 0.6 * (1 - night)) + E.sunColor[i] * 0.05 + E.sunset[i] * 0.3 * toSun);
  if (U && U.u_s3Cir) {
    const C = U.u_s3Cir;
    cir = cir.map((v, i) => v + (U.u_c3Top[i] * 0.7 + U.u_c3Sun[i] * 0.6 - v) * C[0]);
    st = Math.max(st, ss(0.62, 0.86, a * 0.7 + b * 0.38) * ss(0.4, 0.62, m3) * ss(0.12, 0.24, dir[1]) * (1 - ss(0.6, 0.85, dir[1])) * C[1]);
  }
  const k = st * 0.5 * (1 - rain) * (1 - night * 0.8);
  return col.map((v, i) => v + (cir[i] - v) * k);
}

// the sky's HDR colour in the direction dir (skyColor, withSun, without the cosmic layer, the sun's disc and the moon);
// U: the t-sky3 uniforms (VR.Sky3.uniforms(E, q, cam, 'sky')) or null (SKY3 off)
function skyHDR(E, dir, U) {
  const h = Math.max(dir[1], 0), s = E.skyStops, st = [1 / Math.max(1e-3, s[0]), s[1], 1 / Math.max(1e-3, s[2] - s[1]), s[3] === undefined ? 0.45 : s[3]];
  const sR = (e0, rw, x) => { const t = clamp((x - e0) * rw, 0, 1); return t * t * (3 - 2 * t); };
  const z = E.skyDay || [0.6, 1, 0, 0], rain = E.rain || 0, magic = E.magic === undefined ? 0.8 : E.magic;
  let col = mixv(E.horizon, E.skyMid, sR(0, st[0], h));
  const zen = [0, 1, 2].map(i => E.zenith[i] + E.skyMid[i] * (0.4 * (1 - Math.min(1, magic * 1.25)) * z[2]));
  col = mixv(col, zen, sR(st[1], st[2], h));
  const dayK = 1 - E.night, qh = 1 - h;
  const zh = 1 - Math.min(1, h * z[1]), zh16 = Math.pow(zh, 16);
  col = mixv(col, [E.horizon[0] * 1.16 + 0.035 * dayK, E.horizon[1] * 1.1 + 0.04 * dayK, E.horizon[2] * 1.02 + 0.03 * dayK], zh16 * z[0] * dayK);
  const toSun = Math.max(dot(dir, E.sunDir), 0), hb = Math.pow(qh, 5), t7 = Math.pow(toSun, 7);
  col = col.map((v, i) => v + E.sunset[i] * (t7 * 1.3 + hb * 0.45) * (0.3 + 0.7 * toSun));
  col = col.map((v, i) => v + E.sunColor[i] * t7 * t7 * 0.07 * z[2] * (1 - rain));
  const aurK = ss(0.5, 0.98, toSun) * (1 - ss(0.52, 0.8, h));
  col = col.map((v, i) => Math.max(v, E.skyMid[i] * (2 * aurK * aurK * z[2] * (1 - rain))));
  col = col.map((v, i) => v + E.sunColor[i] * Math.pow(toSun, 60) * st[3] * (1 - rain));
  if (U) col = s3Layers(col, dir, h, E, U);
  if (dir[1] < 0) col = mixv(col, E.horizon.map(v => v * 0.55), clamp(-dir[1] * 2.5, 0, 1));
  if (E.cirrus !== false) col = cirrus(col, dir, E, U, toSun);
  return col;
}
// t-sky3 (sky3.js glslSky s3Layers): the sun-side band and the earth's shadow with its belt — the same arithmetic
function s3Layers(col, dir, h, E, U) {
  const sl = Math.hypot(E.sunDir[0], E.sunDir[2]) || 1, dl = Math.hypot(dir[0], dir[2]) || 1;
  const az = 0.5 + 0.5 * (E.sunDir[0] * dir[0] + E.sunDir[2] * dir[2]) / (sl * dl);
  const W = U.u_s3Warm, W2 = U.u_s3Warm2, SH = U.u_s3Shade, BE = U.u_s3Belt, RC = U.u_s3Reach;
  const side = Math.exp(-(1 - az) * RC[0]);
  const hk = h / Math.max(W2[3], 1e-3), low = Math.exp(-hk * hk * 2.2), up = Math.exp(-(hk - 1.1) * (hk - 1.1) * 1.3);
  // the whole sky's lean toward the sun's side (a broad, low-frequency warmth: wide at the golden hour)
  const broad = Math.exp(-(1 - az) * RC[2]) * RC[1] * (1 - ss(0, 0.7, h) * 0.6);
  col = col.map((v, i) => v + (W[i] * low + W2[i] * up * 0.65) * side * W[3] + W[i] * broad);
  const GL = U.u_s3Glow, ag = Math.exp((dot(dir, E.sunDir) - 1) * GL[3]);
  col = col.map((v, i) => v + GL[i] * ag);
  if (BE[3] > 0.001) {
    const anti = ss(0.15, 0.85, 1 - az), top = SH[3], sh0 = 1 - ss(top * 0.75, top * 1.12, h);
    col = mixv(col, [SH[0], SH[1], SH[2]], sh0 * anti * BE[3]);
    const bt = (h - top * 1.4) / Math.max(top * 0.5, 1e-3), eb = Math.exp(-bt * bt);
    col = col.map((v, i) => v + BE[i] * eb * anti * BE[3]);
  }
  return col;
}
// f-sky4 · the sun's disc (sky3.js glslSky s3SunDisc — the same arithmetic) added where the sky shader adds it (sd > 0.95)
function sunDisc(E, U, dir) {
  const sd = dot(dir, E.sunDir);
  if (!U || sd <= 0.95) return [0, 0, 0];
  const e = 1 - sd, th = Math.sqrt(2 * e), S = U.u_s3Sun, r = S[0];
  const c = E.sunColor, sl = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11, sc = c.map(v => v * (Math.max(sl, 0.9) / Math.max(sl, 1e-3)));
  const disc = 1 - ss(r - S[1], r + S[1], th);
  const q = clamp(th / r, 0, 1), limb = 0.72 + 0.28 * Math.sqrt(1 - q * q);
  const t = th / (r * 4), cor = Math.exp(-t * t * 3) * 0.6 + Math.exp(-t * 1.6) * 0.25;
  const W = U.u_s3SunW || null;   // (f-sky4: the white-hot core — u_s3SunW: x its share of white, y its radius over the disc's, w its fully white share)
  const core = W ? W[0] * (1 - ss(r * W[1] * W[3], r * W[1], th)) : 0;
  const lc = sc[0] * 0.3 + sc[1] * 0.59 + sc[2] * 0.11;
  return sc.map((v, i) => (v + (lc - v) * core) * (W ? 1 + W[2] * core : 1) * disc * limb * S[2] + v * [1.05, 0.82, 0.55][i] * S[3] * cor);
}
// the sky in dir with the sun's disc (the model's HDR, clear weather)
function skyWithSun(E, dir, U) { const c = skyHDR(E, dir, U), d = sunDisc(E, U, dir), k = 1 - (E.rain || 0); return c.map((v, i) => v + d[i] * k); }
// the sun's profile: the displayed colour at the angles (degrees) from the sun toward the zenith, at the picture's middle
function sunProfile(E, U, G, angles) {
  const s = E.sunDir, k = s[1], pe = norm([-s[0] * k, 1 - s[1] * k, -s[2] * k]);
  return angles.map(a => {
    const t = a * Math.PI / 180, dir = norm([s[0] * Math.cos(t) + pe[0] * Math.sin(t), s[1] * Math.cos(t) + pe[1] * Math.sin(t), s[2] * Math.cos(t) + pe[2] * Math.sin(t)]);
    const d = display(skyWithSun(E, dir, U), E, G, [0.5, 0.5], 16 / 9);
    return { a, rgb: d, luma: 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2] };
  });
}
// the composite (shaders.js COMPOSITE_FS) and t-light2's grade (light2.js l2Grade) for one HDR colour at the picture's
// place uv (0..1, y up); G: L2.grade(E) or null (the grade off: the old contrast and vignette)
function display(c, E, G, uv, aspect) {
  const x = c.map((v, i) => v * E.exposure * E.grade[i]);
  const f = x.map(aces), l = lum(x);
  let hh = x.map(v => v * (aces(l) / Math.max(l, 1e-5)));
  const m = Math.max(...hh);
  if (m > 1) { const k = clamp((m - 1) * 0.35, 0, 1); hh = hh.map(v => v / m + (1 - v / m) * k); }
  const vivid = E.vivid === undefined ? 0 : E.vivid;
  let o = f.map((v, i) => v + (clamp(hh[i], 0, 1) - v) * vivid);
  const l2 = lum(o); o = o.map(v => l2 + (v - l2) * E.saturation);
  o = o.map(v => clamp(v, 0, 1));
  const vc = [uv[0] - 0.5, uv[1] - 0.5];
  if (!G) { o = o.map(v => v + (v * v * (3 - 2 * v) - v) * (E.contrast || 0)); o = o.map(v => v * (1 - (vc[0] * vc[0] + vc[1] * vc[1]) * (E.vignette || 0))); }
  o = o.map(v => Math.pow(clamp(v, 0, 1), 1 / 2.2));
  if (G) {
    const g = Math.log(G.mid) / Math.log(0.5);
    o = o.map(v => { let y = Math.pow(clamp(v, 0, 1), g); y = y + (y * y * (3 - 2 * y) - y) * G.s; return G.toe + (G.sh - G.toe) * y; });
    const L = lum(o), wd = (1 - L) * (1 - L), wl = L * L;
    let s = o.map((v, i) => v + G.dark[i] * wd + G.light[i] * wl);
    const dl = lum(s) - L; s = s.map(v => v - dl);
    const mid = 1 - Math.abs(2 * L - 1), k = 1 + (G.sat - 1) * mid;
    s = s.map(v => L + (v - L) * k);
    const v2 = [vc[0] * aspect, vc[1]], d2 = (v2[0] * v2[0] + v2[1] * v2[1]) * 2.2;
    s = s.map(v => v * (1 - G.vig * ss(0.25, 0.95, d2)));
    o = s.map(v => clamp(v, 0, 1));
  }
  return o.map(v => v * 255);
}
// the camera of test/sky3.mjs: yaw 0 looks along −z; right, up, forward
function camAxes(yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return { right: [cy, 0, -sy], up: [sy * sp, cp, cy * sp], fwd: [-sy * cp, sp, -cy * cp] };
}
// the measure's mask of one direction (test/sky3.mjs measure): the sun's cone (30° by day, 14° otherwise) and the bodies
function masked(dir, E, kind, bodies) {
  const ang = (a, b) => Math.acos(clamp(dot(a, b), -1, 1));
  if (ang(dir, E.sunDir) < (kind === 'day' ? 30 : 14) * Math.PI / 180) return true;
  for (const [d, r] of bodies || []) if (ang(dir, d) < r) return true;
  return false;
}
// the 8 bands of one view: { yaw, pitch, H (the horizon line, rows of 360), kind ('day' | 'golden' | 'dusk') } → the
// trimmed band colours (sRGB 0–255, the trimmed mean of test/sky_ref.js bandOf) and their CIELAB
function bands(E, view, U, G, opt) {
  opt = opt || {};
  const W = 640, Hh = 360, t = Math.tan((view.fov || 75) / 2 * Math.PI / 180), asp = 16 / 9, ax = camAxes(view.yaw, view.pitch === undefined ? 12 * Math.PI / 180 : view.pitch);
  const stepX = opt.stepX || 8, stepY = opt.stepY || 2, out = [];
  for (let k = 0; k < SR.NB; k++) {
    const [ya, yb] = SR.bandRows(view.H, k), px = [];
    for (let y = ya; y < yb; y += stepY) for (let x = stepX >> 1; x < W; x += stepX) {
      const nx = ((x + 0.5) / W * 2 - 1) * t * asp, ny = (1 - (y + 0.5) / Hh * 2) * t;
      const dir = norm([ax.fwd[0] + ax.right[0] * nx + ax.up[0] * ny, ax.fwd[1] + ax.right[1] * nx + ax.up[1] * ny, ax.fwd[2] + ax.right[2] * nx + ax.up[2] * ny]);
      if (masked(dir, E, view.kind, view.bodies)) continue;
      px.push(display(skyHDR(E, dir, U), E, G, [(x + 0.5) / W, 1 - (y + 0.5) / Hh], asp));
    }
    if (px.length < 10) { out.push(null); continue; }
    px.sort((a, b) => lum(a) - lum(b));
    const lo = Math.floor(px.length * 0.1), hi = Math.ceil(px.length * 0.9), m = [0, 0, 0];
    for (let i = lo; i < hi; i++) { m[0] += px[i][0]; m[1] += px[i][1]; m[2] += px[i][2]; }
    const rgb = m.map(v => v / (hi - lo));
    out.push({ rgb, lab: SR.lab(rgb) });
  }
  return out;
}
module.exports = { skyHDR, s3Layers, cirrus, vnoise, display, bands, camAxes, masked, sunDisc, skyWithSun, sunProfile };

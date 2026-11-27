// ============================================================================
// R9-SI Lab · Horizont: welche Abschnitte der Welt hinter Hügeln liegen — ein Prototyp für das Spiel, mit Beweisprüfung.
// Horizon culling, prototyped on the generator's own chunks: from a camera, which 16³ sections are hidden behind
// ground-connected terrain (conservatively: never one with a clear line of sight). The owner's integrated GPU is bound
// by geometry (the opaque pass, the far land: /kosten), and the renderer draws every section the cave walk reaches in
// the frustum — over open hills that is all of them.
//   Occluders: 4 × 4-block cells whose blocks' top opaque runs are all at least RUN blocks thick; the cell is solid in
//     the band between the highest of their bottoms and the lowest of their tops (a sky isle is a band in the air).
//   Polar horizon: BINS azimuth bins round the camera; occluders (keyed by their farthest corner) and sections (keyed by
//     their nearest point) are visited by distance; a cell gives the bins it covers WHOLLY its band of blocked slopes
//     (the band of the occluder reaching highest, per bin); a section is hidden when, in every bin it touches, its whole
//     range of slopes (bottom to top) lies inside that band (+ a margin)
//   Proof: rays from the eye to the visible surface points of every hidden section (a voxel walk through the real
//     blocks) — one clear ray is a false cull.
//   horizon({ g, cam: [x, y, z], rd, bins }) → { sections: [{cx, sy, cz, faces, hidden}], stats }
// ============================================================================
'use strict';
const W = require('../lib/world.js');
const R = W.R, F = W.F;
const OCC = (s) => !!s && (R.T.flags[s] & F.OPAQUE) && (R.T.flags[s] & F.FULL);
const AIRY = (s) => !s || !(R.T.flags[s] & (F.SOLID | F.FLUID));   // (a face is shown toward air, plants or water's edge)
const SEA = W.VR.C.SEA, FLOOR = SEA - 8, TAU = Math.PI * 2;

// per chunk column (cached on the chunk object): the occluder cells (16 cells of 4 × 4: top or -1) and per section the
// content top (the highest non-air block + 1, or -1 when empty) and its exposed faces (the triangle count's stand-in)
function columnInfo(g, cx, cz, RUN) {
  const ch = W.chunk(g, cx, cz), key = '_hz' + RUN;
  if (ch[key]) return ch[key];
  const B = ch.blocks, H = (B.length / 256) | 0;
  const occTop = new Int16Array(16).fill(32767), occBot = new Int16Array(16).fill(-32768), secTop = new Int16Array(16).fill(-1), faces = new Int32Array(16);
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const col = (z << 4) | x, ci = (z >> 2) * 4 + (x >> 2);
    // the top opaque run: its top (y + 1 of the highest opaque block) and its bottom (the lowest opaque block of the run)
    let y = H - 1; while (y > 0 && !OCC(B[(y << 8) | col])) y--;
    let yy = y; while (yy > 0 && OCC(B[(yy << 8) | col])) yy--;
    const top = y + 1, bot = yy + 1, ok = OCC(B[(y << 8) | col]) && top - bot >= RUN;
    if (!ok || occTop[ci] === -1) { occTop[ci] = -1; }
    else { occTop[ci] = Math.min(occTop[ci], top); occBot[ci] = Math.max(occBot[ci], bot); }
    for (let y2 = 0; y2 < H; y2++) {
      const s = B[(y2 << 8) | col]; if (!s) continue;
      const sy = y2 >> 4; if (y2 + 1 > secTop[sy]) secTop[sy] = y2 + 1;
      let f = 0;
      if (y2 + 1 >= H || AIRY(B[((y2 + 1) << 8) | col])) f++;
      if (y2 > 0 && AIRY(B[((y2 - 1) << 8) | col])) f++;
      if (x < 15 && AIRY(B[(y2 << 8) | col + 1])) f++; if (x > 0 && AIRY(B[(y2 << 8) | col - 1])) f++;
      if (z < 15 && AIRY(B[(y2 << 8) | col + 16])) f++; if (z > 0 && AIRY(B[(y2 << 8) | col - 16])) f++;
      faces[sy] += f;
    }
  }
  for (let i = 0; i < 16; i++) { if (occTop[i] === 32767 || occTop[i] - occBot[i] < 1) occTop[i] = -1; }
  return (ch[key] = { occTop, occBot, secTop, faces, H });
}
const ang = (dx, dz) => { let a = Math.atan2(dz, dx); if (a < 0) a += TAU; return a; };
// the azimuth span of a box [x0,x1]×[z0,z1] seen from (px, pz): [a0, a1] with a1 possibly > TAU (wrapped), or null when
// the eye is inside it
function span(px, pz, x0, x1, z0, z1) {
  if (px >= x0 && px <= x1 && pz >= z0 && pz <= z1) return null;
  const cs = [ang(x0 - px, z0 - pz), ang(x1 - px, z0 - pz), ang(x0 - px, z1 - pz), ang(x1 - px, z1 - pz)];
  // the smallest arc holding the four corners (they lie within π of each other, the box being outside the eye)
  let best = null;
  for (const a of cs) { let lo = a, hi = a; for (const b of cs) { let d = b - a; if (d < 0) d += TAU; if (d > hi - a) hi = a + d; } if (!best || hi - lo < best[1] - best[0]) best = [lo, hi]; }
  return best;
}
const dist2 = (px, pz, x0, x1, z0, z1) => { const dx = Math.max(x0 - px, 0, px - x1), dz = Math.max(z0 - pz, 0, pz - z1); return Math.hypot(dx, dz); };
const distFar = (px, pz, x0, x1, z0, z1) => Math.hypot(Math.max(Math.abs(x0 - px), Math.abs(x1 - px)), Math.max(Math.abs(z0 - pz), Math.abs(z1 - pz)));

module.exports = function horizon(o) {
  const { g, cam } = o, rd = o.rd || 10, BINS = o.bins || 2048, bw = TAU / BINS, margin = o.margin === undefined ? 0.01 : o.margin, RUN = o.run || 6;
  const [px, py, pz] = cam, pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
  const hzTop = new Float32Array(BINS).fill(-Infinity), hzBot = new Float32Array(BINS).fill(Infinity);
  const events = [];
  const sections = [];
  for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
    if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5)) continue;
    const cx = pcx + dx, cz = pcz + dz, info = columnInfo(g, cx, cz, RUN), X0 = cx * 16, Z0 = cz * 16;
    for (let ci = 0; ci < 16; ci++) {
      const top = info.occTop[ci]; if (top < 0) continue;
      const bot = info.occBot[ci];
      const x0 = X0 + (ci & 3) * 4, z0 = Z0 + (ci >> 2) * 4, x1 = x0 + 4, z1 = z0 + 4;
      const sp = span(px, pz, x0, x1, z0, z1); if (!sp) continue;
      const dn = Math.max(0.5, dist2(px, pz, x0, x1, z0, z1)), df = distFar(px, pz, x0, x1, z0, z1);
      // the band of slopes every ray over the cell is blocked in: (bot, top) at every distance of the cell
      const sTop = (top - py) / (top >= py ? df : dn), sBot = (bot - py) / (bot >= py ? dn : df);
      if (sTop > sBot) events.push([df, 0, sp[0], sp[1], sTop, sBot]);
    }
    for (let sy = 0; sy < 16; sy++) {
      const top = info.secTop[sy]; if (top < 0) continue;
      const sec = { cx, sy, cz, faces: info.faces[sy], hidden: false, top };
      sections.push(sec);
      const sp = span(px, pz, X0, X0 + 16, Z0, Z0 + 16); if (!sp) continue;
      const dn = Math.max(0.5, dist2(px, pz, X0, X0 + 16, Z0, Z0 + 16)), df = distFar(px, pz, X0, X0 + 16, Z0, Z0 + 16);
      const ht = top + 0.5, hb = sy * 16;
      const sHi = (ht - py) / (ht >= py ? dn : df), sLo = (hb - py) / (hb >= py ? df : dn);
      events.push([dn, 1, sp[0], sp[1], sHi, sLo, sec]);
    }
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const e of events) {
    const a0 = e[2], a1 = e[3];
    if (e[1] === 0) {
      // the bins wholly inside the cell's span take its band when it reaches higher (the band of ONE occluder per bin)
      const b0 = Math.ceil(a0 / bw), b1 = Math.floor(a1 / bw) - 1;
      for (let b = b0; b <= b1; b++) { const i = ((b % BINS) + BINS) % BINS; if (e[4] > hzTop[i]) { hzTop[i] = e[4]; hzBot[i] = e[5]; } }
    } else {
      const b0 = Math.floor(a0 / bw), b1 = Math.floor(a1 / bw);
      let hidden = true;
      for (let b = b0; b <= b1 && hidden; b++) { const i = ((b % BINS) + BINS) % BINS; if (!(hzTop[i] > e[4] + margin && hzBot[i] < e[5] - margin)) hidden = false; }
      e[6].hidden = hidden;
    }
  }
  const n = sections.length, h = sections.filter((s) => s.hidden), fAll = sections.reduce((a, s) => a + s.faces, 0), fHid = h.reduce((a, s) => a + s.faces, 0);
  return { sections, stats: { sections: n, hidden: h.length, faces: fAll, facesHidden: fHid, share: n ? h.length / n : 0, faceShare: fAll ? fHid / fAll : 0 } };
};

// ---- the proof: does any visible surface point of a hidden section have a clear ray from the eye?
// (a voxel walk, Amanatides–Woo; a ray is blocked by an opaque full block other than the target's own)
module.exports.prove = function (g, cam, sections, perSection) {
  const k = perSection || 24, bad = [];
  let rays = 0;
  for (const s of sections) {
    if (!s.hidden) continue;
    // the section's exposed blocks' top-face centres (and side faces toward the camera): a sample of up to k
    const pts = [], X0 = s.cx * 16, Y0 = s.sy * 16, Z0 = s.cz * 16;
    for (let i = 0; i < 400 && pts.length < k; i++) {
      const x = X0 + ((i * 7) % 16), z = Z0 + ((i * 13 + (i >> 4)) % 16);
      for (let y = Math.min(Y0 + 15, s.top); y >= Y0; y--) { const b = W.block(g, x, y, z); if (b && AIRY(W.block(g, x, y + 1, z))) { pts.push([x + 0.5, y + 1.001, z + 0.5]); break; } }
    }
    for (const p of pts) { rays++; if (clear(g, cam, p)) { bad.push({ cx: s.cx, sy: s.sy, cz: s.cz, p }); break; } }
  }
  return { rays, bad };
};
function clear(g, a, b) {
  let x = Math.floor(a[0]), y = Math.floor(a[1]), z = Math.floor(a[2]);
  const tx = Math.floor(b[0]), ty = Math.floor(b[1] - 0.002), tz = Math.floor(b[2]);
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = Math.abs(1 / (dx || 1e-9)), tdy = Math.abs(1 / (dy || 1e-9)), tdz = Math.abs(1 / (dz || 1e-9));
  let mx = sx > 0 ? (x + 1 - a[0]) * tdx : (a[0] - x) * tdx, my = sy > 0 ? (y + 1 - a[1]) * tdy : (a[1] - y) * tdy, mz = sz > 0 ? (z + 1 - a[2]) * tdz : (a[2] - z) * tdz;
  for (let i = 0; i < 2000; i++) {
    if (x === tx && y === ty && z === tz) return true;
    if (mx < my && mx < mz) { x += sx; mx += tdx; } else if (my < mz) { y += sy; my += tdy; } else { z += sz; mz += tdz; }
    if (Math.min(mx, my, mz) > 1.0001) return true;   // (past the target point)
    if (x === tx && y === ty && z === tz) return true;
    if (OCC(W.block(g, x, y, z))) return false;
  }
  return true;
}

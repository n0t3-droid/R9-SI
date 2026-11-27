// ============================================================================
// Horizontschatten im Spiel (VR.HzGame): die Abschnitte hinter Hügeln werden nicht gezeichnet. Der Kern ist
// src/shared/hzcull.js (mit Beweistest), hier ist nur die Anbindung an Welt und Renderer.
// Horizon culling in the game: the frame's live sections (renderer: `near`) lose the ones hidden behind solid ground
// before the opaque, cutout, mini-voxel and depth passes draw them. The picture stays the same pixel for pixel; the
// shadows, the mirror, the far cache, the mini-voxel residency and the far land's masks keep the whole list.
//   Occluders come only from what is drawn as it is in the data: a column and its 8 neighbours shown (no fade, no grow),
//     every section of the band meshed from its current blocks (a section still waiting for its new mesh, or fading in,
//     occludes nothing) and either live in this frame's list or not reached by the cave walk at all (the first face a ray
//     meets is visible from the eye, so the walk reached its section; one the far cache draws instead is not counted)
//   The eye's slack δ follows the speed (standing: 0.05, a walk: about half a block, flying fast: off); the cull is
//     recomputed when the eye has moved more than δ, when anything it leaned on changed (a column's meshes, a section
//     gone from the live list: HG.holds), and twice a second (columns that finished fading in, new sections)
//   Off when the eye is within 0.35 of an opaque block (the near plane could cut into it), when flying fast (nothing to
//     gain, every frame would recompute) and high over the ground
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F;
  const HG = VR.HzGame = {
    on: true,
    stats: { hidden: 0, of: 0, ms: 0, delta: 0, off: '', runs: 0, occ: 0 },
    tok: 0, hidTok: 0, runsN: 0, last: null, out: [], prev: null,
  };
  let OCCT = null;   // per state: opaque and a full cube (the census in the lab: every such state draws as a whole cube)
  const occT = () => {
    if (OCCT && OCCT.length === R.stateCount + 1) return OCCT;
    OCCT = new Uint8Array(R.stateCount + 1);
    for (let s = 1; s <= R.stateCount; s++) { const f = R.T.flags[s]; OCCT[s] = f & F.OPAQUE && f & F.FULL ? 1 : 0; }
    return OCCT;
  };
  const OCC = (s) => OCCT[s] === 1;
  const RECT = new Int8Array(63); for (let k = 0; k < 21; k++) { const q = k < 16 ? [(k & 3) * 4, (k >> 2) * 4, 4] : k < 20 ? [((k - 16) & 1) * 8, ((k - 16) >> 1) * 8, 8] : [0, 0, 16]; RECT[k * 3] = q[0]; RECT[k * 3 + 1] = q[1]; RECT[k * 3 + 2] = q[2]; }   // (HzCull.cellRect as a table)

  // the eye's distance to the nearest opaque block of its 3 × 3 × 3 cells
  function clearance(world, eye) {
    const T = occT(), bx = Math.floor(eye[0]), by = Math.floor(eye[1]), bz = Math.floor(eye[2]);
    let best = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = bx + dx, y = by + dy, z = bz + dz;
      if (!T[world.getBlock(x, y, z)]) continue;
      const ex = Math.max(x - eye[0], 0, eye[0] - (x + 1)), ey = Math.max(y - eye[1], 0, eye[1] - (y + 1)), ez = Math.max(z - eye[2], 0, eye[2] - (z + 1));
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez); if (d < best) best = d;
    }
    return best;
  }
  // a section drawn exactly as its data says (or empty)
  const settled = (s) => s.count === 0 || (s.meshVer === s.ver && (s.fade === undefined || s.fade >= 1) && (s.grow === undefined || s.grow >= 1));

  HG.frame = function (r, world, cam, near, vis) {
    const st = HG.stats;
    if (!HG.on || !VR.HzCull || !world || !near || !near.length) { st.hidden = 0; st.of = near ? near.length : 0; st.off = 'aus'; return near; }
    occT();
    const now = performance.now(), eye = [cam.x, cam.y, cam.z];
    // the eye's speed (blocks a second), smoothed
    const P = HG.prev;
    if (P) { const dt = Math.max(1e-3, (now - P.t) / 1000), v = Math.hypot(eye[0] - P.e[0], eye[1] - P.e[1], eye[2] - P.e[2]) / dt; HG.speed = HG.speed === undefined ? v : (v > HG.speed ? v : HG.speed * 0.8 + v * 0.2); }
    HG.prev = { t: now, e: eye };
    const speed = HG.speed || 0;
    st.of = near.length;
    if (speed > 16) { st.hidden = 0; st.off = 'schnell'; HG.last = null; return near; }
    if (clearance(world, eye) < 0.35) { st.hidden = 0; st.off = 'nah'; HG.last = null; return near; }
    const ground = world.col(Math.floor(eye[0]) >> 4, Math.floor(eye[2]) >> 4);
    if (ground && ground.height && eye[1] - ground.height[((Math.floor(eye[2]) & 15) << 4) | (Math.floor(eye[0]) & 15)] > 48) { st.hidden = 0; st.off = 'hoch'; HG.last = null; return near; }
    st.off = '';
    // the live list and the cave walk's list: a token on each of their sections (a section the walk did not reach is not
    // visible from here — its faces can never be the first a ray meets, so it may stay undrawn; one the walk reached but
    // the far cache draws is not live: it must not occlude)
    const tok = ++HG.tok;
    if (vis && vis !== near) for (let i = 0; i < vis.length; i++) vis[i].hzV = tok;
    for (let i = 0; i < near.length; i++) { near[i].hzN = tok; near[i].hzV = tok; }
    const L = HG.last;
    const moved = L ? Math.hypot(eye[0] - L.eye[0], eye[1] - L.eye[1], eye[2] - L.eye[2]) : Infinity;
    // the last verdict holds while the eye stays within its δ and everything it leaned on is still drawn as it was
    // (a section a new mesh replaced, or one gone from the live list, or a column fading: computed again); new sections
    // in the list are drawn until the next count (twice a second)
    if (!L || moved > L.delta || L.world !== world || now - L.t > 500 || !HG.holds(tok)) HG.compute(r, world, eye, near, speed, tok, now);
    const out = HG.out; out.length = 0;
    const H = HG.hidTok;
    for (let i = 0; i < near.length; i++) { const s = near[i]; if (s.hzH !== H) out.push(s); }
    st.hidden = near.length - out.length;
    return out;
  };

  // the columns the verdict leaned on: still the same objects, the same meshes, every leaned-on section still live
  const stampOf = (c, mask) => { let h = c.fade >= 1 ? 1 : 2; for (let k = 0; k < c.sec.length && k < 32; k++) if (mask & (1 << k)) { const s = c.sec[k]; h = (Math.imul(h, 31) + (s.meshVer | 0) * 3 + (s.hasMesh ? 1 : 0)) | 0; } return h; };
  HG.holds = function (tok) {
    const D = HG.dep, n = HG.depN | 0;
    for (let i = 0; i < n; i++) {
      const c = D[i * 3], mask = D[i * 3 + 1];
      for (let k = 0; k < c.sec.length && k < 32; k++) if (mask & (1 << k)) { const s = c.sec[k]; if (s.hasMesh && s.hzV === tok && s.hzN !== tok) return false; }
      if (stampOf(c, mask) !== D[i * 3 + 2]) return false;
    }
    return true;
  };
  HG.compute = function (r, world, eye, near, speed, tok, now) {
    const t0 = performance.now(), HC = VR.HzCull, st = HG.stats;
    const delta = Math.min(1.5, Math.max(0.05, speed * 0.12));
    const lm = typeof world.fancyLeaves === 'number' ? world.fancyLeaves : 0;
    const blob = (lm & (4 | 16 | 64)) !== 0, slopes = world.smooth !== false;
    const E0 = blob ? [1, 1, 1] : slopes ? [0, 1, 0] : 0, Ecode = blob ? 2 : slopes ? 1 : 0;
    const rd = world.renderDist, pcx = Math.floor(eye[0]) >> 4, pcz = Math.floor(eye[2]) >> 4, W = 2 * rd + 3;
    // the columns round the eye: runs (cached by their sections' versions) and the mask of sections that may occlude
    const cols = HG.cols && HG.cols.length >= W * W ? HG.cols : (HG.cols = new Array(W * W));
    const good = HG.good && HG.good.length >= W * W ? HG.good : (HG.good = new Uint32Array(W * W));
    const at = (dx, dz) => (dz + rd + 1) * W + dx + rd + 1;
    for (let dz = -rd - 1; dz <= rd + 1; dz++) for (let dx = -rd - 1; dx <= rd + 1; dx++) {
      const i = at(dx, dz), c = world.col(pcx + dx, pcz + dz);
      cols[i] = null; good[i] = 0;
      if (!c || !c.ready || !c.blocks) continue;
      // (the runs follow the blocks alone: the array itself — a load or a taller column brings a new one — and its
      // version c.bv, which every block write moves (world.js setBlock and the bulk edits, zeitraffer.js); light leaves it)
      const R0 = c.hzR;
      if (!R0 || R0.blocks !== c.blocks || R0.bv !== (c.bv | 0) || R0.H !== c.H) { const rr = HC.runs(c.blocks, c.H, OCC, R0); c.hzR = { blocks: c.blocks, bv: c.bv | 0, H: c.H, stamp: ++HG.runsN, run: rr.run, top: rr.top }; }   // (stamps unique across columns: a neighbour reloaded never matches an old key)
      cols[i] = c;
      if (!(c.shownAt >= 0) || c.fade < 1 || (c.grow !== undefined && c.grow < 1)) continue;
      let m = 0;
      for (let k = 0; k < c.sec.length && k < 32; k++) { const s = c.sec[k]; if (settled(s) && (!s.hasMesh || s.hzN === tok || s.hzV !== tok)) m |= 1 << k; }
      good[i] = m;
    }
    // the good sections of a column AND its 8 neighbours' (a cell needs its band drawn as it is in all nine)
    const goodN = HG.goodN && HG.goodN.length >= W * W ? HG.goodN : (HG.goodN = new Uint32Array(W * W));
    const used = HG.used && HG.used.length >= W * W ? HG.used : (HG.used = new Uint8Array(W * W));
    used.fill(0, 0, W * W);
    const rd2 = (rd + 0.5) * (rd + 0.5);
    for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
      const i = at(dx, dz); let m = good[i];
      if (m) for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) m &= good[at(dx + ox, dz + oz)];
      goodN[i] = m;
    }
    // the occluders: the cells of the columns within reach whose band (and a block round it) is drawn as it is, in the
    // column and its neighbours
    const occ = HG.occ && HG.occ.length >= (2 * rd + 1) * (2 * rd + 1) * 21 * 6 ? HG.occ : (HG.occ = new Float64Array((2 * rd + 1) * (2 * rd + 1) * 21 * 6));
    let no = 0;
    for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
      if (dx * dx + dz * dz > rd2) continue;
      const i = at(dx, dz), c = cols[i], gn = goodN[i];
      if (!c || !gn) continue;
      const E = c.lod === 1 ? 0 : E0, ec = c.lod === 1 ? 0 : Ecode;
      // the cells, cached by the column's and its neighbours' stamps and the erosion
      let key = ec; for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) { const n = cols[at(dx + ox, dz + oz)]; key = (Math.imul(key, 31) + (n ? n.hzR.stamp : 7)) | 0; }
      if (!c.hzC || c.hzC.key !== key) c.hzC = { key, cells: HC.cells(c.hzR.run, (ox, oz) => { const n = cols[at(dx + ox, dz + oz)]; return n ? n.hzR.run : null; }, E, c.hzC ? c.hzC.cells : null) };
      const cells = c.hzC.cells, X0 = c.cx * 16, Z0 = c.cz * 16;
      let any = false;
      for (let k = 0; k < 21; k++) {
        const b = cells[k * 2], t = cells[k * 2 + 1]; if (t <= b) continue;
        // the sections of the band and a block round it, drawn as they are in the column and its 8 neighbours
        const s0 = Math.max(0, (b - 1) >> 4), s1 = Math.min(31, t >> 4);
        const need = (s1 >= 31 ? -1 : ((1 << (s1 + 1)) - 1)) & ~((1 << s0) - 1);
        if ((gn & need) !== need) continue;
        const x0 = RECT[k * 3], z0 = RECT[k * 3 + 1], sz = RECT[k * 3 + 2];
        occ[no++] = X0 + x0; occ[no++] = X0 + x0 + sz; occ[no++] = Z0 + z0; occ[no++] = Z0 + z0 + sz; occ[no++] = b; occ[no++] = t;
        any = true;
      }
      if (any) for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) used[at(dx + ox, dz + oz)] = 1;
    }
    // (the verdict leans on the columns that gave occluders and their neighbours: kept with their meshes' stamp — HG.holds)
    const D = HG.dep && HG.dep.length >= W * W * 3 ? HG.dep : (HG.dep = new Array(W * W * 3));
    let nd = 0;
    for (let i = 0; i < W * W; i++) if (used[i] && cols[i]) { D[nd * 3] = cols[i]; D[nd * 3 + 1] = good[i]; D[nd * 3 + 2] = stampOf(cols[i], good[i]); nd++; }
    HG.depN = nd;
    // the targets: the live sections, their box up to their content's top
    const nT = near.length;
    const tg = HG.tg && HG.tg.length >= nT * 6 ? HG.tg : (HG.tg = new Float64Array(Math.max(nT, 256) * 6 * 2));
    const hid = HG.hid && HG.hid.length >= nT ? HG.hid : (HG.hid = new Uint8Array(Math.max(nT, 256) * 2));
    for (let j = 0; j < nT; j++) {
      const s = near[j], ex = (s.ox >> 4) - pcx, ez = (s.oz >> 4) - pcz, sy = s.oy >> 4;
      const c = ex >= -rd - 1 && ex <= rd + 1 && ez >= -rd - 1 && ez <= rd + 1 ? cols[at(ex, ez)] : world.col(s.ox >> 4, s.oz >> 4);
      const top = c && c.hzR && sy < c.hzR.top.length ? c.hzR.top[sy] : s.oy + 16;
      const o = j * 6; tg[o] = s.ox; tg[o + 1] = s.ox + 16; tg[o + 2] = s.oy; tg[o + 3] = top < 0 ? s.oy + 16 : Math.min(s.oy + 16, top); tg[o + 4] = s.oz; tg[o + 5] = s.oz + 16;
    }
    const nh = HC.cull(eye, delta, occ, no / 6, tg, nT, hid);
    const H = ++HG.hidTok;
    for (let j = 0; j < nT; j++) if (hid[j]) near[j].hzH = H;
    HG.last = { eye, delta, world, t: now };
    st.runs++; st.occ = no / 6; st.delta = delta; st.ms = st.ms ? st.ms * 0.8 + (performance.now() - t0) * 0.2 : performance.now() - t0;
    void nh;
  };
})(VR);

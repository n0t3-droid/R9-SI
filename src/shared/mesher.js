// ============================================================================
// Section mesher (worker). Input: 20^3 padded blocks+light (16 + 2 on every side), 20^2 tints.
// Output: 3 vertex streams (opaque, cutout, translucent) of 8 x u16 per vertex:
//  w0..2 pos (section-local, (p+4)*2048), w3 layer|rot<<12|randrot<<14|macro<<15,
//  w4 u|v<<8 (1/16 units), w5 face|ao<<3|sway<<5|leaf<<7|kind<<8|noshade<<11|emit<<12|uw<<13|ctm<<14|look<<15,
//  w6 light (sky<<12|r<<8|g<<4|b), w7 tint rgb565 (a recoloured face, w5 bit 15: the block's own colour, T.rc)
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, SH = VR.SHAPE, FF = VR.FFLAG, MD = VR.MODEL;
  // the section comes padded by PAD blocks on every side: light, AO and the smooth height field (whose pit/bump
  // rule looks two columns out) see the same neighbourhood from both sides of a section border
  const PAD = VR.MESH_PAD = 2, PS = VR.MESH_PS = 16 + PAD * 2, PSS = PS * PS;
  const P = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
  const DOFF = [1, -1, PSS, -PSS, PS, -PS];
  const FLUID_SIDES = [0, 1, 4, 5];   // the side faces of a fluid block (mesher order: +x, -x, +z, -z)
  const KIND = VR.VKIND = { NONE: 0, WATER: 1, LAVA: 2, PORTAL: 3, STARS: 4, ANIM: 5, WATERFLOW: 6, AETHER: 7 };
  const ENC = (p) => Math.round((p + 4) * 2048);

  // Precompute AO neighbor offsets for cube faces (vertex order TL,BL,BR,TR of facePos)
  const AOOFF = [];
  const AXOFF = [[1, -1], [PSS, -PSS], [PS, -PS]]; // x,y,z axis +/- offsets
  const DAXIS = [0, 0, 1, 1, 2, 2];
  for (let d = 0; d < 6; d++) {
    const pos = MD.facePos(d, [0, 0, 0, 16, 16, 16]);
    const arr = [];
    for (let k = 0; k < 4; k++) {
      const c = [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
      const offs = [];
      for (let a = 0; a < 3; a++) { if (a === DAXIS[d]) continue; offs.push(c[a] > 0 ? AXOFF[a][0] : AXOFF[a][1]); }
      arr.push(offs);
    }
    AOOFF.push(arr);
  }
  // connected textures: for each face, the neighbour directions across its texture's top, right, bottom and left edge
  const CTM_NB = [[2, 5, 3, 4], [2, 4, 3, 5], [5, 0, 4, 1], [4, 0, 5, 1], [2, 0, 3, 1], [2, 1, 3, 0]];
  const STEM_COLORS = [0x00ff00, 0x20f700, 0x40ef00, 0x60e700, 0x80df00, 0xa0d700, 0xc0cf00, 0xe0c700];
  const TINT_FIXED = { 4: 0x80A755, 5: 0x619961, 6: 0xB38A55 };
  const hex565 = (h) => VR.rgb565((h >> 16) & 255, (h >> 8) & 255, h & 255);
  const AETHER_TINT = VR.rgb565(90, 240, 255);

  class Buf {
    constructor(n) { this.a = new Uint16Array(n * 8); this.n = 0; }
    ensure(k) { if ((this.n + k) * 8 > this.a.length) { const b = new Uint16Array(Math.max(this.a.length * 2, (this.n + k) * 8 + 4096)); b.set(this.a); this.a = b; } }
    v(x, y, z, w3, u, v, w5, light, tint) {
      const a = this.a, o = this.n * 8;
      a[o] = ENC(x); a[o + 1] = ENC(y); a[o + 2] = ENC(z); a[o + 3] = w3;
      a[o + 4] = (u & 255) | ((v & 255) << 8); a[o + 5] = w5; a[o + 6] = light; a[o + 7] = tint;
      this.n++;
    }
    out() { return this.a.slice(0, this.n * 8); }
  }

  // Panorama glass (the only glass whose frames join, v0.31): per block type its frame family (0 = none) — the frame
  // variants sit in 16 texture layers from o.ctm. Every other glass keeps its own frame per block (v0.33.2: the
  // joined-up window glass, plain / stained glass and panes of v0.33 are single blocks again). Built on first use.
  let CTMK = null, CTML = null;
  function ctmTables() {
    const n = R.types.length; CTMK = new Int32Array(n); CTML = new Uint8Array(n);
    for (const t of R.types) if (t.o.ctm) { CTMK[t.id] = 0x10000 | t.o.ctm; CTML[t.id] = 1; }
  }
  // a look or a variant changed the tables (looks.js): the parts built from them are made again
  VR.meshCacheClear = function () { partCache.clear(); CTMK = null; CTML = null; };

  // Stairs/fence/wall/pane part caches per type
  const partCache = new Map();
  function stairsModels(t, state) {
    let e = partCache.get('s' + t.id + ':' + state);
    if (e) return e;
    // use the face textures from the state (tex table)
    const T = R.T, tex6 = {};
    for (let f = 0; f < 6; f++) tex6[f] = T.tex[state * 6 + f] & 0xfff;
    e = VR.stairsFaces(tex6);
    partCache.set('s' + t.id + ':' + state, e);
    return e;
  }
  function connParts(kind, state) {
    const key = kind + state;
    let e = partCache.get(key);
    if (e) return e;
    const T = R.T; const tx = T.tex[state * 6] & 0xfff;
    const t = R.types[T.type[state]];
    if (kind === 'f') e = VR.fenceParts(tx);
    else if (kind === 'w') e = VR.wallParts(tx);
    else e = VR.paneParts(tx, t.o.paneEdge !== undefined ? t.o.paneEdge : tx);
    partCache.set(key, e);
    return e;
  }

  VR.meshSection = function (job) {
    const T = R.T, TF = T.flags, TSH = T.shape, TL = T.layer, TTEX = T.tex, TTINT = T.tint, TTYPE = T.type, TRC = T.rc;
    if (!CTMK) ctmTables();
    const B = job.blocks, L = job.light, GR = job.grass, FO = job.foliage, WA = job.water;
    const fancy = job.fancyLeaves !== false, smooth = job.smooth !== false;
    // the block look (registry.js): Klassisch draws every panorama glass block with its full frame and no world-space
    // mottling; smooth ground follows the F.SMOOTH flags VR.setLook sets. w3 bit 15 is the macro mottling in Nahtlos —
    // in Klassisch (which never mottles) it marks the faces of natural blocks (random rotation, mottled rock, the
    // nature tab's cubes: R.natural) and leaves for the shader's per-block shade, so neighbouring blocks of one
    // material never read as one surface (Klassisch v2)
    const LK = VR.LOOK, ctmJoin = !LK || LK.ctm, macroOn = !LK || LK.macro, varyOn = !!(LK && LK.vary && !macroOn);
    const NAT = R.natural;
    const bufs = [new Buf(4096), new Buf(1024), new Buf(1024)];
    // world sections keep their mini-voxel pieces apart from the plain terrain: a detailed buffer drawn up close
    // and a far buffer of averaged boxes (ships and previews merge everything into the opaque stream as before)
    const vxSplit = !!job.vxLod;
    if (vxSplit) { bufs.push(new Buf(2048), new Buf(512)); }
    const sy = job.sy;
    const occl = (i) => (TF[B[i]] & (F.OPAQUE | F.LEAVES)) !== 0 && !((TF[B[i]] & F.LEAVES) && !fancy && false);
    const opaqueAt = (i) => (TF[B[i]] & F.OPAQUE) !== 0;
    const tintAt = (code, x, z, state) => {
      if (!code) return 0xffff;
      const ti = (z + PAD) * PS + (x + PAD);
      if (code === 1) return GR[ti]; if (code === 2) return FO[ti]; if (code === 3) return WA[ti];
      if (code === 7) { const t = R.types[TTYPE[state]]; const age = t.has('age') ? t.get(state, 'age') : 7; return hex565(STEM_COLORS[Math.min(7, age)]); }
      if (code < 8) return hex565(TINT_FIXED[code]);
      return hex565(R.tintColors[code - 8]);
    };
    // per-vertex smooth light & ao for cube face d at pad index bi
    const cornerLight = new Uint16Array(4), cornerAO = new Uint8Array(4);
    function faceCorners(bi, d) {
      const qi = bi + DOFF[d];
      const base = L[qi];
      if (!smooth) { for (let k = 0; k < 4; k++) { cornerLight[k] = base; cornerAO[k] = 0; } return; }
      const offs = AOOFF[d];
      for (let k = 0; k < 4; k++) {
        const s1 = qi + offs[k][0], s2 = qi + offs[k][1], c = s1 + offs[k][1];
        const o1 = occl(s1), o2 = occl(s2), oc = occl(c);
        cornerAO[k] = (o1 && o2) ? 3 : ((o1 ? 1 : 0) + (o2 ? 1 : 0) + (oc ? 1 : 0));
        let ss = base >>> 12, rr = (base >> 8) & 15, gg = (base >> 4) & 15, bb = base & 15, n = 1;
        if (!o1) { const l = L[s1]; ss += l >>> 12; rr += (l >> 8) & 15; gg += (l >> 4) & 15; bb += l & 15; n++; }
        if (!o2) { const l = L[s2]; ss += l >>> 12; rr += (l >> 8) & 15; gg += (l >> 4) & 15; bb += l & 15; n++; }
        if (!oc && !(o1 && o2)) { const l = L[c]; ss += l >>> 12; rr += (l >> 8) & 15; gg += (l >> 4) & 15; bb += l & 15; n++; }
        const inv = 1 / n;
        cornerLight[k] = (Math.round(ss * inv) << 12) | (Math.round(rr * inv) << 8) | (Math.round(gg * inv) << 4) | Math.round(bb * inv);
      }
    }
    const bright = (k) => { const l = cornerLight[k]; return Math.max(l >>> 12, (l >> 8) & 15, (l >> 4) & 15, l & 15) * 4 - cornerAO[k] * 3; };
    // the four corners of face d of the box (x0,y0,z0)-(x1,y1,z1) in block units, order TL, BL, BR, TR (the same
    // corners MD.facePos gives for the box in 1/16 units) — written into one scratch array: the emit helpers below run
    // for every face of a section and never allocate (cutting the garbage of a mesh job by half)
    const FP = new Float64Array(12);
    function facePosInto(d, x0, y0, z0, x1, y1, z1) {
      switch (d) {
        case 2: FP[0] = x0; FP[1] = y1; FP[2] = z0; FP[3] = x0; FP[4] = y1; FP[5] = z1; FP[6] = x1; FP[7] = y1; FP[8] = z1; FP[9] = x1; FP[10] = y1; FP[11] = z0; break;
        case 3: FP[0] = x0; FP[1] = y0; FP[2] = z1; FP[3] = x0; FP[4] = y0; FP[5] = z0; FP[6] = x1; FP[7] = y0; FP[8] = z0; FP[9] = x1; FP[10] = y0; FP[11] = z1; break;
        case 4: FP[0] = x0; FP[1] = y1; FP[2] = z1; FP[3] = x0; FP[4] = y0; FP[5] = z1; FP[6] = x1; FP[7] = y0; FP[8] = z1; FP[9] = x1; FP[10] = y1; FP[11] = z1; break;
        case 5: FP[0] = x1; FP[1] = y1; FP[2] = z0; FP[3] = x1; FP[4] = y0; FP[5] = z0; FP[6] = x0; FP[7] = y0; FP[8] = z0; FP[9] = x0; FP[10] = y1; FP[11] = z0; break;
        case 0: FP[0] = x1; FP[1] = y1; FP[2] = z1; FP[3] = x1; FP[4] = y0; FP[5] = z1; FP[6] = x1; FP[7] = y0; FP[8] = z0; FP[9] = x1; FP[10] = y1; FP[11] = z0; break;
        default: FP[0] = x0; FP[1] = y1; FP[2] = z0; FP[3] = x0; FP[4] = y0; FP[5] = z0; FP[6] = x0; FP[7] = y0; FP[8] = z1; FP[9] = x0; FP[10] = y1; FP[11] = z1; break;
      }
    }
    // emit a cube face (single block or merged box, corners in block units) --------------------------------
    // lights / aos: four values per corner (the faceCorners scratch arrays, read before the next face), or null
    function emitCubeQuad(buf, d, x0, y0, z0, x1, y1, z1, w, h, w3, w5base, lights, aos, tint) {
      facePosInto(d, x0, y0, z0, x1, y1, z1);
      const uw = w * 16, vh = h * 16;
      let start = 0;
      if (aos && (bright(0) + bright(2) < bright(1) + bright(3))) start = 1;
      buf.ensure(4);
      for (let kk = 0; kk < 4; kk++) {
        const k = (kk + start) & 3;
        buf.v(FP[k * 3], FP[k * 3 + 1], FP[k * 3 + 2], w3, k >= 2 ? uw : 0, (k === 1 || k === 2) ? vh : 0, w5base | ((aos ? aos[k] : 0) << 3), lights ? lights[k] : 0, tint);
      }
    }
    // ---- R9 Smooth Ground: the natural surface as a height field (see physics.js P.smoothCorners) ----
    const PH = VR.PHYS;
    const blockAt = (x, y, z) => (x < -PAD || x > 15 + PAD || y < -PAD || y > 15 + PAD || z < -PAD || z > 15 + PAD) ? -1 : B[P(x, y, z)];
    const smC = [0, 0, 0, 0], shapeOf = (b) => TSH[b];
    let smKey = -1, smSloped = false;
    // corner heights of the smooth block at (x, y, z) (cached for the block being meshed); false when its top is flat
    const smoothAt = (x, y, z) => {
      const key = P(x, y, z);
      if (key === smKey) return smSloped;
      smKey = key; smSloped = PH ? PH.smoothCorners(blockAt, x, y, z, smC) : false;
      return smSloped;
    };
    // a cube face whose top vertices follow the corner heights (the sloped top itself, or a side under a sloped top)
    function emitSlopeQuad(buf, d, x, y, z, w3, w5base, lights, aos, tint) {
      const x1 = x + 1, y1 = y + 1, z1 = z + 1;
      facePosInto(d, x, y, z, x1, y1, z1);
      let start = 0;
      // the top splits along the diagonal whose ends are closer in height (the crease follows the terrain)
      if (d === 2) start = Math.abs(smC[0] - smC[2]) <= Math.abs(smC[1] - smC[3]) ? 0 : 1;
      else if (aos && (bright(0) + bright(2) < bright(1) + bright(3))) start = 1;
      buf.ensure(4);
      for (let kk = 0; kk < 4; kk++) {
        const k = (kk + start) & 3;
        let py = FP[k * 3 + 1];
        if (py === y1) py = smC[(FP[k * 3] === x1 ? (FP[k * 3 + 2] === z1 ? 2 : 3) : (FP[k * 3 + 2] === z1 ? 1 : 0))];
        buf.v(FP[k * 3], py, FP[k * 3 + 2], w3, k >= 2 ? 16 : 0, (k === 1 || k === 2) ? 16 : 0, w5base | ((aos ? aos[k] : 0) << 3), lights ? lights[k] : 0, tint);
      }
    }
    const texW3 = (texv, flags, d, state) => {
      const layer = texv & 0xfff, rot = (texv >> 12) & 3;
      let w3 = layer | (rot << 12);
      if (flags & F.RANDROT) { const top = TTEX[state * 6 + 2] & 0xfff; if (d >= 2 && d <= 3 || layer === top) w3 |= 1 << 14; }
      if ((flags & F.MACRO) && macroOn) w3 |= 1 << 15;
      else if (varyOn && ((flags & (F.RANDROT | F.MACRO | F.LEAVES)) || (NAT && NAT[state]))) w3 |= 1 << 15;
      return w3;
    };

    // ---- visibility graph flood fill ----
    let visMask = 0;
    {
      const seen = new Uint8Array(4096);
      const stack = new Int32Array(4096);
      let anyOpaque = false;
      for (let i = 0; i < 4096; i++) { const x = i & 15, z = (i >> 4) & 15, y = i >> 8; if (opaqueAt(P(x, y, z))) { seen[i] = 1; anyOpaque = true; } }
      if (!anyOpaque) visMask = 0x7fff;
      else for (let s = 0; s < 4096; s++) {
        if (seen[s]) continue;
        let sp = 0; stack[sp++] = s; seen[s] = 1; let faces = 0;
        while (sp) {
          const i = stack[--sp]; const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
          if (x === 15) faces |= 1; if (x === 0) faces |= 2; if (y === 15) faces |= 4; if (y === 0) faces |= 8; if (z === 15) faces |= 16; if (z === 0) faces |= 32;
          if (x < 15 && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; }
          if (x > 0 && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; }
          if (z < 15 && !seen[i + 16]) { seen[i + 16] = 1; stack[sp++] = i + 16; }
          if (z > 0 && !seen[i - 16]) { seen[i - 16] = 1; stack[sp++] = i - 16; }
          if (y < 15 && !seen[i + 256]) { seen[i + 256] = 1; stack[sp++] = i + 256; }
          if (y > 0 && !seen[i - 256]) { seen[i - 256] = 1; stack[sp++] = i - 256; }
        }
        for (let a = 0; a < 6; a++) if (faces & (1 << a)) for (let b = a + 1; b < 6; b++) if (faces & (1 << b)) visMask |= 1 << VR.visPair(a, b);
      }
    }

    // ---- greedy opaque cubes ----
    const mstate = new Uint16Array(256), mlight = new Uint16Array(256), mtint = new Uint16Array(256), mflag = new Uint8Array(256), mergedLight = new Uint16Array(4);
    for (let d = 0; d < 6; d++) {
      const ax = DAXIS[d]; // slice axis
      for (let s = 0; s < 16; s++) {
        mflag.fill(0);
        for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
          let x, y, z;
          if (ax === 0) { x = s; z = u; y = v; } else if (ax === 1) { y = s; x = u; z = v; } else { z = s; x = u; y = v; }
          const bi = P(x, y, z), b = B[bi];
          if (!b) continue;
          const fl = TF[b];
          if (TSH[b] !== SH.CUBE || TL[b] !== 0 || !(fl & F.OPAQUE)) continue;
          const ni = bi + DOFF[d], nb = B[ni];
          if (TF[nb] & F.OPAQUE) continue;
          const mi = v * 16 + u;
          // smooth ground: a sloped top is its own quad, sides under it follow its corners, sides toward a smooth
          // column one step lower vanish under the joined surface
          if ((fl & F.SMOOTH) && d !== 3 && !(TF[B[bi + PSS]] & F.OPAQUE) && smoothAt(x, y, z)) {
            if (d !== 2) {
              // the side toward a smooth column one step lower vanishes only where both corners of that edge really
              // came down to meet it (a corner held up by a hard column next to it still needs the face below)
              const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), nz = z + (d === 4 ? 1 : d === 5 ? -1 : 0);
              const ca = smC[d === 0 ? 2 : d === 1 ? 0 : d === 4 ? 1 : 0], cb = smC[d === 0 ? 3 : d === 1 ? 1 : d === 4 ? 2 : 3];
              if (ca < y + 1 - 1e-6 && cb < y + 1 - 1e-6 && PH.surfaceTop(blockAt, nx, y, nz) === y) continue;
            }
            faceCorners(bi, d);
            emitSlopeQuad(bufs[0], d, x, y, z, texW3(TTEX[b * 6 + d], fl, d, b), d | ((fl & F.EMISSIVE) ? 1 << 12 : 0) | (d === 2 ? 1 << 13 : 0) | (TRC[b] ? 32768 : 0), cornerLight, cornerAO, TRC[b] || tintAt(TTINT[b], x, z, b));
            continue;
          }
          faceCorners(bi, d);
          let texv = TTEX[b * 6 + d];
          const t = R.types[TTYPE[b]];
          // special cases
          if (d !== 2 && d !== 3 && t.o.soil && (t.name === 'grass_block' || t.name === 'mycelium' || t.name === 'podzol')) {
            const ab = B[bi + PSS]; const at = R.types[TTYPE[ab]];
            if (ab && at && (at.name === 'snow' || at.name === 'snow_block' || at.name === 'powder_snow')) texv = R.texIndex['grass_snow_side'];
          }
          if (t.o.mushInside !== undefined && t.o.fungusCap) { const nt = R.types[TTYPE[nb]]; if (nt && nt.o.mushInside !== undefined) texv = t.o.mushInside; }
          const rcb = TRC[b], tint = rcb || tintAt(TTINT[b], x, z, b);
          const uniform = cornerLight[0] === cornerLight[1] && cornerLight[1] === cornerLight[2] && cornerLight[2] === cornerLight[3] && !cornerAO[0] && !cornerAO[1] && !cornerAO[2] && !cornerAO[3];
          const w5 = d | ((fl & F.EMISSIVE) ? 1 << 12 : 0) | (rcb ? 32768 : 0);
          if (uniform && texv === TTEX[b * 6 + d]) { mflag[mi] = 1; mstate[mi] = b; mlight[mi] = cornerLight[0]; mtint[mi] = tint; }
          else emitCubeQuad(bufs[0], d, x, y, z, x + 1, y + 1, z + 1, 1, 1, texW3(texv, fl, d, b), w5, cornerLight, cornerAO, tint);
        }
        // merge
        for (let v = 0; v < 16; v++) for (let u = 0; u < 16;) {
          const mi = v * 16 + u;
          if (mflag[mi] !== 1) { u++; continue; }
          const st0 = mstate[mi], li0 = mlight[mi], ti0 = mtint[mi];
          let w = 1;
          while (u + w < 16 && w < 15) { const mj = mi + w; if (mflag[mj] !== 1 || mstate[mj] !== st0 || mlight[mj] !== li0 || mtint[mj] !== ti0) break; w++; }
          let h = 1;
          outer: while (v + h < 16 && h < 15) {
            for (let k = 0; k < w; k++) { const mj = (v + h) * 16 + u + k; if (mflag[mj] !== 1 || mstate[mj] !== st0 || mlight[mj] !== li0 || mtint[mj] !== ti0) break outer; }
            h++;
          }
          for (let hh = 0; hh < h; hh++) for (let k = 0; k < w; k++) mflag[(v + hh) * 16 + u + k] = 2;
          const fl = TF[st0];
          mergedLight[0] = li0; mergedLight[1] = li0; mergedLight[2] = li0; mergedLight[3] = li0;
          const w3 = texW3(TTEX[st0 * 6 + d], fl, d, st0), w5 = d | ((fl & F.EMISSIVE) ? 1 << 12 : 0) | (TRC[st0] ? 32768 : 0);
          if (ax === 0) emitCubeQuad(bufs[0], d, s, v, u, s + 1, v + h, u + w, w, h, w3, w5, mergedLight, null, ti0);
          else if (ax === 1) emitCubeQuad(bufs[0], d, u, s, v, u + w, s + 1, v + h, w, h, w3, w5, mergedLight, null, ti0);
          else emitCubeQuad(bufs[0], d, u, v, s, u + w, v + h, s + 1, w, h, w3, w5, mergedLight, null, ti0);
          u += w;
        }
      }
    }

    // ---- everything else ----
    // (declared before the loop: the helpers below run inside it)
    const connGroup = (s) => { const t = R.types[TTYPE[s]]; return t ? (t.o.conn || 0) : 0; };
    const HD = [5, 0, 4, 1]; // facing idx (n,e,s,w) → face dir
    const nbState = (bi, d) => B[bi + DOFF[d]];
    const vxM = VR.VX ? { B, L, bufs: vxSplit ? [bufs[3], bufs[1], bufs[2]] : bufs, far: vxSplit ? bufs[4] : null, detail: !(vxSplit && job.vxDetail === false), DOFF, layerTile: R.texIndex['vx_tile'] | 0, layerGloss: R.texIndex['vx_tile_gloss'] | 0, layerGlass: R.texIndex['vx_glass'] | 0, layerHolo: R.texIndex['vx_holo'] | 0, layerSmooth: R.texIndex['vx_smooth'] | 0, layerSmoothGloss: R.texIndex['vx_smooth_gloss'] | 0, layerMat: [0].concat(['fabric', 'leather', 'wood', 'marble', 'metal', 'plant', 'stone'].map(m => R.texIndex['vx_mat_' + m] | 0)), ox: job.ox | 0, oy: (job.sy | 0) * 16, oz: job.oz | 0 } : null;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const bi = P(x, y, z), b = B[bi];
      if (!b) continue;
      const shape = TSH[b], fl = TF[b], layer = TL[b];
      if (shape === SH.NONE) continue;
      if (shape === SH.CUBE) {
        if (layer === 0 && (fl & F.OPAQUE)) continue; // done by greedy
        // non-opaque cube (glass, leaves, ice, slime, lava-like)
        const t = R.types[TTYPE[b]];
        const ctm = t && t.o.ctm, fam = CTMK[TTYPE[b]] | 0, cmode = fam ? CTML[TTYPE[b]] : 0;
        // the same glass: no face and no frame between them (window glass and panorama glass of one style count as one)
        const same = (nb) => nb === b || TTYPE[nb] === TTYPE[b] || (fam !== 0 && (CTMK[TTYPE[nb]] | 0) === fam && TSH[nb] === SH.CUBE);
        // which edges of face d join the same glass (bit 0 top, 1 right, 2 bottom, 3 left)
        const joinMask = (d) => { const E = CTM_NB[d]; let m = 0; for (let k = 0; k < 4; k++) if (same(B[bi + DOFF[E[k]]])) m |= 1 << k; return m; };
        // (v0.33.2: no more "pane in the middle of the wall" for glass set in a wall — a neighbour that changed made the
        // pane jump to the block's surface, and it looked like glass popping up next to a block you broke. Glass is
        // drawn as the block it is, flush like every other block.)
        for (let d = 0; d < 6; d++) {
          const nb = nbState(bi, d);
          if (TF[nb] & F.OPAQUE) continue;
          if (same(nb)) {
            if (fl & F.SELFCULL) continue;
            if ((fl & F.LEAVES) && !fancy) continue;
          }
          if ((fl & F.LEAVES) && (TF[nb] & F.LEAVES) && !fancy) continue;
          if (layer === 2 && (TF[nb] & F.TRANS) && same(nb)) continue;
          faceCorners(bi, d);
          // a recoloured block (never connected glass: there bit 15 belongs to the frame mask)
          const rcb = cmode === 1 ? 0 : TRC[b];
          const tint = rcb || tintAt(TTINT[b], x, z, b);
          let w5 = d | ((fl & F.EMISSIVE) ? 1 << 12 : 0) | (rcb ? 32768 : 0);
          if (fl & F.WAVELEAF) w5 |= 1 << 7;
          let texv = TTEX[b * 6 + d];
          // panorama glass: the frame variant from the same glass around this face (top, right, bottom, left);
          // Klassisch: variant 0, the full frame on every block
          if (cmode === 1) { texv = ctm + (ctmJoin ? joinMask(d) : 0); w5 |= 1 << 14; }
          emitCubeQuad(bufs[layer], d, x, y, z, x + 1, y + 1, z + 1, 1, 1, texW3(texv, fl, d, b), w5, cornerLight, cornerAO, tint);
        }
        continue;
      }
      if (shape === SH.VOXEL) { if (vxM) VR.VX.meshBlock(vxM, x, y, z, bi, b); continue; }
      if (shape === SH.FLUID) { meshFluid(x, y, z, bi, b); continue; }
      let faces = null;
      const t = R.types[TTYPE[b]];
      // one odd block must never take the whole section (a hole in the ground) down with it
      try { switch (shape) {
        case SH.MODEL: faces = R.models[b]; break;
        case SH.STAIRS: faces = stairsFor(bi, b, t); break;
        case SH.FENCE: faces = connFor(bi, b, 'f'); break;
        case SH.WALL: faces = wallFor(bi, b); break;
        case SH.PANE: faces = connFor(bi, b, 'p'); break;
        case SH.WIRE: meshWire(x, y, z, bi, b); continue;
        case SH.CHORUS: faces = chorusFor(bi, b); break;
        case SH.DRIP: faces = dripFor(bi, b, t); break;
        case SH.CROSS: faces = R.models[b]; break;
      } } catch (e) { if (!VR._meshBlockErr) { VR._meshBlockErr = 1; console.warn('mesh block', R.types[TTYPE[b]] && R.types[TTYPE[b]].name, e); } continue; }
      if (!faces) continue;
      emitModel(faces, x, y, z, bi, b, t, layer, fl);
    }

    function emitModel(faces, x, y, z, bi, b, t, layer, fl) {
      const tintCode = TTINT[b];
      const rcb = TRC[b], blockTint = rcb || tintAt(tintCode, x, z, b);
      const own = L[bi];
      // plant offset jitter for small plants
      let ox = 0, oz = 0, oy = 0;
      if (t.o.jitter) {
        const h = M_hash(x + job.ox, z + job.oz);
        ox = ((h & 15) / 15 - 0.5) * 0.35; oz = (((h >> 4) & 15) / 15 - 0.5) * 0.35;
      }
      // plants on smooth ground sit on the sloped surface (its height under the plant's centre)
      if (PH && (shapeOf(b) === SH.CROSS || shapeOf(b) === SH.TALLCROSS || shapeOf(b) === SH.CROP) && y > 0) {
        const bb = B[bi - PSS];
        if ((TF[bb] & F.SMOOTH) && smoothAt(x, y - 1, z)) { const fx = 0.5 + ox, fz = 0.5 + oz; oy = smC[0] * (1 - fx) * (1 - fz) + smC[1] * (1 - fx) * fz + smC[2] * fx * fz + smC[3] * fx * (1 - fz) - y; }
      }
      let rotLily = 0;
      if (t.o.randomRot) rotLily = M_hash(x + job.ox, z + job.oz) & 3;
      const pane = TSH[b] === SH.PANE;
      for (let fi = 0; fi < faces.length; fi++) {
        let f = faces[fi];
        if (rotLily) f = MD.rotY([f], rotLily)[0];
        if (f.cull >= 0) {
          const nb = B[bi + DOFF[f.cull]];
          if (TF[nb] & F.OPAQUE) continue;
          const nt = TTYPE[nb];
          if (nt === TTYPE[b] && (fl & F.SELFCULL)) continue;
          // a pane's ends and edges against the same pane or flush against a full block (glass too) are hidden
          if (pane && (nt === TTYPE[b] || ((TF[nb] & F.FULL) && (TF[nb] & F.SOLID)))) continue;
        }
        const fflags = f.flags || 0;
        let light;
        if (f.cull >= 0) light = L[bi + DOFF[f.cull]]; else light = own;
        const lay = f.layer !== undefined ? f.layer : layer;
        const buf = bufs[lay];
        let kind = 0;
        if (fflags & FF.WATER) kind = KIND.WATER; else if (fflags & FF.LAVA) kind = KIND.LAVA; else if (fflags & FF.PORTAL) kind = KIND.PORTAL; else if (fflags & FF.STARS) kind = KIND.STARS;
        const texv = f.tex;
        const meta = R.texMeta[texv & 0xfff];
        if (meta && meta.anim) kind = KIND.ANIM;
        let w5base = (f.dir & 7) | (kind << 8) | ((fflags & FF.EMIT) || (fl & F.EMISSIVE) ? 1 << 12 : 0) | (!f.shade ? 1 << 11 : 0);
        if ((fflags & FF.WAVELEAF) || (fl & F.WAVELEAF)) w5base |= 1 << 7;
        // a recoloured block: every plain face in its colour (water, lava, portal and star faces keep theirs)
        const look = rcb && (kind === 0 || kind === KIND.ANIM);
        if (look) w5base |= 32768;
        const tint = look ? rcb : f.tint ? (f.tint >= 8 && f.tint < 256 ? tintAt(f.tint, x, z, b) : (f.tint > 255 ? hex565(f.tint) : tintAt(f.tint, x, z, b))) : (rcb ? tintAt(tintCode, x, z, b) : blockTint);
        const w3 = (texv & 0xffff) | ((fl & F.MACRO) && macroOn ? 1 << 15 : 0);
        const p = f.p, uv = f.uv;
        buf.ensure(f.double ? 8 : 4);
        const tall = t.o.tall && t.has('half') && t.get(b, 'half') === 1;
        for (let k = 0; k < 4; k++) {
          let sway = 0;
          if (fflags & FF.WAVE) { const py = p[k * 3 + 1]; sway = tall ? (py > 0.5 ? 3 : 2) : (py > 0.3 ? (t.o.tall ? 2 : 3) : 0); }
          buf.v(x + p[k * 3] + ox, y + p[k * 3 + 1] + oy, z + p[k * 3 + 2] + oz, w3, uv[k * 2], uv[k * 2 + 1], w5base | (sway << 5), light, tint);
        }
        if (f.double) {
          for (let kk = 0; kk < 4; kk++) {
            const k = 3 - kk;
            let sway = 0;
            if (fflags & FF.WAVE) { const py = p[k * 3 + 1]; sway = tall ? (py > 0.5 ? 3 : 2) : (py > 0.3 ? (t.o.tall ? 2 : 3) : 0); }
            buf.v(x + p[k * 3] + ox, y + p[k * 3 + 1] + oy, z + p[k * 3 + 2] + oz, w3, uv[k * 2], uv[k * 2 + 1], (w5base & ~7) | VR.OPP[f.dir & 7] | (sway << 5), light, tint);
          }
        }
      }
    }
    function M_hash(x, z) { let h = x * 374761393 + z * 668265263; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }

    // ---------------- stairs shape ----------------
    function stairsFor(bi, b, t) {
      const facing = t.get(b, 'facing'), half = t.get(b, 'half');
      const models = stairsModels(t, b);
      const isStairs = (s) => TSH[s] === SH.STAIRS;
      const fdx = VR.HF_DX, fdz = VR.HF_DZ;
      const front = B[bi + fdx[facing] + fdz[facing] * PS];
      let shape = 0;
      if (isStairs(front)) {
        const ft = R.types[TTYPE[front]]; const ff = ft.get(front, 'facing'), fh = ft.get(front, 'half');
        if (fh === half && (ff & 1) !== (facing & 1)) {
          const side = B[bi - fdx[ff] - fdz[ff] * PS];
          const sameSide = isStairs(side) && R.types[TTYPE[side]].get(side, 'facing') === facing && R.types[TTYPE[side]].get(side, 'half') === half;
          if (!sameSide) shape = ff === (facing + 3) % 4 ? 3 : 4;
        }
      }
      if (!shape) {
        const back = B[bi - fdx[facing] - fdz[facing] * PS];
        if (isStairs(back)) {
          const bt = R.types[TTYPE[back]]; const bf = bt.get(back, 'facing'), bh = bt.get(back, 'half');
          if (bh === half && (bf & 1) !== (facing & 1)) {
            const side = B[bi + fdx[bf] + fdz[bf] * PS];
            const sameSide = isStairs(side) && R.types[TTYPE[side]].get(side, 'facing') === facing && R.types[TTYPE[side]].get(side, 'half') === half;
            if (!sameSide) shape = bf === (facing + 3) % 4 ? 1 : 2;
          }
        }
      }
      return models[(facing * 2 + half) * 5 + shape];
    }
    // ---------------- connections ----------------
    function connects(bi, d, my, kind) {
      const n = B[bi + DOFF[d]];
      if (!n) return false;
      if (TF[n] & F.OPAQUE) return true;
      const g = connGroup(n);
      if (kind === 'f') return g === my || (g === 1 && my === 1 && false) || (my === 1 && R.types[TTYPE[n]].o.kind === 'gate');
      if (kind === 'w') return g === 3 || g === 4 || R.types[TTYPE[n]].o.kind === 'gate';
      return R.paneJoin(n);
    }
    function connFor(bi, b, kind) {
      const parts = connParts(kind, b);
      const my = connGroup(b);
      if (kind === 'p') {
        // a pane: no faces inside the glass — the post's side under an arm and the arm's inner end go (they showed as
        // little frame ticks along a run of panes). One face list per joined-sides mask, cached.
        let m = 0; for (let i = 0; i < 4; i++) if (connects(bi, HD[i], my, kind)) m |= 1 << i;
        const key = 'P' + b + ':' + m;
        let f = partCache.get(key);
        if (!f) {
          f = parts.post.filter(fc => { for (let i = 0; i < 4; i++) if ((m >> i & 1) && fc.dir === HD[i]) return false; return true; });
          for (let i = 0; i < 4; i++) if (m >> i & 1) f = f.concat(parts.arms[i].filter(fc => fc.dir !== VR.OPP[HD[i]]));
          partCache.set(key, f);
        }
        return f;
      }
      let f = parts.post.slice();
      for (let i = 0; i < 4; i++) if (connects(bi, HD[i], my, kind)) f = f.concat(parts.arms[i]);
      return f;
    }
    function wallFor(bi, b) {
      const parts = connParts('w', b);
      const c = [0, 1, 2, 3].map(i => connects(bi, HD[i], 3, 'w'));
      const above = B[bi + PSS];
      const aboveTall = above && ((TF[above] & F.OPAQUE) || connGroup(above) === 3);
      const straight = (c[0] && c[2] && !c[1] && !c[3]) || (c[1] && c[3] && !c[0] && !c[2]);
      let f = [];
      const post = !straight || (above && (TF[above] & F.SOLID) && connGroup(above) === 3);
      if (post) f = f.concat(parts.post);
      for (let i = 0; i < 4; i++) if (c[i]) f = f.concat(post ? (aboveTall ? parts.tall[i] : parts.low[i]) : (aboveTall ? parts.tallC[i] : parts.lowC[i]));
      return f;
    }
    function chorusFor(bi, b) {
      const tx = TTEX[b * 6] & 0xfff;
      let f = MD.box([4, 4, 4, 12, 12, 12], tx, { cull: false });
      const arms = [[12, 4, 4, 16, 12, 12], [0, 4, 4, 4, 12, 12], [4, 12, 4, 12, 16, 12], [4, 0, 4, 12, 4, 12], [4, 4, 12, 12, 12, 16], [4, 4, 0, 12, 12, 4]];
      for (let d = 0; d < 6; d++) {
        const n = B[bi + DOFF[d]];
        const g = connGroup(n);
        if (g === 6 || (d === 3 && R.types[TTYPE[n]] && R.types[TTYPE[n]].name === 'voidstone')) f = f.concat(MD.box(arms[d], tx));
      }
      return f;
    }
    function dripFor(bi, b, t) {
      const dir = t.get(b, 'dir'); // 0 up (stalagmite), 1 down
      const step = dir === 0 ? PSS : -PSS;
      const same = (s) => TTYPE[s] === TTYPE[b];
      const n1 = B[bi + step], n2 = B[bi + step * 2];
      let th;
      if (!same(n1)) th = 'tip';
      else if (R.types[TTYPE[n1]].get(n1, 'dir') !== dir) th = 'tip_merge';
      else if (!same(n2)) th = 'frustum';
      else { const back = B[bi - step]; th = same(back) ? 'middle' : 'base'; }
      const tex = R.texIndex['drip:' + t.o.dripFam + ':' + th];
      let f = MD.cross(tex, { inset: th === 'base' ? 2 : th === 'middle' ? 3 : 4 });
      if (dir === 1) f = MD.flipY(f);
      return f;
    }
    // ---------------- volt wire ----------------
    function meshWire(x, y, z, bi, b) {
      const power = R.types[TTYPE[b]].get(b, 'power');
      const c = [0, 1, 2, 3].map(i => wireConn(bi, i));
      const cnt = c.filter(v => v).length;
      const dot = R.texIndex['wire_dot'], line = R.texIndex['wire_line'];
      const r = Math.round(80 + power * 11.6), g = Math.round(power > 12 ? (power - 12) * 30 : 0), bl = 0;
      const tint = VR.rgb565(Math.min(255, r), g, bl);
      const light = L[bi];
      const buf = bufs[1];
      const w5 = 2 | (1 << 11) | (power > 0 ? 1 << 12 : 0);
      const flat = (x0, z0, x1, z1, tex, rot) => {
        const yy = y + 0.015;
        buf.ensure(4);
        const uvs = [[x0 * 16, z0 * 16], [x0 * 16, z1 * 16], [x1 * 16, z1 * 16], [x1 * 16, z0 * 16]];
        const pts = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]];
        for (let k = 0; k < 4; k++) buf.v(x + pts[k][0], yy, z + pts[k][1], tex | (rot << 12), uvs[k][0], uvs[k][1], w5, light, tint);
      };
      if (cnt === 0) flat(0, 0, 1, 1, dot, 0);
      else {
        const ns = c[0] || c[2], ew = c[1] || c[3];
        if (ns && !ew && cnt <= 2) flat(0, 0, 1, 1, line, 0);
        else if (ew && !ns && cnt <= 2) flat(0, 0, 1, 1, line, 1);
        else {
          flat(0.3125, 0.3125, 0.6875, 0.6875, dot, 0);
          if (c[0]) flat(0.3125, 0, 0.6875, 0.3125, line, 0);
          if (c[2]) flat(0.3125, 0.6875, 0.6875, 1, line, 0);
          if (c[1]) flat(0.6875, 0.3125, 1, 0.6875, line, 1);
          if (c[3]) flat(0, 0.3125, 0.3125, 0.6875, line, 1);
        }
      }
      // up-steps
      for (let i = 0; i < 4; i++) {
        const d = HD[i];
        const up = B[bi + DOFF[d] + PSS];
        if (TTYPE[up] === TTYPE[b] && !(TF[B[bi + PSS]] & F.OPAQUE)) {
          const pts = MD.facePos(d, [0, 0, 0, 16, 16, 16]);
          // quad on the neighbor's face, slightly inset
          const e = 0.015;
          buf.ensure(4);
          const uvs = [0, 0, 0, 16, 16, 16, 16, 0];
          for (let k = 0; k < 4; k++) {
            const px = pts[k * 3] / 16 - VR.DX[d] * e, py = pts[k * 3 + 1] / 16, pz = pts[k * 3 + 2] / 16 - VR.DZ[d] * e;
            buf.v(x + px, y + py, z + pz, line, uvs[k * 2], uvs[k * 2 + 1], VR.OPP[d] | (1 << 11), light, tint);
          }
        }
      }
    }
    function wireConn(bi, i) {
      const d = HD[i];
      const n = B[bi + DOFF[d]];
      const nt = R.types[TTYPE[n]];
      if (nt) {
        if (nt.o.kind === 'wire') return true;
        const k = nt.o.kind;
        if (k === 'lever' || k === 'button' || k === 'vtorch' || k === 'plate' || k === 'target' || k === 'daylight' || k === 'observer' || (TF[n] & F.POWERSRC)) return true;
        if (k === 'repeater' || k === 'comparator') { const f = nt.get(n, 'facing'); return (f & 1) === (i & 1); }
      }
      if (!(TF[n] & F.OPAQUE)) { const dn = B[bi + DOFF[d] - PSS]; if (R.types[TTYPE[dn]] && R.types[TTYPE[dn]].o.kind === 'wire') return true; }
      const up = B[bi + DOFF[d] + PSS];
      if (R.types[TTYPE[up]] && R.types[TTYPE[up]].o.kind === 'wire' && !(TF[B[bi + PSS]] & F.OPAQUE)) return true;
      return false;
    }
    // ---------------- fluids ----------------
    function fluidInfo(s, type) {
      if (TTYPE[s] !== type) return -1;
      const lv = R.types[type].get(s, 'level');
      return lv;
    }
    // a fluid block with the same fluid (or something opaque) on all six sides shows no face: the body of a lake or an
    // ocean is left here before any work is done (it is most of the fluid blocks of a section)
    function fluidHidden(bi, type, isLava) {
      const above = B[bi + PSS];
      if (!(TTYPE[above] === type || (!isLava && (TF[above] & F.WATER)) || (TF[above] & F.OPAQUE))) return false;
      const below = B[bi - PSS];
      if (!(TTYPE[below] === type || (TF[below] & F.OPAQUE) || (!isLava && (TF[below] & F.WATER)))) return false;
      for (let k = 0; k < 4; k++) {
        const nb = B[bi + DOFF[FLUID_SIDES[k]]];
        if (!((TF[nb] & F.OPAQUE) || TTYPE[nb] === type || (!isLava && (TF[nb] & F.WATER) && (TF[nb] & F.FLUID)))) return false;
      }
      return true;
    }
    function meshFluid(x, y, z, bi, b) {
      const type = TTYPE[b], t = R.types[type];
      const isLava = (TF[b] & F.LAVA) !== 0;
      if (fluidHidden(bi, type, isLava)) return;
      const lvl = t.get(b, 'level');
      const aboveSame = TTYPE[B[bi + PSS]] === type || (!isLava && (TF[B[bi + PSS]] & F.WATER));
      const heightOf = (s) => {
        const tt = TTYPE[s];
        if (tt !== type && !(!isLava && (TF[s] & F.WATER) && (TF[s] & F.FLUID))) return -1;
        const lv = R.types[tt].get(s, 'level');
        if (lv === 0) return 0.875;
        if (lv >= 8) return 1;
        return (8 - lv) / 9;
      };
      const cornerH = (dx, dz) => {
        // average heights of the 4 blocks around corner (dx,dz ∈ {0,1})
        let sum = 0, n = 0;
        for (let ox = dx - 1; ox <= dx; ox++) for (let oz = dz - 1; oz <= dz; oz++) {
          const ni = bi + ox + oz * PS;
          const s = B[ni];
          const above = B[ni + PSS];
          if ((TTYPE[s] === type || (!isLava && (TF[s] & F.WATER) && (TF[s] & F.FLUID))) && (TTYPE[above] === type || (!isLava && (TF[above] & F.WATER) && (TF[above] & F.FLUID)))) return 1;
          const h = heightOf(s);
          if (h >= 0) { const w = h >= 0.875 ? 3 : 1; sum += h * w; n += w; }
          else if (!(TF[s] & F.SOLID)) { n += 1; }
        }
        return n ? sum / n : 0.875;
      };
      const h00 = aboveSame ? 1 : cornerH(0, 0), h10 = aboveSame ? 1 : cornerH(1, 0), h01 = aboveSame ? 1 : cornerH(0, 1), h11 = aboveSame ? 1 : cornerH(1, 1);
      const buf = bufs[isLava ? 0 : 2];
      const isAether = !!t.o.aether;
      const tint = isLava ? 0xffff : isAether ? AETHER_TINT : tintAt(3, x, z, b);
      const tex = TTEX[b * 6 + 2] & 0xfff;
      const kindBase = isLava ? KIND.LAVA : isAether ? KIND.AETHER : KIND.WATER;
      // flow direction from height gradient
      const fx = (h10 + h11) - (h00 + h01), fz = (h01 + h11) - (h00 + h10);
      const flowing = lvl !== 0 && !aboveSame && (Math.abs(fx) + Math.abs(fz) > 0.01);
      let rot = 0;
      if (flowing) { const a = Math.atan2(-fz, -fx); rot = ((Math.round(a / (Math.PI / 2)) % 4) + 4 + 1) % 4; }
      const w3 = tex | (rot << 12);
      const kind = isAether ? KIND.AETHER : flowing ? KIND.WATERFLOW : kindBase;
      const emitW5 = isLava || isAether ? 1 << 12 : 0;
      const kindV = isLava ? KIND.LAVA : kind;
      // top
      const above = B[bi + PSS];
      if (!aboveSame && !(TF[above] & F.OPAQUE)) {
        const l = L[bi + PSS] > L[bi] ? L[bi + PSS] : L[bi];
        buf.ensure(8);
        const pts = [[0, h00, 0], [0, h01, 1], [1, h11, 1], [1, h10, 0]];
        const uvs = [[0, 0], [0, 16], [16, 16], [16, 0]];
        for (let k = 0; k < 4; k++) buf.v(x + pts[k][0], y + pts[k][1] - 0.001, z + pts[k][2], w3, uvs[k][0], uvs[k][1], 2 | (kindV << 8) | emitW5, l, tint);
        if (!isLava) for (let kk = 0; kk < 4; kk++) { const k = 3 - kk; buf.v(x + pts[k][0], y + pts[k][1] - 0.001, z + pts[k][2], w3, uvs[k][0], uvs[k][1], 3 | (kindV << 8), l, tint); }
      }
      // bottom
      const below = B[bi - PSS];
      if (TTYPE[below] !== type && !(TF[below] & F.OPAQUE) && !(!isLava && (TF[below] & F.WATER))) {
        buf.ensure(4);
        const pts = [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]];
        for (let k = 0; k < 4; k++) buf.v(x + pts[k][0], y, z + pts[k][2], tex, pts[k][0] * 16, pts[k][2] * 16, 3 | (kindBase << 8) | emitW5, L[bi - PSS], tint);
      }
      // sides: order TL,BL,BR,TR matching facePos
      const sides = [
        [0, [1, h11, 1], [1, 0, 1], [1, 0, 0], [1, h10, 0]],
        [1, [0, h00, 0], [0, 0, 0], [0, 0, 1], [0, h01, 1]],
        [4, [0, h01, 1], [0, 0, 1], [1, 0, 1], [1, h11, 1]],
        [5, [1, h10, 0], [1, 0, 0], [0, 0, 0], [0, h00, 0]],
      ];
      for (const [d, a, bb, c, e] of sides) {
        const ni = bi + DOFF[d], nb = B[ni];
        if (TF[nb] & F.OPAQUE) continue;
        if (TTYPE[nb] === type || (!isLava && (TF[nb] & F.WATER) && (TF[nb] & F.FLUID))) continue;
        buf.ensure(8);
        const l = L[ni];
        const pts = [a, bb, c, e];
        for (let k = 0; k < 4; k++) buf.v(x + pts[k][0], y + pts[k][1], z + pts[k][2], tex | (1 << 12), k === 0 || k === 1 ? 0 : 16, (1 - pts[k][1]) * 16, d | ((isAether ? KIND.AETHER : KIND.WATERFLOW) << 8) | emitW5, l, tint);
        if (!isLava) for (let kk = 0; kk < 4; kk++) { const k = 3 - kk; buf.v(x + pts[k][0], y + pts[k][1], z + pts[k][2], tex | (1 << 12), k === 0 || k === 1 ? 0 : 16, (1 - pts[k][1]) * 16, VR.OPP[d] | ((isAether ? KIND.AETHER : KIND.WATERFLOW) << 8) | emitW5, l, tint); }
      }
    }

    const res = { opaque: bufs[0].out(), cutout: bufs[1].out(), trans: bufs[2].out(), vis: visMask };
    if (vxSplit) { res.vx = bufs[3].out(); res.vxFar = bufs[4].out(); }
    return res;
  };
  // pair index for faces a<b (6 faces → 15 pairs)
  const PAIR = [];
  { let k = 0; for (let a = 0; a < 6; a++) { PAIR[a] = []; for (let b = 0; b < 6; b++) PAIR[a][b] = -1; } for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) { PAIR[a][b] = k; PAIR[b][a] = k; k++; } }
  VR.visPair = (a, b) => PAIR[a][b];
})(VR);

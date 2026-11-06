// q-art4 · Runde Inseln (src/shared/isleshell.js, src/main/qart4.js, plan docs/superpowers/plans/2026-11-07-q-art4.md):
//   a  the shell: closed and facing outward, its outline and depth those of the generator's isle (no pop at the chunks'
//      edge), its vertex budget per detail, the same mesh for the same isle (every tile that asks), its colours
//   b  the far land: lod.js and far.js with job.isleForm draw the isles centred in the tile as face-7 forms (no slabs, one
//      draw per isle over a grid of tiles); without it the tiles are byte for byte as before
//   c  the near isles: the mesher's bit 16 with job.isle (VR.IsleShell.columns) — off-grid vertices on the isle, the same
//      mesh where no isle is; Klassisch untouched
//   d  the switch by preset (Very Low and Low off), its row, texts, defines only on the far programs, the leaf-mode bit,
//      the wiring (build.js, game.js, settings_reg.js, horizon.js, farring.js, world.js, worker_main.js, shaders.js)
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const ROOT = path.join(__dirname, '..');
const IS = V.IsleShell;
check(!!IS && typeof IS.mesh === 'function', 'VR.IsleShell exists');
const g = V.makeGen('overworld', 12345, { vgen: 16 });
const all = IS.anchored(g, -1200, -1200, 1200, 1200);
check(all.length > 50, 'isles found round the spawn', all.length);
const big = all.filter(I => !I.designed).sort((a, b) => b.r - a.r)[0], small = all.filter(I => !I.designed).sort((a, b) => a.r - b.r)[0];

// ---- a  the shell
for (const [nm, I] of [['big', big], ['small', small]]) {
  for (const det of [0, 1, 2]) {
    const m = IS.build(g, I, det, IS.palette(g, I));
    // closed body: every edge of the body (the non-card triangles) shared by exactly two triangles, in opposite directions
    const E = new Map(); let bodyTris = 0, outward = 0;
    for (let i = 0; i < m.ni; i += 3) {
      const a = m.idx[i], b = m.idx[i + 1], c = m.idx[i + 2];
      if (m.kind[a] === 5 || (det === 2 && i >= 0 && isCard(m, a, b, c))) continue;
      bodyTris++;
      for (const [u, v] of [[a, b], [b, c], [c, a]]) { const k = u + ',' + v; E.set(k, (E.get(k) || 0) + 1); }
      const p = (j) => [m.pos[j * 3], m.pos[j * 3 + 1], m.pos[j * 3 + 2]];
      const A = p(a), B = p(b), C = p(c);
      const n = cross(sub(B, A), sub(C, A)), ctr = [(A[0] + B[0] + C[0]) / 3 - I.x, (A[1] + B[1] + C[1]) / 3 - (I.y - I.r * 0.3), (A[2] + B[2] + C[2]) / 3 - I.z];
      if (dot(n, ctr) > 0) outward++;
    }
    let open = 0; for (const [k, n] of E) { const [u, v] = k.split(','); if (n !== 1 || E.get(v + ',' + u) !== 1) open++; }
    if (det !== 1) {
      check(open === 0, nm + ' isle, detail ' + det + ': its body is closed (every edge twice, opposite ways)', open + ' open of ' + E.size);
      check(outward / bodyTris > 0.97, nm + ' isle, detail ' + det + ': its faces look outward', (outward / bodyTris * 100).toFixed(1) + ' %');
    }
    if (det === 2) {
      // the outline and depth of the generator's isle (the chunks): the widest column and the lowest bottom
      let rx = 0, minB = 1e9;
      for (let z = -60; z <= 60; z++) for (let x = -60; x <= 60; x++) { const s = g.islandShape(I, I.x + x + 0.5, I.z + z + 0.5); if (s) { rx = Math.max(rx, Math.hypot(x + 0.5, z + 0.5)); minB = Math.min(minB, s.bottom); } }
      let mr = 0, my = 1e9, ty = -1e9;
      for (let v = 0; v < m.nv; v++) { if (m.kind[v] === 5) continue; mr = Math.max(mr, Math.hypot(m.pos[v * 3] - I.x, m.pos[v * 3 + 2] - I.z)); my = Math.min(my, m.pos[v * 3 + 1]); ty = Math.max(ty, m.pos[v * 3 + 1]); }
      check(Math.abs(mr - rx) < 2.5, nm + ' isle: the form\'s outline is the isle\'s (the chunks\' widest column)', mr.toFixed(1) + ' vs ' + rx.toFixed(1));
      const depthV = I.y - minB, depthS = I.y - my;
      check(depthS > depthV * 0.6 && depthS < depthV * 1.15 + 1, nm + ' isle: the form hangs about as deep as the blocks (their spikes averaged)', depthS.toFixed(1) + ' vs ' + depthV.toFixed(1));
      check(Math.abs(ty - (I.y + I.dome + 1)) < 2.5, nm + ' isle: the dome\'s top at the isle\'s top', ty.toFixed(1) + ' vs ' + (I.y + I.dome + 1).toFixed(1));
      check(m.nv < 700, nm + ' isle: detail 2 stays small', m.nv + ' vertices');
      let vines = 0; for (let v = 0; v < m.nv; v++) if (m.kind[v] === 5) vines++;
      check(vines >= 6, nm + ' isle: vines hang from the rim', vines / 3 + ' cards');
      // strata bands: the underside has several colours, the top is the biome's grass
      const cols = new Set(); for (let v = 0; v < m.nv; v++) if (m.pos[v * 3 + 1] < I.y - 3) cols.add(m.col[v * 4] + ',' + m.col[v * 4 + 1] + ',' + m.col[v * 4 + 2]);
      check(cols.size >= 4, nm + ' isle: the underside in bands of several colours', cols.size);
    }
    if (det === 0) check(m.nv <= 60, nm + ' isle: detail 0 (the coarse tiles) a handful of vertices', m.nv);
  }
}
function isCard(m, a, b, c) { return m.col[a * 4 + 3] === 200 && m.col[b * 4 + 3] === 200 && m.col[c * 4 + 3] === 170 || (m.col[a * 4 + 3] === 200 && m.col[c * 4 + 3] === 200 && m.col[b * 4 + 3] === 170); }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
{
  IS.clearCache();
  const m1 = IS.mesh(g, big, 2), g2 = V.makeGen('overworld', 12345, { vgen: 16 }); IS.clearCache();
  const I2 = IS.anchored(g2, -1200, -1200, 1200, 1200).find(J => J.x === big.x && J.z === big.z), m2 = IS.mesh(g2, I2, 2);
  check(m1.nv === m2.nv && Buffer.compare(Buffer.from(m1.pos.buffer), Buffer.from(m2.pos.buffer)) === 0, 'the same isle gives the same form (another generator of the same world)');
  check(IS.minR(2) === 0 && IS.minR(3) > 12 && IS.minR(4) > 25, 'the coarse levels draw only the bigger isles', IS.minR(3) + ' / ' + IS.minR(4));
  check(IS.detFor(-1) === 2 && IS.detFor(0) === 2 && IS.detFor(1) === 1 && IS.detFor(2) === 0 && IS.detFor(4) === 0, 'detail by tile level: near 2, middle 1, coarse 0');
}

// ---- b  the far land
V.LOD.setAvg(null);
const hashBuf = (u8) => { let h = 2166136261; for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
{
  // a level-0 tile (128 blocks) that holds the big isle's centre
  const L = 0, T = 32 * V.LOD.cell(L), tx = Math.floor(big.x / T), tz = Math.floor(big.z / T);
  const a = V.LOD.build(g, { level: L, tx, tz }), b = V.LOD.build(g, { level: L, tx, tz, isleForm: 0 }), c = V.LOD.build(g, { level: L, tx, tz, isleForm: 1 });
  check(hashBuf(new Uint8Array(a.verts)) === hashBuf(new Uint8Array(b.verts)), 'lod.js without isleForm: the tile byte for byte as before');
  const f7 = (r) => { const u = new Uint8Array(r.verts); let n = 0; for (let i = 0; i < u.length; i += 12) if ((u[i + 6] & 7) === 7) n++; return n; };
  check(f7(a) === 0 && f7(c) > 100, 'lod.js with isleForm: the isle as a face-7 form', f7(c) + ' vertices');
  check(c.minY < big.y - 5 && c.maxY > big.y, 'the tile\'s bounds hold the form', c.minY.toFixed(0) + '..' + c.maxY.toFixed(0));
  // over a 3 × 3 grid of tiles every isle is drawn once (by the tile of its centre)
  let n7 = 0, want = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const r = V.LOD.build(g, { level: L, tx: tx + i, tz: tz + j, isleForm: 1 }); if (r && !r.empty) n7 += f7(r); for (const J of IS.anchored(g, (tx + i) * T, (tz + j) * T, (tx + i + 1) * T, (tz + j + 1) * T)) want += IS.mesh(g, J, 0 + IS.detFor(L)).nv; }
  check(n7 === want, 'a 3 × 3 grid of tiles draws every isle exactly once', n7 + ' / ' + want);
  // the old slabs go: fewer vertices with the forms where isles are
  check(c.verts.byteLength < a.verts.byteLength * 1.2, 'the tile with forms is not bigger than with slabs (±20 %)', (a.verts.byteLength / 12) + ' → ' + (c.verts.byteLength / 12));
}
if (V.Far && V.Far.form) {
  const tx = Math.floor(big.x / 64), tz = Math.floor(big.z / 64);
  const a = V.Far.form(g, { tx, tz, cell: 2 }), c = V.Far.form(g, { tx, tz, cell: 2, isleForm: 1 });
  if (a && c && !a.empty) {
    const f7 = (r) => { const u = new Uint8Array(r.verts); let n = 0; for (let i = 0; i < u.length; i += 12) if ((u[i + 6] & 7) === 7) n++; return n; };
    check(f7(a) === 0 && f7(c) === IS.mesh(g, big, 2).nv + IS.anchored(g, tx * 64, tz * 64, tx * 64 + 64, tz * 64 + 64).filter(J => J !== big).reduce((s, J) => s + IS.mesh(g, J, 2).nv, 0), 'far.js (ring 1) with isleForm: the isles centred in the tile as detail-2 forms', f7(c));
  } else check(false, 'far.js form built', String(a && a.empty));
}

// ---- c  the near isles in the mesher
{
  V.setLook('seamless');
  const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
  const CX = Math.floor((big.x + big.r * 0.75) / 16), CZ = Math.floor(big.z / 16);   // (at the rim: the underside's faces)
  const cols = {};
  for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) { const c = g.generate(CX + cx, CZ + cz); c.light = V.computeColumnLight(c.blocks, true); cols[cx + ',' + cz] = c; }
  const jobAt = (sy) => {
    const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS); const t = new Uint16Array(PSS).fill(0x4d6a);
    for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
      const wy = sy * 16 + y, c = cols[Math.floor(x / 16) + ',' + Math.floor(z / 16)], lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
      if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xf000 : 0; continue; }
      const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
    }
    return { blocks, light, grass: t, foliage: t, water: t, sy, ox: CX * 16, oz: CZ * 16, smooth: true, vxLod: true };
  };
  const sy = Math.floor((big.y - 10) / 16), j = jobAt(sy);
  const isle = IS.columns(g, CX * 16, CZ * 16);
  let inIsle = 0; for (let c = 0; c < PSS; c++) if (isle[c * 2 + 1] >= isle[c * 2]) inIsle++;
  check(inIsle > 300, 'VR.IsleShell.columns: the isle\'s columns over the section', inIsle + ' of ' + PSS);
  const offGrid = (r) => { let off = 0; const n = r.opaque.length / 8; for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const p = r.opaque[i * 8 + c] / 2048 - 4; if (Math.abs(p - Math.round(p)) > 0.02) off++; } return off; };   // (qart3.js's grid: the packed position)
  const r0 = V.meshSection(Object.assign({}, j, { fancyLeaves: true }));
  const r1 = V.meshSection(Object.assign({}, j, { fancyLeaves: 16, isle }));
  const r2 = V.meshSection(Object.assign({}, j, { fancyLeaves: 16 }));
  check(offGrid(r1) > offGrid(r0) + 50, 'bit 16 with the isle\'s columns: the isle\'s blocks on the blob (off the grid)', offGrid(r0) + ' → ' + offGrid(r1));
  check(r2.opaque.length === r0.opaque.length, 'bit 16 without the columns: as before', r2.opaque.length / 8);
  // a section with no isle: identical
  const jl = jobAt(4), rl0 = V.meshSection(Object.assign({}, jl, { fancyLeaves: true })), rl1 = V.meshSection(Object.assign({}, jl, { fancyLeaves: 16, isle }));
  check(hashBuf(new Uint8Array(rl0.opaque.buffer)) === hashBuf(new Uint8Array(rl1.opaque.buffer)), 'a section under the isle (the land): the same mesh');
  V.setLook('classic');
  const rc0 = V.meshSection(Object.assign({}, j, { fancyLeaves: true })), rc1 = V.meshSection(Object.assign({}, j, { fancyLeaves: 16, isle }));
  check(hashBuf(new Uint8Array(rc0.opaque.buffer)) === hashBuf(new Uint8Array(rc1.opaque.buffer)), 'Klassisch: the isle\'s blocks as cubes (no blob)');
  V.setLook('seamless');
}
{
  // the round crowns' planar texture (bit 32): a 6 × 5 × 6 crown, its leaf quads' texels one size (16 a block) along the
  // face — without the bit every bent quad carries one whole texture (0 / 16)
  const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS, LEAF = V.R.byName['oak_leaves'].defaultState;
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000), t = new Uint16Array(PSS).fill(0x4d6a);
  for (let y = 6; y < 11; y++) for (let z = 4; z < 10; z++) for (let x = 4; x < 10; x++) { const pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD); blocks[pi] = LEAF; light[pi] = 0xe000; }
  const jb = { blocks, light, grass: t, foliage: t, water: t, sy: 4, ox: 0, oz: 0, smooth: true, vxLod: true };
  const dens = (r) => { const f = r.cutout, n = f.length / 8; let ok = 0, q = 0, whole = 0;
    for (let i = 0; i + 3 < n; i += 4) { q++; const P = (k, c) => f[(i + k) * 8 + c] / 2048 - 4, U = (k) => f[(i + k) * 8 + 4] & 255, W = (k) => (f[(i + k) * 8 + 4] >> 8) & 255;
      const len = Math.hypot(P(1, 0) - P(0, 0), P(1, 1) - P(0, 1), P(1, 2) - P(0, 2)), duv = Math.hypot(U(1) - U(0), W(1) - W(0)) / 16;
      if (len > 0.3 && Math.abs(duv - len) < 0.35 * len + 0.1) ok++; if ([0, 1, 2, 3].every(k => U(k) % 16 === 0 && W(k) % 16 === 0)) whole++; }
    return { q, ok, whole }; };
  const a = dens(V.meshSection(Object.assign({}, jb, { fancyLeaves: 2 }))), b = dens(V.meshSection(Object.assign({}, jb, { fancyLeaves: 34 })));
  check(b.ok > b.q * 0.6 && b.ok > a.ok + 10, 'the round crown\'s texture planar: the texels one size along the bent quads', 'quads ' + b.q + ': ' + a.ok + ' → ' + b.ok + ' one size');
  check(a.whole === a.q, 'without bit 32 every quad one whole texture (as q-art3)', a.whole + ' / ' + a.q);
}

// ---- d  switches, rows, texts, defines, wiring
global.VR = V; global.self = global;
require(path.join(ROOT, 'src/main/qart4.js'));
const Q4 = V.QArt4;
check(!!Q4 && Q4.SW.join() === 'qIsleForm', 'VR.QArt4: the switch');
check(!Q4.defaults('potato').qIsleForm && !Q4.defaults('low').qIsleForm && Q4.defaults('balanced').qIsleForm && Q4.defaults('high').qIsleForm && Q4.defaults('ultra').qIsleForm, 'Very Low and Low off, Balanced and up on');
check(Q4.ROWS.length === 1 && Q4.ROWS[0].cost === 'low' && Q4.ROWS[0].t === 'switch', 'its row: a switch, cost low');
check(Q4.definesFor('lod', { qIsleForm: true }).join() === 'Q_ISLEFORM' && Q4.definesFor('form', { qIsleForm: true }).length === 1 && Q4.definesFor('lodFar', { qIsleForm: true }).length === 1, 'Q_ISLEFORM on the far programs');
check(Q4.definesFor('terrain', { qIsleForm: true }).length === 0 && Q4.definesFor('lod', { qIsleForm: false }).length === 0, 'no define elsewhere or when off');
check(Q4.leafMode(true, { qIsleForm: true }) === 16 && Q4.leafMode(false, { qIsleForm: true }) === 24 && Q4.leafMode(2, { qIsleForm: true }) === 50 && Q4.leafMode(true, { qIsleForm: false }) === true && Q4.leafMode(false, {}) === false, 'the leaf mode: bit 16 only with the switch');
check(Q4.leafMode(2, {}) === 34 && Q4.leafMode(6, {}) === 38 && Q4.leafMode(4, {}) === 4, 'the leaf mode: the crowns\' polish (32) always with the round crowns (2)');
{ Q4.polish = false; const k = Q4.leafMode(2, {}); Q4.polish = true; check(k === 2, 'Q4.polish false: q-art3\'s mode as it was (the before pictures)'); }
check(Q4.definesFor('terrain', { qRoundTop: true }).join() === 'Q_RTOP 0.860' && Q4.definesFor('lod', { qRoundTop: true }).length === 0, 'Q_RTOP only on the terrain programs');
const de = fs.readFileSync(path.join(ROOT, 'src/main/lang_de.js'), 'utf8'), en = fs.readFileSync(path.join(ROOT, 'src/main/lang_en.js'), 'utf8');
check(/'g\.set\.qIsleForm': 'Runde Inseln'/.test(de) && /'g\.set\.qIsleForm\.tip'/.test(de) && /'g\.set\.qIsleForm': 'Round isles'/.test(en) && /'g\.set\.qIsleForm\.tip'/.test(en), 'texts in German and English');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
check(/'isleshell'/.test(src('build.js')) && /'qart4'/.test(src('build.js')) && /'qart4_gl'/.test(src('build.js')), 'build.js: isleshell (shared), qart4, qart4_gl');
check(/Q4_SW/.test(src('src/main/game.js')) && /QArt4\.leafMode/.test(src('src/main/game.js')) && /setIsleForm/.test(src('src/main/game.js')), 'game.js: the switch, the leaf mode, the horizon');
check(/QArt4\.ROWS/.test(src('src/main/settings_reg.js')), 'settings_reg.js: the row');
check(/isleForm: this\.isleForm/.test(src('src/main/horizon.js')) && /isleForm: this\.hz/.test(src('src/main/farring.js')), 'horizon.js and farring.js ask with isleForm');
check(/dim: this\.dim/.test(src('src/main/world.js')) && /IsleShell\.columns/.test(src('src/worker/worker_main.js')), 'world.js sends the dim, the worker the isles\' columns');
const sh = src('src/main/shaders.js');
check(/#ifdef Q_ISLEFORM[\s\S]*v_face == 7u/.test(sh) && /#else\n  vec3 N = NORMALS\[v_face\];\n#endif/.test(sh), 'LOD_FS: face 7 under Q_ISLEFORM, the old line without it');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');

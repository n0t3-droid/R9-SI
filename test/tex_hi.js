// t-material · hero textures (plan docs/superpowers/plans/2026-10-15-t-material.md, step 6; tex_hi.js), no browser:
//  a · the table: sixteen heroes, every one a layer of the registry and the face of a full opaque cube
//  b · the forge as the worker runs it (the texture modules evaluated again with VR.TEX_N = 64 on a namespace of their
//      own): 16 layers of 64 × 64 with 7 levels, nothing missing; the same palette and mean colour as the 32 × 32 ones
//      (within a few levels), the same structure (the 64's level 1 against the 32's level 0), the same roughness; its time
//      and its memory
//  c · the 32 × 32 textures did not change (the heroes against test/tex_ref.json; classic_v2.js checks every layer)
//  d · the cache keeps the set under its own key (size 64, 7 levels, the names), and reads it back only as it was written
//  e · the switch: Detail-Texturen in the settings with its texts, the presets (Balanced and up), the shader's TEXHI and
//      its define list (never on Very Low), the worker bundle's VR.TEX_MODS
//   bash test/wt_run.sh tex_hi.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
const fs = require('fs'), path = require('path');
const TEX = ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_layout', 'tex_mat', 'tex_build', 'tex_hi'];
for (const f of TEX) require('../src/main/' + f + '.js');
// the worker's VR.TEX_MODS (build.js): the same modules as one function
V.TEX_MODS = new Function('VR', TEX.map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'main', f + '.js'), 'utf8')).join('\n'));
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const R = V.R, HI = V.TexHi, mk = V.textureMasks();
const lum = (a, o) => 0.299 * a[o] + 0.587 * a[o + 1] + 0.114 * a[o + 2];

console.log('a · the table');
const names = HI.names();
check(HI.NAMES.length === 16 && names.length === 16, 'sixteen heroes, all in the registry', names.length + ': ' + names.join(' '));
check(names.every((n) => mk.cube[R.texIndex[n]] === 1), 'each the face of a full opaque cube', names.filter((n) => mk.cut[R.texIndex[n]]).map((n) => n + ' also on a cut-out model').join(', ') || 'none on a cut-out');

console.log('b · the forge');
const t0 = Date.now();
const hi = HI.forge({ bevel: 1 });
const ms = Date.now() - t0;
check(!!hi && hi.size === 64 && hi.levels === 7 && hi.layers === 16 && hi.albedo.length === 7 && hi.albedo[0].length === 64 * 64 * 4 * 16 && hi.missing.length === 0, '16 layers of 64 × 64, 7 levels, nothing missing', hi && `${hi.layers} × ${hi.size}, ${hi.levels} levels, missing ${hi.missing.length}`);
const idx = names.map((n) => R.texIndex[n]), pick = (m) => Uint8Array.from(idx.map((i) => m[i]));
const lo = V.buildTextureArrays({ names, ids: idx, cubeMask: pick(mk.cube), cutoutMask: pick(mk.cut), leafMask: pick(mk.leaf), blockMask: pick(mk.block), bevel: 1, bevelAll: false, classic: false });
const rows = [];
for (let l = 0; l < names.length; l++) {
  const n = 32 * 32, A = hi.albedo[1], B = lo.albedo[0], o = l * n * 4;
  const ma = [0, 0, 0], mb = [0, 0, 0], la = [], lb = [];
  let ra = 0, rb = 0;
  for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) { ma[c] += A[o + i * 4 + c]; mb[c] += B[o + i * 4 + c]; } la.push(lum(A, o + i * 4)); lb.push(lum(B, o + i * 4)); ra += hi.material[1][o + i * 4 + 2]; rb += lo.material[0][o + i * 4 + 2]; }
  const da = Math.max(...ma.map((v, c) => Math.abs(v - mb[c]) / n));
  const mla = la.reduce((p, q) => p + q, 0) / n, mlb = lb.reduce((p, q) => p + q, 0) / n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (la[i] - mla) * (lb[i] - mlb); saa += (la[i] - mla) ** 2; sbb += (lb[i] - mlb) ** 2; }
  const r = sab / Math.sqrt(saa * sbb + 1e-9);
  // the palette: the 64's level 0 stays inside the 32's colour range (per channel, a few levels of rounding)
  const A0 = hi.albedo[0], o0 = l * 64 * 64 * 4; let out = 0;
  const lo3 = [255, 255, 255], hi3 = [0, 0, 0]; for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { lo3[c] = Math.min(lo3[c], B[o + i * 4 + c]); hi3[c] = Math.max(hi3[c], B[o + i * 4 + c]); }
  for (let i = 0; i < 64 * 64; i++) for (let c = 0; c < 3; c++) { const v = A0[o0 + i * 4 + c]; if (v < lo3[c] - 6 || v > hi3[c] + 6) { out++; break; } }
  rows.push({ name: names[l], da, r, dr: Math.abs(ra - rb) / n / 255, out: out / (64 * 64) });
}
for (const q of rows) console.log(`     ${q.name.padEnd(20)} mean Δ ${q.da.toFixed(1)} · structure r ${q.r.toFixed(2)} · roughness Δ ${q.dr.toFixed(3)} · outside the palette ${(q.out * 100).toFixed(1)} %`);
check(rows.every((q) => q.da <= 3), 'the mean colour within 3 levels of the 32 × 32 one', 'worst ' + Math.max(...rows.map((q) => q.da)).toFixed(1));
check(rows.every((q) => q.out <= 0.02), 'the same palette (≤ 2 % of the texels outside the 32 × 32 one\'s range)', 'worst ' + (Math.max(...rows.map((q) => q.out)) * 100).toFixed(1) + ' %');
const rs = rows.map((q) => q.r).sort((a, b) => a - b);
check(rs[0] >= 0.55 && rs[rs.length >> 1] >= 0.85, 'the same structure: joints, seams, grooves and bands where they were (the 64\'s level 1 against the 32: r ≥ 0.55, median ≥ 0.85)', `lowest ${rs[0].toFixed(2)}, median ${rs[rs.length >> 1].toFixed(2)}`);
check(rows.every((q) => q.dr <= 0.02), 'the same roughness (the gloss of PBR-lite reads it)');
// a hero that a cut-out model uses too (the planks): solid everywhere at 64 as at 32, so the cut-out depth prepass
// (zPre, the 32 × 32 alpha) and the colour pass (the hero) keep the same texels
{ const holes = names.filter((n, l) => mk.cut[R.texIndex[n]] && hi.albedo[0].subarray(l * 4096 * 4, (l + 1) * 4096 * 4).some((v, i) => (i & 3) === 3 && v < 255)); check(holes.length === 0, 'a hero on a cut-out model has no holes (its alpha the same as the 32 × 32 one\'s)', holes.join(' ') || 'none'); }
// finer: the 64's level 0 has more texel-to-texel detail than the 32 upscaled (its own fine grain)
let fine = 0; for (let l = 0; l < 16; l++) { const A0 = hi.albedo[0], o0 = l * 4096 * 4, B = lo.albedo[0], o = l * 1024 * 4; let dh = 0, dl = 0; for (let y = 0; y < 64; y++) for (let x = 0; x < 63; x++) dh += Math.abs(lum(A0, o0 + (y * 64 + x) * 4) - lum(A0, o0 + (y * 64 + x + 1) * 4)); for (let y = 0; y < 32; y++) for (let x = 0; x < 31; x++) dl += Math.abs(lum(B, o + (y * 32 + x) * 4) - lum(B, o + (y * 32 + x + 1) * 4)) / 2; if (dh / (64 * 63) > dl / (32 * 31) * 1.05) fine++; }
check(fine >= 12, 'up close it is finer: neighbouring texels differ more than in the 32 × 32 one doubled', `${fine} of 16`);
const bytes = HI.bytes(16);
console.log(`     the forge: ${ms} ms here (${hi.ms} ms its own count) · on the GPU ${(bytes / 1048576).toFixed(2)} MB (albedo + material, 7 levels)`);
check(bytes < 1.2 * 1048576, 'the set takes under 1.2 MB of graphics memory', (bytes / 1048576).toFixed(2) + ' MB');

console.log('c · the 32 × 32 textures as before');
{
  const ref = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'tex_ref.json'), 'utf8'));
  const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  // (the reference is v0.39's Nahtlos build: without F2's family relief — tex_mat.js — as classic_v2.js builds it)
  const lo0 = V.buildTextureArrays({ names, ids: idx, cubeMask: pick(mk.cube), cutoutMask: pick(mk.cut), bevel: 1, bevelAll: false, relief: false });
  const bad = [];
  names.forEach((n, l) => {
    if (!ref[n]) return;
    let h = 2166136261 >>> 0;
    lo0.albedo.forEach((a, lv) => { const k = lo0.size >> lv; h = fnv(h, a.subarray(l * k * k * 4, (l + 1) * k * k * 4)); });
    lo0.material.forEach((a, lv) => { const k = lo0.size >> lv; h = fnv(h, a.subarray(l * k * k * 4, (l + 1) * k * k * 4)); });
    if (h.toString(16) !== ref[n]) bad.push(n);
  });
  const pinned = names.filter((n) => ref[n]).length;
  check(pinned >= 10 && bad.length === 0, 'the heroes\' 32 × 32 layers are the pinned ones (tex_ref.json)', `${pinned} pinned${bad.length ? ', changed: ' + bad.join(' ') : ''}`);
}

console.log('d · the texture cache');
{
  V.TEX_SRC_HASH = 'test';
  require('../src/main/tex_cache.js');
  const C = V.TexCache, kh = C.key({ hi: 1, bevel: 1 }), ks = C.key({ bevel: 1, bevelAll: false });
  check(!!kh && kh.id !== ks.id && kh.size === 64 && kh.levels === 7 && kh.layers === 16 && kh.text.includes('"hi"') && names.every((n) => kh.text.includes(n)), 'its own slot and key (size 64, 7 levels, the names)', kh && kh.id);
  const rec = { id: kh.id, text: kh.text, levels: hi.levels, size: hi.size, layers: hi.layers, albedo: hi.albedo, material: hi.material, avgColor: hi.avgColor, missing: hi.missing, names: hi.names };
  const back = C.unpack(rec, kh);
  check(!!back && back.type === 'texhi' && back.size === 64 && back.names.length === 16, 'a record written for the key is read back');
  check(C.unpack(Object.assign({}, rec, { size: 32 }), kh) === null && C.unpack(Object.assign({}, rec, { text: ks.text }), kh) === null && C.unpack(rec, ks) === null, 'another size, another key or the look\'s slot: a miss');
}

console.log('e · the switch, the presets, the shader');
{
  global.self = global; require('../src/shared/water_wave.js'); require('../src/main/water_fx.js'); require('../src/main/shaders.js');
  require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js'); require('../src/main/settings_reg.js');
  require('../src/main/bench.js'); require('../src/main/ultralite.js'); require('../src/main/ipu.js'); require('../src/main/game.js');
  const it = V.Settings.byKey('texHi'), I = V.I18N;
  check(!!it && it.t === 'switch' && it.cost === 'mid', 'the Detail-Texturen switch is in the settings (cost 🟡)', it && JSON.stringify({ t: it.t, sec: it.sec, cost: it.cost }));
  for (const lang of ['de', 'en']) { const d = I.dict[lang] || {}; check(typeof d[it.lab] === 'string' && typeof d[it.tip] === 'string' && d[it.tip].length > 40, `its texts in ${lang}`, d[it.lab]); }
  const P = V.Game.PRESETS, tiers = ['potato', 'low', 'balanced', 'high', 'ultra'].map((p) => P[p].texHi);
  check(JSON.stringify(tiers) === '[false,false,true,true,true]', 'the presets: Balanced, High, Ultra (not Very Low, not Low)', JSON.stringify(tiers));
  const fs1 = V.SHADERS.TERRAIN_FS;
  check(/#ifdef TEXHI[\s\S]*uniform sampler2DArray u_albedoHi;[\s\S]*uniform sampler2D u_hiMap;/.test(fs1) && /hiOn = hiK > 0 && u_blockVar < 0\.5/.test(fs1), 'the terrain shader reads the set only with TEXHI, never in the Klassisch look');
  const rsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'renderer.js'), 'utf8');
  check(/const th = this\.q\.texHi && !this\.q\.lite \? \['TEXHI'\] : \[\]/.test(rsrc), 'the define only when the switch is on and never on the lite look (Very Low)');
  const dist = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(dist)) { const h = fs.readFileSync(dist, 'utf8'); const w = /<script type="text\/js-worker" id="worker-src">([\s\S]*?)<\/script>/.exec(h); check(!!w && w[1].includes('VR.TEX_MODS = function (VR) {') && w[1].includes("m.type === 'texhi'"), 'the worker bundle keeps the texture modules as VR.TEX_MODS and answers \'texhi\''); }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

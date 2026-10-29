// f-stipple2 · review R52-05: walking still showed screen-door on the grass 3–10 m ahead and flat untextured slabs 2–15 m
// ahead. The sources and their fixes (src/shared/stream.js, far.js, world.js, farring.js, renderer.js, shaders.js LOD_FS):
//   (a) the far tiles' cut: a column the chunks draw WHOLE is never drawn by a far tile (the bilinear soft edge — a dither
//       over half a column next to any column not in the visible list, culled or unshown — only while a column fades)
//   (b) the fade needs frames: where the frames come slower than SOFT_GAP_MS apart (a slow PC, a stall) the TSR has no
//       history to resolve the turning dither — things pop whole there, and a running fade completes at once
//   (c) far out the fade is shorter (FAR_FADE_MS beyond FAR_FADE_COLS chunks, the far forms too): fewer frames of grain
//   (d) a stand-in far tile up close wears a texel grain (16 a block), so the near field is never a flat slab
//   (e) Very Low's programs untouched (test/vl_programs.js): all of it behind SOFTFADE; the texture-energy measure
//       (test/tex_energy.js) is calibrated here
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const V = require('./load_shared.js');
global.window = global.window || {}; global.performance = global.performance || { now: () => Date.now() };
const VR = global.VR || V, S = VR.Stream, F = VR.Far;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };

console.log('(a) the far tiles\' cut: a whole column is the chunks\' alone');
check(typeof F.drawsSoft === 'function' && typeof S.lodCoverSoft === 'function', 'Far.drawsSoft and Stream.lodCoverSoft exist');
if (typeof F.drawsSoft === 'function') {
  let holes = 0, cases = 0, doubles = 0, settled = 0, shownTile = 0;
  const vals = [0, 0.25, 0.5, 0.75, 1];
  for (const nR of vals) for (const bR of vals) for (const nG of vals) for (const bG of vals) for (let k = 0; k < 16; k++) {
    const t = F.bayerLevels[k], d = F.drawsSoft(t, nR, bR, nG, bG); cases++;
    if (!d.r0 && !d.r1 && !d.r2) holes++;
    if ((nR === 0 || nR === 1) && (nG === 0 || nG === 1)) { settled++; if ((d.r0 ? 1 : 0) + (d.r1 ? 1 : 0) + (d.r2 ? 1 : 0) !== 1) doubles++; }
    if (nR === 1 && (d.r1 || d.r2)) shownTile++;
  }
  check(holes === 0, 'no threshold of any fade combination is left undrawn', cases + ' cases');
  check(doubles === 0 && settled > 0, 'a settled column is drawn by exactly one ring, whatever its neighbours (the bilinear read)', settled + ' cases');
  check(shownTile === 0, 'a whole column (nearest fade 1) never draws a far tile over it');
  let old = 0; for (const bR of [0.25, 0.5, 0.75]) for (let k = 0; k < 16; k++) if (F.draws(F.bayerLevels[k], 1, bR, 0, 0).r2) old++;
  check(old > 0, '… where the old rule dithered one in beside a culled neighbour', old + ' of 48 thresholds');
  const m = F.drawsSoft(0.3, 0.5, 0.5, 1, 1), m2 = F.drawsSoft(0.7, 0.5, 0.5, 1, 1);
  check(m.r0 && !m.r1 && !m2.r0 && m2.r1, 'a fading column still hands over by its thresholds');
  check(S.lodCoverSoft(1, 0.3) === 1 && S.lodCoverSoft(0.6, 0.3) === 0.3 && S.lodCoverSoft(0, 0.8) === 0, 'lodCoverSoft: 1 on a whole column, else min(bilinear, nearest)');
}

console.log('(b) the fade needs frames');
check(typeof S.softOk === 'function' && S.SOFT_GAP_MS > 33 && S.SOFT_GAP_MS <= 70, 'Stream.softOk, SOFT_GAP_MS ' + S.SOFT_GAP_MS);
if (typeof S.softOk === 'function') check(S.softOk(16.7) && S.softOk(33) && !S.softOk(120) && !S.softOk(500), 'soft at 30–60 fps, pop at 8 fps and in a stall');
const rd = fs.readFileSync(path.join(ROOT, 'src/main/renderer.js'), 'utf8');
check(/this\.fadeSoft = [^;]*softOk\(/.test(rd), 'renderer: fadeSoft asks softOk with the drawn frames\' gap');
const Wp = (() => { try { require(path.join(ROOT, 'src/main/world.js')); require(path.join(ROOT, 'src/main/farring.js')); } catch (e) { check(false, 'world.js/farring.js load', e.message); } return VR.World && VR.World.prototype; })();
if (Wp) {
  const mk = (cx, cz) => ({ cx, cz, shownAt: -1, fade: 0, sec: [{ meshed: true }, { meshed: true }] });
  const r = { fadeSoft: true }, w = { fading: new Set(), lastPos: [8, 70, 8, 0], renderer: r };
  const c = mk(4, 0); Wp.checkShown.call(w, c, 1000);
  Wp.stepFades.call(w, 1050); const mid = c.fade;
  r.fadeSoft = false; Wp.stepFades.call(w, 1080);
  check(mid > 0 && mid < 1 && c.fade === 1 && c.sec[1].fade === 1 && !w.fading.size, 'world: a fade running when the frames slow down completes at once', mid.toFixed(2) + ' → ' + c.fade);
  const Fp = VR.FarRing.prototype, t = { fade: 0.2, shownAt: 1000 }, fr = { fading: [t], maskDirty: false, g: { renderer: { fadeSoft: false } } };
  Fp.stepFades.call(fr, 1020);
  check(t.fade === 1 && !fr.fading.length, 'farring: likewise a far form');
}

console.log('(c) far out the fade is shorter');
check(typeof S.fadeMs === 'function' && S.FAR_FADE_COLS >= 4 && S.FAR_FADE_MS < S.FADE_MS, 'Stream.fadeMs, FAR_FADE_COLS ' + S.FAR_FADE_COLS + ', FAR_FADE_MS ' + S.FAR_FADE_MS);
if (typeof S.fadeMs === 'function' && Wp) {
  check(S.fadeMs(3) === S.FADE_MS && S.fadeMs(S.FAR_FADE_COLS + 1) === S.FAR_FADE_MS, 'fadeMs: 300 near, shorter beyond');
  const p = S.fadePlan(S.FAR_FADE_COLS + 2, 0, true); check(p.fade === 0 && p.ms === S.FAR_FADE_MS, 'fadePlan carries the duration', JSON.stringify(p));
  const w = { fading: new Set(), lastPos: [8, 70, 8, 0], renderer: { fadeSoft: true } }, c = { cx: S.FAR_FADE_COLS + 2, cz: 0, shownAt: -1, fade: 0, sec: [{ meshed: true }] };
  Wp.checkShown.call(w, c, 1000); Wp.stepFades.call(w, 1000 + S.FAR_FADE_MS);
  check(c.fade === 1 && !w.fading.size, 'world: a far column is whole after FAR_FADE_MS');
  const t = { fade: 0, shownAt: 1000 }, fr = { fading: [t], maskDirty: false, g: { renderer: { fadeSoft: true } } };
  VR.FarRing.prototype.stepFades.call(fr, 1000 + S.FAR_FADE_MS);
  check(t.fade === 1, 'farring: a far form likewise');
}

console.log('(f) the texture detail where nothing resolves the jitter');
check(typeof S.mipK === 'function', 'Stream.mipK');
if (typeof S.mipK === 'function') {
  check(Math.abs(S.mipK(true, true, 0.7, false) - Math.sqrt(0.7)) < 1e-9, 'the TSR resolving: the full-size image\'s detail (√scale, as before)');
  check(S.mipK(false, true, 1, false) === S.MIP_CALM && S.mipK(true, false, 0.7, false) === S.MIP_CALM && S.MIP_CALM > 1.3 && S.MIP_CALM < 1.5, 'no TSR, or frames too far apart: half a mip coarser (√2)');
  check(S.mipK(false, false, 0.55, true) === 1 && S.mipK(true, true, 0.55, true) === 1, 'Very Low (lite): its natural mips, as before');
}
check((rd.match(/u_mipScale, VR\.Stream\.mipK\(/g) || []).length === 2, 'renderer: both terrain passes (the depth pre-pass and the colour) take Stream.mipK');

console.log('(d)(e) the shaders');
{
  const sh = fs.readFileSync(path.join(ROOT, 'src/main/shaders.js'), 'utf8');
  const lod = sh.slice(sh.indexOf('S.LOD_FS'), sh.indexOf('S.VOX_VS'));
  check(/#ifdef SOFTFADE[\s\S]{0,200}cutN\(nR, bR\)/.test(lod) && /cutN\(nG, bG\)/.test(lod) && /cutN\(nC, bC\)/.test(lod), 'LOD_FS: the soft path cuts a whole column hard (cutN), ring 0, 1 and 2');
  check(/float cutN\(float n, float b\)\{ return n > 0\.998 \? 1\.0 : min\(n, b\); \}/.test(sh), 'cutN: the same rule as Stream.lodCoverSoft');
  check(/#ifdef SOFTFADE[\s\S]{0,400}texelGrain/.test(lod), 'LOD_FS: a texel grain on the stand-in tiles up close (SOFTFADE only)');
  check((lod.match(/#ifdef SOFTFADE\n(  \/\/[^\n]*\n)?  if \(u_lodNear > 8\.0 && dot\(v_rel, v_rel\) < u_lodNear \* u_lodNear\) discard;/g) || []).length === 2, 'LOD_FS soft path: no 4-m hole around the eye where nothing is drawn yet (both cuts)');
}
{
  const TE = require('./tex_energy.js'), W = 320, H = 180;
  let seed = 3; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const tex = new Float32Array(W * H), flat = new Float32Array(W * H), soft = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, blk = Math.floor(x / 12) + Math.floor(y / 12) * 97;   // 12-px blocks (a block ~10 m ahead at 480 px) of 16 texels
    tex[i] = 90 + rnd() * 40 + (blk % 3) * 6; flat[i] = 110 + (blk % 3) * 6; soft[i] = 100 + 20 * Math.sin(x / 9) * Math.sin(y / 7);
  }
  const eT = TE.energy(tex, W, H, 0, 0, W, H), eF = TE.energy(flat, W, H, 0, 0, W, H), eS = TE.energy(soft, W, H, 0, 0, W, H);
  check(eT >= TE.FLAT * 2, 'tex_energy: a grained ground reads textured', eT.toFixed(1));
  check(eF < TE.FLAT && eS < TE.FLAT, 'tex_energy: a flat slab with block shades and a soft gradient read flat', eF.toFixed(1) + ' / ' + eS.toFixed(1));
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

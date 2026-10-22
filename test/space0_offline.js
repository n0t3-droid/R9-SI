// u-space0 · a space view drawn without a browser (a tool for tuning the look between the browser runs). Node computes
// the frame the game draws — the bodies' textures (bodytex.js, as the worker makes them), the ephemeris, the view of
// /raum, the draw list with every uniform (VR.SpaceScene.frameSetup) and the GLSL of space_shaders.js with the
// renderer's preamble — into a folder; test/space0_offline.py draws it with Mesa's llvmpipe through EGL (headless
// OpenGL ES 3.2: no browser slot, ~2 s a picture) and tone-maps it as the composite does (exposure, the ACES/vivid
// curve, saturation, contrast, vignette, gamma; no bloom, no TSR).   regress: skip
//   node test/space0_offline.js <view> <day> <ticks> <tier> [x z yaw] [W H] [tag]
//   python3 test/space0_offline.py .tmp_tests/space0_off/<tag>  → <tag>.png in test/shots/
const V = require('./load_shared.js');
require('../src/shared/bodytex.js'); require('../src/main/space_shaders.js'); require('../src/main/spacescene.js');
const fs = require('fs'), path = require('path');
const BT = V.BodyTex, SS = V.SpaceScene, SH = V.SpaceShaders, mat4 = V.mat4;
const [view = 'herz', day = '2', ticks = '6000', tier = '0', x = '0', z = '0', yaw = '0', W = '960', H = '540', tagIn] = process.argv.slice(2);
const SEED = +(process.env.SEED || 424242), tag = tagIn || `${view}_${day}_${ticks}_t${tier}`;
const ROOT = path.join(__dirname, '..', '.tmp_tests', 'space0_off'), out = path.join(ROOT, tag), texDir = path.join(ROOT, `tex_${SEED}_${tier}`);
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(texDir, { recursive: true });
const g = new V.OverworldGen(SEED, { vgen: 11 }), gen = () => g;
const t = SS.worldTime(+day, +ticks), eph = SS.ephemeris(t, {});
const v = SS.view(view, eph, { x: +x, z: +z, yaw: +yaw });
if (!v) { console.log('no such view', view); process.exit(1); }
const anc = SS.anchor(v, eph);
// the textures (cached by seed, tier and the patch's centre)
const texInfo = {};
function make(body, extra, names, srgb, repeat) {
  const key = body + (extra ? `_${extra.cx}_${extra.cz}` : ''), meta = path.join(texDir, key + '.json');
  let m = null;
  if (fs.existsSync(meta)) m = JSON.parse(fs.readFileSync(meta, 'utf8'));
  else {
    const jobs = BT.jobs(body, +tier, extra), j0 = jobs[0], a = Buffer.alloc(j0.w * j0.h * 4), b = BT.TWO[body] ? Buffer.alloc(j0.w * j0.h * 4) : null;
    let ms = 0;
    for (const j of jobs) { j.seed = SEED; const r = BT.job(j, gen); a.set(r.a, j.y0 * j.w * 4); if (b) b.set(r.b, j.y0 * j.w * 4); ms += r.ms; }
    fs.writeFileSync(path.join(texDir, key + '_a.bin'), a); if (b) fs.writeFileSync(path.join(texDir, key + '_b.bin'), b);
    m = { w: j0.w, h: j0.h, ms: +ms.toFixed(0), two: !!b };
    fs.writeFileSync(meta, JSON.stringify(m));
    console.log(`  ${key}: ${m.w}×${m.h} in ${m.ms} ms`);
  }
  texInfo[names[0]] = { file: path.join(texDir, key + '_a.bin'), w: m.w, h: m.h, srgb, repeat };
  if (m.two) texInfo[names[1]] = { file: path.join(texDir, key + '_b.bin'), w: m.w, h: m.h, srgb: false, repeat };
}
make('herz', null, ['herzA', 'herzB'], true, true);
make('amarant', null, ['amarant'], true, true);
make('ring', null, ['ring'], true, false);
for (const id of BT.MOONS) make(id, null, [id], true, true);
let patch = null;
if (anc.nadir) {
  const cx = Math.round(anc.nadir.x / 500) * 500, cz = Math.round(anc.nadir.z / 500) * 500, sz = BT.size('patch', +tier);
  make('patch', { cx, cz }, ['patchA', 'patchB'], true, false);
  patch = { x0: cx - sz[0] * sz[1] / 2, z0: cz - sz[0] * sz[1] / 2, size: sz[0] * sz[1], step: sz[1], on: true };
}
const fr = SS.frameSetup({ anc }, eph, { H: +H, tier: +tier, bloom: false, patch });
// the camera of a space frame: at the session frame's origin, yaw = pitch = 0 (renderer.setupCamera, no jitter)
const proj = mat4.create(), view0 = mat4.create(), vp = mat4.create(), inv = mat4.create();
mat4.perspective(proj, fr.fov, +W / +H, 0.06, 100);
mat4.lookAt(view0, 0, 0, 0, 0, 0, -1, 0, 1, 0);
mat4.mul(vp, proj, view0); mat4.invert(inv, vp);
const P = SH.programs(), progs = {};
const FS_PRE = '#version 300 es\n#define FRAG 1\nprecision highp float;\nprecision highp int;\nprecision highp sampler2DArray;\nprecision highp sampler2D;\n';
for (const k in P) progs[k] = { vs: '#version 300 es\n' + P[k].vs, fs: FS_PRE + P[k].fs };
const look = Object.assign({}, fr.look, { saturation: 1.12, contrast: 0.05, vignette: 0.3, vivid: 0.45 });
fs.writeFileSync(path.join(out, 'frame.json'), JSON.stringify({ W: +W, H: +H, tag, view, t, look, viewProj: Array.from(vp), invViewProj: Array.from(inv), textures: texInfo, programs: progs, draws: fr.draws, sunVis: fr.sunVis, bodies: fr.bodies }, null, 0));
console.log(`${tag}: ${fr.draws.length} draws (${fr.draws.map(d => d.prog + (d.full ? '*' : '')).join(' ')}), exposure ${look.exposure.toFixed(2)}, sun visible ${fr.sunVis.toFixed(2)} → ${out}`);

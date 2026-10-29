// f-stipple · R50-12: on Very Low a street lamp 4 m away drew as a black box. A section's re-mesh (a light change, a
// neighbour, the detail coming back) committed its new terrain and dropped the resident mini-voxel detail (mesh[3]);
// until the detail went up again through the upload queue — seconds on Very Low's 1.5 ms budget while the world
// streams — splitVx drew the section's far boxes (the lamp's averaged box) right in front of the eyes.
// Pinned here on the renderer's own methods (no GL: a fake arena and queue):
//   (1) a section near the camera with its detail resident draws near (the near/far choice on Very Low, vxLod 12)
//   (2) a re-mesh with new detail keeps drawing the old detail (near), and asks for the new one at once
//   (3) the new detail's upload swaps it in and gives the old range back
//   (4) a re-mesh without detail (the pieces are gone) gives the old detail back at once (nothing stale stays)
//   (5) beyond the keep band the stale detail is dropped like any other
//   (6) the plain (unstaged) upload path keeps the old detail too
const path = require('path');
const ROOT = path.join(__dirname, '..');
const V = require('./load_shared.js');
global.window = global.window || {}; global.performance = global.performance || { now: () => Date.now() };
for (const f of ['gl', 'shaders', 'renderer']) require(path.join(ROOT, 'src/main', f + '.js'));
const VR = global.VR || V;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };

const released = [];
const arena = { buf: {}, release: (off, cap) => released.push(off) };
let nextOff = 100;
const mesh = (n) => ({ arena, off: nextOff++, cap: n, count: n });
const R = Object.create(VR.Renderer.prototype);
Object.assign(R, {
  q: { vxLod: 12 }, gl: { ARRAY_BUFFER: 0, bindBuffer() {}, bufferSubData() {} },
  propSet() {}, transWaterOf: () => false, transGlassOf: () => false, nearShadow() {}, allocMesh: (n) => mesh(n), visDirty: false,
});
const Q = []; R.upQ = { push: (it) => Q.push(it) };
const data = (n) => new Float32Array(n * 8);
// the hall's lamp: its section (cx −61, sy 4, cz −19), the eye 6 blocks off (the bench's pose)
const col = { cx: -61, cz: -19 }, sy = 4;
const sec = () => { const old = data(40); return { mesh: [mesh(10), null, null, mesh(40), mesh(4)], vxData: old, ox: col.cx * 16, oy: sy * 16, oz: col.cz * 16, hasMesh: true, fade: 1 }; };
const cam = [col.cx * 16 + 2, sy * 16 + 13.6, col.cz * 16 + 14];
const pick = (s) => { const r = R.splitVx([s], cam); return r.near.includes(s) ? 'near' : r.far.includes(s) ? 'far' : 'none'; };
const stage = (vx) => { const st = R.newStage(data(12), null, null, vx, data(4), null); st.m = [mesh(12), null, null, null, mesh(4)]; return st; };

// (1)
const s = sec(), oldNear = s.mesh[3];
check(pick(s) === 'near', '(1) Very Low (vxLod 12): the lamp\'s section, its detail resident, draws near', pick(s));
// (2)
const vxNew = data(44);
R.commitStage(stage(vxNew), s, col, sy);
check(s.vxData === vxNew, '(2) the re-mesh committed: the new detail waits in RAM');
check(pick(s) === 'near' && s.mesh[3] === oldNear, '(2) … and the section still draws its old detail, not the far boxes', pick(s));
R.vxResidency([s], cam);
check(Q.length === 1 && s.vxQ === Q[0], '(2) … and asks for the new detail at once', Q.length);
// (3)
const it = Q[0];
check(it.alive(), '(3) the queued upload is alive while the old detail draws');
it.step(1 << 20); it.commit();
check(s.mesh[3] && s.mesh[3] !== oldNear && s.mesh[3].count === 44, '(3) the upload swaps the new detail in');
check(released.includes(oldNear.off), '(3) … and gives the old range back');
check(pick(s) === 'near', '(3) near as before', pick(s));
// (4)
const s4 = sec(), old4 = s4.mesh[3];
R.commitStage(stage(null), s4, col, sy);
check(!s4.mesh[3] && released.includes(old4.off), '(4) a re-mesh without detail gives the old detail back at once');
check(pick(s4) === 'far', '(4) … and the far boxes draw', pick(s4));
// (5)
const s5 = sec(), old5 = s5.mesh[3];
R.commitStage(stage(data(30)), s5, col, sy);
const farCam = [cam[0] + 60, cam[1], cam[2]];
R.vxResidency([s5], farCam);
check(!s5.mesh[3] && released.includes(old5.off), '(5) beyond the keep band the stale detail is dropped');
// (6)
const s6 = sec(), old6 = s6.mesh[3];
R.uploadSection(s6, col, sy, data(12), null, null, data(50), data(4), null);
check(s6.mesh[3] === old6 && pick(s6) === 'near', '(6) the plain upload path keeps the old detail too', pick(s6));
const q0 = Q.length; R.vxResidency([s6], cam);
check(Q.length === q0 + 1, '(6) … and asks for the new one');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

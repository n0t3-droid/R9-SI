// ============================================================================
// t-sky3 · the GL side of the sky (plan docs/superpowers/plans/2026-10-16-t-sky3.md; the pure part: sky3.js). One method
// on VR.Renderer.prototype, called from one line in renderer.js common(): the sky's and the clouds' uniforms of this frame
// (sky3.js S3.frame fills them into E.sky3.u, env.js calls it) and the light in the billboards' frame (the camera's axes).
// A program without the sky's defines has none of these uniforms and the call does nothing.
// ============================================================================
(function (VR) {
  'use strict';
  const S3 = VR.Sky3;
  if (!S3 || !VR.Renderer) return;
  const R = VR.Renderer.prototype;
  const L3 = [0, 0, 0];
  R.s3Uniforms = function (p, E) {
    const u = p.u;
    if (!u.u_s3Warm && !u.u_c3Sun && !u.u_c3L) return;
    const o = E && E.sky3, gl = this.gl;
    if (!o || !o.u) return;
    const U = o.u;
    for (const k of S3.U4) { const loc = u[k]; if (loc) { const a = U[k]; gl.uniform4f(loc, a[0], a[1], a[2], a[3]); } }
    for (const k of S3.U3) { const loc = u[k]; if (loc) { const a = U[k]; gl.uniform3f(loc, a[0], a[1], a[2]); } }
    if (u.u_c3L) {
      // the light in the billboards' frame: x right, y up, z toward the eye (the sprites face the camera)
      const ld = U.u_c3Ld, c = this.cam || {};
      L3[0] = ld[0]; L3[1] = ld[1]; L3[2] = ld[2];
      const v = S3.billboardL(L3, c, this.s3L || (this.s3L = [0, 0, 0]));
      gl.uniform3f(u.u_c3L, v[0], v[1], v[2]);
    }
  };
})(VR);

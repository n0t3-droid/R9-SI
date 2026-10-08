// ============================================================================
// Sky bodies (t-clouds · TRAILER.md §2.1): where the ringed gas giant, the blue-green cratered planet and their moons hang
// in the sky at a time of day, and how big they are on the sky (angular radii, radians). env.js takes its planet
// directions from here; the sky shader (shaders.js skyColor) draws the discs from the uniforms renderer.js sets.
// The formulas are the ones env.js had (the giant circles the sky at ~33°, the ring is never seen face-on, the blue planet
// hangs higher on the other side); the moons ride along with the giant on its flanks. test/trailer_sky.js checks them.
// ============================================================================
(function (VR) {
  'use strict';
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // the angular radii (radians): the gas giant 7.0°, the blue-green planet 4.9°, four grey moons 1.2°–1.8°
  const RADIUS = { giant: 0.122, blue: 0.085, moon: [0.021, 0.0245, 0.028, 0.0315] };

  // th: the day's angle as env.js has it (tod × 2π: 0 = sunrise, π/2 = noon, π = sunset, 3π/2 = midnight)
  function at(th) {
    const pa = th * 0.5 + 0.55;
    const P = norm([Math.cos(pa) * 0.84, 0.55, Math.sin(pa) * 0.84]);
    // the ring: ~70° away from the line of sight, tilted diagonally, so the rings are always seen at a slant
    const upd = P[1];
    const Y = norm([-P[0] * upd, 1 - P[1] * upd, -P[2] * upd]);
    const X = norm(cross(Y, P));
    const c = Math.cos(0.45), sn = Math.sin(0.45);
    const Np = [Y[0] * c + X[0] * sn, Y[1] * c + X[1] * sn, Y[2] * c + X[2] * sn];
    const ring = norm([Np[0] * 0.94 - P[0] * 0.34, Np[1] * 0.94 - P[1] * 0.34, Np[2] * 0.94 - P[2] * 0.34]);
    const pb = th * 0.5 + 0.55 + 2.4;
    const B = norm([Math.cos(pb) * 0.62, 0.78, Math.sin(pb) * 0.62]);
    // the moons: three on the giant's flanks (two sides, one above and one below the ring plane), the fourth by the blue planet
    const up = Math.abs(P[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    const PX = norm(cross(up, P)), PY = cross(P, PX);
    const moons = [];
    for (let mi = 0; mi < 4; mi++) {
      let m;
      if (mi < 3) {
        const s = (0.34 + mi * 0.13) * (mi === 1 ? -1 : 1), t = 0.16 - mi * 0.14;
        m = norm([P[0] + PX[0] * s + PY[0] * t, P[1] + PX[1] * s + PY[1] * t, P[2] + PX[2] * s + PY[2] * t]);
      } else m = norm([B[0] + 0.26, B[1] - 0.12, B[2] + 0.1]);
      moons.push([m[0], m[1], m[2], RADIUS.moon[mi]]);
    }
    return { giant: P, ring, blue: B, moons, radius: { giant: RADIUS.giant, blue: RADIUS.blue } };
  }
  // the same by ticks (24000 per day; 0 = sunrise, 6000 = noon, 12000 = sunset, 18000 = midnight)
  function atTicks(ticks) { const t = ((ticks % 24000) + 24000) % 24000; return at(t / 24000 * Math.PI * 2); }

  VR.SkyBodies = { RADIUS, at, atTicks };
})(VR);

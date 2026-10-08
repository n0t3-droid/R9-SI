// ============================================================================
// The trailer's camera ride (t-cinema): the pure part, with no DOM and no world.
// Cubic Hermite tracks in time (tangents from Catmull-Rom, zero at the two ends of a
// shot, so every shot starts and ends at rest), the smootherstep easing, and the shot
// list: the trailer's cut (A–G from the first trailer, TRAILER.md §1 corrected by the
// stills in docs/trailer/frames) and the passages of the second and third cut that
// the game adds. The director (src/main/director.js) evaluates the tracks every frame
// into preallocated buffers: no allocation on the ride.
// Shot times are seconds from the shot's first frame. Camera keys: [t, px, py, pz,
// lx, ly, lz] (eye and the point it looks at). Ships: scripted flights through the
// traffic (arch, A → C → B bezier, dur seconds, t0 seconds into the shot); quiet ships
// hover (no arrival flash). Actors: the heroes (blaster in hand), each with a walk
// track [t, x, y, z] or a fixed place.
// ============================================================================
(function (VR) {
  'use strict';
  const Cine = VR.Cine = {};

  // smootherstep: 6u⁵ − 15u⁴ + 10u³ — zero speed and zero acceleration at both ends, monotone
  Cine.ease = function (u) { u = u <= 0 ? 0 : u >= 1 ? 1 : u; return u * u * u * (u * (u * 6 - 15) + 10); };
  // its derivative (for the tests): 30u²(1−u)²
  Cine.easeD = function (u) { u = u <= 0 ? 0 : u >= 1 ? 1 : u; return 30 * u * u * (1 - u) * (1 - u); };

  // A track through keys [[t, x, y, z], …] (ascending t). Each segment is a cubic Hermite; the tangent at an inner
  // key is the Catmull-Rom tangent in time, (p[i+1] − p[i−1]) / (t[i+1] − t[i−1]), so position and velocity are
  // continuous (C1) across the keys; the first and last tangents are zero (the shot starts and ends at rest).
  // eval(t, out) writes x, y, z into `out` and returns it: no allocation.
  class Track {
    constructor(keys) {
      const n = this.n = keys.length;
      this.t = new Float64Array(n); this.p = new Float64Array(n * 3); this.m = new Float64Array(n * 3);
      for (let i = 0; i < n; i++) { this.t[i] = keys[i][0]; for (let k = 0; k < 3; k++) this.p[i * 3 + k] = keys[i][k + 1]; }
      for (let i = 1; i < n - 1; i++) { const h = this.t[i + 1] - this.t[i - 1]; for (let k = 0; k < 3; k++) this.m[i * 3 + k] = (this.p[(i + 1) * 3 + k] - this.p[(i - 1) * 3 + k]) / h; }
      this.dur = n > 1 ? this.t[n - 1] - this.t[0] : 0;
    }
    eval(t, out) {
      const n = this.n, T = this.t, P = this.p, Mt = this.m;
      if (t <= T[0]) { out[0] = P[0]; out[1] = P[1]; out[2] = P[2]; return out; }
      if (t >= T[n - 1]) { const j = (n - 1) * 3; out[0] = P[j]; out[1] = P[j + 1]; out[2] = P[j + 2]; return out; }
      let i = 0; while (i < n - 2 && t > T[i + 1]) i++;
      const h = T[i + 1] - T[i], s = (t - T[i]) / h, s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      const a = i * 3, b = (i + 1) * 3;
      for (let k = 0; k < 3; k++) out[k] = h00 * P[a + k] + h10 * h * Mt[a + k] + h01 * P[b + k] + h11 * h * Mt[b + k];
      return out;
    }
  }
  Cine.Track = Track;

  // the camera track of a shot (cam keys → a position track and a look track)
  Cine.camTracks = function (shot) {
    const K = shot.cam || [];
    return { pos: new Track(K.map((k) => [k[0], k[1], k[2], k[3]])), look: new Track(K.map((k) => [k[0], k[4], k[5], k[6]])) };
  };

  // the trailer, shot by shot. Durations are the first trailer's (TRAILER.md §1, the stills: A 0–2.75 s, B 3–5.75 s,
  // C 6–8.75 s, D 9.25–11 s, E 11.25–19 s, F 19.25–26.5 s, G 26.5–30 s) with the title cards around them; the second
  // and third cut add the passages A2, D2, F2, F3 and G2 (trailer 3 at 1–10 s, trailer 2 at 14–28 s).
  const SH = [
    // ---- title card: the world loads behind the black frame; the cut waits for the first shot's chunks
    { id: 'title', kind: 'title', dur: 2.6, caption: 'R9-SI' },
    // ---- A · Ember Canyon: a push forward over the mesas, lava river, rails and crystals; a shuttle banks across
    { id: 'A', name: 'Ember Canyon', dur: 2.8, fov: 72, tod: 11400,
      cam: [[0, 62, 160, 470, 8, 112, 300], [2.8, 34, 142, 336, -8, 98, 214]],
      ships: [
        { arch: 'shuttle', A: [-46, 182, 420], C: [30, 176, 330], B: [150, 160, 230], dur: 5.5, t0: 0 },
        { arch: 'interceptor', A: [-120, 196, 470], C: [-10, 190, 380], B: [120, 170, 250], dur: 6, t0: 0.5, off: [-9, -2, 12] }] },
    // ---- B · The Spire Citadel: a pull-back from the tan spires; fighters with contrails cross in front of them
    { id: 'B', name: 'The Spire Citadel', dur: 2.75, fov: 70, tod: 11700,
      cam: [[0, -392, 118, 438, -420, 205, 380], [2.75, -318, 186, 528, -420, 196, 372]],
      ships: [
        { arch: 'gunship', A: [-560, 232, 520], C: [-450, 236, 470], B: [-300, 246, 380], dur: 5, t0: 0.4 },
        { arch: 'interceptor', A: [-560, 236, 470], C: [-440, 250, 420], B: [-300, 226, 350], dur: 4.5, t0: 0.2, off: [-8, -3, 10] }] },
    // ---- C · Sky Isles: the follow-cam behind the shuttle, over the islands, its trails blue-white
    { id: 'C', name: 'Sky Isles', dur: 2.75, fov: 76, tod: 12000,
      cam: [[0, 150, 196, 290, 170, 183, 280], [2.75, 220, 190, 240, 260, 176, 210]],
      follow: { ship: 0, back: 15, up: 6, ahead: 24, drop: 6 },
      ships: [{ arch: 'shuttle', A: [150, 186, 300], C: [300, 176, 170], B: [470, 168, -10], dur: 7, t0: 0 }] },
    // ---- D · Gate Temple: the shuttle skims the plaza and goes into the octagonal portal
    { id: 'D', name: 'The Gate Temple', dur: 1.75, fov: 74, tod: 12000,
      cam: [[0, 40, 94, 112, 0, 92, 20], [1.75, 12, 92, 80, 0, 90, 20]],
      ships: [{ arch: 'shuttle', A: [72, 96, 132], C: [26, 92, 64], B: [0, 88, 18], dur: 2.4, t0: 0.15 }] },
    // ---- E · Hangar Hall: a dolly down the hall past the consoles; the shuttle hovers on the pad; two heroes at the consoles
    { id: 'E', name: 'Hangar Hall', dur: 8.5, fov: 72, tod: 12300,
      cam: [[0, 0, 83.2, 16, 0, 83.4, -8], [4.25, 0, 83.2, 3, 0, 83.6, -12], [8.5, 0, 83.2, -3, 0, 84, -14]],
      ships: [{ arch: 'shuttle', A: [0, 84.5, -6], C: [0, 84.5, -8], B: [0, 84.5, -10], dur: 60, t0: 0, quiet: true }],
      actors: [
        { look: { suit: 0, hair: 1, hs: 0, skin: 0, tool: 'blaster' }, pos: [-4.2, 81, 5.5], yaw: Math.PI - 0.3, aim: true },
        { look: { suit: 0, hair: 3, hs: 1, skin: 1, tool: 'blaster' }, pos: [4.2, 81, 5.5], yaw: Math.PI + 0.3, aim: true }] },
    // ---- F · Nova Haven: the heroes walk out of the back door into the palm city; the camera follows the avenue
    { id: 'F', name: 'Nova Haven', dur: 7.5, fov: 74, tod: 12700,
      cam: [[0, 0, 82.8, -44, 0, 83.2, -110], [3.4, -4, 83.4, -72, -26, 86, -128], [7.5, -16, 92, -112, -48, 96, -170]],
      actors: [
        { look: { suit: 0, hair: 1, hs: 0, skin: 0, tool: 'blaster' }, pos: [-1.2, 81, -48], yaw: 0, walk: [[0, -1.2, 81, -48], [7.5, -1.2, 81, -70]] },
        { look: { suit: 0, hair: 3, hs: 1, skin: 1, tool: 'blaster' }, pos: [1.2, 81, -48], yaw: 0, walk: [[0, 1.2, 81, -48], [7.5, 1.2, 81, -70]] }] },
    // ---- G · the white interior: glass walls, floating glass stairs, a cyan pad (placed at the palm city's glass villa)
    { id: 'G', name: 'White House', dur: 3.5, fov: 70, tod: 12700,
      cam: [[0, -60, 84.6, -150, -60, 84.4, -180], [3.5, -66, 84.6, -160, -60, 84.6, -190]] },
    // ---- the second cut: A2 (trailer 3, the canyon low over the spires), D2 (the plaza from behind the shuttle)
    { id: 'A2', name: 'Canyon, low', dur: 2.5, fov: 70, tod: 11500,
      cam: [[0, -70, 118, 430, -40, 128, 330], [2.5, -30, 112, 380, -60, 126, 280]],
      ships: [{ arch: 'shuttle', A: [-160, 150, 300], C: [-60, 170, 330], B: [60, 176, 360], dur: 3.5, t0: 0 }] },
    { id: 'D2', name: 'The plaza', dur: 2.5, fov: 72, tod: 12000,
      cam: [[0, 0, 86, 122, 0, 88, 40], [2.5, 0, 86, 100, 0, 88, 30]],
      ships: [{ arch: 'shuttle', A: [0, 84, 110], C: [0, 84, 70], B: [0, 84, 30], dur: 2.4, t0: 0.1 }] },
    // ---- F2 (trailer 2): the heroes along the cyan-lined street with a villager; F3 (trailer 3): the terraced hills
    { id: 'F2', name: 'Along the street', dur: 5, fov: 74, tod: 12700,
      cam: [[0, -10, 84, -118, -4, 84, -150], [5, -18, 86, -160, -20, 85, -192]],
      actors: [
        { look: { suit: 0, hair: 1, hs: 0, skin: 0, tool: 'blaster' }, pos: [-1.2, 81, -132], yaw: 0, walk: [[0, -1.2, 81, -132], [5, -1.2, 81, -150]] },
        { look: { suit: 0, hair: 3, hs: 1, skin: 1, tool: 'blaster' }, pos: [1.2, 81, -132], yaw: 0, walk: [[0, 1.2, 81, -132], [5, 1.2, 81, -150]] }] },
    { id: 'F3', name: 'The terraces', dur: 5.5, fov: 74, tod: 12800,
      cam: [[0, -8, 92, -140, -60, 95, -178], [5.5, -30, 104, -212, -70, 104, -256]] },
    // ---- G2 (trailers 2 and 3): the white house from the glass hall to the stairs
    { id: 'G2', name: 'Glass stairs', dur: 3.5, fov: 70, tod: 12700,
      cam: [[0, -60, 84.6, -150, -60, 84.4, -180], [3.5, -64, 84.6, -158, -62, 84.6, -186]] },
    { id: 'end', kind: 'title', dur: 2.6, caption: 'R9-SI' },
  ];
  // the shot list, with the camera tracks built once
  Cine.SHOTS = SH;
  for (const s of SH) if (s.cam) { const tr = Cine.camTracks(s); s.posTrack = tr.pos; s.lookTrack = tr.look; }
  Cine.total = function () { let t = 0; for (const s of SH) t += s.dur; return t; };
  // the first real shot after shot i (the title cards preload its area)
  Cine.nextReal = function (i) { for (let k = i + 1; k < SH.length; k++) if (SH[k].kind !== 'title') return k; return -1; };
  // the start second of every shot
  Cine.starts = function () { const out = []; let t = 0; for (const s of SH) { out.push(t); t += s.dur; } return out; };
  // a 'reveal' (game.js): one shot with keys [t, [x,y,z], [lx,ly,lz]] — converted to the flat cam keys
  Cine.fromKeys = function (keys) { return keys.map((k) => [k[0], k[1][0], k[1][1], k[1][2], k[2][0], k[2][1], k[2][2]]); };
})(VR);

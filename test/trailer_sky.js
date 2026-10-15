// Trailer sky and clouds (t-clouds, TRAILER.md §2.1), in node: the cloud field (src/main/clouds.js) and the sky bodies
// (src/main/skybodies.js). Checks:
//  - the cumulus field is deterministic and its cover is what the sky asks for (about 0.2 in clear weather; none at 0;
//    most cells at the overcast end); every cumulus sprite stays above y 190 at its base (no clouds below 190 except the
//    fog band); the sprites are the same on every call
//  - t-sky2: in clear weather one cumulus cell in twelve at most, the clouds smaller, the high ones thin by day; the box
//    clouds (Low, Very Low) as sparse, and by day their runs high in the view fade out fully (not drawn)
//  - the fog banks lie under the Sky Isles (y 104–114, within 300 blocks of their centre); the citadel has its cloud
//    anchors round the spires at y 207–212 (the spire tip is at 252)
//  - the sprite atlas: full density at the centre, empty corners, the lobes' normals point out of the cloud
//  - the sky bodies: the gas giant at 33° elevation all day (the planets never set), its ring never face-on (60°–85° from
//    the line of sight), the blue planet higher at 52°, the radii 7.0° / 4.9° / 1.2°–1.8°, the moons 8°–35° from the giant,
//    and the same directions as env.js had them (no change in the planets' places)
// usage: node test/trailer_sky.js (the browser shots are test/trailer_sky.mjs)
globalThis.VR = globalThis.VR || {};
require('../src/main/skybodies.js');
require('../src/main/clouds.js');
const VR = globalThis.VR;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const deg = (r) => r * 180 / Math.PI;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));

// ---- the cloud field
const C = VR.Clouds;
const cam = { x: 120, y: 150, z: -40 };
const f1 = C.field(cam, 37.5, { cover: 0.2 }), f2 = C.field(cam, 37.5, { cover: 0.2 });
check(JSON.stringify(f1) === JSON.stringify(f2), 'the field is deterministic (the same call, the same sprites)');
const f0 = C.field(cam, 37.5, { cover: 0 }), fo = C.field(cam, 37.5, { cover: 0.85 });
check(f0.cumulus.length === 0, 'no cumulus at cover 0');
check(fo.cumulus.length > f1.cumulus.length, 'more cumulus under overcast (0.85) than in clear weather (0.2)');
check(fo.cumulus.length <= C.MAX_CUMULUS, 'overcast keeps the sprite count within MAX_CUMULUS');
// the cover over a wide area: the share of cells that hold a cloud
let on = 0, all = 0;
for (let gz = -40; gz < 40; gz++) for (let gx = -40; gx < 40; gx++) { all++; if (C.cellOn(gx, gz, 0.2)) on++; }
const share = on / all;
// t-sky2: in clear weather one cell in twelve at most (the trailer's day: a few small cumulus low and far; the big puffy
// ring covered the nebula), still a few; the overcast end as before
check(share > 1 / 30 && share <= 1 / 12, `cover 0.2 gives ${(share * 100).toFixed(1)} % of the cells a cloud (t-sky2: 3.3–8.3 %, one in twelve at most)`);
{ let k = 0, n = 0; for (let gz = -40; gz < 40; gz++) for (let gx = -40; gx < 40; gx++) { n++; if (C.cellOn(gx, gz, 0.85)) k++; } check(k / n >= 0.6, `overcast (0.85) still fills ${(k / n * 100).toFixed(0)} % of the cells (≥ 60 %)`); }
let monotone = true, prev = -1;
for (const c of [0, 0.2, 0.4, 0.6, 0.8, 1]) { let k = 0; for (let gz = -20; gz < 20; gz++) for (let gx = -20; gx < 20; gx++) if (C.cellOn(gx, gz, c)) k++; if (k < prev) monotone = false; prev = k; }
check(monotone, 'the share of cloud cells grows with the cover');
// heights: every cumulus centre at y ≥ 206, and no sprite's flat base below y 190
let minBase = 1e9, minY = 1e9, maxY = -1e9;
for (const s of f1.cumulus) { minBase = Math.min(minBase, s[1] - 0.5 * s[3]); minY = Math.min(minY, s[1]); maxY = Math.max(maxY, s[1]); }
check(minY >= 206 && maxY <= 215, `cumulus centres at y ${minY.toFixed(1)}–${maxY.toFixed(1)} (206–215)`);
check(minBase >= 190, `the lowest cumulus base is at y ${minBase.toFixed(1)} (≥ 190)`);
for (let gz = -30; gz < 30; gz++) for (let gx = -30; gx < 30; gx++) {
  if (!C.cellOn(gx, gz, 0.6)) continue;
  for (const s of C.cumulusCell(gx, gz)) if (s[1] - 0.5 * s[3] < 190) { check(false, 'a cumulus base below 190 at cell ' + gx + ',' + gz); gz = 99; gx = 99; }
}
// t-sky2: smaller in clear weather — the same cells' sprites at cover 0.2 at most 0.7 of their size under overcast
{
  let rc = 0, ro = 0, n = 0;
  for (let gz = -30; gz < 30; gz++) for (let gx = -30; gx < 30; gx++) {
    if (!C.cellOn(gx, gz, 0.2)) continue;
    const a = C.cumulusCell(gx, gz, 0.2), b = C.cumulusCell(gx, gz, 0.85);
    rc += a[0][3]; ro += b[0][3]; n++;
  }
  check(n > 0 && rc / ro <= 0.7, `clear-weather cumulus are smaller: ${(rc / n).toFixed(1)} vs ${(ro / n).toFixed(1)} blocks under overcast (≤ 0.7)`);
}
// t-sky2: by day in clear weather the high puffs thin out (the shader: VR.Clouds.HIGH, mirrored here), so the visible cumulus
// sit low and far and the nebula overhead stays clear; low ones and overcast skies keep their clouds
{
  const sinD = (d) => Math.sin(d * Math.PI / 180);
  check(C.clearDay(0.2, 1) === 1 && C.clearDay(0.85, 1) === 0 && C.clearDay(0.2, 0) === 0, 'the clear-day factor: 1 by day in clear weather, 0 under overcast and at night');
  check(C.highFade(sinD(15), 1) === 1 && C.highFade(sinD(60), 1) <= 0.2 && C.highFade(sinD(60), 0) === 1, `high puffs thin by day in clear weather (15°: ${C.highFade(sinD(15), 1).toFixed(2)}, 60°: ${C.highFade(sinD(60), 1).toFixed(2)}; overcast 60°: ${C.highFade(sinD(60), 0)})`);
}
// t-sky2: the box clouds (Low and Very Low, renderer.js updateClouds) as sparse: their noise above VR.Clouds.boxThr(cover)
{
  require('../src/shared/core.js'); require('../src/shared/noise.js');
  const nz = new VR.Simplex(9173);
  const frac = (cov) => { let k = 0, n = 0; const thr = C.boxThr(cov); for (let gz = -150; gz < 150; gz += 2) for (let gx = -150; gx < 150; gx += 2) { n++; const v = (nz.n2(gx * 0.085, gz * 0.085) * 0.65 + nz.n2(gx * 0.27 + 50, gz * 0.27) * 0.35) * 0.5 + 0.5; if (v > thr) k++; } return k / n; };
  const fc = frac(0.2), fo = frac(0.85);
  check(fc > 0.01 && fc <= 1 / 12 && fo >= 0.5, `the box clouds cover ${(fc * 100).toFixed(1)} % in clear weather (≤ 8.3 %), ${(fo * 100).toFixed(0)} % under overcast (≥ 50 %)`);
}
// t-sky2 (continued): the box clouds of Low and Very Low fade high in the view by day in clear weather like the puffs — fully:
// a run over the camera is not drawn at all (shaders.js CLOUD_VS collapses it), so the nebula overhead stays clear on the
// low tiers too and they draw less. The sources, and the vertex shader's factor mirrored for a camera 150 blocks under the deck
{
  const fs = require('fs');
  const sh = fs.readFileSync(__dirname + '/../src/main/shaders.js', 'utf8'), rd = fs.readFileSync(__dirname + '/../src/main/renderer.js', 'utf8');
  const vs = sh.slice(sh.indexOf('S.CLOUD_VS'), sh.indexOf('S.CLOUD_FS')), cf = sh.slice(sh.indexOf('S.CLOUD_FS'), sh.indexOf('S.PUFF_VS'));
  check(/uniform vec4 u_cloudHigh/.test(vs) && /v_fade < 0\.01 \? vec4\(0\.0, 0\.0, 2\.0, 1\.0\)/.test(vs) && /u_cloudAlpha \* fade \* v_fade/.test(cf), 'CLOUD_VS fades a run by its elevation (u_cloudHigh) and drops one faded to nothing; CLOUD_FS takes the fade');
  check(/u_cloudHigh, HI\.from, 1 \/ \(HI\.to - HI\.from\), VR\.Clouds\.clearDay\(E\.cloudCover/.test(rd.slice(rd.indexOf('drawClouds(E) {'), rd.indexOf('initPuffs() {'))), 'drawClouds passes the puffs\' band and the clear-day factor to the box clouds');
  const fade = (dist, cd) => { const s = 150 / Math.hypot(dist, 150), hi = Math.min(1, Math.max(0, (s - C.HIGH.from) / (C.HIGH.to - C.HIGH.from))); return 1 - cd * hi * hi * (3 - 2 * hi); };
  check(fade(0, 1) < 0.01 && fade(100, 1) < 0.01 && fade(500, 1) === 1 && fade(0, C.clearDay(0.85, 1)) === 1 && fade(0, C.clearDay(0.2, 0)) === 1,
    `by day in clear weather a box cloud overhead is gone (${fade(0, 1).toFixed(2)}, 100 blocks out ${fade(100, 1).toFixed(2)}), one 500 out stays (${fade(500, 1)}); overcast and night keep theirs`);
}
// the wind moves the drawing, not the cells: in cloud space a cloud is the same sprite whatever the wind is
{
  const a = C.field(cam, 0, { cover: 0.2 }).cumulus, b = f1.cumulus;
  const key = (s) => s[0].toFixed(3) + ',' + s[1].toFixed(3) + ',' + s[2].toFixed(3);
  const setA = new Set(a.map(key));
  const shared = b.filter(s => setA.has(key(s))).length;
  check(shared >= 0.8 * Math.min(a.length, b.length), `the same clouds in cloud space at wind 0 and 37.5 (${shared} shared)`);
}
// fog banks: under the Sky Isles, world space
const fogs = C.fogBanks(cam);
check(fogs.length >= 15, `${fogs.length} fog banks round the Sky Isles`);
check(fogs.every(s => s[1] >= 104 && s[1] <= 114.01), 'every fog bank sits at y 104–114 (under the islands, above the lava)');
check(fogs.every(s => Math.hypot(s[0] - C.FOG.x, s[2] - C.FOG.z) <= C.FOG.reach + 0.01), 'fog banks lie within 300 blocks of the Sky Isles centre (330, 140)');
check(fogs.every(s => s[3] >= 70 && s[3] <= 130), 'fog banks are wide: radius 70–130 blocks');
// anchors: round the citadel's spires, world space, at y 207–212
const an = C.anchors();
check(an.length === C.ANCHOR.n, `${an.length} cloud anchors round the Spire Citadel`);
check(an.every(s => Math.hypot(s[0] - C.ANCHOR.x, s[2] - C.ANCHOR.z) <= C.ANCHOR.d + 0.01 && s[1] >= 207 && s[1] <= 212), 'the anchors ring the spire cluster (d ≤ 110) at y 207–212');
check(an.every(s => s[1] - 0.5 * s[3] >= 190), 'the anchors have their bases above y 190');
const packed = C.pack(f1.cumulus);
check(packed.length === f1.cumulus.length * C.SPRITE_FLOATS && Math.abs(packed[0] - f1.cumulus[0][0]) < 1e-3, 'the packed instance data matches the sprite list');

// ---- the sprite atlas
const d = (x, y) => C.density(x, y, 1.3);
check(d(0, 0) > 0.95, `the centre of a cumulus is full (${d(0, 0).toFixed(2)})`);
check(d(0.95, 0.95) === 0 && d(-0.95, -0.95) === 0 && d(0.95, -0.95) === 0, 'the corners of the sprite are empty');
const at = C.atlas();
check(at.length === 256 * 256 * 4, 'the atlas is 256² RGBA');
const texel = (i, j) => { const o = (j * 256 + i) * 4; return [at[o] / 255, at[o + 1] / 255 * 2 - 1, at[o + 2] / 255 * 2 - 1]; };
// variant 0 (quadrant 0: rows 0–127 are the bottom): on the flank of the top lobe the normal points up, on the base down
const top = texel(64, 110), bottom = texel(64, 31);
check(top[0] > 0.2 && top[2] > 0.3, `the outward normal of the top edge points up (ny ${top[2].toFixed(2)})`);
check(bottom[0] > 0 && bottom[2] < 0, 'the outward normal of the base points down');

// ---- the sky bodies
const SB = VR.SkyBodies;
const oldGiant = (th) => { const pa = th * 0.5 + 0.55; const v = [Math.cos(pa) * 0.84, 0.55, Math.sin(pa) * 0.84]; const l = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / l); };
const oldBlue = (th) => { const pb = th * 0.5 + 0.55 + 2.4; const v = [Math.cos(pb) * 0.62, 0.78, Math.sin(pb) * 0.62]; const l = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / l); };
let same = true, elevG = [], ringAng = [], elevB = [], moonBad = 0;
for (let k = 0; k <= 480; k++) {
  const th = k / 480 * Math.PI * 2, b = SB.at(th);
  const dif = (a, c) => Math.max(Math.abs(a[0] - c[0]), Math.abs(a[1] - c[1]), Math.abs(a[2] - c[2]));
  if (dif(b.giant, oldGiant(th)) > 1e-12 || dif(b.blue, oldBlue(th)) > 1e-12) same = false;
  elevG.push(deg(Math.asin(b.giant[1]))); elevB.push(deg(Math.asin(b.blue[1])));
  // the ring's tilt: the angle between the ring normal and the line of sight, as a line (acute), 60°–85° = seen at a slant
  const ra = angle(b.ring, b.giant); ringAng.push(deg(Math.min(ra, Math.PI - ra)));
  // three moons ride along with the giant (8°–35° from it); the fourth drifts by the blue planet (within 35° of it)
  b.moons.forEach((m, i) => { const a = deg(i < 3 ? angle(m, b.giant) : angle(m, b.blue)); if (a < 8 || a > 35) moonBad++; });
}
check(same, 'the giant and the blue planet keep the directions env.js gave them (no change in the places)');
check(Math.min(...elevG) > 33 - 0.5 && Math.max(...elevG) < 33.6, `the gas giant stays at ${Math.min(...elevG).toFixed(2)}–${Math.max(...elevG).toFixed(2)}° (about 33°, never sets)`);
check(Math.min(...elevB) > 51 && Math.max(...elevB) < 52.2, `the blue planet hangs at ${Math.min(...elevB).toFixed(1)}–${Math.max(...elevB).toFixed(1)}° (higher up)`);
check(Math.min(...ringAng) >= 60 && Math.max(...ringAng) <= 85, `the ring normal is ${Math.min(...ringAng).toFixed(0)}–${Math.max(...ringAng).toFixed(0)}° from the line of sight (60–85°: seen at a slant)`);
check(moonBad === 0, 'the moons sit 8°–35° from the giant (three) and from the blue planet (the fourth)');
const r0 = SB.at(Math.PI / 2);
check(Math.abs(deg(SB.RADIUS.giant) - 7.0) < 0.05, `the gas giant's angular radius is ${deg(SB.RADIUS.giant).toFixed(2)}° (≈ 7°)`);
check(Math.abs(deg(SB.RADIUS.blue) - 4.9) < 0.1, `the blue planet's angular radius is ${deg(SB.RADIUS.blue).toFixed(2)}° (≈ 5°)`);
check(r0.moons.every(m => deg(m[3]) >= 1.15 && deg(m[3]) <= 1.85), `the moons' radii are ${r0.moons.map(m => deg(m[3]).toFixed(2)).join(' / ')}° (1.2–1.8°)`);
check(r0.moons.length === 4, 'four moons');
// noon: the giant is south-east of the view's north, the blue planet north-west (the trailer's t1_03 layout)
check(r0.giant[2] > 0.7 && r0.giant[0] > 0, 'at noon the giant hangs to the south, a little east');
check(angle(SB.atTicks(6000).giant, r0.giant) < 1e-9, 'atTicks(6000) is noon');
check(SB.at(0).ring.every(v => Number.isFinite(v)) && Math.abs(Math.hypot(...SB.at(1.1).ring) - 1) < 1e-9, 'the ring normal is a unit vector');

console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);

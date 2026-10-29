// u-orbitlod · the view from orbit, its pure parts (docs/superpowers/plans/2026-10-29-u-orbitlod.md): the sky's band at
// the horizon's dip, the one albedo (no hard colour edges, no saturated pinks and oranges), the planet tiles (selection,
// the worker's job: time, the sphere, the normals, shared edges; GPU bytes), the shader sources (u_dip, PTILE, the
// faint airglow, the aurora, the climb's soft edge instead of the Bayer dissolve).
//   bash test/wt_run.sh planetlod.js 300
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
require('../src/shared/bodytex.js');
require('../src/shared/planetlod.js');
const BT = V.BodyTex, PL = V.PlanetLOD;
let fails = 0;
const check = (ok, msg, extra) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (extra ? ' — ' + extra : '')); if (!ok) fails++; };
const SRC = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const R = BT.CHART.R;

// ---------------------------------------------------------------- 1 · the dip
console.log('the horizon\'s dip');
{
  const d = (h) => Math.asin(PL.dip(h, R)) * 180 / Math.PI;
  check(PL.dip(0, R) === 0 && Math.abs(d(1200) - Math.acos(R / (R + 1200)) * 180 / Math.PI) < 1e-9, `sin(acos(R/(R+h))): 0 at the sea, ${d(900).toFixed(2)}° at 900 m, ${d(1200).toFixed(2)}° at 1,200 m, ${d(3000).toFixed(2)}° at 3 km`);
  const S = SRC('main/shaders.js'), sky = S.slice(S.indexOf('vec3 skyColor(vec3 dir, bool withSun)'), S.indexOf('vec3 skyColor(vec3 dir, bool withSun)') + 6000);
  check(/uniform float u_dip;/.test(S), 'S.COMMON declares u_dip (both sky programs: the classic and t-sky3\'s, the haze too)');
  check(/float h = max\(dir\.y \+ u_dip, 0\.0\);/.test(sky) && /if \(dir\.y \+ u_dip < 0\.0\)/.test(sky) && /smoothstep\(-0\.12, 0\.08, dir\.y \+ u_dip\)/.test(sky), 'skyColor: the gradient, the band, the ground below and the cosmic fade measured from the dipped horizon');
  const hz = S.slice(S.indexOf('vec3 hazeColor(vec3 dir)'), S.indexOf('vec3 hazeColor(vec3 dir)') + 900);
  check(/max\(dir\.y \+ u_dip, 0\.0\)/.test(hz), 'hazeColor too (the far land\'s haze meets the band)');
  const asc = SRC('main/ascent.js'), ren = SRC('main/renderer.js');
  check(/E\.climb\.dip = /.test(asc) && /u_dip/.test(ren), 'E.climb.dip is set in the climb (ascent.js) and fed to u_dip (renderer.js)');
  // the normalised text is the base's: one test sets u_dip aside (vl_programs.js, motion_wind.js)
  check(/u_dip/.test(SRC('../test/vl_programs.js')) && /u_dip/.test(SRC('../test/motion_wind.js')), 'vl_programs.js and motion_wind.js set u_dip aside');
}

// ---------------------------------------------------------------- 2 · one albedo
console.log('one albedo (R50-14)');
{
  const g = new V.OverworldGen(53, { vgen: 11 }), gen = () => g;
  const stats = (a, w, h) => {
    let e = 0, p = 0, warm = 0, blue = 0, land = 0, sat = 0, runs = 0;
    const L = (k) => a[k * 4 + 3] < 128;
    for (let j = 0; j < h; j++) {
      let run = 0;
      for (let i = 0; i < w; i++) {
        const k = j * w + i; if (!L(k)) { run = 0; continue; }
        land++; const r = a[k * 4], G = a[k * 4 + 1], b = a[k * 4 + 2], mx = Math.max(r, G, b), mn = Math.min(r, G, b);
        const s = mx ? (mx - mn) / mx : 0; sat += s;
        if ((r > G + 10 && b > G + 10) || r > G + 45) warm++;
        if (s > 0.2 && b > r + 10 && b > G + 10) blue++;
        let edge = false;
        for (const q of [k + 1, k + w]) { if ((q === k + 1 && i === w - 1) || q >= w * h || !L(q)) continue; p++; const d = Math.max(Math.abs(r - a[q * 4]), Math.abs(G - a[q * 4 + 1]), Math.abs(b - a[q * 4 + 2])); if (d > 48) { e++; edge = true; } }
        run = edge ? run + 1 : 0; if (run > runs) runs = run;
      }
    }
    return { edge: e / p, warm: warm / land, blue: blue / land, sat: sat / land, runs, land };
  };
  for (const [cx, cz, step] of [[0, 0, 50], [9000, -7000, 50], [-15000, 12000, 100]]) {
    const r = BT.job({ type: 'bodytex', body: 'patch', w: 256, h: 256, y0: 0, y1: 256, cx, cz, step }, gen), s = stats(r.a, 256, 256);
    check(s.edge < (step > 50 ? 0.08 : 0.05) && s.runs < 40, `patch at (${cx}, ${cz}), ${step} m: ${(s.edge * 100).toFixed(1)} % of land neighbours differ by > 48 levels (v0.50: 30–44 %), the longest run of edges ${s.runs} texels (< 40)`);
    check(s.warm < 0.01 && s.blue < 0.01 && s.sat < 0.36, `…its land is muted: ${(s.warm * 100).toFixed(2)} % pink/orange, ${(s.blue * 100).toFixed(2)} % saturated blue, mean saturation ${s.sat.toFixed(2)} (v0.50 0.50)`);
  }
  const r = BT.job({ type: 'bodytex', body: 'herz', w: 512, h: 256, y0: 60, y1: 120 }, gen), s = stats(r.a, 512, 60);
  check(s.edge < 0.08 && s.warm < 0.01, `the globe's rows (512 wide): ${(s.edge * 100).toFixed(1)} % hard edges (v0.50 74 %), ${(s.warm * 100).toFixed(2)} % pink/orange`);
  // greens and tans: the land's mean hue between yellow-brown and green
  let rs = 0, gs = 0, bs = 0, n = 0; for (let k = 0; k < 512 * 60; k++) if (r.a[k * 4 + 3] < 128) { rs += r.a[k * 4]; gs += r.a[k * 4 + 1]; bs += r.a[k * 4 + 2]; n++; }
  check(gs / n >= rs / n * 0.85 && bs / n < gs / n, `its mean land colour ${[rs / n, gs / n, bs / n].map(x => x.toFixed(0)).join(', ')}: green ≥ 0.85 red, blue below green (greens, browns, tans)`);
}

// ---------------------------------------------------------------- 3 · the tiles: selection
console.log('the planet tiles: selection');
{
  const t = PL.select(0, 0, 3000);
  const lv = {}; for (const x of t) lv[x.s] = (lv[x.s] || 0) + 1;
  check(t.length >= 20 && t.length <= 90, `at 3 km over the Heartland: ${t.length} tiles (${Object.entries(lv).map(([s, n]) => n + '×' + s + ' m').join(', ')})`);
  const reach = Math.max(...t.map(x => Math.min(Math.hypot(Math.max(x.x0, -(x.x0 + x.size), 0), Math.max(x.z0, -(x.z0 + x.size), 0)))));
  check(reach <= PL.RADIUS, `every tile reaches into the 30-km circle (the farthest's near edge ${(reach / 1000).toFixed(1)} km)`);
  const under = t.filter(x => x.x0 <= 0 && x.x0 + x.size > 0 && x.z0 <= 0 && x.z0 + x.size > 0);
  check(under.length === 1 && under[0].s <= 256, `the nadir in one tile of ${under[0] && under[0].s} m spacing`);
  // no overlaps, the area covered
  let area = 0; for (const x of t) area += x.size * x.size;
  let ov = 0; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const a = t[i], b = t[j]; if (a.x0 < b.x0 + b.size && b.x0 < a.x0 + a.size && a.z0 < b.z0 + b.size && b.z0 < a.z0 + a.size) ov++; }
  check(ov === 0 && area >= Math.PI * PL.RADIUS * PL.RADIUS, `no two overlap; they cover ${(area / 1e6).toFixed(0)} km² (the circle ${(Math.PI * 900).toFixed(0)} km²)`);
  const f = (a) => a.filter(x => x.s === 128).length, lo = PL.select(0, 0, 300), hi = PL.select(0, 0, 9000);
  check(f(lo) >= f(t) && f(hi) < f(t), `finer low down (${f(lo)} of 128 m at 300 m, ${f(t)} at 3 km), coarser high up (${f(hi)} at 9 km)`);
  check(!PL.on(0, 'herz') && !PL.on(1, 'herz') && PL.on(2, 'herz') && PL.on(3, 'herz') && !PL.on(3, 'opal') && !PL.on(3, 'basalt'), 'on from Balanced (tier 2) for Herzwelt; Very Low and Low, the moons: impostors only');
}

// ---------------------------------------------------------------- 4 · the job
console.log('the planet tiles: the worker\'s job');
{
  const g = new V.OverworldGen(53, { vgen: 11 }), gen = () => g;
  PL.job({ type: 'ptile', x0: 0, z0: 0, s: 128 }, gen);
  const ms = [];
  let J = null;
  // (CPU time, not the wall: a busy machine — the browser tests next door — must not fail the budget)
  for (let k = 0; k < 12; k++) { const c0 = process.cpuUsage(); J = PL.job({ type: 'ptile', x0: 4096 * (k % 4) - 8192, z0: 2048 * (k >> 2), s: [128, 256, 512, 1024][k % 4] }, gen); const c = process.cpuUsage(c0); ms.push((c.user + c.system) / 1000); }
  ms.sort((a, b) => a - b);
  check(ms[6] <= 4, `a tile in ${ms[6].toFixed(2)} ms of CPU (median of 12; the slowest ${ms[11].toFixed(2)} ms; budget 4 ms in a worker)`);
  const a = PL.job({ type: 'ptile', x0: 0, z0: 0, s: 128 }, gen), b = PL.job({ type: 'ptile', x0: 2048, z0: 0, s: 128 }, gen), V1 = PL.N + 1;
  check(a.pos.length === PL.VERTS * 3 && a.nrm.length === PL.VERTS * 3, `${PL.VERTS} vertices (17 × 17 + the skirts), positions and normals`);
  let off = 0, nOk = true;
  for (let v = 0; v < V1 * V1; v++) {
    const x = a.pos[v * 3], y = a.pos[v * 3 + 1], z = a.pos[v * 3 + 2], r = Math.hypot(x, y, z);
    off = Math.max(off, Math.abs(r - R - (a.hMin + a.hMax) / 2) - (a.hMax - a.hMin) / 2);
    const nl = Math.hypot(a.nrm[v * 3], a.nrm[v * 3 + 1], a.nrm[v * 3 + 2]), up = (a.nrm[v * 3] * x + a.nrm[v * 3 + 1] * y + a.nrm[v * 3 + 2] * z) / r;
    if (Math.abs(nl - 1) > 1e-3 || up < 0.5) nOk = false;
  }
  check(off < 0.5, `on the sphere: |p| − R within the tile's heights (${a.hMin.toFixed(0)}–${a.hMax.toFixed(0)} m over the sea), ${off.toFixed(3)} m off`);
  check(nOk, 'the normals are unit and face out (none steeper than 60°)');
  // the chart: vertex (0, 0) is the plane's (x0, z0)
  const sp = BT.toSphere(0, 0), n = BT.normal(sp[0], sp[1]), p0 = [a.pos[0], a.pos[1], a.pos[2]], l0 = Math.hypot(...p0);
  check(Math.abs(p0[0] / l0 - n[0]) + Math.abs(p0[1] / l0 - n[1]) + Math.abs(p0[2] / l0 - n[2]) < 1e-6, 'the first vertex sits over the plane\'s (x0, z0) through the chart');
  let edge = 0; for (let j = 0; j < V1; j++) { const ka = (j * V1 + PL.N) * 3, kb = (j * V1) * 3; edge = Math.max(edge, Math.hypot(a.pos[ka] - b.pos[kb], a.pos[ka + 1] - b.pos[kb + 1], a.pos[ka + 2] - b.pos[kb + 2])); }
  check(edge < 0.05, `two neighbours share their edge (${(edge * 100).toFixed(1)} cm apart)`);
  const idx = PL.indices();
  check(idx.length === PL.N * PL.N * 6 + 4 * PL.N * 6 && Math.max(...idx) < PL.VERTS, `the index list: ${idx.length / 3} triangles, every index a vertex`);
  // relief: the Heartland's hills are there (heights vary within a 2-km tile)
  check(a.hMax - a.hMin > 5, `the relief is there: ${(a.hMax - a.hMin).toFixed(0)} m between the tile's low and high points`);
}

// ---------------------------------------------------------------- 5 · memory
console.log('memory');
{
  const mb = PL.gpuBytes(2) / 1048576;
  check(PL.gpuBytes(0) === 0 && PL.gpuBytes(1) === 0 && mb > 0 && mb <= 48, `the tiles' GPU memory on Balanced: ${mb.toFixed(2)} MB (≤ 48 MB more; Very Low and Low 0)`);
}

// ---------------------------------------------------------------- 6 · the shader sources
console.log('the shaders');
{
  const S = SRC('main/space_shaders.js'), L = SRC('main/shaders.js'), G = fs.existsSync(path.join(__dirname, '../src/main/planetlod_gl.js')) ? SRC('main/planetlod_gl.js') : '';
  check(/#ifdef PTILE/.test(S) && /in vec3 v_nb;/.test(S), 'HERZ_FS draws the tiles too (#ifdef PTILE: the vertex\'s own sphere normal, the mesh\'s for the relief)');
  check(/PTILE/.test(G) && /DEPTH_BUFFER_BIT/.test(G), 'planetlod_gl.js compiles it with PTILE and clears its own depth after the pass');
  const ag = (S.match(/AG_COL \* u_air\.w \* ag \* ([0-9.]+)/) || [])[1];
  check(ag !== undefined && +ag <= 0.15, `the airglow's shell faint (×${ag}; v0.50 ×0.45)`);
  check(/aurora/i.test(S) && /auroraAt\(/.test(S), 'the aurora: a function for the oval (the disc and the limb)');
  check(/glint/i.test(S) && /ggx\(max\(dot\(N, H\), 0\.0\), 0\.06\)/.test(S), 'the sunglint: a mirror core (GGX 0.06) in the broad sheen');
  const lod = L.slice(L.indexOf('S.LOD_FS'), L.indexOf('S.LOD_FS') + 6000);
  check(!/bayer4\(gl_FragCoord\.xy\) < smoothstep\(u_climbCut/.test(lod) && /climbA/.test(lod), 'the horizon tiles\' climb edge: an alpha (climbA), not the Bayer dissolve');
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

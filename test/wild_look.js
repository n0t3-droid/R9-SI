// f-wild3 · the u-wild2 animals up close and at play distance (src/main/wildheart.js + src/shared/wildbond.js), node:
//  (a) coats read from 6–10 m: on every kind (adult and baby) the pattern cells on the body's surface differ from the
//      ground by a clear luminance step (adults ≥ 0.10, babies ≥ 0.14 and at least their mother's), the pattern
//      covers both flanks and the back (each 12–70 %), in blobs/bands of several voxels (mean ≥ 3), mapped around the
//      body (u along the flank, v around it: seamless across the belly line)
//  (b) the eyes are soft, not googly: no pure white in the head's eye cells, a dark warm iris (luminance < 0.32,
//      red ≥ blue but the pup's and the cat's own colours), one small catchlight per eye — a half voxel (1/8 of a
//      voxel's volume) in the glint part, in the eye's upper row, off-centre; a half-lid head (head_h) and a shut head
//      (head_c); eye height ≤ 0.4 of the head's; a baby's eye not smaller than its mother's (in head voxels)
//  (c) finches: a take-off flies a short arc and lands again — within 3 s, 4–10 blocks from where it rose, never
//      higher than 4.5 blocks over it; on a perch (a leaf or a fence top) when one is near, else on the grass; wings
//      beat while rising and glide when coming in; it does not take off again for a moment
//   bash test/wt_run.sh wild_look.js 300
const VR = require('./load_shared.js');
VR.SHADERS = VR.SHADERS || {};
require(__dirname + '/../src/shared/wildbond.js');
require(__dirname + '/../src/main/voxmodels.js');
require(__dirname + '/../src/main/wildheart.js');
const B = VR.WildBond, M = VR.VOXMODELS;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const lum = (c) => { const [r, g, b] = rgb(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const cd = (a, b) => { const A = rgb(a), C = rgb(b); return Math.abs(A[0] - C[0]) + Math.abs(A[1] - C[1]) + Math.abs(A[2] - C[2]); };
const each = (g, fn) => { for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const v = g.get(x, y, z); if (v) fn(x, y, z, v); } };
const INK = { glimmer_deer: 'light', bloom_sheep: 'dark', moss_boar: 'light', glimmer_fox: 'light', moss_cat: 'dark', crystal_pup: 'dark' };

console.log('(a) coats at play distance');
{
  const rows = [];
  for (const kind in B.KINDS) {
    const K = B.KINDS[kind], orig = M[kind]().parts.body.grid;
    const ink = INK[kind] === 'light' ? K.light : K.dark;
    const res = {};
    for (const baby of [false, true]) {
      let cs = 0, share = [], blob = 0, n = 0;
      for (let v = 0; v < B.VARIANTS; v++) {
        const def = M[VR.WildHeart.vkey(kind, v, baby)]();
        const g0 = orig, g = def.parts.body.grid, sh = baby ? 1 : 0;   // (a baby's body grew by one voxel for its fluff)
        // the surface voxels of the original body, classified: pattern (moved toward the ink) or ground
        let cx = 0, cy = 0, c0 = 0; each(g0, (x, y) => { cx += x; cy += y; c0++; }); cx /= c0; cy /= c0;
        const pat = new Map(), sides = { l: [0, 0], r: [0, 0], b: [0, 0] }; let Lp = 0, np = 0, Lg = 0, ng = 0;
        each(g0, (x, y, z, o) => {
          const open = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b2, c]) => !g0.get(x + a, y + b2, z + c));
          if (!open || (o >> 24) & 1) return;
          const nv = g.get(x + sh, y + sh, z + sh); if (!nv) return;
          const oc = o & 0xffffff, nc = nv & 0xffffff; if (oc === nc) return;
          const isP = cd(nc, ink) < cd(oc, ink) - 6;
          if (isP) { Lp += lum(nc); np++; pat.set(x + ',' + y + ',' + z, 1); } else { Lg += lum(nc); ng++; }
          const s = y > cy + 1.5 ? 'b' : x < cx ? 'l' : 'r'; sides[s][0] += isP ? 1 : 0; sides[s][1]++;
        });
        cs += np && ng ? Math.abs(Lp / np - Lg / ng) : 0;
        share.push(...Object.values(sides).map(([a, t]) => (t ? a / t : 0)));
        // blobs of pattern voxels on the surface (26-connected)
        const seen = new Set(); let sizes = [];
        for (const k of pat.keys()) {
          if (seen.has(k)) continue; seen.add(k); const st = [k]; let s = 0;
          while (st.length) { const q = st.pop(); s++; const [x, y, z] = q.split(',').map(Number); for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) for (let c = -1; c <= 1; c++) { const r = (x + a) + ',' + (y + b2) + ',' + (z + c); if (pat.has(r) && !seen.has(r)) { seen.add(r); st.push(r); } } }
          sizes.push(s);
        }
        blob += sizes.length ? sizes.reduce((a, b2) => a + b2, 0) / sizes.length : 0; n++;
      }
      res[baby ? 'baby' : 'adult'] = { c: cs / n, smin: Math.min(...share), smax: Math.max(...share), blob: blob / n };
    }
    rows.push([kind, res]);
    console.log(`   ${kind.padEnd(13)} adult ΔL ${res.adult.c.toFixed(3)} share ${res.adult.smin.toFixed(2)}–${res.adult.smax.toFixed(2)} blob ${res.adult.blob.toFixed(1)} · baby ΔL ${res.baby.c.toFixed(3)} share ${res.baby.smin.toFixed(2)}–${res.baby.smax.toFixed(2)} blob ${res.baby.blob.toFixed(1)}`);
  }
  check(rows.every(([, r]) => r.adult.c >= 0.10), 'every adult coat steps clearly from its ground (ΔL ≥ 0.10)');
  check(rows.every(([, r]) => r.baby.c >= 0.14 && r.baby.c >= r.adult.c - 0.005), 'every baby\'s coat stronger still (ΔL ≥ 0.14, ≥ its mother\'s)');
  check(rows.every(([, r]) => r.adult.smin >= 0.12 && r.baby.smin >= 0.12 && r.adult.smax <= 0.7 && r.baby.smax <= 0.7), 'the pattern covers both flanks and the back (12–70 % each)');
  check(rows.every(([, r]) => r.adult.blob >= 3 && r.baby.blob >= 3), 'in blobs and bands of several voxels (mean ≥ 3)');
  // u along the flank, v around the body: one turn around it is one period of the torus (no seam under the belly)
  const C = { cx: 4, cy: 4, z0: 0 }, a = B.bodyUV ? B.bodyUV(4 - 3, 4 - 0.001, 5, C) : null, b = B.bodyUV ? B.bodyUV(4 - 3, 4 + 0.001, 5, C) : null;
  check(!!a && Math.abs(((a[1] - b[1]) + B.N * 1.5) % B.N - B.N * 0.5) < 0.2 && Math.abs(a[0] - b[0]) < 1e-9, 'the coat is mapped around the body (u along it, v around it, seamless)');
}

console.log('(b) the eyes');
{
  const rows = [];
  for (const kind in B.KINDS) for (const baby of [false, true]) {
    const def = M[VR.WildHeart.vkey(kind, 1, baby)](), P = def.parts, head = P.head.grid, E = def.eyes || [];
    const white = []; let irisOK = E.length === 2, glintOK = true, lidOK = !!(P.head_h && P.head_c), hOK = true;
    for (const e of E) {
      for (const [x, y, z] of e.cells) { const c = head.get(x, y, z) & 0xffffff; if (!c) continue; if (c === 0xffffff || lum(c) > 0.8) white.push(c); }
      const ir = e.iris; if (!(lum(ir) < 0.32 && (rgb(ir)[0] >= rgb(ir)[2] || kind === 'crystal_pup' || kind === 'moss_cat'))) irisOK = false;
      if (e.rows / head.sy > 0.4) hOK = false;
    }
    // the glint part: half-scale voxels (a doubled grid), one bright one per eye, in the upper row of the eye, not centred
    const G = P.glint && P.glint.grid; let bright = 0, okPos = true;
    if (G) each(G, (x, y, z, v) => {
      if (lum(v & 0xffffff) < 0.75) return; bright++;
      const e = E.find(q => q.cells.some(([a, b2, c]) => a === (x >> 1) && b2 === (y >> 1) && c === (z >> 1)));
      if (!e || (y >> 1) !== e.top || !(y & 1)) okPos = false;
    }); else glintOK = false;
    if (bright !== E.length || !okPos || def.glintScale !== 0.5) glintOK = false;
    rows.push({ kind, baby, white: white.length, irisOK, glintOK, lidOK, hOK, ey: E.length ? E[0].rows : 0, hy: head.sy });
  }
  check(rows.every(r => r.white === 0), 'no white cells in the eyes (the catchlight is not a whole voxel any more)' + rows.filter(r => r.white).map(r => ' ' + r.kind + (r.baby ? '·b' : '') + ':' + r.white).join(''));
  check(rows.every(r => r.irisOK), 'a dark, warm iris (luminance < 0.32)');
  check(rows.every(r => r.glintOK), 'one half-voxel catchlight per eye, in its upper row, off-centre');
  check(rows.every(r => r.lidOK), 'a half-lid head and a shut head for soft blinks');
  check(rows.filter(r => !r.baby).every(r => r.hOK), 'adult eyes in proportion (≤ 0.4 of the head\'s height)');
  check(Object.keys(B.KINDS).every(k => { const a = rows.find(r => r.kind === k && !r.baby), b = rows.find(r => r.kind === k && r.baby); return b.ey >= a.ey; }), 'a baby\'s eyes not smaller than its mother\'s (its head is 1.3×)');
  // the blink: open → half → shut → half → open, and a content half-lid while it is petted or eats
  const lids = []; const h = { bl: 0 };
  if (B.lid) { h.bl = B.BLINK; for (let t = 0; t <= B.BLINK + 0.02; t += 0.01) { lids.push(B.lid(h.bl, false, false)); h.bl = Math.max(0, h.bl - 0.01); } }
  const seq = lids.filter((v, i) => i === 0 || v !== lids[i - 1]).join('');
  check(B.lid && /^h+s+h+o?$|^hsho?$/.test(lids.map(v => v[0]).filter((v, i, a) => i === 0 || v !== a[i - 1]).join('')) && B.lid(0, false, true) === 'half' && B.lid(0, true, false) === 'shut' && B.lid(0, false, false) === 'open', 'a gentle blink (half → shut → half), a happy half-lid, shut at rest: ' + seq.slice(0, 40));
}

console.log('(c) finches fly an arc and land again');
{
  // a world: flat grass at y 10, a fence post at (6, 11, 0) — its top a perch at 12 — and leaves at (-7, 13, 3)
  const top = (x, z) => (x === 6 && z === 0 ? 11 : x === -7 && z === 3 ? 13 : 10);
  const perch = (x, z) => (x === 6 && z === 0) || (x === -7 && z === 3);
  const W = { top, perch };
  let ok = 0, okPerch = 0, okGround = 0, maxT = 0, maxH = 0, dists = [], flapOK = !!B.finchTakeoff, again = !!B.finchTakeoff;
  const N = 40, r = B.rng(5);
  for (let i = 0; i < N; i++) {
    const usePerch = i % 2 === 0;
    const w = usePerch ? W : { top: () => 10, perch: () => false };
    const b = { x: 0.5 + (r() - 0.5), y: 11, z: 0.5 + (r() - 0.5), st: 'hop', flap: 0, yaw: 0 };
    const px = b.x - 2 + r(), pz = b.z + 1.5 - r() * 3;   // the player, near
    if (!B.finchTakeoff) break;
    B.finchTakeoff(b, px, pz, w, r);
    const x0 = b.x, y0 = b.y, z0 = b.z;
    let t = 0, rising = 0, gliding = 0;
    while (b.st === 'fly' && t < 6) { const vy0 = b.vy; B.finchFly(b, 1 / 30); t += 1 / 30; maxH = Math.max(maxH, b.y - y0); if (b.y > y0 + 0.2) { if (b.beat) rising++; else gliding++; } void vy0; }
    maxT = Math.max(maxT, t);
    const d = Math.hypot(b.x - x0, b.z - z0); dists.push(d);
    if (b.st !== 'fly' && t <= 3 && d >= 4 && d <= 10.5) ok++;
    if (usePerch && b.st === 'perch' && Math.abs(b.y - (top(Math.floor(b.x), Math.floor(b.z)) + 1)) < 0.05 && perch(Math.floor(b.x), Math.floor(b.z))) okPerch++;
    if (!usePerch && b.st === 'hop' && Math.abs(b.y - 11) < 0.05) okGround++;
    if (!(rising > 3 && gliding > 1)) flapOK = false;
    if (!(b.calm > 0.8)) again = false;
  }
  console.log(`   longest flight ${maxT.toFixed(2)} s · highest ${maxH.toFixed(2)} blocks · landed ${Math.min(...dists).toFixed(1)}–${Math.max(...dists).toFixed(1)} blocks off`);
  check(ok === N, `every take-off lands again within 3 s, 4–10 blocks off (${ok}/${N})`);
  check(maxH <= 4.5 && maxH >= 1, `a short arc (highest ${maxH.toFixed(2)} blocks over its start)`);
  check(okPerch >= N / 2 * 0.8, `with a perch near it lands on the leaf or the fence top (${okPerch}/${N / 2})`);
  check(okGround === N / 2, `without one on the grass again (${okGround}/${N / 2})`);
  check(flapOK, 'wings beat while it rises and it glides in');
  check(again, 'it sits a moment before it can take off again');
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

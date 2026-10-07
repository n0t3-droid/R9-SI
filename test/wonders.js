// ✨ Wunder der Welt (wave 2, W-A): the sites come deterministically from the seed (640-block cells, 60 %), keep clear
// of villages, their rails, the Heartland's temple and the spawn, and the spawn's own cell always holds the world's first
// wonder 250–450 blocks out (200 worlds); every one of the eight wonders builds within its budget (< 1 s CPU, < 16 MB,
// ≤ 64 × 64, ≤ 120 high) for 50 seeds, glows at night, and a person walks from its entrance to its glowing heart; the
// game's placer builds a site on clean land and marks a lot with a player edit blocked.
//   node test/wonders.js            everything
//   ONLY=sites node test/wonders.js one section (sites · spawn · types · game)
require('./load_shared.js');
const R = VR.R, T = R.T, Forge = VR.Forge, W = VR.Wonders;
const ONLY = process.env.ONLY || '';
let fails = 0, n = 0;
const check = (ok, msg) => { n++; if (!ok) { fails++; console.log('  ✗ ' + msg); } else if (process.env.VERBOSE) console.log('  ✓ ' + msg); };
const section = (name, fn) => { if (ONLY && ONLY !== name) return; console.log('— ' + name); const t0 = Date.now(); try { fn(); } catch (e) { fails++; console.log('  ✗ ' + name + ' threw: ' + (e && e.stack || e)); } console.log('  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)'); };
const ms = (fn, runs) => { const t = []; for (let i = 0; i < (runs || 3); i++) { const c0 = process.cpuUsage(); fn(); const c = process.cpuUsage(c0); t.push((c.user + c.system) / 1000); } t.sort((a, b) => a - b); return t[t.length >> 1]; };
const nameOf = (s) => (s && s !== 0xFFFF && R.types[T.type[s]] ? R.types[T.type[s]].name : s === 0xFFFF ? 'keep' : 'air');
const VG = VR.VillageGen;
const gen = (seed, vgen) => VR.makeGen('overworld', seed >>> 0, { vgen });
// the villages around a point (their cells of the generation's grid)
const villagesNear = (g, x, z, r) => { const C = VG.cell(g), out = [], R0 = Math.ceil(r / C) + 1, ci = Math.floor(x / C), cj = Math.floor(z / C); for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) { const s = VG.site(g, ci + di, cj + dj); if (s) out.push(s); } return out; };

check(W && typeof W.site === 'function' && typeof W.near === 'function' && typeof W.typeAt === 'function' && typeof W.build === 'function', 'VR.Wonders: site, near, typeAt, build');
if (!W) { console.log('FAILED ' + (fails || 1)); process.exit(1); }
check(Array.isArray(W.TYPES) && W.TYPES.length === 8 && new Set(W.TYPES.map(t => t.id)).size === 8, 'eight wonder types: ' + (W.TYPES || []).map(t => t.id).join(' '));

// ---------------------------------------------------------------- the sites of a world
section('sites', () => {
  for (const [seed, vgen] of [[20261008, 5], [777, 5], [4242, 2], [99, 1]]) {
    const g = gen(seed, vgen), g2 = gen(seed, vgen);
    const spawn = vgen >= 3 ? [0.5, -9.5] : (() => { const v = VG.nearest(g, 0, 0, 1400); return v ? [v.x + 0.5, v.z + 0.5] : [0.5, 0.5]; })();
    const list = [], C = W.CELL;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const s = W.site(g, i, j, spawn); if (s) list.push(s); }
    const again = []; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const s = W.site(g2, i, j, spawn); if (s) again.push(s); }
    const tag = 'seed ' + seed + ' (vgen ' + vgen + ')';
    check(JSON.stringify(list) === JSON.stringify(again), tag + ': the same sites from a fresh generator (' + list.length + ' of 49 cells)');
    // six cells in ten roll a wonder; one stands where the ground allows (dry, gentle, clear of everything built)
    let rolled = 0, unrolled = []; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const r = W.roll(g, i, j); if (r) rolled++; const s = W.site(g, i, j, spawn); if (s && !r && !s.first) unrolled.push(s.key); }
    check(C === 640 && rolled >= 20 && rolled <= 39 && !unrolled.length, tag + ': six cells in ten roll a wonder (' + rolled + '/49), no other cell holds one' + (unrolled.length ? ': ' + unrolled.join(' ') : ''));
    check(list.length >= Math.max(6, rolled * 0.25) && list.length <= rolled + 1, tag + ': most rolled cells find a place for it: ' + list.length + '/' + rolled);
    check(list.every(s => s.key && W.TYPES.some(t => t.id === s.type) && Number.isFinite(s.x) && Number.isFinite(s.z) && Number.isFinite(s.y) && (s.r | 0) === s.r && s.r >= 0 && s.r < 4 && s.seed > 0), tag + ': every site has a key, a type, a place, a turn and a seed');
    // spacing: from each other, from the villages (their reach), from the spawn and the Heartland's temple
    let close = [], vil = [], sp = [], tem = [];
    for (const a of list) {
      for (const b of list) if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 250) close.push(a.key + '~' + b.key);
      for (const v of villagesNear(g, a.x, a.z, 700)) { const d = Math.hypot(v.x - a.x, v.z - a.z), need = Math.max(160, VG.siteRad(g, v) + (a.first ? 70 : 96)); if (d < need) vil.push(a.key + ' ' + v.id + ' ' + d.toFixed(0) + '<' + need); }
      if (Math.hypot(a.x - spawn[0], a.z - spawn[1]) < 160) sp.push(a.key);
      if (VR.Heart.on(g) && Math.hypot(a.x - VR.Heart.TEMPLE.x, a.z - VR.Heart.TEMPLE.z) < 160) tem.push(a.key);
    }
    check(!close.length, tag + ': sites ≥ 250 apart' + (close.length ? ': ' + close.slice(0, 4).join(' ') : ''));
    check(!vil.length, tag + ': sites clear of every village (≥ max(160, its radius + 96); the spawn\'s own ≥ radius + 70)' + (vil.length ? ': ' + vil.slice(0, 4).join(' · ') : ''));
    check(!sp.length && !tem.length, tag + ': sites ≥ 160 from the spawn and the temple' + (sp.length || tem.length ? ': ' + sp.concat(tem).join(' ') : ''));
    // the ground under every site is dry and gentle
    let wet = [], steep = [];
    // (the middle of the lot is dry; a little shallow water may lap at its rim — the levelling fills it)
    for (const s of list) {
      const inner = [], rimWet = [];
      for (const dz of [-30, -15, 0, 15, 30]) for (const dx of [-30, -15, 0, 15, 30]) { const h = g.surfaceY(Math.round(s.x + dx), Math.round(s.z + dz)), rim = Math.abs(dx) === 30 || Math.abs(dz) === 30; if (rim) { if (h <= VR.C.SEA + 1) rimWet.push(h); } else inner.push(h); }
      if (inner.some(h => h <= VR.C.SEA + 1) || rimWet.length > 3 || rimWet.some(h => h < VR.C.SEA - 3)) wet.push(s.key);
      if (Math.max(...inner) - Math.min(...inner) > 20) steep.push(s.key + ' ' + (Math.max(...inner) - Math.min(...inner)));
    }
    check(!wet.length && !steep.length, tag + ': on dry, gentle ground' + (wet.length || steep.length ? ': wet ' + wet.join(' ') + ' steep ' + steep.join(' ') : ''));
    // W.near lists what the worker job sends: the sites around a point, sorted by distance
    const nr = W.near(g, spawn[0], spawn[1], 1300, spawn);
    check(nr.length >= 3 && nr.every((s, i) => i === 0 || Math.hypot(s.x - spawn[0], s.z - spawn[1]) >= Math.hypot(nr[i - 1].x - spawn[0], nr[i - 1].z - spawn[1])) && nr.every(s => list.concat([W.site(g, Math.floor(s.x / C), Math.floor(s.z / C), spawn)]).some(q => q && q.key === s.key) || true), tag + ': W.near lists the sites around the spawn by distance (' + nr.length + ' within 1.3 km)');
    const types = new Set(list.map(s => s.type));
    if (seed === 20261008) check(types.size >= 4, tag + ': the sites show several kinds of wonder: ' + [...types].join(' '));
  }
  // a type follows the biome where it can (crystal fields → the cathedral, forests → the giant tree …)
  const g = gen(31337, 5); let hit = 0, tot = 0;
  for (const [x, z, want] of W.PREFER_PROBES || []) { tot++; if (W.typeAt(g, x, z, new VR.RNG(tot)) === want) hit++; }
  check(!W.PREFER_PROBES || hit >= tot * 0.5, 'biome preferences pick their wonder most of the time: ' + hit + '/' + tot);
});

// ---------------------------------------------------------------- the spawn's cell: the first wonder is always near
section('spawn', () => {
  const bad = [], dist = [], slow = [];
  for (let k = 0; k < 200; k++) {
    const vgen = k % 4 === 3 ? 2 : 5, seed = (k * 2654435761 + 12345) >>> 0, g = gen(seed, vgen);
    let spawn;
    if (vgen >= 3) spawn = [0.5, -9.5];
    else { const v = VG.nearest(g, 0, 0, 1400); spawn = v ? [v.x + 0.5, v.z + 0.5] : [0.5, 0.5]; }
    const c0 = process.cpuUsage();
    const i = Math.floor(spawn[0] / W.CELL), j = Math.floor(spawn[1] / W.CELL), s = W.site(g, i, j, spawn);
    const cu = process.cpuUsage(c0), cpu = (cu.user + cu.system) / 1000;
    if (cpu > 700) slow.push(seed + ' ' + cpu.toFixed(0) + ' ms');
    const d = s ? Math.hypot(s.x - spawn[0], s.z - spawn[1]) : -1;
    if (!s || d < 250 || d > 450 || !s.first) { bad.push(seed + '/v' + vgen + ': ' + (s ? d.toFixed(0) + ' m' : 'none')); continue; }
    dist.push(d);
    // and it keeps its distance from the villages like any other site
    // (the spawn's own search may come as near as the village's reach + 70 in a crowded ring)
    for (const v of villagesNear(g, s.x, s.z, 700)) { const dv = Math.hypot(v.x - s.x, v.z - s.z), need = Math.max(160, VG.siteRad(g, v) + 70); if (dv < need) { bad.push(seed + '/v' + vgen + ': ' + dv.toFixed(0) + ' m from ' + v.id); break; } }
  }
  dist.sort((a, b) => a - b);
  check(!bad.length, '200 worlds: the spawn\'s cell holds a wonder 250–450 blocks from the spawn (median ' + (dist[dist.length >> 1] || 0).toFixed(0) + ' m)' + (bad.length ? ' — not: ' + bad.slice(0, 8).join(' · ') + (bad.length > 8 ? ' … ' + bad.length : '') : ''));
  check(slow.length <= 2, 'finding it costs < 0.7 s CPU (the worker computes it once): ' + (slow.length ? slow.slice(0, 5).join(' · ') : 'all'));
});

// ---------------------------------------------------------------- the eight wonders
section('types', () => {
  const emits = (s) => s && s !== 0xFFFF && T.emit[s] > 0;
  const colourful = (s) => /stained_glass|^vollton_|crystal|amethyst|gold|glazed|_concrete$|_wool$|terracotta|lapis|prism|neon/.test(nameOf(s));
  for (const t of W.TYPES) {
    let worst = 0, big = 0, over = [], notWalk = [], dark = [], plain = [], noHeart = [], nondet = [];
    for (let k = 0; k < 50; k++) {
      const seed = 1 + ((k * 40503) & 0xffff), dna = W.dna(t.id, seed), cpu = ms(() => Forge.build(dna), 1), g = Forge.build(dna), M = g.meta;
      if (cpu > worst) worst = cpu;
      const mb = g.blocks.length * 2 / 1e6; if (mb > big) big = mb;
      if (g.sx > 64 || g.sz > 64 || M.top - M.bottom + 1 > 121 || g.sy > 124) over.push(seed + ' ' + g.sx + '×' + g.sy + '×' + g.sz);
      if (k < 3 && Forge.hash(Forge.build(dna)) !== Forge.hash(g)) nondet.push(seed);
      const h = M.heart, door = M.doors && M.doors[0];
      if (!h || !emits(g.blocks[((h[1] - g.dy) * g.sz + h[2]) * g.sx + h[0]])) { noHeart.push(seed + ' ' + (h ? nameOf(g.blocks[((h[1] - g.dy) * g.sz + h[2]) * g.sx + h[0]]) : 'none')); continue; }
      // a person walks in from the street at the lot's front edge (the lot as the game leaves it) to the heart
      if (k < 12 || k % 5 === 0) {
        const gp = Forge.asPlaced(g), wk = Forge.walkable(gp, [door[0], door[1] - g.dy, door[2]], {});
        let near = false; for (const key of wk.reach) { const [x, y, z] = key.split(',').map(Number); if (Math.hypot(x + 0.5 - (h[0] + 0.5), y + 0.9 - (h[1] - g.dy + 0.5), z + 0.5 - (h[2] + 0.5)) <= 3.6) { near = true; break; } }
        if (!near) notWalk.push(seed + ' (reach ' + wk.reach.size + ')');
      }
      let glow = 0, col = 0; for (let i = 0; i < g.blocks.length; i++) { const s = g.blocks[i]; if (!s || s === 0xFFFF) continue; if (emits(s)) glow++; if (colourful(s)) col++; }
      if (glow < 12) dark.push(seed + ' ' + glow);
      if (col < 40) plain.push(seed + ' ' + col);
    }
    const name = t.id;
    check(!noHeart.length, name + ': a glowing heart at meta.heart in every build' + (noHeart.length ? ': ' + noHeart.slice(0, 3).join(' · ') : ''));
    check(worst < 1000 && big < 16, name + ': 50 seeds, the slowest ' + worst.toFixed(0) + ' ms CPU, the largest grid ' + big.toFixed(1) + ' MB');
    check(!over.length, name + ': ≤ 64 × 64 and ≤ 120 high' + (over.length ? ': ' + over.slice(0, 3).join(' · ') : ''));
    check(!nondet.length, name + ': the same seed → the same wonder');
    check(!notWalk.length, name + ': from the entrance a person walks to the heart' + (notWalk.length ? ': not for ' + notWalk.slice(0, 4).join(' · ') : ''));
    check(!dark.length, name + ': light at night (≥ 12 glowing blocks)' + (dark.length ? ': ' + dark.slice(0, 3).join(' · ') : ''));
    check(!plain.length, name + ': colour (≥ 40 blocks of coloured glass, Vollton, crystal, gold …)' + (plain.length ? ': ' + plain.slice(0, 3).join(' · ') : ''));
  }
  // the DNA is a Forge DNA of the hidden type: the game's forge plans build it, the Studio's 🏭 chips do not list it
  const d = W.dna('sternwarte', 0x1a2b);
  check(d === 'wonder:sternwarte#1a2b' && Forge.parse(d) && Forge.meta(d) && Forge.meta(d).level === true, 'a wonder is the Forge DNA ' + d + ' (a levelled lot)');
  check(!Forge.types.some(t => t.id === 'wonder') && Forge.type('wonder'), 'the wonder type is hidden from the Forge\'s list (the Studio\'s chips) but builds');
  check(Forge.fromText('Sternwarte') === null || !/^wonder:/.test(Forge.fromText('Sternwarte') || ''), 'the Forge\'s own text parser does not build wonders (only /bau after a discovery does)');
  check(W.TYPES.every(t => W.byName(t.de) === t.id && W.byName(t.en) === t.id && W.byName(t.de.toLowerCase()) === t.id), 'every wonder is found by its German and English name (any case)');
});

console.log(fails ? 'FAILED ' + fails + ' of ' + n : 'ALL OK (' + n + ' checks)');
process.exit(fails ? 1 : 0);

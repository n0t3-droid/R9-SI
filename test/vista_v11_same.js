// vgen 11's references (t-vista; plan docs/superpowers/plans/2026-10-15-t-vista.md): the Heartland of a new world as the
// vista work leaves it — the vista points' records (place, landmark, composition, wow), the chunks over the land and
// under the first eight vista spurs (blocks, biomes, tints, spawns), the horizon tiles (lod.js) and the far forms
// (far.js) — hashed against the pins below. Once vgen 11 ships, its worlds keep their chunks: a front that changes vgen
// 11 on purpose before that updates the pins (PIN=1 prints them) and says so in its plan; after it, a new vgen.
// (vgen ≤ 10: test/gen_same.js, test/vista_v10_same.js, test/land_v9_same.js.)
//   bash test/wt_run.sh vista_v11_same.js 900
const V = require('./load_shared.js');
const COLS = [[0, 0], [5, 5], [-5, 5], [7, -6], [-8, -6], [13, -4], [20, -15], [17, 9], [21, 14], [28, 2], [36, 2], [-39, 2], [-17, -30], [-6, -35], [33, -15], [-26, 24], [-31, 18], [16, -20], [12, 4], [-14, -9]];
const TILES = [[0, -4, -4], [0, 3, -2], [1, -3, 0], [2, 0, -1], [0, 2, 1], [0, -2, 0]];   // horizon tiles [level, tx, tz]
const FORMS = [[1, 1, 4], [5, 2, 4], [-3, -8, 4], [-7, 5, 4]];                           // far forms [tx, tz, cell]
const PINS = {"plan":"ad987e25","chunks":"e9369675","lod":"72bfe214","far":"4f540cff"};
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const str = (h, s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const mesh = (h, t) => { if (!t) return str(h, 'null'); for (const k of Object.keys(t).sort()) { const v = t[k]; if (v instanceof ArrayBuffer) h = fnv(h, new Uint8Array(v)); else if (v && v.buffer && v.length !== undefined) h = fnv(h, new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); else if (typeof v === 'number' || typeof v === 'boolean') h = str(h, k + v); } return h; };
const hx = (v) => v.toString(16).padStart(8, '0');
const t0 = Date.now();
const g = V.makeGen('overworld', 4242, { vgen: 11 }), P = V.Land.plan(g);
let hp = 2166136261 >>> 0;
for (const v of P.vistas) hp = str(hp, JSON.stringify([v.id, v.x, v.y, v.z, v.lm, v.d, v.eye, v.yaw, v.pitch, v.fov, v.frame, !!v.wow, !!v.arch, v.framed, v.grove]));
const cols = COLS.concat(P.vistas.slice(0, 8).map(v => [v.x >> 4, v.z >> 4]));
let hc = 2166136261 >>> 0;
for (const [cx, cz] of cols) {
  const c = g.generate(cx, cz);
  hc = fnv(hc, c.blocks); if (c.biome) hc = fnv(hc, c.biome);
  if (c.tints) { hc = fnv(hc, c.tints.grass); hc = fnv(hc, c.tints.foliage); hc = fnv(hc, c.tints.water); }
  if (c.spawns) hc = str(hc, JSON.stringify(c.spawns));
}
let hl = 2166136261 >>> 0;
for (const [level, tx, tz] of TILES) hl = mesh(hl, V.LOD.build(g, { level, tx, tz }));
let hf = 2166136261 >>> 0;
if (V.Far && V.Far.form) for (const [tx, tz, cell] of FORMS) { const t = V.Far.form(g, { tx, tz, cell }); if (t) delete t.tris; hf = mesh(hf, t ? { verts: t.verts, idx: t.idx, count: t.count, minY: t.minY, maxY: t.maxY } : null); }
const now = { plan: hx(hp), chunks: hx(hc), lod: hx(hl), far: hx(hf) };
if (process.env.PIN) { console.log(JSON.stringify(now)); process.exit(0); }
console.log(`  vgen 11: ${JSON.stringify(now)}\n  pinned:  ${JSON.stringify(PINS)}  (${P.vistas.length} vista points, ${cols.length} columns, ${TILES.length} horizon tiles, ${FORMS.length} far forms; ${Date.now() - t0} ms)`);
let fails = 0;
for (const k of Object.keys(PINS)) {
  const ok = now[k] === PINS[k]; if (!ok) fails++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + `vgen 11 ${k}: ${ok ? 'as pinned' : 'changed against the pin (' + now[k] + ' against ' + PINS[k] + ')'}`);
}
const sane = !!V.Vista && V.Vista.on(g) && P.vistas.length >= 12;
if (!sane) fails++;
console.log(sane ? `  ✓ a vgen-11 world with its vista points (${P.vistas.length})` : '  ✗ no vista layer in this vgen-11 world');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

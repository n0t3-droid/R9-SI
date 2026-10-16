// The vista work (t-vista, vgen 11; plan docs/superpowers/plans/2026-10-15-t-vista.md) leaves every vgen-10 world as
// it was: vgen 10 shipped with v0.46, and only modified columns are saved (storage.js), so a changed vgen-10 generator
// would grow new pieces beside a player's saved columns. The Heartland's chunks of a vgen-10 world — blocks, biomes,
// tints, spawns —, its horizon tiles (lod.js) and its far forms (far.js) are hashed
//   1. against the hashes pinned at the base of this front (9b48d51: v0.46 + f-ipu), and
//   2. here with the shared code as built and in a second node without gen_vista.js (R9_SKIP=gen_vista).
// A front that changes vgen 10 on purpose updates the pins below and says so in its plan (1); the vista module itself
// may never change a vgen-10 world (2).
//   bash test/wt_run.sh vista_v10_same.js 900        (PIN=1 prints the hashes to pin)
const { execFileSync } = require('child_process');
// columns over the land: the temple, the plaza's ways, the city's edge, the farms, the lake, the falls, the ridge, the
// north crossroads, the citadel's foot, the east grove
const COLS = [[0, 0], [5, 5], [-5, 5], [7, -6], [-8, -6], [13, -4], [20, -15], [17, 9], [21, 14], [28, 2], [36, 2], [-39, 2], [-17, -30], [-6, -35], [33, -15], [-26, 24], [-31, 18], [16, -20], [12, 4], [-14, -9]];
const TILES = [[0, -4, -4], [0, 3, -2], [1, -3, 0], [2, 0, -1], [0, 2, 1], [0, -2, 0]];   // horizon tiles [level, tx, tz]
const FORMS = [[1, 1, 4], [5, 2, 4], [-3, -8, 4], [-7, 5, 4]];                           // far forms [tx, tz, cell]
const PINS = {"chunks":"58881d7c","lod":"d15b57c9","far":"45d0dd2a"};
const hashes = () => {
  const V = require('./load_shared.js');
  const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const str = (h, s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const mesh = (h, t) => { if (!t) return str(h, 'null'); for (const k of Object.keys(t).sort()) { const v = t[k]; if (v instanceof ArrayBuffer) h = fnv(h, new Uint8Array(v)); else if (v && v.buffer && v.length !== undefined) h = fnv(h, new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); else if (typeof v === 'number' || typeof v === 'boolean') h = str(h, k + v); } return h; };
  const g = V.makeGen('overworld', 4242, { vgen: 10 });
  let h = 2166136261 >>> 0;
  for (const [cx, cz] of COLS) {
    const c = g.generate(cx, cz);
    h = fnv(h, c.blocks); if (c.biome) h = fnv(h, c.biome);
    if (c.tints) { h = fnv(h, c.tints.grass); h = fnv(h, c.tints.foliage); h = fnv(h, c.tints.water); }
    if (c.spawns) h = str(h, JSON.stringify(c.spawns));
  }
  let hl = 2166136261 >>> 0;
  for (const [level, tx, tz] of TILES) hl = mesh(hl, V.LOD.build(g, { level, tx, tz }));
  let hf = 2166136261 >>> 0;
  if (V.Far && V.Far.form) for (const [tx, tz, cell] of FORMS) { const t = V.Far.form(g, { tx, tz, cell }); if (t) delete t.tris; hf = mesh(hf, t ? { verts: t.verts, idx: t.idx, count: t.count, minY: t.minY, maxY: t.maxY } : null); }
  const hx = (v) => v.toString(16).padStart(8, '0');
  return { chunks: hx(h), lod: hx(hl), far: hx(hf) };
};
if (process.argv[2] === '--child') { process.stdout.write(JSON.stringify(hashes())); process.exit(0); }
const t0 = Date.now();
const withV = hashes();
if (process.env.PIN) { console.log(JSON.stringify(withV)); process.exit(0); }
const without = JSON.parse(execFileSync(process.execPath, [__filename, '--child'], { env: Object.assign({}, process.env, { R9_SKIP: 'gen_vista' }), maxBuffer: 1 << 20 }).toString());
console.log(`  with gen_vista.js: ${JSON.stringify(withV)}\n  without:           ${JSON.stringify(without)}\n  pinned (9b48d51):  ${JSON.stringify(PINS)}  (${COLS.length} columns, ${TILES.length} horizon tiles, ${FORMS.length} far forms; ${Date.now() - t0} ms)`);
let fails = 0;
for (const k of Object.keys(PINS)) {
  const a = withV[k] === PINS[k], b = withV[k] === without[k];
  if (!a) fails++; if (!b) fails++;
  console.log((a ? '  ✓ ' : '  ✗ ') + `vgen 10 ${k}: ${a ? 'as pinned at the base' : 'changed against the pin (' + withV[k] + ' against ' + PINS[k] + ')'}`);
  console.log((b ? '  ✓ ' : '  ✗ ') + `vgen 10 ${k}: ${b ? 'the same with and without the vista module' : 'the vista module changed it (' + withV[k] + ' against ' + without[k] + ')'}`);
}
const V = require('./load_shared.js');
const sane = Object.keys(without).length === 3 && (!!V.Vista || !require('fs').existsSync(__dirname + '/../src/shared/gen_vista.js'));
if (!sane) fails++;
console.log(sane ? '  ✓ the comparison is what it says (the module loaded here, left out in the second node)' : '  ✗ the comparison is not what it says (gen_vista.js not loaded, or hashes missing)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

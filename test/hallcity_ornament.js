// Weißstadt round 2 — the splendour (docs/superpowers/plans/2026-10-08-t-town2.md): the hall city's ornament, in the
// generated blocks of two halls (seed 53's meadow site of cell (−2, −1) and seed 2026's of cell (−3, 1), another frame):
//   1. the kit: the arched window and the word signs registered late, every shop word in both tables (German first) and
//      drawn in our own pixel font in both languages
//   2. the façades: for every shop house a plinth and pilasters at the bay edges, a cornice at every storey, arches over
//      the upper windows (≥ 60 %), a storefront (glass, sill, door), a striped awning over each shop window and a word
//      sign on every shop; flower boxes or vines on at least a third of the houses; columns at the loggias' unit edges
//   3. the grand staircase: thirteen wide, its steps rise continuously to the gallery with three landings, balusters and
//      a rail on both sides, columns flanking it; the gallery closed (a balustrade on every open edge); arched niches with
//      lanterns in the apse wall
//   4. the market aisles: a stall at least every 8 blocks along both aisles, each with a counter, a striped canopy and a
//      lantern on a bracket, a barrel pair beside, benches and potted plants between, wooden ribs every 12 blocks
//   5. the exterior: buttresses at least every 12 blocks with a window between every pair, a portal in the entrance end
//      (a seven-wide pointed arch, two-step surround), a cornice band under the glass roof, oculi at the aisle ends,
//      lantern turrets on the ridge
//   6. the light: a lantern at every stall and four round the fountain; warm block light at the stalls (the light engine)
//   7. no crystal anywhere
// usage: bash test/wt_run.sh hallcity_ornament.js 600
const V = require('./load_shared.js');
const path = require('path');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(path.join(__dirname, '..', 'src', 'main', f + '.js'));
const VG = V.VillageGen, R = V.R, VM = V.VM, I = V.I18N, T = V.Town;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const nm = (s) => (s > 0 && R.types[R.T.type[s]]) ? R.types[R.T.type[s]].name : 'air';
const props = (s) => (s > 0 && R.types[R.T.type[s]]) ? R.types[R.T.type[s]].decode(s) : {};
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + ' %';

// ---------------------------------------------------------------- 1. the kit
console.log('1. the kit');
const WORDS = (T && T.WORDS) || [];
check(!!R.byName.vm_town_arch3 && VM.MODELS.vm_town_arch3 && VM.MODELS.vm_town_arch3.W === 3 && VM.MODELS.vm_town_arch3.H === 3, 'the arched window (3 × 3, wood frame, stone archivolt and keystone) is a block');
check(WORDS.length >= 10, `at least ten shop words (${WORDS.length})`);
{
  const de = I.dict.de || {}, en = I.dict.en || {};
  const noBlock = WORDS.filter(k => !R.byName['vm_town_word_' + k]), noKey = WORDS.filter(k => typeof de['town.sign.' + k] !== 'string' || typeof en['town.sign.' + k] !== 'string');
  check(!noBlock.length, `every word is a sign block (${noBlock.join(' ') || 'all'})`);
  check(!noKey.length, `every word is in both tables, German first (${noKey.join(' ') || 'all'}: e.g. ${de['town.sign.' + WORDS[0]]} / ${en['town.sign.' + WORDS[0]]})`);
  const miss = new Set();
  for (const k of WORDS) for (const w of [de['town.sign.' + k], en['town.sign.' + k]]) for (const ch of String(w || '').toUpperCase()) if (ch !== ' ' && !(T.FONT && T.FONT[ch])) miss.add(ch);
  check(miss.size === 0, `our own pixel font draws every letter of every word (${[...miss].join('') || 'none missing'})`);
  // the sign shows the language of the table: built once in German and once in English, the gold differs where the words do
  if (!(T && T.setWords)) check(false, 'VR.Town.setWords: the word table for the signs');
  else {
  const gold = (k) => { const m = VM.MODELS['vm_town_word_' + k]; VM.materialize(m); let n = 0; for (let i = 0; i < m.vol.length; i++) { const c = m.pal[m.vol[i]] & 0xffffff; if (c === T.COL.goldL) n++; } return n; };
  T.setWords(Object.fromEntries(WORDS.map(k => [k, de['town.sign.' + k]])));
  const gDe = gold('baker');
  T.setWords(Object.fromEntries(WORDS.map(k => [k, en['town.sign.' + k]])));
  const gEn = gold('baker');
  check(gDe > 30 && gEn > 30 && gDe !== gEn, `a sign is drawn in the table's language (${de['town.sign.baker']}: ${gDe} gold voxels, ${en['town.sign.baker']}: ${gEn})`);
  T.setWords(null);
  }
}

// ---------------------------------------------------------------- the halls
function hall(seed, cell) {
  const g = new V.OverworldGen(seed, { worldType: 'default', vgen: 9 }), s = VG.site(g, cell[0], cell[1]);
  if (!s || s.style !== 'hall') return null;
  const plan = VG.plan(g, s), Hh = plan.hall, F = Hh.F, r = Hh.r, cx = Hh.cx, cz = Hh.cz;
  const cols = new Map();
  const colOf = (x, z) => { const k = x * 65536 + z; let c = cols.get(k); if (!c) { c = new Int32Array(256).fill(-1); cols.set(k, c); } return c; };
  for (const b of plan.chunks.values()) {
    for (let i = 0; i < b.f.length; i += 5) { const c = colOf(b.f[i], b.f[i + 1]); for (let y = Math.max(1, b.f[i + 2]); y <= Math.min(254, b.f[i + 3]); y++) c[y] = b.f[i + 4]; }
    for (let i = 0; i < b.o.length; i += 4) { const y = b.o[i + 1]; if (y < 1 || y > 254) continue; colOf(b.o[i], b.o[i + 2])[y] = b.o[i + 3]; }
  }
  const W2 = (u, v) => { const q = ROT[r](u, v); return [cx + q[0], cz + q[1]]; };
  const stAt = (x, y, z) => { const c = cols.get(x * 65536 + z); return c ? c[y] : -1; };
  const at = (u, y, v) => { const [x, z] = W2(u, v); return stAt(x, y, z); };
  const atN = (u, y, v) => { const s = at(u, y, v); return s < 0 ? '?' : nm(s); };
  const lotN = (h, u, y, v) => { const [rr, ox, oz] = h.frame, q = ROT[rr](u, v), s = stAt(ox + q[0], y, oz + q[1]); return s < 0 ? '?' : nm(s); };
  const lotS = (h, u, y, v) => { const [rr, ox, oz] = h.frame, q = ROT[rr](u, v); return stAt(ox + q[0], y, oz + q[1]); };
  return { g, s, plan, Hh, F, r, cx, cz, W2, at, atN, lotN, lotS, stAt };
}
const HALLS = [['seed 53', hall(53, [-2, -1])], ['seed 2026', hall(2026, [-3, 1])]];
check(HALLS.every(([, h]) => !!h), 'both sites are hall cities');
const solid = (n) => n !== 'air' && n !== '?' && !/vines|carpet/.test(n);
const PIL = /^(quartz_pillar|chiseled_quartz_block|smooth_quartz)$/;

for (const [label, H] of HALLS) {
  if (!H) continue;
  const { Hh, F, at, atN, lotN, lotS, plan } = H;
  // ---------------------------------------------------------------- 2. the façades
  console.log(`2. the façades (${label}, F ${F}, frame ${H.r})`);
  const houses = Hh.houses.filter(h => h.lot && h.frame);
  check(houses.length === 12, `twelve shop houses with their lot frame (${houses.length})`);
  let pilN = 0, pilOk = 0, plinth = 0, corn = 0, cornOk = 0, wins = 0, arched = 0, keys = 0, shop = 0, signs = 0, awn = 0, flowery = 0;
  const trades = new Set();
  for (const h of houses) {
    const fl = h.lot.floors, top = F + 5 * fl;
    for (const u of [0, 4, 7, 11]) for (let k = 1; k < fl; k++) for (let y = F + 5 * k + 1; y <= F + 5 * k + 4; y++) { pilN++; if (PIL.test(lotN(h, u, y, -1))) pilOk++; }
    for (const u of [0, 11]) { pilN += 4; for (let y = F + 1; y <= F + 4; y++) if (PIL.test(lotN(h, u, y, -1))) pilOk++; if (lotN(h, u, F + 1, -1) === 'smooth_quartz') plinth++; }
    for (let k = 1; k <= fl; k++) { let n = 0; for (let u = 0; u <= 11; u++) { const s = lotS(h, u, F + 5 * k, -1), n0 = nm(s); if (/quartz_(stairs|slab)|smooth_quartz_stairs|smooth_quartz_slab/.test(n0) && (!/stairs/.test(n0) || props(s).half === 'top' || props(s).half === 1)) n++; } corn++; if (n >= 10) cornOk++; }
    for (let k = 1; k < fl; k++) {
      const y0 = F + 5 * k;
      for (const u0 of [1, 8]) { wins++; if (lotN(h, u0, y0 + 1, 0) === 'vm_town_arch3' && lotN(h, u0 + 2, y0 + 3, 0) === 'vm_town_arch3') { arched++; if (lotN(h, u0 + 1, y0 + 4, -1) === 'chiseled_quartz_block') keys++; } }
      for (const u0 of [5, 6]) { wins++; if (/^vm_town_window_/.test(lotN(h, u0, y0 + 1, 0))) arched++; }
    }
    const glass = [1, 2, 3, 8, 9, 10].every(u => /glass/.test(lotN(h, u, F + 2, 0)) && /glass/.test(lotN(h, u, F + 3, 0)));
    const sill = [1, 2, 3, 8, 9, 10].every(u => /slab/.test(lotN(h, u, F + 1, -1)));
    const door = /door/.test(lotN(h, 5, F + 1, 0)) && lotN(h, 5, F + 1, -1) === 'air';
    if (glass && sill && door) shop++;
    if ([1, 2, 3, 8, 9, 10].every(u => /^vm_town_awning_/.test(lotN(h, u, F + 3, -1)))) awn++;
    const sg = [4, 5, 6, 7].map(u => lotN(h, u, F + 4, -1));
    if (sg.every(n => n === 'vm_town_word_' + h.lot.trade)) { signs++; trades.add(h.lot.trade); }
    let fv = 0; for (let u = -1; u <= 12; u++) for (let y = F + 5; y <= top + 2; y++) for (const v of [-1, -2]) if (/vines|windowbox/.test(lotN(h, u, y, v))) fv++;
    if (fv >= 4) flowery++;
    void top;
  }
  check(pilOk === pilN, `pilasters one block proud at the bay edges u 0, 4, 7, 11 of the upper storeys and at the corners (${pilOk} of ${pilN} cells)`);
  check(plinth === 2 * houses.length, `a plinth block under every corner pilaster (${plinth} of ${2 * houses.length})`);
  check(cornOk === corn, `a cornice line at every storey and under the gable (${cornOk} of ${corn} lines)`);
  check(arched >= 0.6 * wins && keys >= 0.5 * wins * 0.5, `arched heads over the upper windows (${arched} of ${wins}, ${pct(arched, wins)}; ${keys} keystones over the three-wide ones)`);
  check(shop === houses.length, `a storefront on every shop: two shop windows with a sill, the door in the middle (${shop} of ${houses.length})`);
  check(awn === houses.length, `a striped awning over each shop window (${awn} of ${houses.length})`);
  check(signs === houses.length && trades.size >= 8, `a word sign over every shop door (${signs} of ${houses.length}, ${trades.size} trades: ${[...trades].join(' ')})`);
  check(flowery * 3 >= houses.length, `flower boxes or vines on at least a third of the façades (${flowery} of ${houses.length})`);
  // the loggia houses: columns at the unit edges, carrying the galleries
  {
    let n = 0, ok = 0;
    for (const l of Hh.loggias.filter(l => l.frame)) for (const u of [0, 9]) for (let y = F + 1; y <= F + 14; y++) { n++; if (PIL.test(lotN(l, u, y, -1))) ok++; }
    check(n > 0 && ok >= 0.9 * n, `columns at the loggias' unit edges carry the galleries (${ok} of ${n} cells)`);
  }

  // ---------------------------------------------------------------- 3. the grand staircase and the gallery
  console.log(`3. the grand staircase and the gallery (${label})`);
  // the walking surface: the highest solid cell up to the gallery's rail with two free cells over it (roof eaves, vines and
  // lanterns overhead count as free)
  const free = (u, y, v) => { const n = atN(u, y, v); return n === 'air' || /roof|slate|vines|lantern|beam/.test(n); };
  const surf = (u, v) => { for (let y = F + 9; y >= F; y--) { const n = atN(u, y, v); if (solid(n) && !/roof|slate|beam/.test(n) && free(u, y + 1, v) && free(u, y + 2, v)) return y - F; } return -1; };
  {
    const prof = []; for (let v = 34; v <= 56; v++) prof.push([v, surf(0, v)]);
    let mono = true, maxStep = 0, reach = -1;
    for (let i = 1; i < prof.length; i++) { const d = prof[i][1] - prof[i - 1][1]; if (d < 0) mono = false; maxStep = Math.max(maxStep, d); if (prof[i][1] === 8 && reach < 0) reach = prof[i][0]; }
    const runs = []; let run = 1;
    for (let i = 1; i < prof.length; i++) { if (prof[i][1] === prof[i - 1][1]) run++; else { if (prof[i - 1][1] >= 1 && prof[i - 1][1] <= 7 && run >= 2) runs.push(prof[i - 1][1]); run = 1; } }
    check(mono && maxStep <= 1 && prof[0][1] === 0 && reach > 0, `the steps rise continuously from the floor to the gallery (${prof.map(p => p[1]).join(' ')}; the gallery reached at v ${reach})`);
    check(runs.length >= 3, `three landings on the way up (at ${runs.join(', ')})`);
    const stairV = prof.filter(p => p[1] >= 1 && p[1] <= 7).map(p => p[0]);
    let wide = 0; for (const v of stairV) { let w = 0; for (let u = -10; u <= 10; u++) if (surf(u, v) === surf(0, v)) w++; if (w >= 11) wide++; }
    check(stairV.length >= 8 && wide === stairV.length, `eleven or more wide all the way up (${wide} of ${stairV.length} rows; ${(() => { let w = 0; for (let u = -10; u <= 10; u++) if (surf(u, stairV[2]) === surf(0, stairV[2])) w++; return w; })()} wide)`);
    let bal = 0, rail = 0, n = 0;
    for (const v of stairV) for (const s of [-1, 1]) {
      n++; const h = surf(0, v); let edge = 0; for (let u = 6; u <= 9; u++) if (surf(s * u, v) !== h) { edge = u; break; }
      const b = atN(s * edge, F + h + 1, v), c = atN(s * edge, F + h + 2, v);
      if (/balustrade|quartz_pillar/.test(b) || /balustrade|quartz_pillar/.test(atN(s * edge, F + h + 2, v)) && solid(b)) bal++;
      if (/slab|quartz_pillar|lantern|lamp|chiseled/.test(c)) rail++;
    }
    check(bal === n, `balusters on both sides of every step and landing (${bal} of ${n})`);
    check(rail >= 0.8 * n, `a rail (slab) on the balusters, newels at the landings (${rail} of ${n})`);
    let cols = 0; for (const s of [-1, 1]) for (const vs of [[stairV[0] - 1, stairV[0] + 2], [stairV[stairV.length - 1] - 2, stairV[stairV.length - 1]]]) { let best = 0; for (let v = vs[0]; v <= vs[1]; v++) for (let a = 8; a <= 9; a++) { let hgt = 0; for (let y = F + 1; y <= F + 12; y++) if (atN(s * a, y, v) === 'quartz_pillar') hgt++; best = Math.max(best, hgt); } if (best >= 8) cols++; }
    check(cols === 4, `columns flank the staircase up to the gallery at its foot and its head (${cols} of 4)`);
    // the gallery closed: every gallery floor cell beside a lower cell inside the hall carries a balustrade (the stair's
    // arrival aside)
    // (a gallery cell: its floor at 8, nothing over it but a balustrade, a post, a lamp, a bench, a plant or the bell)
    const RAIL = /balustrade|quartz_pillar|lamp|lantern|chiseled/;
    const galCell = (u, v) => solid(atN(u, F + 8, v)) && (atN(u, F + 9, v) === 'air' || /balustrade|quartz_pillar|lamp|lantern|bench|bell|planter/.test(atN(u, F + 9, v))) && atN(u, F + 10, v) !== '?' && !solid(atN(u, F + 11, v));
    let open = 0, edges = 0;
    for (let v = Hh.V1 - 1; v <= 80; v++) for (let u = -27; u <= 27; u++) {
      if (!galCell(u, v)) continue;
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (galCell(u + du, v + dv)) continue;
        const h2 = surf(u + du, v + dv); if (h2 < 0 || h2 >= 7) continue;
        edges++; if (!RAIL.test(atN(u, F + 9, v))) open++;
      }
    }
    check(edges >= 30 && open === 0, `the gallery is closed: a balustrade on every open edge (${edges} edges, ${open} open)`);
    let niches = 0;
    for (let v = 52; v <= 80; v++) for (let u = -29; u <= 29; u++) { const d = Math.hypot(u, v - 51); if (d < 26.6 || d > 28.6) continue; for (let y = F + 9; y <= F + 13; y++) if (/^(lantern|vx_lantern)$/.test(atN(u, y, v))) niches++; }   // (in the wall: the gallery's own floor lanterns at 26 do not count)
    check(niches >= 5, `arched niches with lanterns in the apse wall (${niches} lanterns)`);
  }

  // ---------------------------------------------------------------- 4. the market aisles
  console.log(`4. the market aisles (${label})`);
  {
    const stalls = Hh.stalls || [];
    const len = Hh.V1 - (Hh.V0 + 3) + 1 - 7;
    for (const s of [-1, 1]) {
      const mine = stalls.filter(st => st.s === s);
      let ok = 0, lamp = 0, barrels = 0;
      for (const st of mine) {
        const cells = []; for (let v = st.v0; v <= st.v0 + 2; v++) for (const a of [30, 31]) for (let y = F + 1; y <= F + 3; y++) cells.push(atN(s * a, y, v));
        if (cells.filter(n => /^vm_town_stall_/.test(n)).length >= 15) ok++;
        let L = 0; for (let v = st.v0 - 1; v <= st.v0 + 3; v++) for (let a = 30; a <= 33; a++) for (let y = F + 1; y <= F + 5; y++) { const x = at(s * a, y, v); if (x > 0 && R.T.emit[x]) L++; }
        if (L) lamp++;
        let b = 0; for (let v = st.v0 - 2; v <= st.v0 + 4; v++) for (const a of [30, 31]) if (atN(s * a, F + 1, v) === 'vx_barrel') b++;
        if (b >= 2) barrels++;
      }
      check(mine.length >= len / 8, `aisle ${s > 0 ? '+' : '−'}: a stall at least every 8 blocks (${mine.length} stalls on ${len} blocks)`);
      check(ok === mine.length && lamp === mine.length, `each with a counter, four posts and a striped canopy (${ok}) and a lantern on a bracket (${lamp} of ${mine.length})`);
      check(barrels === mine.length, `a barrel pair beside each (${barrels} of ${mine.length})`);
      let bench = 0, plant = 0; for (let v = Hh.V0 + 3; v <= Hh.V1; v++) for (const a of [30, 31]) { const n = atN(s * a, F + 1, v); if (n === 'vx_bench') bench++; if (n === 'vm_planter') plant++; }
      check(bench >= mine.length - 2 && plant >= mine.length - 2, `benches and potted plants between the stalls (${bench} benches, ${plant} plants)`);
      let ribs = 0, ribN = 0; for (let v = -72; v <= 48; v += 12) { ribN++; let w = 0; for (let a = 30; a <= 45; a++) { let any = false; for (let y = F + 16; y <= F + 26; y++) if (/beam/.test(atN(s * a, y, v))) any = true; if (any) w++; } if (w >= 13) ribs++; }
      check(ribs === ribN, `wooden ribs under the aisle vault every 12 blocks (${ribs} of ${ribN})`);
      // the arcades' side: a passage from the arcade into the aisle at least every 8 blocks
      let gap = 0, worst = 0; for (let v = Hh.V0 + 3; v <= Hh.V1; v++) { const free = [30, 31].every(a => atN(s * a, F + 1, v) === 'air' && atN(s * a, F + 2, v) === 'air'); if (free || Math.abs(v) <= 3) gap = 0; else { gap++; worst = Math.max(worst, gap); } }
      check(worst <= 7, `a way through between the stalls every few blocks (the longest closed stretch ${worst})`);
    }
  }

  // ---------------------------------------------------------------- 5. the exterior
  console.log(`5. the exterior (${label})`);
  {
    for (const s of [-1, 1]) {
      const bt = []; let run = 0;
      for (let v = Hh.V0 - 1; v <= Hh.V1 + 1; v++) { const tall = atN(s * 49, F + 15, v) !== 'air' && atN(s * 49, F + 15, v) !== '?'; if (tall) run++; else { if (run) bt.push(v - 1); run = 0; } }
      check(bt.length >= (Hh.V1 - Hh.V0) / 12, `wall ${s > 0 ? '+' : '−'}: buttresses at least every 12 blocks (${bt.length})`);
      let between = 0; for (let i = 1; i < bt.length; i++) { let g = 0; for (let v = bt[i - 1] + 1; v < bt[i] - 1; v++) for (let y = F + 6; y <= F + 16; y++) if (/glass/.test(atN(s * 47, y, v))) g++; if (g >= 10) between++; }
      check(between >= bt.length - 2, `a tall window between every pair of buttresses (${between} of ${bt.length - 1}, the gate's bay aside)`);
      let tracery = 0; for (let k = -7; k <= 4; k++) { if (k === 0) continue; const v = 10 * k; if (atN(s * 47, F + 10, v - 2) !== 'air' && !/glass/.test(atN(s * 47, F + 10, v - 2)) && /glass/.test(atN(s * 47, F + 8, v - 2))) tracery++; }
      check(tracery >= 10, `tracery: a stone cross in the long wall's windows (${tracery})`);
      let corn = 0, cn = 0; for (let v = Hh.V0; v <= Hh.V1; v++) { cn++; if (/quartz_stairs/.test(atN(s * 49, F + 23, v))) corn++; }
      check(corn >= 0.8 * cn, `a cornice band under the glass roof along the long wall (${corn} of ${cn})`);
    }
    const V0 = Hh.V0;
    let open = 0; for (let u = -3; u <= 3; u++) for (let y = F + 1; y <= F + 5; y++) for (let v = V0; v <= V0 + 2; v++) if (atN(u, y, v) === 'air') open++;
    const pointed = atN(0, F + 8, V0 + 1) === 'air' && atN(-3, F + 8, V0 + 1) !== 'air' && atN(3, F + 8, V0 + 1) !== 'air';
    let step1 = 0, step2 = 0; for (let y = F + 1; y <= F + 6; y++) for (const s of [-1, 1]) { if (solid(atN(s * 4, y, V0 - 1))) step1++; if (solid(atN(s * 5, y, V0 - 2))) step2++; }
    check(open === 7 * 5 * 3 && pointed && step1 === 12 && step2 === 12, `a portal in the entrance end: seven wide through the wall (${open} of 105 open), a pointed arch (${pointed}), a two-step surround (${step1}, ${step2} of 12)`);
    let oculi = 0;
    for (const [v0, v1] of [[V0, V0 + 2], [Hh.V1 + 1, Hh.V1 + 3]]) for (const s of [-1, 1]) { let g = 0; for (let v = v0; v <= v1; v++) for (let u = 33; u <= 39; u++) for (let y = F + 19; y <= F + 24; y++) if (/glass/.test(atN(s * u, y, v))) g++; if (g >= 5) oculi++; }
    check(oculi === 4, `a round window in each aisle end wall (${oculi} of 4)`);
    let turrets = 0; for (let v = V0; v <= Hh.V1; v++) { let L = false; for (let y = F + 41; y <= F + 46; y++) for (let u = -1; u <= 1; u++) if (/lantern/.test(atN(u, y, v))) L = true; if (L) turrets++; }
    check(turrets >= 4, `lantern turrets on the ridge (${turrets})`);
  }

  // ---------------------------------------------------------------- 6. the light
  console.log(`6. the light (${label})`);
  {
    let f = 0; for (let u = -6; u <= 6; u++) for (let v = -6; v <= 6; v++) for (let y = F + 1; y <= F + 4; y++) { const x = at(u, y, v); if (x > 0 && R.T.emit[x] && !/fountain|lamp/.test(nm(x))) f++; }
    check(f >= 4, `four lanterns round the fountain (${f})`);
    const stalls = (Hh.stalls || []).slice(0, 6);
    const g = H.g, cache = new Map();
    const lightAt = (u, y, v) => { const [x, z] = H.W2(u, v), k = (x >> 4) + ',' + (z >> 4); let c = cache.get(k); if (!c) { const ch = g.generate(x >> 4, z >> 4); c = V.computeColumnLight(ch.blocks, true); cache.set(k, c); } return c[(y << 8) | ((z & 15) << 4) | (x & 15)]; };
    let warm = 0; const seen = [];
    for (const st of stalls) { const L = lightAt(st.s * 32, F + 2, st.v0 + 1), r = (L >> 8) & 15, b = L & 15; seen.push(r + '/' + ((L >> 4) & 15) + '/' + b); if (r >= 9 && r >= b + 4) warm++; }
    check(stalls.length && warm === stalls.length, `warm block light in front of the stalls (${warm} of ${stalls.length}: ${seen.join(' ')})`);
  }
  // ---------------------------------------------------------------- 7. no crystal
  const bad = new Set();
  for (const b of plan.chunks.values()) { for (let i = 3; i < b.o.length; i += 4) { const n = nm(b.o[i]); if (/crystal|prism|aether/.test(n)) bad.add(n); } for (let i = 4; i < b.f.length; i += 5) { const n = nm(b.f[i]); if (/crystal|prism|aether/.test(n)) bad.add(n); } }
  check(bad.size === 0, `no crystal anywhere in the town (${[...bad].join(' ') || 'none'})`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

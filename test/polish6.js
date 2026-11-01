// f-polish6 (docs/superpowers/plans/2026-11-01-f-polish6.md; review docs/reviews/v0.55.md): the pure parts.
//  1 · R56-14 the trailer's city reads „Palmenhafen" in German (tables, i18n vars, villager lines, shown names), „Nova
//      Haven" in English; the site's stored name stays
//  2 · R56-18 Funke in a new world's first 75 s: no way ribbon, no drone in the first-person view
//  3 · R56-05 the far flock never darker than 0.7 × the sky band behind it (the floor in the wild program)
//  4 · R56-13 the held block 20 % less saturated (Low and up; Very Low's mesh program unchanged)
//  5 · R56-10 Very Low's ring chunks get a two-tone light (only on Very Low)
//  6 · R56-01 Very Low with seasons on draws no festival models and adds no per-frame festival work
//   bash test/wt_run.sh polish6.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
global.performance = global.performance || require('perf_hooks').performance;
const fs = require('fs');
const M = __dirname + '/../src/main/';
for (const f of ['i18n', 'lang_en', 'lang_de', 'settings_reg', 'first', 'funke', 'first2', 'wildsim']) require(M + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const src = (f) => fs.readFileSync(M + f, 'utf8');

// ---------------------------------------------------------------- 1 · Palmenhafen
console.log('1 · the city\'s German name');
const N = V.Names, I = V.I18N;
check(N && N.shown && N.shown('Nova Haven', 'de') === 'Palmenhafen' && N.shown('Nova Haven', 'en') === 'Nova Haven', 'VR.Names.shown: de „' + (N.shown && N.shown('Nova Haven', 'de')) + '", en „' + (N.shown && N.shown('Nova Haven', 'en')) + '"');
const deVals = JSON.stringify(I.dict.de), enVals = JSON.stringify(I.dict.en);
check(!/Nova Haven/.test(deVals) && /Palmenhafen/.test(deVals), 'the German table: no „Nova Haven" left, „Palmenhafen" in ' + (deVals.match(/Palmenhafen/g) || []).length + ' places');
check(/Nova Haven/.test(enVals) && !/Palmenhafen/.test(enVals), 'the English table keeps „Nova Haven"');
I.lang = 'de';
check(I.t('g.fl.welcomeChat', { name: 'Nova Haven' }).indexOf('Palmenhafen') >= 0 && I.tx('p6.x', { v: 'Nova Haven' }, 'Willkommen in {v}', 'Welcome to {v}') === 'Willkommen in Palmenhafen', 'a name passed in (vars) reads Palmenhafen in German: „' + I.t('g.fl.welcomeChat', { name: 'Nova Haven' }) + '"');
I.lang = 'en';
check(I.tx('p6.x', { v: 'Nova Haven' }, 'Willkommen in {v}', 'Welcome to {v}') === 'Welcome to Nova Haven', 'and Nova Haven in English');
I.lang = 'de';
const gh = fs.readFileSync(__dirname + '/../src/shared/gen_heart.js', 'utf8');
check(/site\.name = 'Nova Haven'/.test(gh), 'the generator\'s stored site name stays (saves, ids)');
for (const [f, re] of [['map.js', /Names\.shown\(nv\.site\.name/], ['map.js', /Names\.shown\(v\.name/], ['villages.js', /Names\.shown\(site\.name/], ['villagers.js', /Names\.shown\(vars\[k\]/], ['cockpit.js', /Names\.shown\(best\.name/]]) check(re.test(src(f)), f + ' shows the name through VR.Names.shown');

// ---------------------------------------------------------------- 2 · Funke's first quiet
console.log('2 · Funke in the first look');
const FK = V.Funke;
check(FK.FIRST_QUIET === 75 && FK.firstQuiet(0, true) && FK.firstQuiet(45, true) && FK.firstQuiet(60, true) && !FK.firstQuiet(75, true) && !FK.firstQuiet(45, false) && !FK.firstQuiet(NaN, true), 'firstQuiet: a new world\'s 0–75 s only (45 s, 60 s quiet; 75 s, an old world, no age: not)');
const fk = src('funke.js');
check(/this\.wayPts > 1 && !this\.quietNow\(\)\) this\.drawWay/.test(fk) && /camMode \| 0\) === 0[^\n]*this\.quietNow\(\)\) return;/.test(fk), 'the ribbon and the first-person drone skip the quiet window');

// ---------------------------------------------------------------- 3 · the flock's sky floor
console.log('3 · the far flock is pale');
const W = V.Wild;
check(W.MURM_SKYK === 0.7 && W.murmSky(20) === 0 && W.murmSky(40) === 0 && W.murmSky(80) > 0.2 && W.murmSky(120) === 0.7 && W.murmSky(400) === 0.7, `murmSky: 0 near, ${W.murmSky(80).toFixed(2)} at 80 m, 0.7 from 120 m`);
let mono = true; for (let d = 0; d < 300; d += 5) if (W.murmSky(d + 5) < W.murmSky(d) - 1e-12) mono = false;
check(mono, 'the floor never falls with the distance');
const wg = src('wildgpu.js');
check(/c = skyFloor\(c, v_rel\);/.test(wg) && /if \(u_mode == 2\) col = skyFloor\(col, v_rel\);/.test(wg) && /max\(c, band \* k\)/.test(wg), 'the wild program floors the impostors and the bird dashes');

// ---------------------------------------------------------------- 4 · the held block
console.log('4 · the held block');
check(V.First2.HAND_SAT === 0.7, 'VR.First2.HAND_SAT 0.7 (70 % of its chroma: about 20 % less saturated on the screen)');
{ const F2 = V.First2, sat = (c) => (Math.max(...c) - Math.min(...c)) / Math.max(...c), lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  let ok = true, worst = 1; for (const c of [[0.42, 0.33, 0.2], [0.2, 0.45, 0.12], [0.5, 0.5, 0.5], [0.6, 0.2, 0.1]]) { const t = F2.handTint(c, F2.HAND_SAT), o = c.map((v, i) => v * t[i]); if (Math.abs(lum(o) - lum(c)) > 0.01) ok = false; if (sat(c) > 0.01) worst = Math.min(worst, 1 - sat(o) / sat(c)); }
  check(ok && worst >= 0.15, 'Very Low: handTint moves a block\'s mean colour toward its luma (saturation ≥ 15 % lower, the luma kept) — least ' + (worst * 100).toFixed(0) + ' %'); }
check(/F2\.handTint\(mesh\.meanCol/.test(src('entities.js')) && /m\.meanCol = /.test(src('entities.js')), 'drawHand tints Very Low\'s hand lights by the block\'s mean colour');
const sh = src('shaders.js'), mesh = sh.slice(sh.indexOf('S.MESH_FS'), sh.indexOf('// ------------------------------------------------------------ particles'));
check(/#ifndef LITE\nuniform float u_desat;/.test(mesh) && /#ifndef LITE\n  if \(u_desat > 0\.0\)/.test(mesh), 'the mesh program\'s desaturation sits behind LITE (Very Low unchanged)');
check(/P\.mesh = GL\.program\(S\.MESH_VS, S\.MESH_FS, 'mesh', this\.q\.lite \? \['LITE'\] : \[\]\)/.test(src('renderer.js')), 'the mesh program gets LITE on Very Low');
const en = src('entities.js');
check(/u_desat, hDs\)/.test(en) && /u_desat, 0\)/.test(en), 'drawHand sets the held block\'s desaturation and resets it');

// ---------------------------------------------------------------- 5 · the Very Low ring
console.log('5 · the Very Low ring');
const fl = src('fields.js');
check(/F\.VL_LIFT = 0\.\d+/.test(fl) && /lift: tier === 0 \? F\.VL_LIFT : 0/.test(fl) && /if \(u_lift > 0\.0\) col = max\(col, alb \* u_lift/.test(fl), 'the chunks\' two-tone light on Very Low only (tier 0)');

// ---------------------------------------------------------------- 6 · seasons on Very Low
console.log('6 · seasons on Very Low');
const sf = src('seasons_fest.js');
{ const d = sf.slice(sf.indexOf('P.ssDraw = function')), gate = d.indexOf('if (tier <= 0) { SF.cost.models = 0; return; }'), draw = d.indexOf('LK.drawModel(');
  check(/P6_VL/.test(sf) && gate > 0 && draw > gate, 'seasons_fest.ssDraw: on Very Low (tier 0) it returns before any festival model is drawn'); }
{ const fr = sf.slice(sf.indexOf('P.ssAir = function')); check(/if \(tier <= 0 \|\| dPl > 140 \|\| !pa\) return;/.test(fr), 'and its air (petals, lights) stays off on Very Low'); }
{ const ss = src('seasons.js'); check(/if \(tier <= 0\) return;   \/\/ Very Low: the tint only/.test(ss), 'seasons.frame: Very Low the tint only (no leaves, petals, breath)'); }

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

// t-film · the second trailer 'welt' (docs/superpowers/plans/2026-11-05-t-film.md): VR.TrailerWelt's pure parts.
//  (a) plan(A): 8–10 shots, 40–50 s in all, each with a finite camera path, a time of day and a caption key that both
//      language tables have (German first)
//  (b) the film's grammar: the first shot a high establishing wide, a low hero angle (the meadow family), a reveal (the
//      isles: the camera rises), every shot a slow move (≤ 6 m/s), the sunset → night ramp, the last shot the title
//      R9-SI with a subtitle line
//  (c) the shots that stage something (the family, the freeing) name it; a ship flies in the ferry shot
//  (d) resolve(shot, ground): a key under the ground + 1.2 is lifted; anchors without a place fall back (no NaN)
//  (e) the old trailer is untouched: director.js still has its six Heartland shots
const path = require('path');
const fs = require('fs');
global.VR = {};
const ROOT = path.join(__dirname, '..');
try { require(path.join(ROOT, 'src', 'main', 'trailer_welt.js')); } catch (e) { console.log('  ! trailer_welt.js: ' + e.message); }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const TW = VR.TrailerWelt;
if (!TW || typeof TW.plan !== 'function') { console.log('  ✗ VR.TrailerWelt.plan missing'); console.log('FAILED 1'); process.exit(1); }
const loadLang = (f) => { const src = fs.readFileSync(path.join(ROOT, 'src', 'main', f), 'utf8'); const keys = new Set(); for (const m of src.matchAll(/['"]((?:g\.)?film\.[\w.]+)['"]\s*:/g)) keys.add(m[1]); return keys; };
const DE = loadLang('lang_de.js'), EN = loadLang('lang_en.js');

const A = { meadow: [300, 84, 200], village: [-1, 81, -55], fairy: [74, 90, -278], outpost: [-523, 83, -497], beacon: [-529, 84, -503], isles: [330, 146, 140] };
const S = TW.plan(A);
const fin = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
check(Array.isArray(S) && S.length >= 8 && S.length <= 10, '8–10 shots (' + (S && S.length) + ')');
const total = S.reduce((a, s) => a + s.dur, 0);
check(total >= 40 && total <= 50, 'about 45 s in all (' + total.toFixed(1) + ' s)');
let keysOk = true, todOk = true, capOk = true, speedOk = true, maxV = 0;
for (const s of S) {
  if (!Array.isArray(s.keys) || s.keys.length < 2 || !s.keys.every(k => Number.isFinite(k[0]) && fin(k[1]) && fin(k[2]))) keysOk = false;
  if (s.keys[s.keys.length - 1][0] !== s.dur) keysOk = false;
  if (!Number.isFinite(s.tod) || (s.todTo !== undefined && !Number.isFinite(s.todTo))) todOk = false;
  if (!s.capKey || !DE.has(s.capKey) || !EN.has(s.capKey)) { capOk = false; console.log('    (caption key ' + s.capKey + ' missing)'); }
  for (let i = 1; i < s.keys.length; i++) { const a = s.keys[i - 1], b = s.keys[i]; const v = Math.hypot(b[1][0] - a[1][0], b[1][1] - a[1][1], b[1][2] - a[1][2]) / (b[0] - a[0]); maxV = Math.max(maxV, v); if (v > 6) speedOk = false; }
}
check(keysOk, 'every shot has a finite camera path that ends at its duration');
check(todOk, 'every shot has a time of day');
check(capOk, 'every caption key is in lang_de.js and lang_en.js');
check(speedOk, 'every move is slow, a cartoon film\'s push (≤ 6 m/s; fastest ' + maxV.toFixed(1) + ')');
check(S[0].keys[0][1][1] - S[0].keys[0][2][1] > 25, 'the first shot is a high establishing wide (camera well above what it looks at)');
const fam = S.find(s => s.stage === 'family');
check(!!fam && fam.keys[0][1][1] - A.meadow[1] < 2.5 && fam.keys[0][2][1] > fam.keys[0][1][1], 'the meadow family: a low hero angle (camera < 2.5 m over the meadow, looking up)');
const isl = S.find(s => s.name === 'inseln');
check(!!isl && isl.keys[isl.keys.length - 1][1][1] - isl.keys[0][1][1] > 15, 'the isles are a reveal: the camera rises');
check(S.some(s => s.ships && s.ships.length), 'a ship / ferry flies in a shot');
check(S.some(s => s.stage === 'liberate'), 'a shot stages the freeing of an outpost (BEFREIT)');
check(S.some(s => s.stage === 'fairy'), 'a Flausel shot at a fairy place');
check(S.some(s => s.stage === 'village'), 'a village shot');
const dusk = S.find(s => s.todTo !== undefined && s.todTo > s.tod);
check(!!dusk && dusk.tod < 12000 && dusk.todTo > 13800, 'the sunset → night ramp (' + (dusk && dusk.tod) + ' → ' + (dusk && dusk.todTo) + ')');
const last = S[S.length - 1];
check(last.caption === 'R9-SI' && last.big && !!last.subKey && DE.has(last.subKey) && EN.has(last.subKey), 'the last shot: the title R9-SI with a subtitle line');
check(last.tod > 14800 && last.tod < 21000, 'the title over the night sky (' + last.tod + ')');
// (d) resolve
const r = TW.resolve({ keys: [[0, [0, 70, 0], [5, 70, 5]], [4, [10, 90, 0], [5, 70, 5]]] }, () => 80);
check(r.keys[0][1][1] >= 81.2 && r.keys[1][1][1] === 90, 'resolve lifts a key under the ground + 1.2 and keeps one above (' + r.keys[0][1][1] + ', ' + r.keys[1][1][1] + ')');
const S2 = TW.plan({ meadow: [300, 84, 200], village: null, fairy: null, outpost: null, beacon: null, isles: [330, 146, 140] });
check(S2.length >= 8 && S2.every(s => s.keys.every(k => fin(k[1]) && fin(k[2]))), 'missing places fall back to finite shots (' + S2.length + ')');
check(!S2.some(s => s.stage === 'liberate'), 'no outpost: no freeing staged');
// (e)
const dir = fs.readFileSync(path.join(ROOT, 'src', 'main', 'director.js'), 'utf8');
check((dir.match(/\{ name: '(Ember Canyon|The Spire Citadel|Sky Isles|The Gate Temple|Hangar Hall|Nova Haven)'/g) || []).length === 6, 'the old Heartland trailer keeps its six shots');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

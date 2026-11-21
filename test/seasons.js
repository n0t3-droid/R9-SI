// w-seasons (docs/superpowers/plans/2026-11-01-w-seasons.md): the year's calendar, the season's tints, the festivals'
// schedule and the save — the pure part of VR.Seasons (src/main/seasons.js).
//   1. the calendar: 3 days a season, day 0 the first of spring, a soft half-day blend, the Kreativ lock, multiplayer
//   2. the tints (the shader's math mirrored): neutral off Herzwelt, spring fresh/blossoms, summer gold, autumn reds,
//      winter white; water and other colours never touched
//   3. the festivals: the 2nd day decorates, the 3rd celebrates; one per season on Herzwelt, one per people elsewhere
//   4. the save: the Wanderbuch's page „Feste" (meta.wander.festivals) read back as written; old saves read as before
//   bash test/wt_run.sh seasons.js 300
require('./load_shared.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/seasons.js');
const S = VR.Seasons;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

// ---------------------------------------------------------------- 1. the calendar
check(!!S && typeof S.at === 'function', 'VR.Seasons.at exists');
check(S.DAYS === 3 && S.NAMES.join() === 'spring,summer,autumn,winter', '3 days a season, four seasons');
const at = (d, t, l) => S.at(d, t === undefined ? 6000 : t, l === undefined ? -1 : l);
check(at(0).idx === 0 && at(0).dayIn === 0, 'day 0 is the first day of spring');
check(at(3).idx === 1 && at(6).idx === 2 && at(9).idx === 3 && at(12).idx === 0, 'the year turns after 12 days');
check(at(5, 6000).idx === 1 && at(5, 6000).dayIn === 2, 'day 5 is the third day of summer');
let sumOk = true, monoOk = true, prev = -1;
for (let d = 0; d < 24; d++) for (let t = 0; t < 24000; t += 1500) {
  const a = at(d, t), s = a.w.reduce((x, y) => x + y, 0);
  if (!near(s, 1, 1e-6)) sumOk = false;
  if (d === 2) { const nx = a.w[1]; if (nx < prev - 1e-9) monoOk = false; prev = nx; }
}
check(sumOk, 'the weights always sum to 1');
check(monoOk, 'the last day of spring fades into summer, never back');
check(at(1, 6000).w[0] === 1 && at(2, 1000).w[0] === 1, 'the first two and a half days are spring alone');
check(at(2, 23999).w[1] > 0.95, 'by the end of the season it is (almost) summer');
check(at(1, 6000, 3).idx === 3 && at(1, 6000, 3).w[3] === 1 && at(7, 6000, 3).idx === 3, 'a held season stays (Kreativ)');
check(at(-5, 6000).idx >= 0 && at(1e6, 6000).idx >= 0, 'odd days still give a season');
check(S.lockOf({ seasonPick: 'winter' }, { mode: 'creative' }) === 3, 'Kreativ: ⚙ Jahreszeit holds winter');
check(S.lockOf({ seasonPick: 'winter' }, { mode: 'survival' }) === -1, 'Überleben: the calendar always turns');
check(S.lockOf({ seasonPick: 'auto' }, { mode: 'creative' }) === -1 && S.lockOf({}, {}) === -1, 'Automatisch / nothing: the calendar');
check(S.lockOf({ seasonPick: 'summer' }, { mode: 'creative', guest: true }, 'autumn') === 2, 'a guest takes the host\'s season');
check(S.lockOf({ seasonPick: 'summer' }, { mode: 'creative', guest: true }, '') === -1, 'a guest of a turning host: the calendar (the host\'s day)');
check(S.wire(-1) === '' && S.wire(2) === 'autumn' && S.unwire('autumn') === 2 && S.unwire('x') === -1, 'the host\'s season on the wire');

// ---------------------------------------------------------------- 2. the tints
const grass = [0.18, 0.42, 0.09], leaf = [0.12, 0.34, 0.07], water = [0.1, 0.25, 0.4], red = [0.6, 0.1, 0.1];
const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const W = (i) => { const w = [0, 0, 0, 0]; if (i >= 0) w[i] = 1; return w; };
const tint = (c, i, o) => S.tint(c, W(i), Object.assign({ leaf: false, top: true, h: 0.7, kind: 0 }, o || {}));
check(JSON.stringify(tint(grass, -1)) === JSON.stringify(grass), 'no season (another world, ⚙ off): the tint as it was');
check(JSON.stringify(tint(water, 3, { kind: 1 })) === JSON.stringify(water) && JSON.stringify(tint(grass, 3, { kind: 1 })) === JSON.stringify(grass), 'water is never tinted');
check(JSON.stringify(tint(red, 2)) === JSON.stringify(red), 'a colour that is not green stays');
const sp = tint(grass, 0), su = tint(grass, 1), au = tint(grass, 2), wi = tint(grass, 3);
check(sp[1] / sp[0] > grass[1] / grass[0], 'spring: the grass a fresher green');
check(su[0] / su[1] > grass[0] / grass[1] && su[2] < grass[2], 'summer: the grass golden');
check(au[0] / au[1] > su[0] / su[1], 'autumn: the grass drier than summer');
check(lum(wi) > 0.7 && wi[2] >= wi[0], 'winter: the open grass white with snow');
const wiSide = tint(grass, 3, { top: false });
check(lum(wiSide) < lum(wi), 'winter: a grass side frosty, not white');
let reds = 0, yell = 0, blos = 0;
for (let k = 0; k < 40; k++) {
  const h = (k + 0.5) / 40;
  const a = tint(leaf, 2, { leaf: true, h });
  if (a[0] > a[1] * 1.8) reds++; else if (a[0] > a[1] * 0.9) yell++;
  const s = tint(leaf, 0, { leaf: true, h });
  if (s[0] > s[1]) blos++;
}
check(reds >= 8 && yell >= 8, `autumn: the trees red and gold, tree by tree (${reds} red, ${yell} gold of 40)`);
check(blos === 0, `spring: the green crowns stay green — no pink cells (t-trees2) (${blos} of 40)`);
const wl = tint(leaf, 3, { leaf: true });
check(lum(wl) > lum(leaf) * 2.5, 'winter: the leaves frosted');
const half = S.tint(grass, [0.5, 0.5, 0, 0], { top: true, h: 0.3 });
check(near(half[0], (sp[0] + su[0]) / 2, 1e-9), 'the blend mixes the seasons linearly');
const U = S.uniforms(at(10, 6000), 'overworld'), U0 = S.uniforms(at(10, 6000), 'aqua');
check(U.season[3] === 1 && U.fx[0] > 0.5 && U.fx[2] > 0.5, 'winter on Herzwelt: the snow cover and the ice');
check(U0.season.every(v => v === 0) && U0.fx.every(v => v === 0), 'another world: no seasons in its look');
const Ua = S.uniforms(at(7, 6000), 'overworld'), Us = S.uniforms(at(1, 6000), 'overworld');
check(Ua.fx[3] > 0.5 && Ua.fx[0] === 0 && Us.fx[1] > 0.5, 'autumn: fallen leaves · spring: petals');

// ---------------------------------------------------------------- 3. the festivals
const H = (d, lock) => S.schedule(d, 'overworld', null, lock === undefined ? -1 : lock);
check(H(0).phase === 'none' && H(1).phase === 'prep' && H(2).phase === 'fest', 'spring: day 2 the plaza is decorated, day 3 the feast');
check(H(2).id === 'bluete' && H(5).id === 'drachen' && H(8).id === 'tafel' && H(11).id === 'lichter', 'the four festivals of Herzwelt\'s year');
check(H(4).id === 'drachen' && H(4).phase === 'prep', 'the decorating day is the next feast\'s');
check(H(8, 3).id === 'lichter', 'a held winter: its light night');
const sps = ['aqua', 'ocker', 'zinn', 'basalt', 'opal'], ids = new Set();
for (const k of sps) { const f = S.schedule(2, k, k, -1); ids.add(f.id); check(f.phase === 'fest' && !!S.FESTS[f.id] && S.FESTS[f.id].sp === k, `the ${k} people celebrate their own: ${f.id}`); }
check(ids.size === 5, 'five peoples, five festivals');
check(S.schedule(2, 'aqua', null, -1).id === '' && S.schedule(2, 'drift', null, -1).id === '', 'no people, no festival');
check(S.FEST_IDS.length === 9 && S.FEST_IDS.every(id => !!S.FESTS[id]), 'nine festivals in all');
let langOk = true;
for (const id of S.FEST_IDS) for (const k of ['g.ss.f.' + id, 'g.ss.f.' + id + '.what']) {
  const D = VR.I18N.dict;
  if (!D.de[k] || !D.en[k]) { langOk = false; console.log('    missing', k); }
}
check(langOk, 'every festival named in German and English');
check(S.daysTo(0, -1) === 2 && S.daysTo(2, -1) === 0 && S.daysTo(3, -1) === 2, 'the next feast in n days');

// ---------------------------------------------------------------- 4. the save
const meta = { day: 8, mode: 'survival' };
check(S.record(meta, 'tafel') === true && S.record(meta, 'tafel') === false, 'a festival enters the book once');
check(S.record(meta, 'nope') === false, 'an unknown id is never written');
const back = JSON.parse(JSON.stringify(meta));
check(back.wander && back.wander.festivals && back.wander.festivals.tafel === 1, 'meta.wander.festivals read back as written');
check(S.seen(back).join() === 'tafel' && S.seen({}).length === 0 && S.seen({ wander: { festivals: 'odd' } }).length === 0, 'an old or odd save: nothing seen, nothing broken');
check(Object.keys(meta).sort().join() === 'day,mode,wander', 'nothing else in the save');

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

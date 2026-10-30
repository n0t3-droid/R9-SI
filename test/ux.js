// e-ux (plan docs/superpowers/plans/2026-10-30-e-ux.md) · the design system and the UI's rules, in node:
//  1 the tokens (src/ui/tokens.css, the one file): every colour, radius, spacing and type-scale token is there; text
//    colours reach 4.5:1 on the panel colour (and on the darkest backdrop a HUD pill gives), the type scale climbs and
//    starts at ≥ 13 px, the spacing is a 4-px scale, the radii climb; the old variables (style.css, start.css) are
//    aliased to the tokens, so the game has one palette
//  2 the UI scale: 90–140 %, snapped to 5 %, a bad value → 100 %; the setting is in the registry (Spiel)
//  3 the key-hint strip (VR.UX.strip): only what you can do now — nothing in a menu, the photo mode, a vehicle, the
//    cockpit or on touch; never the key the Aktion prompt already shows; the journal only with the Abenteuer; fly keys
//    only where you can fly; at most four; the keys follow the player's bindings; both languages
//  4 the first minute (VR.UX.onboard): three gentle hints in order — move, look, V — each after a quiet moment, never
//    while a menu is open, never again once done
//  5 ⚙ Empfohlen (VR.UX.recommend): the preset the first start would pick for this machine
//  6 the settings search (VR.UX.match): words, umlauts and case don't matter, every word must be found
//  7 the texts are in both tables
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
require('./dom_stub.js');
globalThis.VR = {};
require(path.join(ROOT, 'src/main/i18n.js'));
require(path.join(ROOT, 'src/main/lang_en.js'));
require(path.join(ROOT, 'src/main/lang_de.js'));
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

console.log('1 · the tokens (src/ui/tokens.css)');
const TOK = path.join(ROOT, 'src/ui/tokens.css');
check(fs.existsSync(TOK), 'src/ui/tokens.css exists');
const css = fs.existsSync(TOK) ? fs.readFileSync(TOK, 'utf8') : '';
const root = (css.match(/:root\s*\{([^}]*)\}/) || [, ''])[1];
const tok = {}; for (const m of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tok[m[1]] = m[2].trim();
const NEED = ['--ux-bg', '--ux-panel', '--ux-panel-solid', '--ux-line', '--ux-line-strong', '--ux-ink', '--ux-ink-2', '--ux-acc', '--ux-acc-ink', '--ux-good', '--ux-warn', '--ux-bad', '--ux-gold',
  '--ux-r1', '--ux-r2', '--ux-r3', '--ux-s1', '--ux-s2', '--ux-s3', '--ux-s4', '--ux-s5', '--ux-fs-xs', '--ux-fs-s', '--ux-fs', '--ux-fs-l', '--ux-fs-xl', '--ux-scale', '--ux-font', '--ux-display', '--ux-shadow', '--ux-pill'];
const miss = NEED.filter(k => !tok[k]); check(!miss.length, 'all ' + NEED.length + ' tokens are on :root' + (miss.length ? ' (missing ' + miss.join(' ') + ')' : ''));
const hex = (s) => { const m = /#([0-9a-f]{6})\b/i.exec(s || ''); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null; };
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const bg = hex(tok['--ux-panel-solid']);
for (const k of ['--ux-ink', '--ux-ink-2', '--ux-acc', '--ux-gold', '--ux-good', '--ux-bad', '--ux-warn']) {
  const c = hex(tok[k]); const r = c && bg ? contrast(c, bg) : 0;
  check(r >= 4.5, `${k} ${tok[k]} on the panel ${tok['--ux-panel-solid']}: ${r.toFixed(2)}:1 ≥ 4.5`);
}
const accInk = hex(tok['--ux-acc-ink']), acc = hex(tok['--ux-acc']);
check(accInk && acc && contrast(accInk, acc) >= 4.5, 'text on an accent button (--ux-acc-ink on --ux-acc) ≥ 4.5:1 (' + (accInk && acc ? contrast(accInk, acc).toFixed(2) : '?') + ')');
const px = (k) => { const m = /(\d+(?:\.\d+)?)px/.exec(tok[k] || ''); return m ? +m[1] : NaN; };
const fsz = ['--ux-fs-xs', '--ux-fs-s', '--ux-fs', '--ux-fs-l', '--ux-fs-xl'].map(px);
check(fsz.every((v, i) => i === 0 || v > fsz[i - 1]) && fsz[0] >= 13, 'the type scale climbs from ≥ 13 px: ' + fsz.join(' · '));
check(['--ux-fs-xs', '--ux-fs-s', '--ux-fs', '--ux-fs-l', '--ux-fs-xl'].every(k => /var\(--ux-scale\)/.test(tok[k])), 'every type size follows the UI scale (× var(--ux-scale))');
const sp = ['--ux-s1', '--ux-s2', '--ux-s3', '--ux-s4', '--ux-s5'].map(px);
check(sp.every((v, i) => v % 4 === 0 && (i === 0 || v > sp[i - 1])), 'the spacing is a 4-px scale: ' + sp.join(' · '));
const rr = ['--ux-r1', '--ux-r2', '--ux-r3'].map(px);
check(rr.every((v, i) => i === 0 || v > rr[i - 1]), 'the radii climb: ' + rr.join(' · '));
// one palette: the older variables point at the tokens
const ALIAS = ['--panel', '--line', '--line2', '--text', '--muted', '--accent', '--gold', '--good', '--bad', '--font', '--display', '--st-acc', '--st-ink', '--st-mute', '--st-bg', '--st-line', '--st-font'];
const notAl = ALIAS.filter(k => !/^var\(--ux-/.test(tok[k] || '')); check(!notAl.length, 'the older variables are aliases of the tokens' + (notAl.length ? ' (not: ' + notAl.join(' ') + ')' : ''));
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
check(/\['tokens', 'ux'\]/.test(build) && /uxCss\}<\/style>/.test(build) && /MAIN.push\('ux'\)/.test(build), 'build.js loads tokens.css and ux.css (after the other styles) and src/main/ux.js');

// the module
global.window = global.window || globalThis;
require(path.join(ROOT, 'src/main/ux.js'));
const X = VR.UX;
check(!!X && ['strip', 'onboard', 'recommend', 'match', 'clampScale'].every(k => typeof X[k] === 'function'), 'VR.UX: strip · onboard · recommend · match · clampScale');
if (!X) { console.log('FAILED ' + fails); process.exit(1); }

console.log('2 · the UI scale');
check(X.SCALE_MIN === 0.9 && X.SCALE_MAX === 1.4, 'the range is 90–140 %');
check(X.clampScale(1.23) === 1.25 && X.clampScale(2) === 1.4 && X.clampScale(0.5) === 0.9 && X.clampScale('x') === 1 && X.clampScale(undefined) === 1, 'snapped to 5 %, clamped, a bad value → 100 %');

console.log('3 · the key-hint strip');
const base = { mode: 'foot', survival: false, creative: true, quests: true, ctxKey: null, canFly: true, flying: false, touch: false, menu: false };
const keys = (o, l) => X.strip(Object.assign({}, base, o), l || 'de').map(e => e.id);
check(keys({}).length >= 2 && keys({}).length <= 4, 'on foot: 2–4 things (' + keys({}).join(' ') + ')');
check(keys({ menu: true }).length === 0 && keys({ mode: 'photo' }).length === 0 && keys({ mode: 'vehicle' }).length === 0 && keys({ mode: 'cockpit' }).length === 0, 'nothing in a menu, the photo mode, a vehicle, the cockpit');
check(keys({ touch: true }).length === 0, 'nothing on touch (the buttons speak)');
check(keys({ quests: false }).indexOf('journal') < 0 && keys({ quests: true }).indexOf('journal') >= 0, 'the journal only with the Abenteuer');
check(keys({ ctxKey: 'veh' }).indexOf('veh') < 0, 'never the key the Aktion prompt already shows');
check(keys({ canFly: false }).indexOf('fly') < 0 && keys({ canFly: true }).indexOf('fly') >= 0, 'fly only where you can fly');
const fl = keys({ flying: true }); check(fl.indexOf('up') >= 0 && fl.indexOf('down') >= 0 && fl.indexOf('fly') < 0, 'flying: up and down instead of „fliegen" (' + fl.join(' ') + ')');
const all = X.strip(Object.assign({}, base, { quests: true, canFly: true }), 'de');
check(all.every(e => e.key && e.text && typeof e.text === 'string') && all.length <= 4, 'every entry has a key cap and a word; four at most');
const B = { codesFor: (n) => n === 'KeyE' ? ['KeyI'] : n === 'KeyJ' ? ['KeyJ'] : n === 'KeyM' ? ['KeyM'] : null };
const reb = X.strip(base, 'de', B).find(e => e.id === 'inv'); check(reb && reb.key === 'I', 'the keys follow the bindings (Inventar on I: ' + (reb && reb.key) + ')');
const en = X.strip(base, 'en').map(e => e.text).join(' '), de = X.strip(base, 'de').map(e => e.text).join(' ');
check(en !== de && /Inventar|Bauen|Tagebuch|Karte|Fliegen/.test(de), 'German and English words (' + de + ' | ' + en + ')');
check(JSON.stringify(X.strip(base, 'de')) === JSON.stringify(X.strip(base, 'de')), 'pure: the same state → the same strip');

console.log('4 · the first minute');
const on = (o) => X.onboard(Object.assign({ done: {}, quiet: 0, menu: false, ctx: false }, o));
check(on({ quiet: 1 }) === null && on({ quiet: 3.5 }) === 'move', 'move after a quiet moment (3 s), not at once');
check(on({ done: { move: 1 }, quiet: 3.5 }) === 'look', 'then look');
check(on({ done: { move: 1, look: 1 }, quiet: 0.5, ctx: true }) === 'v', 'then V — as soon as the Aktion has something to do');
check(on({ done: { move: 1, look: 1 }, quiet: 12 }) === 'v' && on({ done: { move: 1, look: 1 }, quiet: 5 }) === null, '… or after a longer quiet moment');
check(on({ done: { move: 1, look: 1, v: 1 }, quiet: 60 }) === null, 'never again once all three are done');
check(on({ quiet: 30, menu: true }) === null, 'never while a menu is open');
check(X.ONBOARD.join(',') === 'move,look,v', 'three hints: move, look, v');

console.log('5 · ⚙ Empfohlen');
check(X.recommend({ cores: 8, mem: 16, gpu: 'NVIDIA GeForce RTX 3060' }) === 'balanced', 'a gaming PC → Ausgewogen');
check(X.recommend({ cores: 2, mem: 4, gpu: 'x' }) === 'potato' && X.recommend({ cores: 8, mem: 8, gpu: 'Google SwiftShader' }) === 'potato', 'two cores or a software renderer → Sehr niedrig');
check(X.recommend({ cores: 8, mem: 8, gpu: 'Intel(R) UHD Graphics 620' }) === 'low' && X.recommend({ cores: 4, mem: 8, gpu: 'NVIDIA' }) === 'low', 'an integrated GPU or four cores → Niedrig');

console.log('6 · the settings search');
check(X.match('schatten', 'Schatten der Sonne') && X.match('SCHATTEN', 'Weiche Schatten'), 'case does not matter');
check(X.match('grosse', 'Größe der Schrift') && X.match('größe', 'Groesse'), 'ß/ss and umlauts match');
check(X.match('sonne schatten', 'Schatten der Sonne') && !X.match('sonne wasser', 'Schatten der Sonne'), 'every word must be found');
check(X.match('', 'x') && X.match('  ', 'y'), 'an empty search matches everything');

console.log('7 · the texts');
const D = VR.I18N.dict.de, E = VR.I18N.dict.en;
const ux = Object.keys(E).filter(k => k.startsWith('ux.'));
check(ux.length >= 20 && ux.every(k => D[k] !== undefined), ux.length + ' ux.* keys, all in both tables');
const src = fs.readFileSync(path.join(ROOT, 'src/main/ux.js'), 'utf8');
const used = [...new Set([...src.matchAll(/['"](ux\.[\w.]+)['"]/g)].map(m => m[1]))];
const nf = used.filter(k => E[k] === undefined || D[k] === undefined); check(!nf.length, 'every ux.* key ux.js uses is in both tables' + (nf.length ? ' (missing ' + nf.join(' ') + ')' : ''));

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

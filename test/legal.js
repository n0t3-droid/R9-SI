// 📜 Rechtliches (src/main/legal.js) — the launch audit's texts (docs/legal/2026-10-07-launch-legal-audit.md §4) in the
// game and the R9 Studio: Impressum, Datenschutz, Credits, Hinweis in German and English, the owner's details as
// clearly marked placeholders until they are filled in (never invented), the fonts' OFL credit, the imported things of
// VR.Credits, the share hint of every export. And the repository: no company or product name of the house catalogue's
// models left in src/ or the README, the independence disclaimer where the audit wants it, no milestone title of
// another game. Node, no DOM.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

require(path.join(ROOT, 'src/main/legal.js'));
const L = globalThis.VR && VR.Legal;

console.log('1 · the module');
check(!!L && ['open', 'close', 'isOpen', 'text', 'plain', 'html', 'button', 'shareHint', 'incomplete', 'mpNotice', 'mpToggle'].every(k => typeof L[k] === 'function'), 'VR.Legal: open / close / isOpen / text / plain / html / button / shareHint / incomplete / mpNotice / mpToggle');
if (!L) { console.log('FAILED ' + (fails + 1)); process.exit(1); }
check(JSON.stringify(L.SECTIONS) === JSON.stringify(['impressum', 'datenschutz', 'credits', 'hinweis']), 'four sections: Impressum · Datenschutz · Credits · Hinweis');
check(L.open('impressum') === false && !L.isOpen(), 'without a page (no document) open() does nothing and says so');
// without the language module the texts are German
check(/Impressum/.test(L.text('impressum')) && /Datenschutzerklärung/.test(L.text('datenschutz')), 'no VR.I18N: German');

console.log('2 · German and English');
const T = (sec, lang) => L.text(sec, lang);
for (const s of L.SECTIONS) {
  const de = T(s, 'de'), en = T(s, 'en');
  check(de.length > 200 && en.length > 200 && de !== en, s + ': a German and an English text (' + de.length + ' / ' + en.length + ' chars)');
}
check(/§ 18 Abs\. 1 Medienstaatsvertrag/.test(T('impressum', 'de')) && /§ 18 \(1\)/.test(T('impressum', 'en')), 'Impressum: § 18 Abs. 1 MStV (de) / § 18 (1) (en)');
check(/Deutschland/.test(T('impressum', 'de')) && /Germany/.test(T('impressum', 'en')), 'Impressum: the country');
check(/nicht-kommerzielles Hobbyprojekt/.test(T('impressum', 'de')) && /Anthropic ist nicht der Anbieter/.test(T('impressum', 'de')), 'Impressum: a hobby project, Anthropic is not the provider');
const ds = T('datenschutz', 'de'), dsEn = T('datenschutz', 'en');
for (const [w, why] of [['IndexedDB „r9si“', 'local saves'], ['keine Cookies', 'no cookies'], ['§ 25 Abs. 2 Nr. 2 TDDDG', 'no consent banner needed'], ['Anthropic Ireland, Limited', 'the host'], ['https://www.anthropic.com/legal/privacy', 'Anthropic\'s policy'], ['Mitspieler sehen deinen Namen', 'the one-time multiplayer notice'], ['Mehrspieler aus', 'multiplayer off'], ['Mindestalter von 18 Jahren', 'the parents\' note'], ['Art. 15–22 DSGVO', 'the rights'], ['Art. 77 DSGVO', 'the complaint']])
  check(ds.includes(w), 'Datenschutz (de): ' + why + ' — „' + w + '“');
for (const [w, why] of [['IndexedDB "r9si"', 'local saves'], ['no cookies', 'no cookies'], ['Other players see your name', 'the notice'], ['Multiplayer off', 'multiplayer off'], ['the German version applies', 'which version applies']])
  check(dsEn.includes(w), 'Datenschutz (en): ' + why + ' — "' + w + '"');
check(!/\[Datum\]|\[Bundesland\]/.test(ds), 'no placeholder in the Datenschutz besides the owner\'s details (no [Datum], no [Bundesland])');
check(/Teile nur, was dir gehört/.test(L.shareHint('de')) && /Share only what is yours/.test(L.shareHint('en')), 'the share hint: „' + L.shareHint('de') + '“ / "' + L.shareHint('en') + '"');

console.log('3 · the owner: placeholders until filled in, never invented');
const O = L.OWNER;
check(O && 'name' in O && 'address' in O && 'email' in O, 'VR.Legal.OWNER has name, address, email');
const shipped = { name: O.name, address: O.address, email: O.email };
const filled = !!(O.name && O.address && O.email);
if (!filled) {
  const imp = T('impressum', 'de');
  check(imp.includes('[Name]') && imp.includes('[Anschrift]') && imp.includes('[E-Mail]'), 'Impressum (de): the placeholders [Name] [Anschrift] [E-Mail]');
  check(T('impressum', 'en').includes('[Name]') && T('impressum', 'en').includes('[Address]') && T('impressum', 'en').includes('[E-mail]'), 'Impressum (en): [Name] [Address] [E-mail]');
  check(L.incomplete() && /Vor dem öffentlichen Start ausfüllen/.test(imp) && /fill in before the public launch/i.test(T('impressum', 'en')), 'a visible note: they must be filled in before the launch');
  check(T('datenschutz', 'de').includes('[Name]') && T('credits', 'de').includes('© 2026 [Name]'), 'the Datenschutz (Verantwortlicher) and the Credits (©) use the same placeholders');
  const h = L.html('impressum');
  check((h.match(/<mark class="lg-ph"/g) || []).length >= 3, 'in the page the placeholders are marked (<mark class="lg-ph">)');
} else console.log('  · OWNER is filled in — the placeholder checks are skipped');
Object.assign(O, { name: 'Erika Beispiel', address: 'Teststraße 1, 12345 Musterort', email: 'test@example.org' });
const imp2 = T('impressum', 'de');
check(!L.incomplete() && imp2.includes('Erika Beispiel') && imp2.includes('Teststraße 1') && imp2.includes('12345 Musterort') && imp2.includes('test@example.org') && !/\[Name\]|\[Anschrift\]|\[E-Mail\]|Vor dem öffentlichen Start/.test(imp2), 'filled in: the details show, the placeholders and the note are gone');
check(/Erika Beispiel, Teststraße 1, 12345 Musterort, E-Mail: test@example.org/.test(T('datenschutz', 'de')), 'the Verantwortlicher in one line');
check(!/<mark class="lg-ph"/.test(L.html('impressum')) && L.html('impressum').includes('Teststraße 1<br>12345 Musterort'), 'the address breaks into lines in the page');
Object.assign(O, shipped);

console.log('4 · Credits');
const cr = T('credits', 'de'), crEn = T('credits', 'en');
const lic = read('src/ui/fonts/LICENSES.md');
const fams = [...new Set([...read('src/ui/fonts/game_fonts.css').matchAll(/font-family:'([^']+)'/g), ...read('src/ui/fonts/studio_fonts.css').matchAll(/font-family:'([^']+)'/g)].map(m => m[1]))];
check(fams.length === 4 && fams.every(f => cr.includes(f) && crEn.includes(f) && lic.includes(f)), 'every embedded font is credited (' + fams.join(', ') + ') — the same as src/ui/fonts/LICENSES.md');
for (const [f, c] of [['Orbitron', 'Copyright 2018 The Orbitron Project Authors'], ['Rajdhani', 'Copyright (c) 2014, Indian Type Foundry'], ['Sora', 'Copyright 2019 The Sora Project Authors'], ['JetBrains Mono', 'Copyright 2020 The JetBrains Mono Project Authors']])
  check(cr.includes(c) && crEn.includes(c), f + ': „' + c + '“');
check(cr.includes('Reserved Font Name "Orbitron"') && cr.includes('SIL Open Font License, Version 1.1') && cr.includes('https://openfontlicense.org'), 'the OFL notice: Reserved Font Name, the licence and its link');
check(/Alle Rechte vorbehalten/.test(cr) && /All rights reserved/.test(crEn), '© … Alle Rechte vorbehalten / All rights reserved');
check(!/Importierte Dinge/.test(cr), 'no VR.Credits: no "Importierte Dinge" section');
VR.Credits = { list: () => [
  { name: 'Hirsch', kind: 'ding', src: { title: 'Deer', author: 'Kenney', url: 'https://kenney.nl/assets/deer', license: 'CC BY 4.0', tier: 'by' } },
  { title: 'Stein', author: 'Ich', license: 'CC0', tier: 'free', kind: 'ding' },
  { name: 'Ritter', kind: 'figur', src: { title: 'Knight', author: 'Quaternius', license: 'QAL v1.0', tier: 'local' } },
] };
const cr2 = T('credits', 'de'), cr2En = T('credits', 'en');
check(/Importierte Dinge/.test(cr2) && cr2.includes('„Deer“ von Kenney (https://kenney.nl/assets/deer) · CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) · geändert: als Voxelmodell umgesetzt'), 'VR.Credits: a CC BY line with title, author, source, licence + link and „geändert“ (T-A-S-L)');
check(cr2.includes('„Stein“ von Ich · CC0 (https://creativecommons.org/publicdomain/zero/1.0/)'), 'a CC0 line');
check(cr2.includes('„Knight“ · nur lokal') && /erscheint nicht in 📦 Paketen/.test(cr2), 'a „Nur für dich“ thing: local only, never in 📦 packs');
check(/Imported things/.test(cr2En) && cr2En.includes('"Deer" by Kenney') && cr2En.includes('modified: turned into a voxel model') && cr2En.includes('local only'), 'the same in English');
check(/das Spiel kann sie nicht prüfen/.test(cr2), 'the player attests the licence; the game cannot check it');
VR.Credits = { list: () => [] };
check(/Noch nichts importiert/.test(T('credits', 'de')), 'an empty VR.Credits: "Noch nichts importiert"');
VR.Credits = { list: () => { throw new Error('broken'); } };
check(/Importierte Dinge/.test(T('credits', 'de')), 'a broken VR.Credits.list() does not break the Credits');
delete VR.Credits;

console.log('5 · Hinweis');
const hw = T('hinweis', 'de'), hwEn = T('hinweis', 'en');
check(/eigenständiges, unabhängiges Werk/.test(hw) && /mit keiner anderen Spielefirma verbunden/.test(hw) && /genehmigt, gesponsert oder unterstützt/.test(hw), 'de: an independent work, not affiliated with or endorsed by any other game company');
check(/independent work/.test(hwEn) && /not affiliated with, endorsed, sponsored or approved by any other game company/.test(hwEn), 'en: the same');
check(hw.includes('NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.') && hwEn.includes('NOT AN OFFICIAL MINECRAFT PRODUCT.'), 'the disclaimer the brand owner\'s guidelines ask for, word for word');
check(/WorldEdit, Amulet, Axiom, Litematica, MCEdit und MagicaVoxel/.test(hw) && /Dateiformate/.test(hw), 'tool names only to describe file compatibility');

console.log('6 · the language module');
require(path.join(ROOT, 'src/main/i18n.js'));
const I = VR.I18N;
I.set('en');
check(/Privacy policy for R9-SI/.test(L.text('datenschutz')) && /Share only/.test(L.shareHint()), 'VR.I18N in English: the English texts');
I.set('fr');
check(/Privacy policy for R9-SI/.test(L.text('datenschutz')), 'a language without a table (fr): English');
I.add('fr', { 'legal.share': 'Ne partage que ce qui est à toi.' });
check(L.shareHint() === 'Ne partage que ce qui est à toi.', 'a table entry (legal.<key>) wins: the texts go through VR.I18N.tx');
I.set('de');
check(/Datenschutzerklärung für R9-SI/.test(L.text('datenschutz')), 'German: the German texts');
L.lang = 'en';
check(/Privacy policy/.test(L.text('datenschutz')) && /Privacy policy/.test(L.plain()) && /Share only/.test(L.shareHint()), 'the overlay\'s own DE / EN switch overrides the game\'s language');
L.lang = null;
const all = L.plain('de');
check(['Impressum', 'Datenschutzerklärung', 'Credits', 'Hinweis'].every(w => all.includes(w)) && all.indexOf('Impressum') < all.indexOf('Datenschutzerklärung') && all.indexOf('Orbitron') < all.indexOf('NOT AN OFFICIAL'), '📋 copies everything as plain text, in order: Impressum · Datenschutz · Credits · Hinweis');
check(!/<[a-z][^>]*>/i.test(all), 'the copied text has no HTML');

console.log('7 · bundled into the game and the Studio');
const bj = read('build.js');
check(/src\/main\/legal\.js/.test(bj) && /src\/ui\/legal\.css/.test(bj), 'build.js reads src/main/legal.js and src/ui/legal.css');
check(/\$\{legal\}\s*\n<script>\$\{guard\(mainSrc\)\}<\/script>/.test(bj) && /<script>\$\{guard\(studioLibs\)\}<\/script>\s*\n\$\{legal\}/.test(bj), 'in the game before its own scripts (its Esc comes first), in the Studio after the libraries');

console.log('8 · the share hint at every export (one line, no dialog)');
const br = read('src/studio/bridge.js'), wb = read('src/studio/workbench.js'), crf = read('src/studio/crafter.js');
check(/VR\.Legal\.shareHint\(\)/.test(br) && /sum\.text[^\n]*\+ share\(\), true\)/.test(br), '📦 Mitnehmen (the Crafter, 🕘 Weitermachen, the standalone\'s banner — all call exportPack): the line after saving');
check((wb.match(/'⬇ ' \+ \w+ \+ \(shareHint\(\)/g) || []).length === 2, '⬇ .schem / .vox / .json (the Werkbank, Bild → 3D): the line after saving, both ways of saving');
check(/note\(esc\(shareHint\(\)\), 'dim share'\)/.test(wb), 'and a line under the ⬇ buttons (Bauteile go out there too)');
check(/VR\.Legal\.shareHint\(\)/.test(crf), 'the Crafter: a line under 📦 Mitnehmen / 📥 Übernehmen');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

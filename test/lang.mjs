// Languages (v0.40): a German browser gets a German game — the start screen, the chat welcome, the HUD badge, the
// pause menu (W1's words: Pause, ▶ Weiterspielen, 📍 Mein Platz ist hier), the settings and the inventory; the 🌐 tab and /lang switch live (no reload) between Deutsch and English, the choice
// is remembered in r9si.lang and html lang follows; the codex, the death screen and a villager's talk box read the
// tables too; no page errors.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text().slice(0, 500)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 20) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dtms]); } };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const text = (sel) => ev((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
const texts = (sel) => ev((s) => [...document.querySelectorAll(s)].map(e => e.textContent.trim()), sel);

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const boot = await ev(() => ({ lang: VR.I18N && VR.I18N.lang, html: document.documentElement.lang, nav: navigator.language, en: Object.keys(VR.I18N.dict.en || {}).length, de: Object.keys(VR.I18N.dict.de || {}).length }));
console.log('boot', JSON.stringify(boot));
check(boot.nav.startsWith('de'), 'the browser speaks German (' + boot.nav + ')');
check(boot.lang === 'de' && boot.html === 'de', 'the first visit follows the browser language: de');
check(boot.en > 300 && boot.de === boot.en, 'both tables are bundled (' + boot.de + ' keys)');
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Sprache',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'the world is playing');
await step(6);

// ---- German in the game: chat, HUD badge, pause, settings, inventory
const chat = await texts('#chatlog div');
check(chat.some(t => t.startsWith('Willkommen in Sprache')), 'the welcome line is German: ' + JSON.stringify(chat[0] || ''));
check(await text('#modebadge') === 'KREATIV', 'the HUD badge reads KREATIV');
await ev(() => VR.game.ui.pause()); await step(2);
check(await text('#pause h2') === 'Pause', 'the pause menu is German (Pause)');
check(await text('#pause [data-act="resume"]') === '▶ Weiterspielen', 'the resume button reads ▶ Weiterspielen');
check(await text('#pause [data-act="sethome"]') === '📍 Mein Platz ist hier' && await text('#pause [data-act="gohome"]') === '🏠 Zu meinem Platz', 'the spawn buttons read 📍 Mein Platz ist hier · 🏠 Zu meinem Platz');
check(await text('#pause [data-act="bauenlive"]') === '🏗 Bauen' && await text('#pause [data-act="meins"]') === '🎒 Meins', 'the W1 entries read 🏗 Bauen · 🎒 Meins');
check(await text('#pause [data-act="codex"]') === '📖 Entdecker-Codex' && await text('#pause [data-act="settings"]') === '⚙ Einstellungen' && await text('#pause [data-act="quit"]') === '⏏ Speichern & zum Start', 'codex, settings and quit are German');
const zen = await text('#zenpanel .subtitle');
check(/Kreativ/.test(zen || ''), 'the creative tools panel is German: ' + zen);
await ev(() => { VR.game.ui.prevScreen = 'pause'; VR.game.ui.showSettings(); }); await step(2);
check(await text('#settings h2') === 'Einstellungen', 'the settings title is Einstellungen');
const tabs = await texts('#settabs button');
check(tabs.join('|') === 'Grafik|Steuerung|Ton|Spiel|🌐 Sprache', 'the settings tabs are German: ' + tabs.join(' · '));
const labels = await texts('#setbody label');
check(labels.some(l => l.startsWith('Sichtweite')) && labels.some(l => l.startsWith('Qualitätsstufe')), 'graphics labels are German (Sichtweite, Qualitätsstufe)');
check(labels.some(l => l === 'Blöcke') && (await texts('#setbody .seg button')).includes('Klassisch'), 'the block look reads Blöcke: Klassisch');
await ev(() => { VR.game.ui.settingsTab = 'game'; VR.game.ui.showSettings(); }); await step(1);
const gameLabels = await texts('#setbody label');
check(gameLabels.some(l => l.startsWith('Dein Name')) && gameLabels.some(l => /Koordinaten anzeigen/.test(l)), 'game tab labels are German');
await ev(() => { VR.game.ui.show(null); VR.game.ui.openInventory(); }); await step(2);
const catTabs = await texts('#invpanel .tabs button');
check(catTabs.includes('Bausteine') && catTabs.includes('Werkzeuge') && catTabs.includes('★ Favoriten') && !catTabs.includes('Bauen'), 'the creative tabs are German (Bausteine — „Bauen" is the 🏗 of the start screen): ' + catTabs.slice(0, 5).join(' · '));
check((await texts('#invpanel .subtitle')).includes('Schnellleiste'), 'the hotbar is the Schnellleiste');
await ev(() => VR.game.ui.closeInventory()); await step(2);

// ---- the 🌐 tab switches live to English, /lang switches back
await ev(() => { VR.game.ui.pause(); VR.game.ui.prevScreen = 'pause'; VR.game.ui.settingsTab = 'lang'; VR.game.ui.showSettings(); }); await step(1);
const langBtns = await texts('#langseg button');
check(langBtns.join('|') === 'Deutsch|English', 'the language tab offers Deutsch and English');
check((await texts('#setbody .langsoon button')).length === 0, 'Einfach: only the languages that are there (no „bald" list)');
await ev(() => { VR.UIPrefs.set({ pro: true }); VR.game.ui.showSettings(); }); await step(1);
const soon = await texts('#setbody .langsoon button');
check(soon.length === 11 && soon.every(t => / · bald$/.test(t)), 'Profi: the other 11 languages are listed as bald (' + soon.length + ')');
await page.click('#langseg button[data-lang="en"]'); await step(2);
const after = await ev(() => ({ lang: VR.I18N.lang, stored: localStorage.getItem('r9si.lang'), html: document.documentElement.lang, title: document.querySelector('#settings h2').textContent, tabs: [...document.querySelectorAll('#settabs button')].map(b => b.textContent), pause: document.querySelector('#pause h2').textContent, resume: document.querySelector('#pause [data-act="resume"]').textContent, soon: [...document.querySelectorAll('#setbody .langsoon button')].map(b => b.textContent) }));
console.log('after click', JSON.stringify(after));
check(after.lang === 'en' && after.stored === 'en' && after.html === 'en', 'English is chosen, stored and on <html>');
check(after.title === 'Settings' && after.tabs[0] === 'Graphics' && after.tabs[4] === '🌐 Language', 'the settings re-render in English without a reload');
check(after.pause === 'Paused' && after.resume === '▶ Play on', 'the pause screen (static texts) re-reads the tables: ' + after.pause + ' · ' + after.resume);
check(after.soon.every(t => / · soon$/.test(t)), 'the soon-entries read "soon"');
await ev(() => { VR.UIPrefs.set({ pro: false }); VR.game.ui.show(null); }); await step(1);
check(await text('#modebadge') === 'CREATIVE', 'the HUD badge reads CREATIVE');
await ev(() => VR.game.chat('/lang de')); await step(2);
const back = await ev(() => ({ lang: VR.I18N.lang, badge: document.querySelector('#modebadge').textContent, chat: [...document.querySelectorAll('#chatlog div')].map(d => d.textContent).slice(-1)[0], pause: document.querySelector('#pause h2').textContent }));
console.log('after /lang de', JSON.stringify(back));
check(back.lang === 'de' && back.badge === 'KREATIV' && back.pause === 'Pause', '/lang de switches back live — also in Einfach, where other commands wait for Profi');
check(back.chat === 'Sprache: Deutsch', 'the command answers in the new language: ' + back.chat);
await ev(() => VR.game.chat('/lang fr')); await step(1);
const fr = await ev(() => ({ lang: VR.I18N.lang, chat: [...document.querySelectorAll('#chatlog div')].map(d => d.textContent).slice(-1)[0] }));
check(fr.lang === 'de' && /Français: bald/.test(fr.chat), '/lang fr stays German and says bald: ' + fr.chat);
await ev(() => VR.game.chat('/lang')); await step(1);
check(/^Sprache: Deutsch · \/lang de \| en$/.test(await ev(() => [...document.querySelectorAll('#chatlog div')].map(d => d.textContent).slice(-1)[0])), '/lang alone shows the choice');

// ---- codex, death screen, a command answer, the villager talk box
await ev(() => VR.game.ui.showCodex()); await step(1);
const cats = await texts('#codexgrid .codexcat');
check(cats.some(c => c.startsWith('Meilensteine')) && cats.some(c => c.startsWith('Oberwelt-Biome')), 'the codex categories are German: ' + cats.slice(0, 3).join(' · '));
check((await texts('#codexgrid .codexitem .note')).includes('Bäume haben noch mehr zu bieten.'), 'a milestone hint is German (locked entries show their hint)');
await ev(() => VR.game.ui.showDeath('fall')); await step(1);
check(await text('#death h1') === 'Ohje …' && await text('#deathmsg') === 'Du bist zu hart gelandet.', 'the death screen is German');
await ev(() => { VR.game.ui.show(null); VR.game.chat('/give diamond 3'); }); await step(1);
check(/Profi/.test(await ev(() => [...document.querySelectorAll('#chatlog div')].map(d => d.textContent).slice(-1)[0])), 'Einfach: /give answers with the Profi note, in German');
await ev(() => { VR.UIPrefs.set({ pro: true }); VR.game.chat('/give diamond 3'); }); await step(1);
check(/3 × Diamond bekommen/.test(await ev(() => [...document.querySelectorAll('#chatlog div')].map(d => d.textContent).slice(-1)[0])), 'Profi: /give answers in German (item names stay English)');
await ev(() => VR.UIPrefs.set({ pro: false }));
// to the nearest village, so someone is there to talk to
await ev(() => { const g = VR.game, V = g.villages, p = g.player; const nv = V && V.nearestSite ? V.nearestSite(p.pos[0], p.pos[2]) : null; if (nv) p.safeTeleport(nv.site.x + 0.5, nv.site.y + 2, nv.site.z + 0.5); });
for (let i = 0; i < 60; i++) { await step(10); await wait(500); if (await ev(() => VR.game.villages && VR.game.villages.agents.length > 0)) break; }
const talk = await ev(() => {
  const g = VR.game, V = g.villages; if (!V || !V.agents.length) return { none: true };
  const a = V.agents.find(x => !x.kid) || V.agents[0];
  V.openTalk(a);
  const out = { role: document.querySelector('#tk_role').textContent, opts: [...document.querySelectorAll('#tk_opts button')].map(b => b.textContent), rep: document.querySelector('#tk_rep').textContent, hello: document.querySelector('#tk_text').textContent };
  V.closeTalk();
  return out;
});
console.log('talk', JSON.stringify(talk).slice(0, 300));
if (talk.none) console.log('  (no villager near — the talk box is checked by the tables)');
else { check(talk.opts.includes('Wie geht’s dir?') && talk.opts.includes('Tschüss'), 'the talk options are German'); check(/ in Sprache| in /.test(talk.role) && /mag /.test(talk.role), 'the role line is German: ' + talk.role); check(/Freundschaft im Dorf/.test(talk.rep), 'the friendship line is German'); }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => l.startsWith('[pageerror]')), 'no page errors');
await browser.close();
console.log(fails ? 'FAIL ' + fails : 'OK');
process.exit(fails ? 1 : 0);

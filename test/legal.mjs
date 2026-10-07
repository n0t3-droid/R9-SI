// 📜 + 👥 in the browser (src/main/legal.js, mp.js): the claude.ai room is stubbed — every presence patch, emit and
// capability request is recorded — and the profile name is „Erika Mustermann".
//   1 · a fresh browser: the name notice shows in the title's multiplayer box before any presence carries a name;
//       Join waits for it; ✓ OK publishes the name; the answer is kept for the next start
//   2 · Spitzname…: the nickname goes out, the profile name never
//   3 · Mehrspieler aus: no presence at all, and on the next start no connection; Settings → Game turns it back on
//   4 · a world: hosting waits for the notice (pause menu → ✓ OK); 📜 in the pause menu opens the overlay, the
//       sections and DE / EN switch, 📋 copies, Esc closes it and only it; 📜 next to Done in the settings
//   5 · the R9 Studio: 📜 in the header, Esc; 📦 Mitnehmen says the share hint
// And no page error anywhere.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1180, height: 760 }, acceptDownloads: true });
await ctx.addInitScript(() => {
  const rec = window.__mp = { used: [], pres: [], emits: [], namedAt: 0, noticeAt: 0 };
  const mine = {};
  const me = () => ({ peer: 'p_me', by: 'u_me', isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze(Object.assign({}, mine)), updatedAt: Date.now() });
  const friend = { peer: 'p_fr', by: 'u_fr', isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: { v: 1, n: 'Buddy', host: { s: 'w-buddy', w: 'Buddys Welt', m: 'creative', t: Date.now() } }, updatedAt: Date.now() };
  const fns = [];
  const peers = () => [me(), friend];
  const lobby = {
    emit: (topic, data) => { rec.emits.push([topic, JSON.parse(JSON.stringify(data === undefined ? null : data))]); return Promise.resolve(); },
    on: () => () => { },
    presence: (patch) => {
      const p = JSON.parse(JSON.stringify(patch)); rec.pres.push(p);
      if (p.n || (p.pl && p.pl.n)) rec.namedAt = rec.namedAt || performance.now();
      for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; }
      setTimeout(() => { for (const f of fns.slice()) f({ peers: peers(), joined: [], left: [], updated: [me()] }); }, 0);
      return Promise.resolve();
    },
    peers,
    onPeers: (fn) => { fns.push(fn); setTimeout(() => fn({ peers: peers(), joined: peers(), left: [], updated: [] }), 0); return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); }; },
    connected: () => true,
    onConnection: (fn) => { setTimeout(() => fn(true), 0); return () => { }; },
  };
  window.claude = { use: async (cap) => { rec.used.push(cap); if (cap === 'room') return Object.assign({ join: async () => lobby }, lobby); if (cap === 'user') return { me: async () => ({ id: 'u_me', name: 'Erika Mustermann', color: '#8cf' }), profiles: async () => ({}) }; return null; } };
  // when the notice first shows
  new MutationObserver(() => { if (!rec.noticeAt && document.querySelector('.mpnotice')) rec.noticeAt = performance.now(); }).observe(document, { childList: true, subtree: true });
});
const logs = [];
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const GAME = 'file:///home/claude/vr/dist/index.html', STUDIO = 'file:///home/claude/vr/dist/studio.html';
const page = await ctx.newPage();
page.on('pageerror', e => logs.push('[game pageerror] ' + (e.stack || e.message).slice(0, 1200)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404|ERR_FILE_NOT_FOUND/.test(m.text())) logs.push('[game console] ' + m.text().slice(0, 400)); });
const ev = (fn, a) => page.evaluate(fn, a);
const shot = (n) => page.screenshot({ path: `/home/claude/vr/test/shots/${n}.png`, timeout: 120000 }).catch((e) => console.log('shot failed', n, e.message));
async function toTitle(what) {
  for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => !!(window.VR && VR.game && VR.game.state === 'title' && VR.game.mp && VR.game.mp.status !== 'connecting')).catch(() => false); if (s) break; }
  await wait(400);
  return ev(() => ({ state: VR.game.state, status: VR.game.mp.status, ready: VR.game.mp.ready }));
}
const clickIn = (sel, text) => ev(([s, t]) => { const b = [...document.querySelectorAll(s + ' button')].find(x => x.textContent.trim().startsWith(t) && x.offsetParent !== null); if (!b) return false; b.click(); return true; }, [sel, text]);

console.log('1 · a fresh browser: the notice before any name');
await page.goto(GAME);
let t = await toTitle();
await ev(() => { const g = VR.game; g.settings.renderDist = 3; g.settings.dynRes = false; g.settings.horizon = 0; g.applySettings('*'); g.saveSettings(); });
let r = await ev(() => ({ used: __mp.used, pres: __mp.pres, notice: !!document.querySelector('#mphosts .mpnotice'), text: (document.querySelector('#mphosts .mpnotice') || {}).textContent || '', hosts: VR.game.mp.hostList().length, join: !!document.querySelector('#mphosts .mphost button') }));
console.log('  ', JSON.stringify({ t, r }).slice(0, 600));
check(t.status === 'ready' && r.used.includes('room'), 'the stubbed claude.ai room is there (multiplayer ready)');
check(r.notice && /Mitspieler sehen deinen Namen/.test(r.text) && /Erika Mustermann/.test(r.text), 'the title\'s multiplayer box asks: „👥 Mitspieler sehen deinen Namen: Erika Mustermann“');
check(/✓ OK/.test(r.text) && /Spitzname…/.test(r.text) && /Mehrspieler aus/.test(r.text), 'with ✓ OK · Spitzname… · Mehrspieler aus');
check(r.pres.length === 0, 'no presence at all before the answer (' + r.pres.length + ' patches)');
await shot('legal_notice_title');
// Join first: it waits for the notice
check(r.hosts === 1 && r.join, 'a friend\'s world is listed with Join');
await ev(() => document.querySelector('#mphosts .mphost button').click());
await wait(300);
r = await ev(() => ({ role: VR.game.mp.role, hello: __mp.emits.filter(e => e[0] === 'hello').length, ask: !!document.querySelector('#mphosts .mpnotice.ask'), state: VR.game.state }));
check(!r.role && r.hello === 0 && r.ask && r.state === 'title', 'Join before the answer: nothing sent, the notice lights up (' + JSON.stringify(r) + ')');
check(await clickIn('#mphosts .mpnotice', '✓ OK'), '✓ OK clicked');
await wait(400);
r = await ev(() => ({ pres: __mp.pres, flag: localStorage.getItem('r9si.mpNotice'), notice: !!document.querySelector('#mphosts .mpnotice'), namedAt: __mp.namedAt, noticeAt: __mp.noticeAt }));
const named = r.pres.filter(p => p.n);
check(named.length >= 1 && named[0].n === 'Erika Mustermann' && r.flag === '1' && !r.notice, 'after ✓ OK the lobby presence carries the name, the answer is kept (r9si.mpNotice), the notice is gone');
check(r.noticeAt > 0 && r.namedAt > r.noticeAt, 'the notice showed before any presence carried a name (' + Math.round(r.noticeAt) + ' ms < ' + Math.round(r.namedAt) + ' ms)');
await page.reload();
t = await toTitle();
r = await ev(() => ({ pres: __mp.pres, notice: !!document.querySelector('#mphosts .mpnotice') }));
check(r.pres.some(p => p.n === 'Erika Mustermann') && !r.notice, 'the next start: the name goes out at once, no notice (once per browser)');

console.log('2 · Spitzname…');
await ev(() => { localStorage.removeItem('r9si.mpNotice'); const s = JSON.parse(localStorage.getItem('r9si.settings') || '{}'); delete s.playerName; localStorage.setItem('r9si.settings', JSON.stringify(s)); });
await page.reload();
t = await toTitle();
check(await clickIn('#mphosts .mpnotice', 'Spitzname'), 'Spitzname… clicked');
await wait(300);
r = await ev(() => ({ input: !!document.querySelector('#mphosts .mpnotice input'), focused: document.activeElement && document.activeElement.classList.contains('mpn-nick') }));
check(r.input, 'a field for the nickname (' + JSON.stringify(r) + ')');
await page.click('#mphosts .mpnotice input');
await page.keyboard.type('Stern');
// the lobby keeps changing meanwhile (friends move, presence updates ~10 Hz): the field must survive it
for (let i = 0; i < 5; i++) { await ev(() => { const mp = VR.game.mp; mp.lobbyChanged(mp.T.lobby.peers()); }); await wait(60); }
await page.keyboard.type('chen');
check(await ev(() => (document.querySelector('#mphosts .mpnotice input') || {}).value === 'Sternchen'), 'the field keeps what is typed while the lobby changes');
await page.keyboard.press('Enter');
await wait(400);
r = await ev(() => ({ pres: __mp.pres, name: VR.game.settings.playerName, flag: localStorage.getItem('r9si.mpNotice') }));
check(r.pres.some(p => p.n === 'Sternchen') && !r.pres.some(p => JSON.stringify(p).includes('Erika')) && r.name === 'Sternchen' && r.flag === '1', 'the nickname goes out (settings.playerName), the profile name never: ' + JSON.stringify(r.pres));

console.log('3 · Mehrspieler aus');
await ev(() => { localStorage.removeItem('r9si.mpNotice'); });
await page.reload();
t = await toTitle();
check(await clickIn('#mphosts .mpnotice', 'Mehrspieler aus'), 'Mehrspieler aus clicked');
await wait(300);
r = await ev(() => ({ off: localStorage.getItem('r9si.mp'), status: VR.game.mp.status, pres: __mp.pres, text: document.querySelector('#mphosts').textContent }));
check(r.off === 'off' && r.status === 'off' && !r.pres.some(p => p.n) && /Mehrspieler ist aus/.test(r.text), 'off: r9si.mp = off, no name went out, the box says so (' + JSON.stringify(r).slice(0, 300) + ')');
await page.reload();
t = await toTitle();
r = await ev(() => ({ used: __mp.used, pres: __mp.pres.length, status: VR.game.mp.status }));
check(!r.used.includes('room') && !r.used.includes('user') && r.pres === 0 && r.status === 'off', 'the next start: no connection at all, no presence (' + JSON.stringify(r) + ')');
// Settings → Game turns it back on (and the notice is still to be answered)
await ev(() => { VR.game.ui.act('settings'); VR.game.ui.settingsTab = 'game'; VR.game.ui.showSettings(); });
r = await ev(() => { const cb = document.querySelector('#setbody [data-mp-toggle]'); return { cb: !!cb, checked: cb && cb.checked, legal: !!document.querySelector('#settings [data-legal]') }; });
check(r.cb && r.checked === false, 'Settings → Game: 👥 Mehrspieler, unchecked');
check(r.legal, '📜 next to Done in the settings');
await ev(() => document.querySelector('#setbody [data-mp-toggle]').click());
for (let i = 0; i < 20 && (await ev(() => VR.game.mp.status)) !== 'ready'; i++) await wait(250);
await ev(() => { if (VR.game.ui.screen === 'settings') VR.game.ui.showSettings(); });
r = await ev(() => ({ status: VR.game.mp.status, used: __mp.used, off: localStorage.getItem('r9si.mp'), notice: !!document.querySelector('#setbody .mpnotice'), pres: __mp.pres.filter(p => p.n).length }));
check(r.status === 'ready' && r.used.includes('room') && r.off === null && r.notice && r.pres === 0, 'on again: connected, the notice waits in the settings, still no name (' + JSON.stringify(r) + ')');
await ev(() => VR.game.ui.act('setback'));

console.log('4 · a world: hosting waits; 📜 in the pause menu');
await ev(() => VR.game.createWorld({ name: 'Rechtswelt', mode: 'creative', difficulty: 'peaceful', type: 'flat', seed: '7', cheats: true, kit: true }));
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await wait(500);
r = await ev(() => ({ state: VR.game.state, role: VR.game.mp.role, pres: __mp.pres.filter(p => p.n || p.host || p.pl).length }));
check(r.state === 'play' && !r.role && r.pres === 0, 'in the world: not hosting yet, nothing named sent (' + JSON.stringify(r) + ')');
await ev(() => VR.game.ui.pause());
await wait(200);
r = await ev(() => ({ card: !!document.querySelector('#mppanel .mpnotice'), text: (document.querySelector('#mppanel') || {}).textContent || '', legal: !!document.querySelector('#pause [data-legal]') }));
check(r.card && /Mitspieler sehen deinen Namen/.test(r.text), 'the pause menu\'s 👥 shows the notice');
check(await clickIn('#mppanel .mpnotice', '✓ OK'), '✓ OK in the pause menu');
await wait(500);
r = await ev(() => ({ role: VR.game.mp.role, host: __mp.pres.filter(p => p.host && p.host.s && p.n && p.n === VR.game.mp.myName()).length, panel: (document.querySelector('#mppanel') || {}).textContent || '' }));
check(r.role === 'host' && r.host >= 1 && !/Mitspieler sehen deinen Namen/.test(r.panel), 'now it hosts: the lobby shows the world with the name, the panel is the usual one');
check(await ev(() => !!document.querySelector('#pause [data-legal]')), '📜 in the pause menu');
await shot('legal_pause');
await ev(() => document.querySelector('#pause [data-legal]').click());
await wait(300);
const sec = () => ev(() => ({ open: !!document.querySelector('#r9legal.on'), sec: VR.Legal.section(), body: (document.querySelector('#r9legal .lg-body') || {}).textContent || '', tabs: [...document.querySelectorAll('#r9legal .lg-tabs button')].map(b => b.textContent), on: ((document.querySelector('#r9legal .lg-tabs .on') || {}).textContent) }));
r = await sec();
check(r.open && r.sec === 'impressum' && r.tabs.join('|') === 'Impressum|Datenschutz|Credits|Hinweis', 'the overlay opens on the Impressum, four tabs: ' + r.tabs.join(' · '));
check(['[Name]', '[Anschrift]', '[E-Mail]'].every(w => r.body.includes(w)) && /Vor dem öffentlichen Start ausfüllen/.test(r.body) && await ev(() => document.querySelectorAll('#r9legal mark.lg-ph').length >= 3), 'the placeholders, marked, and the note that they must be filled in before the launch');
await shot('legal_impressum');
for (const [tab, word] of [['Datenschutz', 'Datenschutzerklärung für R9-SI'], ['Credits', 'SIL Open Font License'], ['Hinweis', 'NOT AN OFFICIAL MINECRAFT PRODUCT']]) {
  await clickIn('#r9legal .lg-tabs', tab); await wait(150); r = await sec();
  check(r.on === tab && r.body.includes(word), tab + ': „' + word + '“');
}
await ev(() => document.querySelector('#r9legal [data-lang="en"]').click()); await wait(150);
await clickIn('#r9legal .lg-tabs', 'Privacy'); await wait(150); r = await sec();
check(r.tabs.join('|') === 'Impressum|Privacy|Credits|Notice' && r.body.includes('Privacy policy for R9-SI') && r.body.includes('Other players see your name'), 'EN: Privacy policy, the tabs in English');
await shot('legal_privacy_en');
await ev(() => document.querySelector('#r9legal [data-lang="de"]').click()); await wait(150);
await ev(() => { VR.Credits = { list: () => [{ name: 'Hirsch', kind: 'ding', src: { title: 'Deer', author: 'Kenney', url: 'https://kenney.nl/assets/deer', license: 'CC BY 4.0', tier: 'by' } }] }; });
await clickIn('#r9legal .lg-tabs', 'Credits'); await wait(150); r = await sec();
check(/Importierte Dinge/.test(r.body) && r.body.includes('„Deer“ von Kenney') && await ev(() => !!document.querySelector('#r9legal a[href="https://kenney.nl/assets/deer"]')), 'Credits lists VR.Credits (with links)');
await ev(() => document.querySelector('#r9legal .lg-copy').click()); await wait(400);
r = await ev(() => ({ copied: VR.Legal.copied || '', msg: (document.querySelector('#r9legal .lg-msg') || {}).textContent || '' }));
check(['IMPRESSUM', 'DATENSCHUTZ', 'CREDITS', 'HINWEIS', '[Anschrift]', 'Orbitron'].every(w => r.copied.includes(w)) && r.msg.length > 0, '📋 copies all of it as plain text (' + r.copied.length + ' chars) — „' + r.msg + '“');
await page.keyboard.press('Escape'); await wait(200);
r = await ev(() => ({ open: !!document.querySelector('#r9legal.on'), screen: VR.game.ui.screen, focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.legal : null }));
check(!r.open && r.screen === 'pause', 'Esc closes the overlay — and only it: the pause menu stays (' + JSON.stringify(r) + ')');
await ev(() => VR.game.ui.act('settings')); await wait(150);
check(await ev(() => document.querySelectorAll('#settings [data-legal]').length === 1), '📜 next to Done in the settings (once)');
await ev(() => document.querySelector('#settings [data-legal]').click()); await wait(200);
check(await ev(() => !!document.querySelector('#r9legal.on') && VR.Legal.section() === 'impressum'), 'and it opens the Impressum');
await page.keyboard.press('Escape'); await wait(200);
check(await ev(() => !document.querySelector('#r9legal.on') && VR.game.ui.screen === 'settings'), 'Esc: back in the settings');

console.log('5 · the R9 Studio');
const sp = await ctx.newPage();
sp.on('pageerror', e => logs.push('[studio pageerror] ' + (e.stack || e.message).slice(0, 1200)));
sp.on('console', m => { if (m.type() === 'error' && !/favicon|404|ERR_FILE_NOT_FOUND/.test(m.text())) logs.push('[studio console] ' + m.text().slice(0, 400)); });
await sp.goto(STUDIO);
for (let i = 0; i < 60; i++) { await wait(500); if (await sp.evaluate(() => !!document.querySelector('#studio > header [data-legal]') && !!window.VR && !!VR.StudioBridge).catch(() => false)) break; }
r = await sp.evaluate(() => { const b = document.querySelector('#studio > header [data-legal]'); return { btn: !!b, text: b ? b.textContent : '', visible: !!(b && b.offsetParent !== null) }; });
check(r.btn && r.visible && /📜/.test(r.text), 'the Studio\'s header has 📜 (' + r.text + ')');
await sp.evaluate(() => document.querySelector('#studio > header [data-legal]').click()); await wait(300);
check(await sp.evaluate(() => !!document.querySelector('#r9legal.on') && /Angaben gemäß § 18/.test(document.querySelector('#r9legal .lg-body').textContent)), 'it opens the Impressum in the Studio');
await sp.screenshot({ path: '/home/claude/vr/test/shots/legal_studio.png', timeout: 120000 }).catch(() => { });
await sp.keyboard.press('Escape'); await wait(200);
check(await sp.evaluate(() => !document.querySelector('#r9legal.on')), 'Esc closes it');
const dl = sp.waitForEvent('download', { timeout: 15000 }).catch(() => null);
r = await sp.evaluate(async () => { const ok = await VR.StudioBridge.exportPack(); return { ok, sys: (document.getElementById('sysText') || {}).textContent || '' }; });
await dl;
check(r.ok && /Teile nur, was dir gehört/.test(r.sys), '📦 Mitnehmen: the share hint in one line — „' + r.sys + '“');

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page error');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);

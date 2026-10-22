// f-names in the page (plan docs/superpowers/plans/2026-10-23-f-names.md; R50-05 + R50-07). One run, German first,
// 1280 × 720:
//   1. the create form's one question „Wie willst du spielen?", German: Einfach and Profi, each card (🏗 Frei bauen ·
//      🧭 Abenteuer, sanft · ⚔ Abenteuer mit Begegnungen), Profi 🏗 + Überleben (Friedlich lit), 🧸 Kindersicher →
//      names_cf_de_*.png; „Welt erstellen" in view in each, nothing scrolled
//   2. every combination through the page's own buttons (Einfach/Profi × 🧸 × four pick orders × card × Spielart ×
//      difficulty; only buttons a player can see are clicked; ui.js's createWorld captured): the lit difficulty is the
//      world's (its band under „mit Begegnungen"), peaceful the default, 🧸 only the first two cards, no Zen under ⚔
//   3. English: the same six cards → names_cf_en_*.png
//   4. one world: Profi, ⚔ mit Begegnungen, Überleben, Schwer → meta.difficulty peaceful, band hard, enc normal
//   5. the Heliataler: the HUD ring (crop), the level-up gift, a quest's reward, the pause card, the Tagebuch, the Hangar
//      (a buy) → names_hud.png, names_levelup.png, names_reward.png, names_card.png, names_journal.png, names_shop.png;
//      the coin is Helia's sun everywhere; the settings line „Wolkenrochen" → names_settings.png
//   6. English in the world: the card, the Tagebuch, the Hangar → names_*_en.png
//   7. the retired words (Sterntaler, Sky Ray, Himmelsrochen) nowhere in the page, no page error
//   8. the cost: the game loop on Very Low and High, this build against the base (1feab8f, built into
//      .tmp_tests/base/dist) in a second page of the same browser, alternating blocks of 200 frames (CPU, drawing off)
// → test/shots/names_*.png, names_sheet.jpg, names_numbers.json
//   nohup bash test/wt_run.sh names.mjs 3600 > .tmp_tests/names_mjs.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = 'file://' + ROOT + 'dist/index.html';
const BASE_FILE = ROOT + '.tmp_tests/base/dist/index.html';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const N = {};   // the numbers for the plan
fs.mkdirSync(SHOTS, { recursive: true });
const RETIRED = /Sterntaler|Sky[ -]?Rays?|Skyrays?|Himmelsrochen/i;

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// the game's own frames stop once a world is open (window.__manual): a frame the test runs itself would otherwise start
// one more requestAnimationFrame chain each time; drawing only for a picture (SwiftShader draws slowly)
const manualInit = (pg) => pg.evaluate(() => {
  const g = VR.game; if (g.__man) return; g.__man = true;
  const L = Object.getPrototypeOf(g).loop;
  g.loop = function (t) { if (window.__manual && !window.__inMan) return; return L.call(this, t); };
  if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
  window.__manual = true;
});
const step = async (n, dtms = 33, pg = page) => { for (let k = 0; k < n; k += 20) await pg.evaluate(([m, d]) => { const g = VR.game; window.__norender = true; window.__inMan = true; try { for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } } finally { window.__inMan = false; } }, [Math.min(20, n - k), dtms]); };
const draw = (tod) => ev((tod) => { const g = VR.game; window.__norender = false; window.__inMan = true; try { if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); } finally { window.__inMan = false; window.__norender = true; } }, tod);
const frames = (n, pg) => pg.evaluate((n) => { const g = VR.game; window.__norender = true; window.__inMan = true; const a = performance.now(); try { for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } } finally { window.__inMan = false; } return (performance.now() - a) / n; }, n);
const shot = async (name, clip) => { await wait(150); await page.screenshot({ path: SHOTS + name + '.png', timeout: 120000, clip }); console.log('shot ' + name + ' (' + secs() + ')'); return SHOTS + name + '.png'; };
const hold = (ms) => ev((ms) => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = ms; } catch (e) { /* */ } } }, ms);
const release = () => ev(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) { /* */ } } });
const pics = {};
// one section stopping (a throw) is one failure and its picture; the next section still runs (one run must tell all)
const section = async (tag, fn) => {
  try { await fn(); } catch (e) {
    fails++; console.log('  ✗ section ' + tag + ' stopped: ' + (e.stack || e.message).slice(0, 900));
    try { await release(); await page.screenshot({ path: SHOTS + 'names_fail_' + tag + '.png', timeout: 120000 }); } catch (e2) { /* */ }
  }
};
// the page's text, read for the retired words at every stop
const seenText = [];
const readText = async (where) => { const t = await ev(() => document.body.innerText); seenText.push([where, t]); const m = t.match(RETIRED); check(!m, where + ': none of the retired words on screen' + (m ? ' — found „' + m[0] + '"' : '')); return t; };

// ---- the create form: what a player sees (only what is on screen counts)
const formState = () => ev(() => {
  const q = (s) => document.querySelector(s), vis = (e) => !!e && e.getClientRects().length > 0;
  const fieldOf = (e) => (e ? e.closest('.field') : null);
  const shown = (s) => [...document.querySelectorAll(s + ' > button')].filter(vis).map(b => b.dataset.v);
  const lit = (s) => { const b = q(s + ' > .on'); return b ? b.dataset.v : null; };
  const go = q('#create [data-act="docreate"]'), r = go.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const scr = q('#create'), panel = scr.querySelector('.panel'), way = fieldOf(q('#cw_way')), note = q('#create .advwaynote');
  const cards = [...document.querySelectorAll('#cw_way > button')].filter(vis);
  return {
    label: way ? way.querySelector('label').textContent : null, afterName: !!(way && way.previousElementSibling && way.previousElementSibling.querySelector('#cw_name')),
    cards: cards.map(b => b.dataset.v), texts: cards.map(b => b.innerText.replace(/\s+/g, ' ').trim()), way: lit('#cw_way'),
    modeShown: vis(fieldOf(q('#cw_mode'))), modes: shown('#cw_mode'), mode: lit('#cw_mode'),
    diffShown: vis(fieldOf(q('#cw_diff'))), diffs: shown('#cw_diff'), diff: lit('#cw_diff'),
    note: vis(note) ? note.textContent : '', name: q('#cw_name').value,
    go: { text: go.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), hit: !!hit && (hit === go || go.contains(hit)) },
    vh: innerHeight, scroll: [scr.scrollTop, panel.scrollTop], panelH: Math.round(panel.getBoundingClientRect().height),
  };
});
// opens the form the way a player does (the start screen's „Neue Welt"), then clicks the picks in order
const openForm = async (pro, kids, picks) => {
  await ev(([pro, kids]) => { VR.UIPrefs.set({ pro }); VR.game.settings.kids = kids; VR.game.ui.show('title'); }, [pro, kids]);
  await wait(300);
  await ev(() => document.querySelector('#title [data-act="newworld"]').click());
  await wait(300);
  for (const [sel, v] of picks || []) await ev(([sel, v]) => document.querySelector(`${sel} > [data-v="${v}"]`).click(), [sel, v]);
  await wait(250);
  return formState();
};
const inView = (st) => st.go.top >= 0 && st.go.bottom <= st.vh && st.go.hit && st.scroll[0] === 0 && st.scroll[1] === 0;
const CARD = { free: '#cw_way', gentle: '#cw_way', enc: '#cw_way' };

try {
  await page.goto(DIST);
  const atTitle = () => ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title');
  for (let i = 0; i < 160; i++) { await wait(500); if (await atTitle()) break; }
  check(await atTitle(), 'the start screen (' + secs() + ')');
  check(await ev(() => !!(VR.Adv && VR.Adv.form && VR.Adventure && VR.Adventure.createRow && VR.Quests && VR.Shop)), 'VR.Adv.form, VR.Adventure.createRow, VR.Quests and VR.Shop are in the page');
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); g.audio.resume(); if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  check(await ev(() => VR.I18N.lang) === 'de', 'German UI (de-DE)');

  // ---------------------------------------------------------------- 1 · the create form, German
  const FORM = async (lang) => {
    const L = lang === 'de';
    for (const pro of [false, true]) {
      const tag = pro ? 'profi' : 'einfach';
      for (const k of ['free', 'gentle', 'enc']) {
        const st = await openForm(pro, false, k === 'free' ? [] : [[CARD[k], k]]);
        console.log('     ' + lang + ' ' + tag + ' ' + k + ': ' + JSON.stringify(st));
        N['cf_' + lang + '_' + tag + '_' + k] = st;
        const okCards = st.cards.join() === 'free,gentle,enc' && st.way === k && st.afterName && st.label === (L ? 'Wie willst du spielen?' : 'How do you want to play?');
        let okRows;
        if (!pro) okRows = !st.modeShown && !st.diffShown;
        else if (k === 'enc') okRows = st.modeShown && st.modes.join() === 'survival,creative' && st.mode === 'survival' && st.diffShown && st.diffs.join() === 'easy,normal,hard' && st.diff === 'normal';
        else okRows = st.modeShown && st.modes.join() === 'survival,creative,zen' && st.mode === 'zen' && !st.diffShown;
        check(okCards && okRows, `${lang} ${pro ? 'Profi' : 'Einfach'}, ${st.texts[['free', 'gentle', 'enc'].indexOf(k)] || k}: the three cards after the name, ` + (!pro ? 'no Spielart, no difficulty' : k === 'enc' ? 'Spielart without Zen (Überleben lit), the band Leicht · Normal · Schwer (Normal lit)' : 'Spielart with Zen lit, no difficulty row'));
        check(inView(st), `${lang} ${tag} ${k}: „${st.go.text}" in view at 1280 × 720 without scrolling (${st.go.top}–${st.go.bottom} of ${st.vh} px, the panel ${st.panelH} px)`);
        if (k === 'enc') check(st.note.length > 10, `${lang} ${tag} ⚔: the note says the encounters come later („${st.note}")`);
        pics['cf_' + lang + '_' + tag + '_' + k] = await shot('names_cf_' + lang + '_' + tag + '_' + k);
      }
    }
  };
  await section('1', async () => {
    console.log('1 · the create form, German');
    await FORM('de');
    const de = N.cf_de_profi_free;
    check(/Frei bauen/.test(de.texts[0]) && /Abenteuer, sanft/.test(de.texts[1]) && /Abenteuer mit Begegnungen/.test(de.texts[2]) && /Heliataler/.test(de.texts[1]), 'the cards say „Frei bauen" · „Abenteuer, sanft" (with the Heliataler) · „Abenteuer mit Begegnungen"');
    // Profi: 🏗 + Überleben → the difficulty row appears with Friedlich lit (peaceful stays the default)
    const fs1 = await openForm(true, false, [['#cw_mode', 'survival']]);
    N.cf_de_profi_free_survival = fs1;
    check(fs1.way === 'free' && fs1.mode === 'survival' && fs1.diffShown && fs1.diffs.join() === 'peaceful,easy,normal,hard' && fs1.diff === 'peaceful' && inView(fs1), '🏗 Frei bauen + Überleben: the row Friedlich · Leicht · Normal · Schwer appears, Friedlich lit (' + JSON.stringify({ diffs: fs1.diffs, diff: fs1.diff }) + ')');
    pics.cf_de_free_surv = await shot('names_cf_de_profi_free_survival');
    // 🧸 Kindersicher: the first two cards only, no difficulty
    const ks = await openForm(true, true, [['#cw_mode', 'survival']]);
    N.cf_de_kids = ks;
    check(ks.cards.join() === 'free,gentle' && !ks.diffShown && /Kindersicher/.test(ks.note + ' ' + (await ev(() => document.querySelector('#create').innerText))) === true, '🧸 Kindersicher: only 🏗 Frei bauen and 🧭 sanft, no difficulty even under Überleben (' + JSON.stringify({ cards: ks.cards, diffShown: ks.diffShown, note: ks.note }) + ')');
    const ks2 = await openForm(true, true, [['#cw_way', 'gentle']]);
    check(ks2.way === 'gentle' && /Kindersicher/.test(ks2.note), '🧸 + 🧭 sanft: the note „' + ks2.note + '"');
    pics.cf_de_kids = await shot('names_cf_de_kids');
    await ev(() => { VR.game.settings.kids = false; });
    await readText('the create form (German)');
  });

  // ---------------------------------------------------------------- 2 · every combination through the page's buttons
  await section('2', async () => {
    console.log('2 · every combination through the page\'s buttons');
    const W = await ev(() => {
      const g = VR.game, ui = g.ui, A = VR.Adventure, out = { n: 0, nbad: 0, bad: [], skipped: 0, clicks: 0, ms: 0, defaults: [], ways: {}, worlds: {} };
      const q = (s) => document.querySelector(s), vis = (e) => !!e && e.getClientRects().length > 0, fieldOf = (e) => (e ? e.closest('.field') : null);
      const shown = (s) => [...document.querySelectorAll(s + ' > button')].filter(vis).map(b => b.dataset.v);
      const lit = (s) => { const b = q(s + ' > .on'); return b ? b.dataset.v : null; };
      const see = () => ({ way: lit('#cw_way'), cards: shown('#cw_way'), modeShown: vis(fieldOf(q('#cw_mode'))), modes: shown('#cw_mode'), mode: lit('#cw_mode'), diffShown: vis(fieldOf(q('#cw_diff'))), diffs: shown('#cw_diff'), diff: lit('#cw_diff') });
      const cw0 = g.createWorld; let got = null;
      g.createWorld = (o) => { got = o; };
      const create = () => { got = null; A.pendingCreate = null; q('#create [data-act="docreate"]').click(); const pc = A.pendingCreate; A.pendingCreate = null; return { got, pc: pc ? { band: pc.band, enc: pc.enc } : null }; };
      const SEL = { way: '#cw_way', mode: '#cw_mode', diff: '#cw_diff' };
      const click = (what, v) => { const b = q(`${SEL[what]} > [data-v="${v}"]`); if (!b || !vis(b)) { out.skipped++; return; } const t = performance.now(); b.click(); out.ms += performance.now() - t; out.clicks++; };
      try {
        for (const pro of [false, true]) for (const kids of [false, true]) {
          VR.UIPrefs.set({ pro }); g.settings.kids = kids;
          // the fresh form: 🏗 Frei bauen, Zen, peaceful, no Abenteuer
          ui.show('create');
          const s0 = see(), c0 = create();
          out.defaults.push({ pro, kids, way: s0.way, mode: c0.got && c0.got.mode, difficulty: c0.got && c0.got.difficulty, adv: !!c0.pc, diffShown: s0.diffShown });
          for (const ord of [['way', 'mode', 'diff'], ['mode', 'diff', 'way'], ['diff', 'way', 'mode'], ['way', 'diff', 'mode']])
            for (const way of ['free', 'gentle', 'enc']) for (const mode of ['survival', 'creative', 'zen']) for (const diff of ['peaceful', 'easy', 'normal', 'hard']) {
              ui.show('create');
              const val = { way, mode, diff };
              for (const w of ord) click(w, val[w]);
              const s = see(), c = create(), G = c.got, pc = c.pc;
              out.n++;
              out.ways[s.way] = (out.ways[s.way] || 0) + 1;
              const key = s.way + '/' + (G && G.mode) + '/' + (G && G.difficulty) + (pc ? '/' + pc.band + '/' + pc.enc : '');
              out.worlds[key] = (out.worlds[key] || 0) + 1;
              const bads = [];
              if (!G) bads.push('no world');
              else {
                if (s.cards.join() !== (kids ? 'free,gentle' : 'free,gentle,enc')) bads.push('cards');
                if (kids && s.way === 'enc') bads.push('kids enc');
                if (!pro && (s.modeShown || s.diffShown)) bads.push('Einfach shows a row');
                if (s.modeShown && G.mode !== s.mode) bads.push('Spielart differs');
                if (!s.modeShown && G.mode !== (s.way === 'enc' ? 'survival' : 'zen')) bads.push('hidden Spielart');
                if (s.way === 'enc' && (G.mode === 'zen' || s.modes.indexOf('zen') >= 0)) bads.push('Zen under encounters');
                if (s.modeShown && s.modes.indexOf(s.mode) < 0) bads.push('lit Spielart hidden');
                if (s.diffShown && s.diffs.indexOf(s.diff) < 0) bads.push('lit difficulty hidden');
                if (G.mode === 'zen' && s.diffShown) bads.push('Zen shows a difficulty');
                if (kids && s.diffShown) bads.push('Kindersicher shows a difficulty');
                if (s.way === 'free') {
                  if (pc) bads.push('Frei bauen has an Abenteuer');
                  if (G.difficulty !== (s.diffShown ? s.diff : 'peaceful')) bads.push('the difficulty is not the shown one');
                  if (s.diffShown && s.diffs.join() !== 'peaceful,easy,normal,hard') bads.push('the free row');
                } else {
                  if (G.difficulty !== 'peaceful') bads.push('an Abenteuer world not peaceful');
                  if (!pc) bads.push('no Abenteuer');
                  else if (s.way === 'gentle') { if (pc.enc !== 'off' || pc.band !== 'normal' || s.diffShown) bads.push('sanft'); }
                  else { if (pc.enc !== 'normal' || pc.band !== (s.diffShown ? s.diff : 'normal')) bads.push('the band is not the shown one'); if (s.diffShown && s.diffs.join() !== 'easy,normal,hard') bads.push('the band row'); }
                }
              }
              if (bads.length) { out.nbad++; if (out.bad.length < 10) out.bad.push({ bads, pro, kids, ord: ord.join('>'), val, s, got: G && { mode: G.mode, difficulty: G.difficulty }, pc }); }
            }
        }
      } finally { g.createWorld = cw0; VR.UIPrefs.set({ pro: true }); g.settings.kids = false; ui.show('title'); }
      out.msPerClick = out.clicks ? out.ms / out.clicks : 0;
      return out;
    });
    console.log('     ' + JSON.stringify({ n: W.n, nbad: W.nbad, skipped: W.skipped, clicks: W.clicks, msPerClick: +W.msPerClick.toFixed(3), ways: W.ways }));
    console.log('     the worlds made: ' + JSON.stringify(W.worlds));
    for (const b of W.bad) console.log('     ✗ ' + JSON.stringify(b));
    N.walk = { n: W.n, nbad: W.nbad, skipped: W.skipped, clicks: W.clicks, msPerClick: +W.msPerClick.toFixed(3), ways: W.ways, worlds: W.worlds, defaults: W.defaults };
    check(W.n === 576 && W.nbad === 0, 'every combination (' + W.n + ': Einfach/Profi × 🧸 × four orders × card × Spielart × difficulty, ' + W.clicks + ' clicks a player can make, ' + W.skipped + ' on buttons not on screen skipped): the lit difficulty is the world\'s, its band under ⚔, no Zen under ⚔, 🧸 two cards — ' + W.nbad + ' wrong');
    check(W.defaults.every(d => d.way === 'free' && d.mode === 'zen' && d.difficulty === 'peaceful' && !d.adv && !d.diffShown), 'the fresh form is 🏗 Frei bauen, Zen, peaceful, no Abenteuer — in Einfach and Profi, with and without 🧸 (' + JSON.stringify(W.defaults.map(d => d.mode + '/' + d.difficulty)) + ')');
    check((W.ways.enc || 0) > 0 && (W.ways.gentle || 0) > 0 && (W.ways.free || 0) > 0, 'all three cards reached (' + JSON.stringify(W.ways) + ')');
    check(W.msPerClick < 5, 'a click on the form: ' + W.msPerClick.toFixed(3) + ' ms (the rules and the rows re-lit)');
  });

  // ---------------------------------------------------------------- 3 · English
  await section('3', async () => {
    console.log('3 · the create form, English');
    await ev(() => VR.I18N.set('en'));
    await wait(300);
    await FORM('en');
    const en = N.cf_en_profi_free;
    check(/Free building/.test(en.texts[0]) && /Gentle adventure/.test(en.texts[1]) && /Adventure with encounters/.test(en.texts[2]) && /Heliataler/.test(en.texts[1]) && en.go.text === 'Create world', 'English: „Free building" · „Gentle adventure" (with the Heliataler) · „Adventure with encounters", „Create world"');
    await readText('the create form (English)');
    await ev(() => VR.I18N.set('de'));
    await wait(300);
  });

  // ---------------------------------------------------------------- 4 · one world: Profi, ⚔, Überleben, Schwer
  let pos0 = null;
  await section('4', async () => {
    console.log('4 · a world: Profi, ⚔ mit Begegnungen, Überleben, Schwer');
    const st = await openForm(true, false, [['#cw_way', 'enc'], ['#cw_mode', 'survival'], ['#cw_diff', 'hard']]);
    await ev(() => { document.querySelector('#cw_name').value = 'Heliataler-Probe'; document.querySelector('#cw_seed').value = '4242'; });
    check(st.way === 'enc' && st.mode === 'survival' && st.diff === 'hard' && st.diffShown, 'the form shows ⚔ mit Begegnungen, Überleben, Schwer (' + JSON.stringify({ way: st.way, mode: st.mode, diff: st.diff }) + ')');
    await ev(() => document.querySelector('#create [data-act="docreate"]').click());
    for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
    check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
    await manualInit(page);
    for (let i = 0; i < 14; i++) { await step(20); await wait(250); }
    const w = await ev(() => { const g = VR.game, m = g.meta, a = m.adventure; return { name: m.name, diff: m.difficulty, gdiff: g.difficulty, mode: g.player.mode, on: !!(a && a.on), band: a && a.band, enc: a && a.enc, taler: a && a.me.taler, keys: a ? Object.keys(a).sort() : [] }; });
    console.log('     ' + JSON.stringify(w));
    N.world = w;
    check(w.on && w.mode === 'survival' && w.diff === 'peaceful' && w.gdiff === 'peaceful' && w.band === 'hard' && w.enc === 'normal', 'the world: Überleben, its own difficulty peaceful, the Abenteuer on with band Schwer and Begegnungen normal — what the form showed');
    check(w.keys.indexOf('taler') < 0 && typeof w.taler === 'number', 'the record keeps its field names (me.taler; nothing renamed in the save)');
    pos0 = await ev(() => { const p = VR.game.player; return [p.pos[0], p.pos[1], p.pos[2], p.yaw, p.pitch]; });
  });

  // ---------------------------------------------------------------- 5 · the Heliataler in the world (German)
  await section('5', async () => {
    console.log('5 · the Heliataler: ring, level-up, reward, card, Tagebuch, Hangar');
    await ev(() => { const g = VR.game, p = g.player; p.pitch = 0.04; const me = g.meta.adventure.me; me.taler = 135; me.xp = 585; const lv = VR.Adv.levelOf(me.xp); me.level = lv.level; VR.Adventure.renderHud(true); });
    await draw(5200); await step(4); await draw(5200);
    const ring = await ev(() => { VR.Adventure.renderHud(true); const e = document.getElementById('advhud'), r = e.getBoundingClientRect(), c = e.querySelector('.tal svg.coin'), me = VR.game.meta.adventure.me; return { shown: getComputedStyle(e).display !== 'none', box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], lvl: e.querySelector('.lvl').textContent, n: e.querySelector('.tal .n').textContent, level: me.level, taler: me.taler, coin: c ? c.getAttribute('data-coin') : null, rays: c ? c.querySelectorAll('path').length : 0, star: c ? /polygon|star/i.test(c.innerHTML) : null }; });
    console.log('     ' + JSON.stringify(ring));
    N.ring = ring;
    check(ring.shown && ring.lvl === String(ring.level) && ring.n === String(ring.taler) && ring.level === 4 && ring.coin === 'helia' && ring.rays >= 2 && !ring.star, 'the ring top left: level ' + ring.lvl + ' and ' + ring.n + ' beside Helia\'s sun (the coin a gold disc with eight rays, no star)');
    pics.hud = await shot('names_hud', { x: 0, y: 0, width: 400, height: 130 });
    pics.hudFull = await shot('names_hud_full');
    // the level-up to 5: the gift in Heliataler
    let busy = '';
    for (let i = 0; i < 40; i++) { busy = await ev(() => VR.Adventure.busy()); if (!busy) break; await step(10); await wait(250); }
    if (busy) console.log('     the view is held: ' + busy);
    const up = await ev(() => { const A = VR.Adventure, me = VR.game.meta.adventure.me, t0 = me.taler, r = A.award('wonder', { id: 'names.mjs' }); clearTimeout(A.banT); const b = document.getElementById('advup'); return { r, banner: b ? b.className : null, text: b ? b.innerText.replace(/\s+/g, ' ') : '', t0, taler: me.taler }; });
    console.log('     ' + JSON.stringify(up));
    check(up.r && up.r.level === 5 && up.r.gift === 50 && up.banner === 'on' && /Geschenk: 50 Heliataler/.test(up.text) && up.taler - up.t0 === 50, 'the level-up to 5: „🎁 Geschenk: 50 Heliataler", the wallet ' + up.t0 + ' → ' + up.taler);
    await step(5); await draw();
    await hold(700);
    pics.levelup = await shot('names_levelup');
    await release();
    await ev(() => { const b = document.getElementById('advup'); if (b) b.className = ''; });
    await wait(1700);
    // a quest's reward (the Tagebuch's ✦ riddle done): the toast and the float beside the ring (the world drawn first:
    // the float lives 1.6 s, the picture is taken without another frame)
    await draw(5200);
    const qs = await ev(() => {
      const g = VR.game, Q = VR.Quests, A = VR.Adventure, rec = A.rec, p = g.player.pos, x = Math.round(p[0]), y = Math.round(p[1]), z = Math.round(p[2]);
      const village = { x: x + 60, y, z: z - 40, name: 'Lindenau', plaza: [x + 58, y, z - 38] };
      const places = Q.places({ heart: true, vistas: [{ id: 'v3', x: x + 140, y, z: z + 40, lm: 'lighthouse', aim: [x + 360, y + 40, z + 120] }, { id: 'v7', x: x - 60, y, z: z - 190, lm: 'citadel', aim: [x - 480, y + 170, z + 320] }], wonders: [], villages: [{ id: '1_2', name: 'Lindenau', x: village.x, y, z: village.z }], vid: '1_2' });
      const base = { seed: 4242, vid: '1_2', day: g.env.day, age: 'adult', village, places };
      const made = [['1_2:3:0', 'fetch', 'farmer', 'Mira'], ['1_2:4:0', 'riddle', 'default', 'Ben'], ['1_2:5:0', 'photo', 'default', 'Ada']].map(([pid, k, role, name]) => Q.make(Object.assign({}, base, { pid, kinds: [k], role, name })));
      const acc = made.map(q => (q ? Q.accept(rec, q, Date.now()).ok : false));
      const r = Q.get(rec, '1_2:4:0'); if (r) r.st = 'ready';
      // (run 1: the toast (4.2 s) and the float beside the ring (1.6 s) were gone before the loaded machine's picture —
      // their timers wait 20 s longer for this one picture; the float is flushed now, not on the next frame)
      const st0 = window.setTimeout; window.setTimeout = (fn, ms, ...a) => st0(fn, (ms || 0) + 20000, ...a);
      let t0 = rec.me.taler, line = '';
      try { line = r ? Q.complete(null, null, r) : ''; if (A.flushFloat) A.flushFloat(); } finally { window.setTimeout = st0; }
      const toast = [...document.querySelectorAll('#toasts .toast')].map(t => t.innerText.replace(/\s+/g, ' ')).pop() || '';
      return { kinds: made.map(q => q && q.k), acc, line, toast, got: rec.me.taler - t0, open: Q.open(rec).length };
    });
    console.log('     ' + JSON.stringify(qs));
    N.quests = qs;
    check(qs.acc.every(Boolean) && qs.open === 2 && qs.got === 15 && /\+15 Heliataler/.test(qs.toast) && /\+15 Heliataler/.test(qs.line), 'three quests accepted, the riddle done: „' + qs.toast + '" (+15 Heliataler in the wallet)');
    await wait(120);
    await hold(500);
    const fl = await ev(() => { const f = document.querySelector('#advhud .fl'); return f ? { text: f.innerText.replace(/\s+/g, ' '), coin: (f.querySelector('svg.coin') || { getAttribute: () => null }).getAttribute('data-coin') } : null; });
    check(!!fl && fl.coin === 'helia' && /\+15/.test(fl.text), 'beside the ring: „' + (fl && fl.text) + '" with Helia\'s sun');
    pics.reward = await shot('names_reward');
    await release();
    // the pause card ⚔ Abenteuer
    await ev(() => VR.game.ui.pause()); await wait(250);
    await ev(() => document.querySelector('#pause [data-act="adventure"]').click()); await wait(300);
    const card = await ev(() => { const c = document.querySelector('#adventure .panel'), on = (a) => { const b = c.querySelector(`[data-act="${a}"].on`); return b ? b.dataset.v : null; }; return { way: on('adv:way'), cards: [...c.querySelectorAll('[data-act="adv:way"]')].map(b => b.dataset.v), band: on('adv:band'), enc: on('adv:enc'), tal: (c.querySelector('.advsum .tal') || {}).textContent, taler: VR.game.meta.adventure.me.taler, coin: !!c.querySelector('.advsum .tal svg[data-coin="helia"]'), label: (c.querySelector('.advways label') || {}).textContent, h: Math.round(c.getBoundingClientRect().height) }; });
    console.log('     ' + JSON.stringify(card));
    N.card = card;
    check(card.label === 'Wie willst du spielen?' && card.cards.join() === 'free,gentle,enc' && card.way === 'enc' && card.band === 'hard' && card.enc === 'normal' && card.tal === card.taler + ' Heliataler' && card.coin && card.h <= 700, 'the card asks the same question (⚔ lit, Schwer, Begegnungen normal) and shows „' + card.tal + '" with the sun (' + card.h + ' px)');
    pics.card = await shot('names_card');
    await readText('the card ⚔ Abenteuer');
    await ev(() => VR.game.ui.resume()); await wait(200);
    // the Tagebuch
    await ev(() => VR.Quests.journal()); await wait(300);
    const jr = await ev(() => { const s = document.getElementById('journal'); return { screen: VR.game.ui.screen, quests: s.querySelectorAll('.jq').length, coins: s.querySelectorAll('.chip svg[data-coin="helia"]').length, chips: [...s.querySelectorAll('.jq .chip')].map(c => c.innerText.trim()).slice(0, 6), done: (s.querySelector('.jdone') || {}).innerText || '' }; });
    console.log('     ' + JSON.stringify(jr));
    N.journal = jr;
    check(jr.screen === 'journal' && jr.quests === 2 && jr.coins === 2 && jr.chips.some(c => /\+15/.test(c)) && /Ben/.test(jr.done) && /Lindenau/.test(jr.done), 'the Tagebuch: two open quests, each reward chip with Helia\'s sun (' + jr.chips.join(' · ') + '), Ben\'s riddle under „Zuletzt erledigt" („' + jr.done.replace(/\s+/g, ' ') + '")');
    pics.journal = await shot('names_journal');
    await readText('the Tagebuch');
    await ev(() => VR.Quests.closeJournal()); await wait(200);
    // the Hangar: a buy
    await ev(() => { const me = VR.Adventure.rec.me; me.taler = 700; VR.Adventure.renderHud(true); VR.Shop.open('hangar', null, null); });
    await wait(300);
    const sh = await ev(() => { const p = document.querySelector('#shop .panel'), me = VR.Adventure.rec.me, t0 = me.taler, b = p.querySelector('[data-sact="buy"][data-key="up:engine"]'); if (b) b.click(); const q = document.querySelector('#shop .panel'); return { title: q.querySelector('h2').textContent, head: (q.querySelector('.shoptal') || {}).innerText, coin: !!q.querySelector('.shoptal svg[data-coin="helia"]'), paid: t0 - me.taler, msg: (q.querySelector('.shopmsg') || {}).textContent, prices: [...q.querySelectorAll('.shopitem')].map(r => r.innerText.replace(/\s+/g, ' ')).slice(0, 3) }; });
    console.log('     ' + JSON.stringify(sh));
    N.shop = sh;
    check(sh.coin && /Heliataler/.test(sh.head || '') && sh.paid > 0 && /gekauft für \d+ Heliataler/.test(sh.msg || ''), 'the Hangar: the wallet „' + (sh.head || '').replace(/\s+/g, ' ') + '" with the sun; a buy: „' + sh.msg + '"');
    pics.shop = await shot('names_shop');
    await readText('the Hangar');
    await ev(() => VR.Shop.close()); await wait(200);
    // the settings line of the cloud rays (Profi, Bild → objects)
    const set = await ev(() => { const ui = VR.game.ui; ui.pause(); ui.showSettings('img'); const root = document.getElementById('settings') || document.body; const el = [...root.querySelectorAll('*')].find(e => e.children.length === 0 && /Wolkenrochen/.test(e.textContent)); if (el) el.scrollIntoView({ block: 'center' }); return el ? { text: el.textContent, row: (el.closest('.srow, .row, .field, label, div') || el).innerText.replace(/\s+/g, ' ').slice(0, 160) } : null; });
    console.log('     ' + JSON.stringify(set));
    N.settings = set;
    check(!!set && /Wolkenrochen: große Rochen zwischen den Himmelsinseln/.test(set.text), 'the settings: „' + (set && set.text) + '"');
    await wait(250);
    pics.settings = await shot('names_settings');
    await readText('the settings (Bild)');
    await ev(() => { const ui = VR.game.ui; ui.resume(); });
    await wait(200);
  });

  // ---------------------------------------------------------------- 6 · English in the world
  await section('6', async () => {
    console.log('6 · English: the card, the Tagebuch, the Hangar');
    await ev(() => VR.I18N.set('en')); await wait(300);
    await ev(() => VR.game.ui.pause()); await wait(250);
    await ev(() => document.querySelector('#pause [data-act="adventure"]').click()); await wait(300);
    const card = await ev(() => { const c = document.querySelector('#adventure .panel'); return { label: (c.querySelector('.advways label') || {}).textContent, cards: [...c.querySelectorAll('[data-act="adv:way"]')].map(b => b.innerText.replace(/\s+/g, ' ')), tal: (c.querySelector('.advsum .tal') || {}).textContent }; });
    console.log('     ' + JSON.stringify(card));
    check(card.label === 'How do you want to play?' && /Heliataler$/.test(card.tal || '') && /Free building/.test(card.cards[0] || ''), 'the card in English: „' + card.label + '", „' + card.tal + '"');
    pics.cardEn = await shot('names_card_en');
    await readText('the card (English)');
    await ev(() => VR.game.ui.resume()); await wait(200);
    await ev(() => VR.Quests.journal()); await wait(300);
    const jr = await ev(() => { const s = document.getElementById('journal'); return { title: (s.querySelector('h2') || {}).textContent, coins: s.querySelectorAll('.chip svg[data-coin="helia"]').length }; });
    check(jr.coins === 2 && /Journal|Diary|Log/i.test(jr.title || ''), 'the Tagebuch in English: „' + jr.title + '", the sun on both chips');
    pics.journalEn = await shot('names_journal_en');
    await readText('the Tagebuch (English)');
    await ev(() => VR.Quests.closeJournal()); await wait(200);
    await ev(() => { const me = VR.Adventure.rec.me; me.taler = 2400; VR.Adventure.renderHud(true); VR.Shop.open('hangar', null, null); });
    await wait(300);
    const sh = await ev(() => { const p = document.querySelector('#shop .panel'), b = p.querySelector('[data-sact="buy"][data-key="up:engine"]'); if (b) b.click(); const q = document.querySelector('#shop .panel'); return { head: (q.querySelector('.shoptal') || {}).innerText, msg: (q.querySelector('.shopmsg') || {}).textContent }; });
    console.log('     ' + JSON.stringify(sh));
    check(/Heliataler/.test(sh.head || '') && /bought for [\d.,  ]+ Heliataler/.test(sh.msg || ''), 'the Hangar in English: „' + sh.msg + '"');   // (run 1: „1,500" — the thousands)
    pics.shopEn = await shot('names_shop_en');
    await readText('the Hangar (English)');
    await ev(() => VR.Shop.close()); await wait(200);
    await ev(() => VR.I18N.set('de')); await wait(300);
  });

  // ---------------------------------------------------------------- 7 · the retired words, the tables in the page
  await section('7', async () => {
    console.log('7 · the retired words');
    // what a player can read anywhere in the page — every text node (hidden screens too, no script or style) and the
    // attributes that are read out or shown (title, placeholder, aria-label, alt); the ids in other attributes are the
    // game's internal names and stay (run 1 found „skyray" there: an id, never shown — listed below, not a failure)
    const r = await ev((src) => {
      const re = new RegExp(src, 'i'), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      let txt = '', nodes = 0; while (tw.nextNode()) { txt += tw.currentNode.nodeValue + '\n'; nodes++; }
      for (const e of document.querySelectorAll('[title],[placeholder],[aria-label],[alt]')) for (const a of ['title', 'placeholder', 'aria-label', 'alt']) if (e.hasAttribute(a)) txt += e.getAttribute(a) + '\n';
      const mt = txt.match(re), ids = [];
      for (const e of document.querySelectorAll('*')) for (const a of e.attributes) if (!/^(title|placeholder|aria-label|alt)$/.test(a.name) && re.test(a.value) && ids.length < 6) ids.push(e.nodeName.toLowerCase() + '[' + a.name + '="' + a.value.slice(0, 60) + '"]');
      const vals = (d) => Object.values(d || {}).map(v => (Array.isArray(v) ? v.join(' ') : String(v))).join('\n'); const de = vals(VR.I18N.dict.de), en = vals(VR.I18N.dict.en);
      return { text: mt ? txt.slice(Math.max(0, mt.index - 60), mt.index + 60) : null, nodes, ids, de: (de.match(re) || [null])[0], en: (en.match(re) || [null])[0], deHelia: (de.match(/Heliataler/g) || []).length, enHelia: (en.match(/Heliataler/g) || []).length, deRays: (de.match(/Wolkenrochen/g) || []).length, enRays: (en.match(/[Cc]loud [Rr]ays?/g) || []).length };
    }, RETIRED.source);
    console.log('     ' + JSON.stringify(r));
    N.retired = r;
    check(!r.text && !r.de && !r.en, 'the page\'s text (' + r.nodes + ' text nodes, the shown attributes) and its two tables hold none of the retired words (Sterntaler, Sky Ray, Himmelsrochen)' + (r.text ? ' — „' + r.text + '"' : '') + (r.ids.length ? ' (internal ids in attributes, never shown: ' + r.ids.join(', ') + ')' : ''));
    check(r.deHelia >= 15 && r.enHelia >= 15 && r.deRays >= 4 && r.enRays >= 4, 'the new names in the built page: Heliataler ' + r.deHelia + ' (de) / ' + r.enHelia + ' (en) texts, Wolkenrochen ' + r.deRays + ' / Cloud ray(s) ' + r.enRays);
    check(seenText.length >= 8, 'the screens read for the words on them: ' + seenText.map(s => s[0]).join(' · '));
  });

  // ---------------------------------------------------------------- 8 · the cost: this build against the base
  // Two fresh pages made the same way — this build and the base (1feab8f) — so neither carries the other's history
  // (run 1 measured the long-used page with its open quests against a fresh base page: 2.38 → 3.36 ms on Very Low,
  // history, not code). The pictures' page is closed first (memory); the blocks alternate ABBA so a burst of the
  // shared machine falls on both sides.
  await section('8', async () => {
    console.log('8 · the game loop on Very Low and High: f-names against the base (1feab8f), two fresh pages');
    if (!fs.existsSync(BASE_FILE)) { console.log('     (no base build at ' + BASE_FILE + ' — git archive 1feab8f | tar -x -C .tmp_tests/base && node build.js there)'); check(false, 'the base build for the cost comparison'); return; }
    await page.close();
    const open = async (url, tag) => {
      const pg = await ctx.newPage();
      pg.on('pageerror', e => logs.push('[pageerror ' + tag + '] ' + (e.stack || e.message).slice(0, 600)));
      await pg.goto(url);
      for (let i = 0; i < 160; i++) { await pg.waitForTimeout(500); if (await pg.evaluate(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
      await pg.evaluate(async () => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); if (VR.Start && VR.Start.ready) await VR.Start.ready(g); VR.Adventure.pendingCreate = { at: Date.now(), band: 'hard', enc: 'normal' }; g.createWorld({ name: 'Kosten ' + Date.now(), mode: 'survival', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, keep: false, kit: true, first: true }); });
      for (let i = 0; i < 240; i++) { await pg.waitForTimeout(1000); if (await pg.evaluate(() => VR.game.state) === 'play') break; }
      const ok = await pg.evaluate(() => VR.game.state === 'play' && !!(VR.game.meta.adventure && VR.game.meta.adventure.on) && VR.game.meta.adventure.band === 'hard');
      return ok ? pg : null;
    };
    const pa = await open(DIST, 'f-names');
    const pb = pa ? await open('file://' + BASE_FILE, 'base') : null;
    check(!!pa && !!pb, 'two fresh pages, the same world in each (seed 4242, Überleben, an Abenteuer with band Schwer): this build and the base (' + secs() + ')');
    if (!pa || !pb) { for (const pg of [pa, pb]) if (pg) await pg.close(); return; }
    await manualInit(pa); await manualInit(pb);
    const posA = await pa.evaluate(() => { const p = VR.game.player; return [p.pos[0], p.pos[1], p.pos[2], p.yaw, p.pitch]; });
    const posB = await pb.evaluate(() => { const p = VR.game.player; return [p.pos[0], p.pos[1], p.pos[2]]; });
    N.spawn = { a: posA.slice(0, 3).map(v => +v.toFixed(1)), b: posB.map(v => +v.toFixed(1)), pictures: pos0 && pos0.slice(0, 3).map(v => +v.toFixed(1)) };
    console.log('     the spawns: ' + JSON.stringify(N.spawn));
    // the same spot, the same hour, the same view in both; the worlds settle (the arrival, the columns around)
    const put = (pg, p) => pg.evaluate((p) => { const g = VR.game, pl = g.player; pl.flying = true; pl.teleport(p[0], p[1], p[2]); pl.yaw = p[3]; pl.viewYaw = p[3]; pl.pitch = p[4]; g.env.setTime(5200); g.env.rain = 0; g.env.rainTarget = 0; if (g.ui.screen) g.ui.resume(); }, p);
    await put(pa, posA); await put(pb, posA);
    for (let i = 0; i < 14; i++) { await step(20, 33, pa); await step(20, 33, pb); await pa.waitForTimeout(250); }   // (the pictures' page is closed: its wait() is gone)
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    N.cost = {};
    for (const preset of ['potato', 'high']) {
      for (const pg of [pa, pb]) await pg.evaluate((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('renderDist'); }, preset);
      for (let i = 0; i < 4; i++) { await step(30, 33, pa); await step(30, 33, pb); }
      const as = [], bs = [];
      for (let r = 0; r < 6; r++) { if (r % 2) { as.push(await frames(200, pa)); bs.push(await frames(200, pb)); } else { bs.push(await frames(200, pb)); as.push(await frames(200, pa)); } }
      const a = Math.min(...as), b = Math.min(...bs);
      N.cost[preset] = { base: +b.toFixed(3), fnames: +a.toFixed(3), medBase: +med(bs).toFixed(3), medFnames: +med(as).toFixed(3), bases: bs.map(v => +v.toFixed(3)), fs: as.map(v => +v.toFixed(3)) };
      console.log('     ' + preset + ': ' + JSON.stringify(N.cost[preset]));
      check(a <= b * 1.1 + 0.1, (preset === 'potato' ? 'Very Low' : 'High') + ': the game loop ' + b.toFixed(3) + ' ms (base) → ' + a.toFixed(3) + ' ms (f-names), the best of six blocks of 200 frames each, alternating ABBA (medians ' + med(bs).toFixed(3) + ' → ' + med(as).toFixed(3) + '; CPU, drawing off)');
    }
    await pa.close(); await pb.close();
  });

  const errs = logs.filter(l => /pageerror/.test(l));
  check(errs.length === 0, 'no page error (' + errs.length + ')' + (errs.length ? '\n' + errs.slice(0, 4).join('\n') : ''));
  console.log('console messages: ' + logs.length + (logs.length ? '\n' + logs.slice(0, 10).join('\n') : ''));
} catch (e) {
  fails++; console.log('  ✗ the run stopped: ' + (e.stack || e.message).slice(0, 1200));
  try { await page.screenshot({ path: SHOTS + 'names_fail.png' }); } catch (e2) { /* */ }
} finally {
  fs.writeFileSync(SHOTS + 'names_numbers.json', JSON.stringify(N, null, 1));
  try {
    // (the sheet's labels: plain letters — sheet.py's font has no emoji, no umlauts and no „ quotes)
    const spec = { cols: [], w: 640, rows: [
      { label: 'de einfach', labels: ['1 - Einfach: Frei bauen (lit by default)', '1 - Einfach: Abenteuer, sanft', '1 - Einfach: Abenteuer mit Begegnungen'], imgs: [pics.cf_de_einfach_free || null, pics.cf_de_einfach_gentle || null, pics.cf_de_einfach_enc || null] },
      { label: 'de profi', labels: ['1 - Profi: Frei bauen, Zen (no difficulty row)', '1 - Profi: Abenteuer, sanft', '1 - Profi: mit Begegnungen (no Zen, band Normal)'], imgs: [pics.cf_de_profi_free || null, pics.cf_de_profi_gentle || null, pics.cf_de_profi_enc || null] },
      { label: 'en einfach', labels: ['3 - English, Einfach: Free building', '3 - English, Einfach: Gentle adventure', '3 - English, Einfach: Adventure with encounters'], imgs: [pics.cf_en_einfach_free || null, pics.cf_en_einfach_gentle || null, pics.cf_en_einfach_enc || null] },
      { label: 'en profi', labels: ['3 - English, Profi: Free building', '3 - English, Profi: Gentle adventure', '3 - English, Profi: with encounters'], imgs: [pics.cf_en_profi_free || null, pics.cf_en_profi_gentle || null, pics.cf_en_profi_enc || null] },
      { label: 'extra', labels: ['1 - Profi: Frei bauen + Ueberleben (Friedlich lit)', '1 - Kindersicher: two cards, sanft', '5 - the ring: level and Heliataler (crop)'], imgs: [pics.cf_de_free_surv || null, pics.cf_de_kids || null, pics.hud || null] },
      { label: 'heliataler 1', labels: ['5 - level 5: Geschenk 50 Heliataler', '5 - a quest done: +15 Heliataler', '5 - the card: the same question, 200 Heliataler'], imgs: [pics.levelup || null, pics.reward || null, pics.card || null] },
      { label: 'heliataler 2', labels: ['5 - the Tagebuch: the sun on the reward chips', '5 - the Hangar: a buy in Heliataler', '5 - settings: Wolkenrochen'], imgs: [pics.journal || null, pics.shop || null, pics.settings || null] },
      { label: 'english', labels: ['6 - English: the card', '6 - English: the journal', '6 - English: the Hangar'], imgs: [pics.cardEn || null, pics.journalEn || null, pics.shopEn || null] },
    ] };
    fs.writeFileSync(SHOTS + 'names_sheet.json', JSON.stringify(spec));
    execFileSync('python3', ['/root/r9coord/sheet.py', SHOTS + 'names_sheet.jpg', SHOTS + 'names_sheet.json'], { stdio: 'inherit' });
  } catch (e) { console.log('sheet: ' + e.message); }
  await browser.close();
  console.log('numbers ' + JSON.stringify(N).slice(0, 3000));
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
}

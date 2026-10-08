// ============================================================================
// Languages (v0.34): the game and the R9 Studio speak 13 languages. VR.I18N.t(key,
// vars, fallback) looks the key up in the chosen language, then in English, then
// uses the fallback text written at the call. The choice is stored per browser
// ('r9si.lang') and shared by the game and the Studio; the first visit follows
// the browser's language. Arabic turns the page right-to-left.
// ============================================================================
(function (VR) {
  'use strict';
  const LANGS = [
    ['de', 'Deutsch', 'de-DE'], ['en', 'English', 'en-GB'], ['fr', 'Français', 'fr-FR'], ['es', 'Español', 'es-ES'],
    ['it', 'Italiano', 'it-IT'], ['pt', 'Português', 'pt-PT'], ['nl', 'Nederlands', 'nl-NL'], ['pl', 'Polski', 'pl-PL'],
    ['tr', 'Türkçe', 'tr-TR'], ['ru', 'Русский', 'ru-RU'], ['ar', 'العربية', 'ar', 'rtl'], ['zh', '中文', 'zh-CN'], ['ja', '日本語', 'ja-JP'],
  ];
  const I = VR.I18N = VR.I18N || { dict: {} };
  I.langs = LANGS;
  I.dict = I.dict || {};
  I.listeners = I.listeners || [];
  I.add = function (lang, table) { Object.assign(I.dict[lang] || (I.dict[lang] = {}), table); };
  const fill = (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m)) : String(s));
  I.t = function (key, vars, fallback) {
    let s;
    const d = I.dict[I.lang]; if (d) s = d[key];
    if (s === undefined && I.lang !== 'en' && I.dict.en) s = I.dict.en[key];
    if (s === undefined) s = fallback !== undefined ? fallback : key;
    return fill(s, vars);
  };
  // the fallback text is German in the Studio, English in the game: English users must never see German
  I.tx = function (key, vars, de, en) { const d = I.dict[I.lang]; if (d && d[key] !== undefined) return fill(d[key], vars); if (I.lang === 'de') return fill(de !== undefined ? de : en, vars); const e = I.dict.en && I.dict.en[key]; return fill(e !== undefined ? e : (en !== undefined ? en : de), vars); };
  // a list of lines (villager talk, loading tips): the table holds an array — the English list when the chosen
  // language has none, an empty list when nobody has it
  I.list = function (key) { const d = I.dict[I.lang], v = d && d[key]; if (Array.isArray(v)) return v; const e = I.dict.en && I.dict.en[key]; return Array.isArray(e) ? e : []; };
  // a German word of the game's own data (a forge name, a Modern category): the German word is the source, its table
  // entry is the g.fgw.* key whose German text it is. The word in the language of the moment; a word without an entry
  // stays as it is. The index is made once, when the German table is there.
  let wordIdx = null;
  I.word = function (de) {
    if (typeof de !== 'string' || !de || I.lang === 'de') return de;
    if (!wordIdx) {
      const d = I.dict.de || {}; if (!Object.keys(d).length) return de;
      wordIdx = {}; for (const k of Object.keys(d)) if (k.indexOf('g.fgw.') === 0 && typeof d[k] === 'string') wordIdx[d[k]] = k;
    }
    return Object.prototype.hasOwnProperty.call(wordIdx, de) ? I.t(wordIdx[de]) : de;
  };
  // the languages with a table (the game: de and en); the others are "soon"
  I.ready = (code) => !!(I.dict[code] && Object.keys(I.dict[code]).length);
  // static texts in a page: data-t (text), data-th (HTML), data-tt (title) are filled from the tables — again on
  // every language change (the game calls it from a listener)
  I.retext = function (root) {
    if (typeof document === 'undefined') return;
    root = root || document;
    for (const e of root.querySelectorAll('[data-t]')) e.textContent = I.t(e.dataset.t);
    for (const e of root.querySelectorAll('[data-th]')) e.innerHTML = I.t(e.dataset.th);
    for (const e of root.querySelectorAll('[data-tt]')) e.title = I.t(e.dataset.tt);
  };
  I.info = (code) => LANGS.find(l => l[0] === code) || LANGS[1];
  I.locale = () => I.info(I.lang)[2];
  I.rtl = () => I.info(I.lang)[3] === 'rtl';
  function detect() {
    try { const s = localStorage.getItem('r9si.lang'); if (s && LANGS.some(l => l[0] === s)) return s; } catch (e) { /* storage blocked */ }
    const nav = (typeof navigator !== 'undefined' && (navigator.languages && navigator.languages[0] || navigator.language)) || 'en';
    const c = String(nav).slice(0, 2).toLowerCase();
    return LANGS.some(l => l[0] === c) ? c : 'en';
  }
  I.apply = function () {
    if (typeof document === 'undefined') return;
    const de = document.documentElement; de.lang = I.lang; de.dir = I.rtl() ? 'rtl' : 'ltr';
  };
  I.set = function (code) {
    if (!LANGS.some(l => l[0] === code)) return;
    I.lang = code;
    try { localStorage.setItem('r9si.lang', code); } catch (e) { /* */ }
    I.apply();
    for (const f of I.listeners.slice()) { try { f(code); } catch (e) { console.warn('lang listener', e); } }
  };
  I.on = function (f) { I.listeners.push(f); };
  if (!I.lang) I.lang = detect();
  // another tab (the Studio next to the game) changed the language
  if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === 'r9si.lang' && e.newValue && e.newValue !== I.lang) I.set(e.newValue); });
  I.apply();
  // a small language picker: a globe button with the code, a list of native names (opts.ready: only the languages
  // with a table — the others would read English anyway). Keyboard: Enter opens, the arrows walk, Esc closes.
  I.picker = function (opts) {
    opts = opts || {};
    const wrap = document.createElement('div'); wrap.className = 'langpick' + (opts.cls ? ' ' + opts.cls : '');
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'lp-btn'; btn.title = 'Language · Sprache · Langue · Idioma · 语言';
    btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    const list = document.createElement('div'); list.className = 'lp-list'; list.setAttribute('role', 'group'); list.setAttribute('aria-label', btn.title);
    const langs = () => { const r = opts.ready ? LANGS.filter(l => I.ready(l[0])) : LANGS; return r.length ? r : LANGS; };
    const open = (on) => { wrap.classList.toggle('open', on); btn.setAttribute('aria-expanded', String(on)); };
    const draw = () => {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg><b>' + I.lang.toUpperCase() + '</b>';
      btn.setAttribute('aria-label', btn.title + ': ' + I.info(I.lang)[1]);
      list.innerHTML = '';
      for (const [code, name] of langs()) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'lp-item' + (code === I.lang ? ' on' : ''); b.lang = code;
        b.setAttribute('aria-pressed', String(code === I.lang));
        b.innerHTML = '<i aria-hidden="true">' + code.toUpperCase() + '</i><span></span>'; b.lastChild.textContent = name;
        b.onclick = (e) => { e.stopPropagation(); open(false); I.set(code); try { btn.focus({ preventScroll: true }); } catch (er) { /* */ } };
        list.appendChild(b);
      }
    };
    btn.onclick = (e) => { e.stopPropagation(); const on = !wrap.classList.contains('open'); open(on); if (on && e.detail === 0) { const c = list.querySelector('.on') || list.firstChild; if (c) c.focus({ preventScroll: true }); } };
    wrap.addEventListener('keydown', (e) => {
      if (!wrap.classList.contains('open')) return;
      const items = [...list.querySelectorAll('.lp-item')], k = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); open(false); btn.focus({ preventScroll: true }); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); const n = items[(k + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length] || items[0]; if (n) n.focus({ preventScroll: true }); }
    });
    wrap.addEventListener('focusout', (e) => { if (e.relatedTarget && !wrap.contains(e.relatedTarget)) open(false); });   // (Tab moved on; a click elsewhere closes it below)
    document.addEventListener('click', () => open(false));
    wrap.appendChild(btn); wrap.appendChild(list); draw();
    I.on(draw);
    return wrap;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

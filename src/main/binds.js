// ============================================================================
// 🎮 Key bindings (F5 · Steuerung): every game key is an action with two slots
// (primary and alternative). The game code keeps asking for its default key
// names (input.down('KeyW'), input.hit('Digit3'), …); input.js translates a name
// into the physical keys of the action that owns it (codesFor). So a rebind
// reaches every call site without touching them, and a name the game does not
// bind (Escape, Enter, Tab) keeps its meaning.
//   'r9si.controls' = { v: 1, map: { fwd: ['KeyI', ''], … } }   (only changed actions)
// VR.Binds.ACTIONS · byId(id) · byName(name) · reserved(code) · valid(code)
// label(code, 'de'|'en') · Bindings: slots(id) · codesFor(name) · set(id, slot, code,
// {swap}) → { ok, reason?, conflicts[], swapped? } · clear · reset · resetAll ·
// isDefault · conflicts() · conflictsOf(id) · toJSON() · Bindings.fromJSON(o)
// VR.Binds.current (the player's bindings) · read() · write(b)
// No DOM here: the model is tested in node (test/binds_model.js).
// ============================================================================
(function (VR) {
  'use strict';
  const V = 1, KEY = 'r9si.controls';
  // keys the browser or the menus need: never bound (Esc closes menus, Enter sends chat, Tab moves focus, the
  // Win and Alt keys open the system and the browser's menus)
  const RESERVED = ['Escape', 'Enter', 'NumpadEnter', 'Tab', 'F12', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ContextMenu', 'PrintScreen'];
  // group: move (walking, flying) · act (things the player does) · hotbar · view (F-keys)
  const ACTIONS = [
    { id: 'fwd', group: 'move', names: ['KeyW'], def: ['KeyW', ''] },
    { id: 'back', group: 'move', names: ['KeyS'], def: ['KeyS', ''] },
    { id: 'left', group: 'move', names: ['KeyA'], def: ['KeyA', ''] },
    { id: 'right', group: 'move', names: ['KeyD'], def: ['KeyD', ''] },
    { id: 'jump', group: 'move', names: ['Space'], def: ['Space', ''] },
    { id: 'sneak', group: 'move', names: ['ShiftLeft', 'ShiftRight'], def: ['ShiftLeft', 'ShiftRight'] },
    { id: 'sprint', group: 'move', names: ['ControlLeft', 'ControlRight'], def: ['ControlLeft', 'ControlRight'] },
    { id: 'turnL', group: 'move', names: ['ArrowLeft'], def: ['ArrowLeft', ''] },
    { id: 'turnR', group: 'move', names: ['ArrowRight'], def: ['ArrowRight', ''] },
    { id: 'inv', group: 'act', names: ['KeyE'], def: ['KeyE', ''] },
    { id: 'drop', group: 'act', names: ['KeyQ'], def: ['KeyQ', ''] },
    { id: 'map', group: 'act', names: ['KeyM'], def: ['KeyM', ''] },
    { id: 'wp', group: 'act', names: ['KeyN'], def: ['KeyN', ''] },
    { id: 'chat', group: 'act', names: ['KeyT'], def: ['KeyT', ''] },
    { id: 'cmd', group: 'act', names: ['Slash'], def: ['Slash', ''] },
    { id: 'photo', group: 'act', names: ['KeyP'], def: ['KeyP', ''] },
    { id: 'zoom', group: 'act', names: ['KeyC'], def: ['KeyC', ''] },
    { id: 'veh', group: 'act', names: ['KeyV'], def: ['KeyV', ''] },
    { id: 'auto', group: 'act', names: ['KeyG'], def: ['KeyG', ''] },
    { id: 'fill', group: 'act', names: ['KeyF'], def: ['KeyF', ''] },
    { id: 'hollow', group: 'act', names: ['KeyH'], def: ['KeyH', ''] },
    { id: 'clear', group: 'act', names: ['KeyX'], def: ['KeyX', ''] },
    { id: 'rot', group: 'act', names: ['KeyR'], def: ['KeyR', ''] },
    { id: 'undo', group: 'act', names: ['KeyZ'], def: ['KeyZ', ''] },
    { id: 'hud', group: 'view', names: ['F1'], def: ['F1', ''] },
    { id: 'shot', group: 'view', names: ['F2'], def: ['F2', ''] },
    { id: 'debug', group: 'view', names: ['F3'], def: ['F3', ''] },
    { id: 'cam', group: 'view', names: ['F5'], def: ['F5', ''] },
  ];
  for (let i = 1; i <= 9; i++) ACTIONS.push({ id: 'slot' + i, group: 'hotbar', names: ['Digit' + i], def: ['Digit' + i, ''] });
  const BY_ID = {}, BY_NAME = {};
  for (const a of ACTIONS) { BY_ID[a.id] = a; for (const n of a.names) BY_NAME[n] = a; }
  const CODE_RE = /^[A-Za-z0-9]{1,16}$/;
  const valid = (c) => typeof c === 'string' && CODE_RE.test(c);
  const reserved = (c) => RESERVED.indexOf(c) >= 0;
  const LABEL = {
    de: { Space: 'Leertaste', ShiftLeft: 'Umschalt links', ShiftRight: 'Umschalt rechts', ControlLeft: 'Strg links', ControlRight: 'Strg rechts', AltLeft: 'Alt links', AltRight: 'Alt rechts', Escape: 'Esc', Backspace: 'Rücktaste', Backquote: '`', Slash: '/', Minus: '-', Equal: '=', Comma: ',', Period: '.', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' },
    en: { Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt', Escape: 'Esc', Backspace: 'Backspace', Backquote: '`', Slash: '/', Minus: '-', Equal: '=', Comma: ',', Period: '.', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' },
  };
  function label(code, lang) {
    if (!code || typeof code !== 'string') return '—';
    const t = LABEL[lang === 'en' ? 'en' : 'de'];
    if (t[code]) return t[code];
    let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
    m = /^Digit(\d)$/.exec(code); if (m) return m[1];
    m = /^Numpad(\d)$/.exec(code); if (m) return 'Num ' + m[1];
    return code;
  }
  const other = (id) => ACTIONS.filter(a => a.id !== id);
  class Bindings {
    constructor() { this.m = {}; for (const a of ACTIONS) this.m[a.id] = a.def.slice(); }
    slots(id) { return BY_ID[id] && this.m[id] ? this.m[id].slice() : null; }
    isDefault(id) { const a = BY_ID[id]; return !!a && this.m[id][0] === a.def[0] && this.m[id][1] === a.def[1]; }
    // the physical codes of the action that owns a game key name; null when no action owns the name
    codesFor(name) { const a = BY_NAME[name]; return a ? this.m[a.id].filter(c => !!c) : null; }
    owners(code, exceptId) { return ACTIONS.filter(a => a.id !== exceptId && this.m[a.id].indexOf(code) >= 0); }
    set(id, slot, code, opts) {
      if (!BY_ID[id]) return { ok: false, reason: 'unknown' };
      if (slot !== 0 && slot !== 1) return { ok: false, reason: 'slot' };
      if (code !== '' && !valid(code)) return { ok: false, reason: 'invalid' };
      if (code && reserved(code)) return { ok: false, reason: 'reserved' };
      const prev = this.m[id][slot];
      let swapped = null;
      if (code && opts && opts.swap) {
        const o = this.owners(code, id)[0];
        if (o) { for (let s = 0; s < 2; s++) if (this.m[o.id][s] === code) { this.m[o.id][s] = prev; break; } swapped = o.id; }
      }
      this.m[id][slot] = code;
      const conflicts = code ? this.conflictsOf(id) : [];
      return { ok: true, conflicts, swapped };
    }
    clear(id, slot) { return this.set(id, slot, ''); }
    swap(id, slot, code) { return this.set(id, slot, code, { swap: true }); }
    reset(id) { const a = BY_ID[id]; if (a) this.m[id] = a.def.slice(); return !!a; }
    resetAll() { for (const a of ACTIONS) this.m[a.id] = a.def.slice(); }
    // actions that share a physical key with this one (the key is then pressed for both)
    conflictsOf(id) {
      const mine = this.m[id].filter(c => !!c);
      return other(id).filter(a => this.m[a.id].some(c => !!c && mine.indexOf(c) >= 0)).map(a => a.id);
    }
    conflicts() {
      const by = {};
      for (const a of ACTIONS) for (const c of this.m[a.id]) {
        if (!c) continue;
        const list = by[c] || (by[c] = []);
        if (list.indexOf(a.id) < 0) list.push(a.id);
      }
      return Object.keys(by).filter(c => by[c].length > 1).map(c => ({ code: c, actions: by[c].slice() }));
    }
    toJSON() {
      const map = {};
      for (const a of ACTIONS) if (!this.isDefault(a.id)) map[a.id] = this.m[a.id].slice();
      return { v: V, map };
    }
    equals(o) { return !!o && JSON.stringify(this.toJSON()) === JSON.stringify(o.toJSON()); }
    static fromJSON(o) {
      const b = new Bindings();
      if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== V || !o.map || typeof o.map !== 'object' || Array.isArray(o.map)) return b;
      for (const id of Object.keys(o.map)) {
        const a = BY_ID[id], arr = o.map[id];
        if (!a || !Array.isArray(arr)) continue;
        for (let s = 0; s < 2; s++) {
          const c = arr[s];
          // an empty slot is a deliberate clear; anything else must be a key the game may use, or the default stays
          if (c === '') b.m[id][s] = '';
          else if (valid(c) && !reserved(c)) b.m[id][s] = c;
          else b.m[id][s] = a.def[s];
        }
      }
      return b;
    }
  }
  function read() {
    try { const raw = localStorage.getItem(KEY); return raw ? Bindings.fromJSON(JSON.parse(raw)) : new Bindings(); } catch (e) { return new Bindings(); }
  }
  function write(b) {
    try { localStorage.setItem(KEY, JSON.stringify(b.toJSON())); return true; } catch (e) { return false; }
  }
  const B = VR.Binds = {
    V, KEY, ACTIONS, RESERVED,
    byId: (id) => BY_ID[id] || null,
    byName: (name) => (BY_NAME[name] ? BY_NAME[name].id : null),
    reserved, valid, label, Bindings, read, write,
  };
  B.current = read();
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

// ============================================================================
// f-album · 📒 Fotoalbum — every photo of the Fotomodus is kept in this browser (an IndexedDB of its own, 'r9si-album':
// a JPEG at most 1600 px wide and a 320-px thumbnail), the last ALBUM_MAX of them; the pause menu opens the album: a grid
// of the pictures (newest first, the world's name and the day), a click shows one large with Herunterladen and Löschen.
// Nothing leaves the browser. Without IndexedDB (a private window) the album lives for the session only.
// Pure parts (test/album.js): trim, label.
// ============================================================================
(function (VR) {
  'use strict';
  const AL = VR.Album = VR.Album || {};
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  AL.MAX = 48; AL.FULL_W = 1600; AL.THUMB_W = 320;
  // the records to drop so that at most max stay: the oldest (records { id, when })
  AL.trim = (recs, max) => recs.slice().sort((a, b) => b.when - a.when).slice(max).map((r) => r.id);
  // 'Weltname · 17.11. 14:05'
  AL.label = (r, lang) => { const d = new Date(r.when), p = (n) => String(n).padStart(2, '0'); return (r.world || '') + ' · ' + (lang === 'en' ? p(d.getDate()) + '/' + p(d.getMonth() + 1) : p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.') + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };

  // ---------------------------------------------------------------- the store
  let dbP = null; const mem = [];
  function db() {
    if (dbP) return dbP;
    dbP = new Promise((res) => {
      let rq = null; try { rq = indexedDB.open('r9si-album', 1); } catch (e) { res(null); return; }
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore('photos', { keyPath: 'id' }); } catch (e) { /* */ } };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
    });
    return dbP;
  }
  const tr = (d, mode) => d.transaction('photos', mode).objectStore('photos');
  const done = (rq) => new Promise((res) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); });
  AL.list = async function () {
    const d = await db(); if (!d) return mem.slice().sort((a, b) => b.when - a.when);
    try { const all = (await done(tr(d, 'readonly').getAll())) || []; return all.sort((a, b) => b.when - a.when); } catch (e) { return []; }
  };
  AL.del = async function (id) {
    const d = await db(); if (!d) { const i = mem.findIndex((r) => r.id === id); if (i >= 0) mem.splice(i, 1); return; }
    try { await done(tr(d, 'readwrite').delete(id)); } catch (e) { /* */ }
  };
  const toBlob = (c, q) => new Promise((res) => { try { c.toBlob((b) => res(b), 'image/jpeg', q); } catch (e) { res(null); } });
  function scaled(src, w) { const k = Math.min(1, w / src.width), c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c; }
  // a picture in: a canvas (any size) and the world's name
  AL.add = async function (canvas, world, caption) {
    if (!canvas || typeof document === 'undefined') return null;
    const full = await toBlob(scaled(canvas, AL.FULL_W), 0.9), thumb = await toBlob(scaled(canvas, AL.THUMB_W), 0.8);
    if (!full || !thumb) return null;
    const rec = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), when: Date.now(), world: String(world || ''), caption: caption ? String(caption).slice(0, 80) : '', w: canvas.width, h: canvas.height, full, thumb };
    const d = await db();
    if (!d) { mem.push(rec); for (const id of AL.trim(mem, AL.MAX)) { const i = mem.findIndex((r) => r.id === id); if (i >= 0) mem.splice(i, 1); } return rec; }
    try { await done(tr(d, 'readwrite').put(rec)); const all = await AL.list(); for (const id of AL.trim(all, AL.MAX)) await AL.del(id); } catch (e) { mem.push(rec); }
    return rec;
  };

  // ---------------------------------------------------------------- every Fotomodus picture into the album
  const PM = VR.PhotoMode;
  if (PM && PM.Photo) {
    const sv = PM.Photo.prototype.save;
    PM.Photo.prototype.save = function (img) {
      const r = sv.apply(this, arguments);
      try {
        if (img && img.w && typeof document !== 'undefined') {
          const c = document.createElement('canvas'); c.width = img.w; c.height = img.h;
          const ctx = c.getContext('2d'), id = ctx.createImageData(img.w, img.h), row = img.w * 4;
          for (let y = 0; y < img.h; y++) id.data.set(img.data.subarray((img.h - 1 - y) * row, (img.h - y) * row), y * row);
          ctx.putImageData(id, 0, 0);
          AL.add(c, this.g && this.g.meta && this.g.meta.name);
        }
      } catch (e) { /* the album is a convenience */ }
      return r;
    };
  }

  // ---------------------------------------------------------------- Momente: the album takes a picture by itself
  // When something happens worth remembering — a companion tamed, a Wanderbuch moment found, a new place reached — the
  // next frame is kept (no flash, the screen's own size, the HUD hidden for that frame), with a line saying what it was.
  // At most one a minute; switch ⚙ Spiel „Momente festhalten" (moments, on).
  AL.GAP = 60;
  AL.last = -1e9;
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'moments', g: 'game', sec: 'misc', t: 'switch', lab: 'g.set.moments', tip: 'g.set.moments.tip', def: true });
  AL.due = (now, last, gap) => now - last >= gap;
  AL.moment = function (g, caption) {
    if (!g || !g.renderer || g.state !== 'play' || (g.settings && g.settings.moments === false)) return false;
    const now = performance.now() / 1000;
    if (!AL.due(now, AL.last, AL.GAP) || g.renderer.capNext || (g.photoCam && g.photoCam.on)) return false;
    AL.last = now;
    const hud0 = g.hideHud;
    // a moment later (the toast and the hearts in the picture's place), one frame at the screen's size
    setTimeout(() => {
      if (!g.renderer || g.renderer.capNext) return;
      g.renderer.capNext = { k: 1, cb: (img) => {
        if (!img) return;
        try {
          const c = document.createElement('canvas'); c.width = img.w; c.height = img.h;
          const ctx = c.getContext('2d'), id = ctx.createImageData(img.w, img.h), row = img.w * 4;
          for (let y = 0; y < img.h; y++) id.data.set(img.data.subarray((img.h - 1 - y) * row, (img.h - y) * row), y * row);
          ctx.putImageData(id, 0, 0);
          AL.add(c, g.meta && g.meta.name, caption);
        } catch (e) { /* the album is a convenience */ }
      } };
      void hud0;
    }, 700);
    return true;
  };
  // the moments: a companion tamed, a Wanderbuch moment found, a place reached
  if (VR.Companions && VR.Companions.prototype && VR.Companions.prototype.tame) {
    const t0 = VR.Companions.prototype.tame;
    VR.Companions.prototype.tame = function (m, p) { const had = !!m.pet; const r = t0.apply(this, arguments); if (!had && m.pet) AL.moment(this.g, '🐾 ' + m.pet.name); return r; };
  }
  if (VR.Wander && VR.Wander.Actor && VR.Wander.Actor.prototype && VR.Wander.Actor.prototype.found) {
    const f0 = VR.Wander.Actor.prototype.found;
    VR.Wander.Actor.prototype.found = function (m, sub) { const first = !m.found; const r = f0.apply(this, arguments); if (first && VR.Wander.KINDS[m.kind]) AL.moment(this.g, VR.Wander.KINDS[m.kind].ico + ' ' + tx('g.wd.k.' + m.kind)); return r; };
  }
  // ---------------------------------------------------------------- the album screen (the pause menu's 📒)
  let urls = [];
  const free = () => { for (const u of urls) { try { URL.revokeObjectURL(u); } catch (e) { /* */ } } urls = []; };
  const url = (b) => { const u = URL.createObjectURL(b); urls.push(u); return u; };
  AL.mount = function (ui) {
    if (!ui || !ui.root || document.getElementById('album')) return;
    const pb = ui.root.querySelector('#pause [data-act="photo"]');
    if (pb) { const b = document.createElement('button'); b.className = 'btn'; b.id = 'albumBtn'; b.textContent = tx('g.album.btn'); b.addEventListener('click', () => AL.open(ui)); pb.insertAdjacentElement('afterend', b); }
    const el = document.createElement('div'); el.id = 'album'; el.className = 'screen';
    el.innerHTML = '<div class="panel box col gap" style="min-width:min(760px,94vw);max-height:88vh"><h2 id="albumTitle"></h2>' +
      '<div id="albumGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;overflow:auto;max-height:62vh"></div>' +
      '<div class="note" id="albumNote"></div><button class="btn small" id="albumBack"></button></div>' +
      '<div id="albumView" style="display:none;position:absolute;inset:0;background:rgba(8,10,16,.92);z-index:5;flex-direction:column;align-items:center;justify-content:center;gap:10px">' +
      '<img id="albumBig" style="max-width:90vw;max-height:72vh;border-radius:8px;box-shadow:0 8px 40px #000">' +
      '<div class="note" id="albumCap"></div><div class="row gap"><a class="btn" id="albumDl"></a><button class="btn" id="albumDel"></button><button class="btn small" id="albumClose"></button></div></div>';
    ui.root.appendChild(el);
    el.querySelector('#albumBack').addEventListener('click', () => { free(); ui.show('pause'); });
    el.querySelector('#albumClose').addEventListener('click', () => { el.querySelector('#albumView').style.display = 'none'; });
  };
  AL.open = async function (ui) {
    const el = document.getElementById('album'); if (!el) return;
    free();
    el.querySelector('#albumTitle').textContent = tx('g.album.title');
    el.querySelector('#albumBack').textContent = tx('g.album.back');
    el.querySelector('#albumClose').textContent = tx('g.album.close');
    el.querySelector('#albumDl').textContent = '⬇ ' + tx('g.album.dl');
    el.querySelector('#albumDel').textContent = tx('g.album.del');
    ui.show('album');
    const grid = el.querySelector('#albumGrid'); grid.innerHTML = '';
    const recs = await AL.list(), lang = VR.I18N && VR.I18N.lang;
    el.querySelector('#albumNote').textContent = recs.length ? tx('g.album.count', { n: recs.length }) : tx('g.album.empty');
    for (const r of recs) {
      const f = document.createElement('figure'); f.style.cssText = 'margin:0;cursor:pointer;background:#0d1018;border-radius:6px;overflow:hidden';
      const im = document.createElement('img'); im.src = url(r.thumb); im.style.cssText = 'width:100%;display:block;aspect-ratio:16/9;object-fit:cover';
      const cap = document.createElement('figcaption'); cap.textContent = (r.caption ? r.caption + ' · ' : '') + AL.label(r, lang); cap.style.cssText = 'font-size:11px;opacity:.8;padding:3px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      f.appendChild(im); f.appendChild(cap); grid.appendChild(f);
      f.addEventListener('click', () => {
        const v = el.querySelector('#albumView'), big = url(r.full), name = (PM && PM.fileName ? PM.fileName(r.world, 1).replace(/-1\.png$/, '') : 'R9-SI') + '-' + r.id + '.jpg';
        el.querySelector('#albumBig').src = big; el.querySelector('#albumCap').textContent = (r.caption ? r.caption + ' · ' : '') + AL.label(r, lang) + ' · ' + r.w + ' × ' + r.h;
        const a = el.querySelector('#albumDl'); a.href = big; a.download = name;
        el.querySelector('#albumDel').onclick = async () => { await AL.del(r.id); v.style.display = 'none'; AL.open(ui); };
        v.style.display = 'flex';
      });
    }
  };
  // the screen comes with the UI
  if (VR.UI && VR.UI.prototype) {
    const UP = VR.UI.prototype, sh = UP.show;
    UP.show = function (id) { if (!document.getElementById('album')) AL.mount(this); return sh.apply(this, arguments); };
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

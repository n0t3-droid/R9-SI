// ============================================================================
// ✨ the wizard in the game (W2): VR.Wizard's host for this page — over the open
// world (the Bauhand's „✨ Neu…", ✏️ on a ✨ thing) and on the start screen (the
// ✨ Erschaffen tile). The Genie and the Baukasten are compiled the first time
// (VR.GenieLazy: the Studio's own modules, bundled with the game); Forge pieces
// and the catalogue's villas come from the game's worker; pictures are
// VR.IsoPic's (furniture: the game's icons).
// Wohin?  🧍 Vor mir — the Bauhand holds it (from the start screen: r9si.hand,
//            and ▶ opens the world with it in hand)
//         📍 An meinem Platz — a plan six blocks in front of the spawn point, its
//            floor found on the ground; you land in front of it (a world open:
//            you are taken there; from the start screen: ▶ lands you there)
//         🗺 Auf der Karte — the R9 Studio's Karte with it in hand
//         🔁 An seiner Stelle — ✏️ on a ✨ thing: the old one goes, the new one comes
// ============================================================================
(function (VR) {
  'use strict';
  const Wz = VR.Wizard; if (!Wz) return;
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const game = () => VR.game;
  const inPlay = () => { const g = game(); return !!(g && g.state === 'play' && g.player && g.meta); };
  const ownWorld = () => { const g = game(); return !!(g && g.meta && !g.meta.guest); };
  let texCol = null, texAvg = null;
  const host = Wz.host = {
    name: 'game',
    root: () => document.getElementById('ui'),
    // the Genie and the Baukasten: compiled once, on the first ✨
    ready() { try { if (VR.GenieLazy) VR.GenieLazy(); } catch (e) { console.warn('Genie', e); } return Promise.resolve(true); },
    colors() { const g = game(); if (!g || !g.tex || !g.tex.avgColor) return null; if (!texCol || texAvg !== g.tex.avgColor) { texAvg = g.tex.avgColor; texCol = VR.IsoPic.texColors(texAvg); } return texCol; },
    forge(dna) { const g = game(); if (!g || !g.pool) return Promise.resolve(null); return new Promise((res) => g.pool.direct(0, { type: 'forge', dna }, null, (m) => res(m && m.type === 'forge' && m.ops ? { ops: m.ops } : null))); },
    house(i) { const g = game(); if (!g || !g.pool) return Promise.resolve(null); return new Promise((res) => g.pool.direct(0, { type: 'blueprint', index: i, seed: 7 }, null, (m) => res(m && m.type === 'blueprint' && m.ops ? { ops: m.ops } : null))); },
    model(name, w, h) { const g = game(); if (!g || !g.icons) return null; const c = document.createElement('canvas'), s = Math.min(w, h); c.width = s; c.height = s; try { g.icons.paint(c, name, s); } catch (e) { return null; } return c; },
    // what Wohin? offers here
    wheres(ctx) {
      const g = game();
      if (inPlay()) {
        if (!ownWorld()) return ['keep'];
        const w = (g.player && g.player.creative) ? ['hand', 'spot', 'map'] : ['spot', 'map'];
        if (ctx && ctx.edit && ctx.plan) w.unshift('here');
        return w;
      }
      return ['hand', 'spot', 'map'];
    },
    place(where, ding, thing, ctx) {
      const g = game(); if (!g) return false;
      const name = (ctx && ctx.name) || (VR.Ding ? VR.Ding.name(ding) : ding);
      if (where === 'keep') { toast(tx('wiz.keptToast', { n: name }, '✓ {n} wartet in 🎒 Meins', '✓ {n} waits in 🎒 Mine')); return true; }
      if (where === 'map') { openKarte(ding); return true; }
      if (where === 'here' && ctx && ctx.plan) return replaceHere(ding, name, ctx.plan);
      if (inPlay()) {
        if (where === 'hand') { if (VR.Bauhand && VR.Bauhand.hold(ding, { name, from: 'wizard' })) return true; return false; }
        if (where === 'spot') return spotHere(g, ding, name);
        return false;
      }
      // from the start screen: the world opens with it
      if (where === 'hand') { setHand({ ding, name }); if (VR.Start && VR.Start.play) VR.Start.play(); return true; }
      if (where === 'spot') { spotFromTitle(ding, name); return true; }
      return false;
    },
    studio(kind) { const h = kind === 'site' ? '#erschaffen/site' : '#erschaffen/photo'; const g = game(); if (inPlay()) { if (!g.openStudio(h)) g.ui.hint(tx('bh.noStudio', null, 'Das geht nur in deiner eigenen Welt', 'That works in your own world only'), 2400); return; } try { location.href = 'studio.html' + (location.search || '') + h; } catch (e) { /* */ } },
    full() { toast(tx('bh.toast.full', null, '⚠ Gebaut, aber nicht gemerkt — Browser-Speicher voll', '⚠ Built, but not kept — browser storage full'), true); },
    // over the world: the mouse is free while the wizard is open, the world keeps running behind it
    onOpen() { const g = game(); if (g && g.input) { g.input.releaseLock(); g.input.captured = false; } },
    onClose(why) { const g = game(); if (g && g.state === 'play' && !g.ui.screen && !g.studioOpen) { const holding = VR.Bauhand && VR.Bauhand.state === 'holding'; g.input.captured = true; if (holding || why !== 'studio') g.input.requestLock(); } },
  };
  const toast = (t, warn) => { const g = game(); if (VR.Bauhand && VR.Bauhand.toast && inPlay()) VR.Bauhand.toast(t, warn); else if (g && g.ui) { if (g.state === 'title' && g.ui.titleNote) g.ui.titleNote(t); else if (g.ui.hint) g.ui.hint(t, 3000); } };
  function setHand(o) { try { localStorage.setItem('r9si.hand', JSON.stringify(Object.assign({ v: 1, world: null, t: Date.now(), from: 'wizard' }, o))); return true; } catch (e) { return false; } }
  // 🗺: the Studio's Karte with it in hand (over the game, or the Studio's page from the start screen)
  function openKarte(ding) {
    const g = game(), h = '#karte/' + encodeURIComponent(ding);
    if (inPlay()) { if (!g.openStudio(h)) g.ui.hint(tx('bh.noStudio', null, 'Das geht nur in deiner eigenen Welt', 'That works in your own world only'), 2400); return; }
    try { location.href = 'studio.html' + (location.search || '') + h; } catch (e) { /* no Studio next to this page */ }
  }
  // 📍 a world open: the plan at the spawn point, built as soon as its ground is there; you stand in front of it
  function spotHere(g, ding, name) {
    const p = g.player, sp = Array.isArray(p.spawn) && p.spawn.every(Number.isFinite) ? p.spawn : g.worldSpawn();
    const S = Wz.spotPlan(ding, sp, p.yaw, { name }); if (!S) return false;
    const blue = g.gadgets && g.gadgets.blue; if (!blue) return false;
    if (!blue.plans) blue.loadPlans();
    blue.plans.push(S.plan);
    const kept = blue.storePlans((ps) => ps.concat([S.plan]));
    if (VR.Landing) VR.Landing.note(g.meta.id, S.landing);
    g.meta.seenLanding = Date.now();   // (shown now: not again on the next ▶)
    blue.planT = 0; blue.tryBuild(S.plan);
    p.flying = false;
    p.safeTeleport(S.landing.pos[0], S.landing.pos[1], S.landing.pos[2], { keep: true, yaw: S.landing.yaw, pitch: S.landing.pitch });
    g.revealPending = { box: S.landing.box, label: name };
    toast(kept ? tx('wiz.spotToast', { n: name }, '✨ {n} entsteht an deinem Platz', '✨ {n} appears at your spot') : tx('bh.toast.full', null, '⚠ Gebaut, aber nicht gemerkt — Browser-Speicher voll', '⚠ Built, but not kept — browser storage full'), !kept);
    return true;
  }
  // 📍 from the start screen: the plan and the landing go into the last world first, then it opens (you land in front
  // of it, the game builds it); no world yet: „Meine Welt" is made and the plan follows it in
  async function spotFromTitle(ding, name) {
    const g = game(), ST = VR.Start; if (!g || !ST) return;
    const ws = await ST.listWorlds(), w = ws && ws[0];
    if (!w) { setHand({ ding, name, spot: true }); ST.newWorld(); return; }
    const pl = w.player || {}, sp = Array.isArray(pl.spawn) && pl.spawn.every(Number.isFinite) ? pl.spawn : Array.isArray(w.worldSpawn) ? w.worldSpawn : Array.isArray(pl.pos) ? pl.pos : null;
    if (!sp) { setHand({ ding, name, spot: true }); ST.play(); return; }
    const S = Wz.spotPlan(ding, sp, +pl.yaw || 0, { name }); if (!S) return;
    const key = 'r9si.plans.' + w.id;
    try { const d = JSON.parse(localStorage.getItem(key) || 'null') || { v: 1, world: w.id, plans: [] }; d.plans = (d.plans || []).concat([S.plan]); d.t = Date.now(); localStorage.setItem(key, JSON.stringify(d)); } catch (e) { host.full(); }
    if (VR.Landing) VR.Landing.note(w.id, S.landing);
    g.pendingEntry = 'studio';   // (like ▶ Spielen from the Studio: in front of the new thing)
    if (VR.Hints) VR.Hints.done('play');
    g.loadWorld(w);
  }
  // 🔁 ✏️ on a ✨ thing: the new one is built where the old one stands, the old one's own blocks (what still stands of
  // it) go in the same step — Z brings the old one back
  function replaceHere(ding, name, old) {
    const g = game(); if (!inPlay() || !ownWorld()) return false;
    const blue = g.gadgets && g.gadgets.blue, d = VR.Ding && VR.Ding.parse(ding); if (!blue || !d) return false;
    const pl = { id: 'wz' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36), ox: old.ox, oz: old.oz, F: old.F, r: old.r & 3, status: 'pending', t: Date.now(), from: 'hand', ding, wiz: true, replaces: old.id };
    if (d.kind === 'f') Object.assign(pl, { kind: 'forge', dna: d.key }); else if (d.kind === 'p') Object.assign(pl, { kind: 'piece', piece: ding }); else return false;
    if (!blue.plans) blue.loadPlans();
    blue.plans.push(pl);
    const kept = blue.storePlans((ps) => ps.concat([pl]));
    if (VR.Bauhand) VR.Bauhand.last = { id: pl.id, name, undo: null, sliced: false, kept, replaces: old.id };
    const res = blue.tryBuild(pl);
    if (VR.Bauhand && VR.Bauhand.last && VR.Bauhand.last.id === pl.id && res === 'sliced') VR.Bauhand.last.sliced = true;
    if (res !== 'built') toast(tx('bh.toast.building', { n: name }, '{n} entsteht …', '{n} is being built …'));
    if (!kept) host.full();
    return true;
  }
  Wz.spotHere = (ding, name) => { const g = game(); return inPlay() ? spotHere(g, ding, name) : false; };

  // ---------------------------------------------------------------- the start screen's ✨ tile opens it right there
  if (VR.Start) VR.Start.erschaffen = function () { Wz.open({ from: 'title' }); };

  // ---------------------------------------------------------------- 🎒 Meins: a Forge thing's card shows it (an iso picture)
  const fPics = new Map();
  function forgePic(id) {
    const dna = id.slice(2), cv = document.createElement('canvas'); cv.width = 240; cv.height = 180; cv.style.width = '100%'; cv.style.height = '100%'; cv.style.objectFit = 'contain';
    const paint = (img) => { if (img) cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); };
    const have = fPics.get(dna); if (have && have.done) { paint(have.done); return cv; }
    const job = have || { wait: [] }; job.wait.push(paint); fPics.set(dna, job);
    if (!have) host.forge(dna).then((src) => { const col = host.colors(); if (!src || !col) { fPics.delete(dna); return; } const img = VR.IsoPic.toCanvas(VR.IsoPic.render(src, 240, 180, col)); job.done = img; for (const f of job.wait) f(img); job.wait = []; });
    return cv;
  }
  setInterval(() => {
    const Dg = VR.Ding, H = Dg && Dg.handlers; if (!H || !H.__game || H.__wz) return;
    const prev = H.pic;
    H.pic = function (id, w, h) { if (/^f:/.test(id) && VR.IsoPic && host.colors()) return forgePic(id); return prev ? prev(id, w, h) : null; };
    H.__wz = true;
  }, 1000);
})(VR);

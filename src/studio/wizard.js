// ============================================================================
// R9 Studio · ✨ Erschaffen (W2, spec §5): VR.Wizard's host on this page. The ✨
// tile and #erschaffen open it; Wohin? hands the thing to the game:
//  🧍 Vor mir — the game opens with it in your 🖐 hand (r9si.hand)
//  📍 An meinem Platz — planned six blocks in front of your spot (the game finds
//     its floor and builds it); you land in front of it
//  🗺 Auf der Karte — the Karte view with it in hand (a Bauteil, a Forge thing,
//     a house, furniture)
// The standalone Studio keeps it (🎒 Nur merken). Ort and Foto open the Studio's
// own tools (also #erschaffen/site · #erschaffen/photo from the game).
// VR.StudioWizard: pieceOf(id) / canPiece(id) / makePiece(id) — a k: or g:
// project as its Bauteil (made from the project when it has none yet) — and
// tool(kind).
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const Wz = VR.Wizard; if (!Wz) return;
  const { S } = C;
  const SA = !!C.SA;
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const WM = () => VR.StudioWorld, SS = () => VR.StudioStart, PJ = () => VR.Projects, D = () => VR.Ding, LD = () => VR.Landing, NAV = () => VR.Nav;
  const toast = (t) => { const P = PJ(); if (P && P.toast) P.toast(t); else C.sys(t, 'ok'); };
  const lsGet = (k) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  // the game this Studio lies over (its overlay), if any
  const gameUnder = () => { try { const g = window.parent !== window && window.parent.VR && window.parent.VR.game; return g && g.studioOpen ? g : null; } catch (e) { return null; } };
  const copy = (src) => { if (!src || !src.width) return null; const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c; };
  const SW = VR.StudioWizard = {};

  // ---------------------------------------------------------------- a project (k: Baukasten house, g: Genie thing) → its Bauteil
  const lib = () => (VR.Pack && VR.Pack.libLoad ? VR.Pack.libLoad() : []);
  SW.pieceOf = function (id) {
    const d = D() && D().parse(id); if (!d) return null;
    if (d.kind === 'p') return lib().some(it => it && it.id === d.key) ? id : null;
    if (d.kind !== 'k' && d.kind !== 'g') return null;
    const p = PJ() && PJ().get(d.key), pc = p && p.piece ? String(p.piece).replace(/^p:/, '') : null;
    return pc && lib().some(it => it && it.id === pc) ? 'p:' + pc : null;
  };
  SW.canPiece = function (id) {
    if (SW.pieceOf(id)) return true;
    const d = D() && D().parse(id), P = PJ(); if (!d || !P || (d.kind !== 'k' && d.kind !== 'g')) return false;
    const data = P.data(d.key);
    return !!(data && (d.kind === 'k' ? data.spec : data.last && (data.last.kind === 'model' || data.last.kind === 'house')));
  };
  SW.makePiece = function (id) {
    const have = SW.pieceOf(id); if (have) return have;
    const d = D() && D().parse(id), P = PJ(), K = VR.WizKinds; if (!d || !P || !K || (d.kind !== 'k' && d.kind !== 'g')) return null;
    const pj = P.get(d.key), data = P.data(d.key); if (!pj || !data) return null;
    let thing = null;
    if (d.kind === 'k' && data.spec) thing = { src: 'kit', spec: data.spec, name: pj.label || pj.name || data.spec.name || 'Haus' };
    else if (d.kind === 'g' && data.last && data.last.kind === 'house') thing = { src: 'kit', spec: data.last.spec, name: pj.label || pj.name || 'Haus' };
    else if (d.kind === 'g' && data.last && data.last.kind === 'model') thing = { src: 'genie', design: data.last, name: pj.label || pj.name || data.last.name || 'Ding' };
    if (!thing) return null;
    let grid = null; try { grid = K.grid(thing); } catch (e) { grid = null; }
    if (!grid) return null;
    const origin = thing.src === 'kit' ? { kind: 'kit', spec: thing.spec, level: true } : { kind: 'genie', recipe: thing.design.recipe || null };
    let th; try { const u = P.thumbURL && P.thumbURL(d.key); th = u && u.length < 60000 ? u : undefined; } catch (e) { th = undefined; }
    const it = K.libItem(grid, { name: thing.name, origin, thumb: th });
    const items = lib().slice(); items.unshift(it);
    if (!lsSet('r9si.library', { v: 1, items, t: Date.now() })) { host.full(); return null; }
    P.put(d.key, { piece: it.id }, { touch: false });
    return 'p:' + it.id;
  };

  // ---------------------------------------------------------------- the host
  let texCol = null, texAvg = null;
  const host = {
    name: 'studio',
    root: () => document.getElementById('studio') || document.body,
    ready: () => new Promise((res) => { const P = PJ(); if (P && P.whenReady) P.whenReady(() => res(true)); else res(true); }),
    colors() { const ti = C.texInfo && C.texInfo(); if (!ti || !ti.avgColor || !VR.IsoPic) return null; if (texAvg !== ti.avgColor) { texAvg = ti.avgColor; texCol = VR.IsoPic.texColors(texAvg); } return texCol; },
    forge: (dna) => C.call({ type: 'forge', dna }).then((m) => (m && m.type === 'forge' && m.ops ? { ops: m.ops } : null), () => null),
    // a catalogue villa: the Architektur view's own picture when it has one, else the blocks as an iso picture
    house(i) { const rec = C.HOUSE && C.HOUSE.get(i); if (rec && rec.thumb) return Promise.resolve(copy(rec.thumb)); return C.call({ type: 'blueprint', index: i, seed: 7 }).then((m) => (m && m.type === 'blueprint' && m.ops ? { ops: m.ops } : null), () => null); },
    model(name) { try { return copy(C.thumbOf(name)); } catch (e) { return null; } },
    projects: { newId: (k) => PJ().newId(k), put: (id, patch) => PJ().put(id, patch), setData: (id, d) => PJ().setData(id, d), thumb: (id, cv, fit) => PJ().thumb(id, cv, fit) },
    wheres: () => (SA ? ['keep'] : ['hand', 'spot', 'map']),
    place(where, ding, thing, ctx) {
      const name = (ctx && ctx.name) || (D() ? D().name(ding) : ding);
      if (where === 'keep') { toast(tx('wiz.keptToast', { n: name }, '✓ {n} wartet in 🎒 Meins', '✓ {n} waits in 🎒 Mine')); return true; }
      if (where === 'map') { const SSx = SS(); if (!SSx || !SSx.set) return false; Promise.resolve(SSx.set(ding)).catch(() => false); return true; }
      if (where === 'hand') { handTo(ding, name); return true; }
      if (where === 'spot') { spotTo(ding, name); return true; }
      return false;
    },
    studio(kind) { SW.tool(kind); },
    full() { if (C.full) C.full('library'); toast(tx('bh.toast.full', null, '⚠ Gebaut, aber nicht gemerkt — Browser-Speicher voll', '⚠ Built, but not kept — browser storage full')); },
    onOpen() { const P = PJ(); if (P && P.isOpen && P.isOpen()) P.show(false); const IM = WM() && WM().imagine; if (IM && IM.close && document.querySelector('#imagine.on')) IM.close(); },
    onClose() { },
  };
  if (VR.Projects) Wz.host = host;   // (a page without the projects list keeps the wizard closed)
  if (VR.WizKinds && !VR.WizKinds.catalog) VR.WizKinds.catalog = () => (C.HOUSES || []).map(h => ({ i: h.i, name: h.name }));   // (the villas: this page has their list, not the generator)

  // ---------------------------------------------------------------- the world it goes to, and where its spot is
  async function target() {
    const W = WM(); if (!W) return null;
    let w = W.play && W.play.target ? W.play.target() : null;
    if (!w && W.list) { try { await W.list(); } catch (e) { /* */ } w = W.play && W.play.target ? W.play.target() : (W.worlds && W.worlds[0]) || null; }
    return w || null;
  }
  function spawnIn(w) {
    const L = LD(), o = L ? L.read(w.id) : {};
    if (L && L.freshSpawn && L.freshSpawn(o, w)) return o.spawn.pos;
    const g = gameUnder(); if (g && g.meta && g.meta.id === w.id && g.player && Array.isArray(g.player.spawn)) return g.player.spawn;
    if (w.player && Array.isArray(w.player.spawn) && w.player.spawn.every(Number.isFinite)) return w.player.spawn;
    if (Array.isArray(w.worldSpawn)) return w.worldSpawn;
    return w.player && Array.isArray(w.player.pos) ? w.player.pos : null;
  }
  const yawIn = (w) => { const g = gameUnder(); if (g && g.meta && g.meta.id === w.id && g.player) return g.player.yaw || 0; return w.player && Number.isFinite(+w.player.yaw) ? +w.player.yaw : 0; };
  function play(w) {
    const W = WM();
    if (W && W.play && W.play.go) { W.play.go(); return; }
    try { location.href = 'index.html' + (location.search || '') + (w ? '#play=' + encodeURIComponent(w.id) : ''); } catch (e) { /* */ }
  }
  // 🧍 into your hand: the game opens (or comes back) with it in the 🖐 Bauhand
  async function handTo(ding, name) {
    const w = await target();
    if (!lsSet('r9si.hand', { v: 1, ding, name, world: w ? w.id : null, t: Date.now(), from: 'wizard' })) { host.full(); return; }
    toast(tx('wiz.handToast', { n: name }, '🖐 {n} ist in deiner Hand — das Spiel öffnet sich', '🖐 {n} is in your hand — the game opens'));
    play(w);
  }
  // 📍 at your spot: the plan six blocks in front of it (the game finds its floor); you land in front of it
  async function spotTo(ding, name) {
    const w = await target();
    if (!w) { lsSet('r9si.hand', { v: 1, ding, name, world: null, spot: true, t: Date.now(), from: 'wizard' }); toast(tx('wiz.firstWorld', null, '▶ Losspielen — es entsteht in deiner neuen Welt', '▶ Play — it appears in your new world')); play(null); return; }
    const sp = spawnIn(w), Sx = sp ? Wz.spotPlan(ding, sp, yawIn(w), { name }) : null;
    if (!Sx) { lsSet('r9si.hand', { v: 1, ding, name, world: w.id, spot: true, t: Date.now(), from: 'wizard' }); play(w); return; }
    const W = WM();
    let kept = true;
    if (W && W.world && W.world.id === w.id && W.change && W.commit) {
      // the world open here: through its own plan list (its drafts and ▶ keep it)
      W.change(() => { W.plans.push(Object.assign({}, Sx.plan, { status: 'draft' })); });
      kept = W.commit(true).ok;
    } else {
      const key = 'r9si.plans.' + w.id, d = lsGet(key) || { v: 1, world: w.id, plans: [] };
      d.plans = (Array.isArray(d.plans) ? d.plans : []).concat([Sx.plan]); d.t = Date.now();
      kept = lsSet(key, d);
    }
    if (!kept) { host.full(); return; }
    if (LD()) LD().note(w.id, Sx.landing);   // (after the commit: you stand at your spot, looking at it)
    toast(tx('wiz.spotToast', { n: name }, '✨ {n} entsteht an deinem Platz', '✨ {n} appears at your spot'));
    play(w);
  }
  SW.handTo = handTo; SW.spotTo = spotTo;

  // ---------------------------------------------------------------- Ort, Foto: the Studio's own tools
  SW.tool = async function (kind) {
    const W = WM(), IM = W && W.imagine; if (!IM || !IM.open) return false;
    if (Wz.isOpen()) Wz.close('studio');
    if (kind === 'site' && !W.world && W.list) {
      if (!W.worlds) { try { await W.list(); } catch (e) { /* */ } }
      const last = W.worlds && W.worlds[0];
      if (last && W.openId) await W.openId(last.id, 'karte');
    }
    IM.open(null, kind === 'site' ? (W.world ? 'site' : 'house') : 'flat');
    return true;
  };

  // ---------------------------------------------------------------- the cards' pictures: a Forge thing as an iso picture
  const fPics = new Map();
  function forgePic(id, w, h) {
    const dna = id.slice(2), cv = document.createElement('canvas'); cv.width = 240; cv.height = 180; cv.style.width = '100%'; cv.style.height = '100%'; cv.style.objectFit = 'contain';
    const paint = (img) => { if (!img) return; const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height); };
    const have = fPics.get(dna); if (have && have.done) { paint(have.done); return cv; }
    const job = have || { wait: [] }; job.wait.push(paint); fPics.set(dna, job);
    if (!have) host.forge(dna).then((src) => { const col = host.colors(); if (!src || !col) { fPics.delete(dna); return; } const img = VR.IsoPic.toCanvas(VR.IsoPic.render(src, 240, 180, col)); job.done = img; for (const f of job.wait) f(img); job.wait = []; });
    void w; void h;
    return cv;
  }
  function picHook() {
    const Dg = D(); if (!Dg || !Dg.handlers || Dg.handlers.__wz) return;
    const prev = Dg.handlers.pic;
    Dg.handlers.pic = function (id, w, h) { if (/^f:/.test(id) && VR.IsoPic && host.colors()) return forgePic(id, w, h); return prev ? prev(id, w, h) : null; };
    Dg.handlers.__wz = true;
  }
  setInterval(picHook, 1000); window.addEventListener('load', () => setTimeout(picHook, 600));
})();

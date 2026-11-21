// ============================================================================
// Zauberblick — V with nothing in reach (the owner, 21 Nov 2026: „mit der Taste V holt man den Roboter, ich will eine
// geilere Idee"; his pick of four: the Zauberblick). For six seconds a hologram lies over the land:
//   · the villages (the three nearest within 2.5 km) with their names and distances, on the screen where they lie — or on
//     its edge with an arrow when they are behind you
//   · the way: Funke's current target (story, quest, waypoint, vista, the next village)
//   · the animals within 64 m (the five nearest: the wild ones of t-wild and the creatures)
//   · Funke's scan: chests and ores glow through the ground (funke.js, unchanged)
//   · the next wow and when („Nächstes Wow: Sonnenuntergang · in 2 Min")
// A second V closes it. Presentation only, DOM over the picture; every preset alike (cost 🟢: six seconds, ≤ Z.MAX marks
// projected per frame, the list refreshed twice a second). Switch: settings.zauber (default on; off → V asks Funke again).
// Pure (test/zauber.js): collect · dist · place · wowLine · MAX · DUR.
// ============================================================================
(function (VR) {
  'use strict';
  const Z = VR.Zauber = VR.Zauber || {};
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'zauber', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.zauber', tip: 'g.set.zauber.tip', cost: 'low', def: true });
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const lang = () => (VR.I18N && VR.I18N.lang) || 'de';
  // a word in language L (the tests ask for one; the game passes its own)
  const TL = (k, v, L) => { const I = VR.I18N, d = I && L && I.dict && I.dict[L]; if (d && typeof d[k] === 'string') return d[k].replace(/\{(\w+)\}/g, (m, n) => (v && v[n] !== undefined ? v[n] : m)); return T(k, v); };
  Z.DUR = 6; Z.MAX = 9; Z.VIL_R = 2500; Z.ANI_R = 64; Z.FADE = 0.35;
  const ICON_A = { fox: '🦊', rabbit: '🐇', deer: '🦌', heron: '🪶', bird: '🐦', cat: '🐈', dog: '🐕', sheep: '🐑', cow: '🐄', pig: '🐖', chicken: '🐔', horse: '🐎', bee: '🐝', fish: '🐟' };
  const NAME_A = { fox: 1, rabbit: 1, deer: 1, heron: 1, bird: 1 };
  const kindOf = (id) => { const s = String(id || ''); for (const k in ICON_A) if (s.indexOf(k) >= 0) return k; return 'other'; };

  // ---------------------------------------------------------------- pure
  Z.dist = function (m, L) {
    if (m < 1000) return Math.round(m) + ' m';
    const s = (m / 1000).toFixed(1);
    return ((L || lang()) === 'de' ? s.replace('.', ',') : s) + ' km';
  };
  // c: {pos, villages: [{name, x, z}], animals: [{kind, x, y, z}], target: {name, pos} | null} → marks
  // [{type, icon, label, pos: [x, y, z], d}] — the way, the villages, the animals; at most Z.MAX
  Z.collect = function (c) {
    const P = c.pos, out = [], L = c.lang || lang();
    const dh = (x, z) => Math.hypot(x - P[0], z - P[2]);
    if (c.target && c.target.pos) { const q = c.target.pos; out.push({ type: 'way', icon: '✦', label: c.target.name || T('g.zb.way'), pos: [q[0], (q[1] || P[1]) + 4, q[2]], d: dh(q[0], q[2]) }); }
    const vs = (c.villages || []).map(v => ({ v, d: dh(v.x, v.z) })).filter(o => o.d <= Z.VIL_R && o.d > 24).sort((a, b) => a.d - b.d).slice(0, 3);
    for (const o of vs) out.push({ type: 'village', icon: '🏘', label: o.v.name || '', pos: [o.v.x, (o.v.y || P[1]) + 12, o.v.z], d: o.d });
    const as = (c.animals || []).map(a => ({ a, d: Math.hypot(a.x - P[0], a.y - P[1], a.z - P[2]) })).filter(o => o.d <= Z.ANI_R).sort((a, b) => a.d - b.d).slice(0, 5);
    for (const o of as) { const k = kindOf(o.a.kind); out.push({ type: 'animal', icon: ICON_A[k] || '🐾', label: T('g.zb.a.' + (NAME_A[k] ? k : 'other')), pos: [o.a.x, o.a.y + 1.4, o.a.z], d: o.d }); }
    void L;
    return out.slice(0, Z.MAX);
  };
  // clip (x, y, z, w) of a point → {x, y, edge, ang}: inside the view where it is on a W × H screen; behind or outside on
  // the margin's box toward it (ang: the arrow's screen angle, radians, 0 = right, counter-clockwise up)
  Z.place = function (clip, W, H, m) {
    const w = clip[3];
    if (w > 1e-4) {
      const nx = clip[0] / w, ny = clip[1] / w;
      if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1) {
        const x = (nx * 0.5 + 0.5) * W, y = (1 - (ny * 0.5 + 0.5)) * H;
        if (x >= m && x <= W - m && y >= m && y <= H - m) return { x, y, edge: false, ang: 0 };
      }
    }
    let dx = w > 1e-4 ? clip[0] / w : -clip[0], dy = w > 1e-4 ? clip[1] / w : -clip[1];
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = -1;
    const hx = W / 2 - m, hy = H / 2 - m, k = Math.min(hx / Math.max(1e-6, Math.abs(dx)), hy / Math.max(1e-6, Math.abs(dy)));
    return { x: W / 2 + dx * k, y: H / 2 - dy * k, edge: true, ang: Math.atan2(dy, dx) };
  };
  const KINDS = { golden: 1, sunset: 1, night: 1, aurora: 1, meteor: 1, murm: 1, rays: 1, festival: 1, ship: 1, vista: 1 };
  Z.wowLine = function (w, L) {
    L = L || lang();
    if (!w) return TL('g.zb.quiet', null, L);
    const what = TL('g.zb.k.' + (KINDS[w.kind] ? w.kind : 'other'), null, L);
    const s = Math.max(0, w.eta || 0);
    const when = s < 15 ? TL('g.zb.now', null, L) : TL('g.zb.in', { t: s < 90 ? Math.round(s) + ' s' : Math.round(s / 60) + ' Min' }, L);
    return TL('g.zb.wow', { what, when }, L);
  };

  // ---------------------------------------------------------------- the game's side
  const st = { on: false, t: 0, marks: [], els: [], root: null, head: null, ring: null, refresh: 0, wow: '' };
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  function gatherOf(g) {
    const p = g.player, P = p.pos, c = { pos: P, villages: [], animals: [], target: null, lang: lang() };
    const V = g.villages;
    if (V && V.known) for (const vil of V.known.values()) { const ce = vil.center || (vil.plan ? [vil.plan.x, vil.plan.y, vil.plan.z] : null); if (ce) c.villages.push({ name: vil.name || (vil.plan && vil.plan.name) || '', x: ce[0], y: ce[1], z: ce[2] }); }
    const E = g.entities;
    if (E && E.mobs) for (const m of E.mobs) { if (!m || m.dead || m.pet || !m.def || m.def.hostile || !m.pos) continue; c.animals.push({ kind: m.def.model || m.def.id || m.type, x: m.pos[0], y: m.pos[1], z: m.pos[2] }); }
    const W = g.wild;
    if (W) {
      for (const k of ['rabbits', 'herons', 'gulls']) { const arr = W[k]; if (Array.isArray(arr)) for (const a of arr) if (a && a.pos) c.animals.push({ kind: k === 'rabbits' ? 'rabbit' : k === 'herons' ? 'heron' : 'bird', x: a.pos[0], y: a.pos[1], z: a.pos[2] }); }
      if (W.fox && W.fox.pos) c.animals.push({ kind: 'fox', x: W.fox.pos[0], y: W.fox.pos[1], z: W.fox.pos[2] });
    }
    const F = g.funke;
    try { const tg = F && F.target ? F.target(false) : null; if (tg && tg.pos) c.target = { name: tg.name, pos: tg.pos }; } catch (e) { /* no way */ }
    return c;
  }
  function nextWow(g) {
    const F = g.funke; if (!F || !F.wowCands || !VR.Funke || !VR.Funke.pickWow) return null;
    try { return VR.Funke.pickWow(F.wowCands(), new Set(), 'ask'); } catch (e) { return null; }
  }
  function css() {
    if (document.getElementById('zbcss')) return;
    const s = document.createElement('style'); s.id = 'zbcss';
    s.textContent = `
#zb{position:absolute;inset:0;pointer-events:none;z-index:6;opacity:0;transition:opacity .3s}
#zb .zbveil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,rgba(40,180,220,.10),rgba(10,40,70,.28) 70%,rgba(5,20,40,.45));}
#zb .zbveil::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(120,230,255,.05) 0 1px,transparent 1px 4px);}
#zb .zbring{position:absolute;left:50%;top:55%;width:40px;height:40px;margin:-20px 0 0 -20px;border:2px solid rgba(140,240,255,.75);border-radius:50%;box-shadow:0 0 18px rgba(120,230,255,.6);animation:zbr 1.6s ease-out 1 forwards}
@keyframes zbr{from{transform:scale(.2);opacity:1}to{transform:scale(40);opacity:0}}
#zb .zbhead{position:absolute;left:50%;top:9%;transform:translateX(-50%);padding:8px 16px;border:1px solid rgba(140,240,255,.55);border-radius:10px;background:rgba(6,30,48,.62);color:#dffaff;font:600 15px/1.35 sans-serif;text-align:center;text-shadow:0 0 8px rgba(120,230,255,.7);box-shadow:0 0 22px rgba(80,200,240,.35);white-space:nowrap}
#zb .zbhead b{display:block;font-size:12px;letter-spacing:.18em;color:#8ff0ff;text-transform:uppercase}
#zb .zbhead i{display:block;font-style:normal;font-weight:400;font-size:11px;color:#9cc8d6;margin-top:2px}
#zb .zbm{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;color:#e9fdff;font:600 13px/1.2 sans-serif;text-shadow:0 0 6px rgba(0,0,0,.9),0 0 10px rgba(110,230,255,.8)}
#zb .zbm .zi{font-size:22px;filter:drop-shadow(0 0 6px rgba(130,240,255,.9))}
#zb .zbm .zl{padding:2px 7px;margin-top:2px;border-radius:7px;background:rgba(6,30,48,.55);border:1px solid rgba(140,240,255,.35);white-space:nowrap}
#zb .zbm .zd{font-weight:400;color:#a6e9f5;margin-left:5px}
#zb .zbm .za{width:0;height:0;border:7px solid transparent;border-left:12px solid #8ff0ff;margin-top:3px;filter:drop-shadow(0 0 4px #6fe0ff);display:none}
#zb .zbm.edge .za{display:block}
#zb .zbm.way .zl{border-color:rgba(255,220,140,.7);color:#fff3cf}
#zb .zbm.way .zi{color:#ffd98a;filter:drop-shadow(0 0 8px rgba(255,210,120,.95))}`;
    document.head.appendChild(s);
  }
  function build() {
    if (!hasDoc) return;
    css();
    const ui = document.getElementById('ui') || document.body;
    let root = document.getElementById('zb');
    if (!root) { root = document.createElement('div'); root.id = 'zb'; ui.appendChild(root); }
    root.innerHTML = '<div class="zbveil"></div><div class="zbring"></div><div class="zbhead"></div>';
    st.root = root; st.head = root.querySelector('.zbhead'); st.els = [];
  }
  function markEl(i) {
    let el = st.els[i];
    if (!el) { el = document.createElement('div'); el.className = 'zbm'; el.innerHTML = '<span class="zi"></span><span class="zl"></span><span class="za"></span>'; st.root.appendChild(el); st.els[i] = el; }
    return el;
  }
  Z.open = function (g) {
    if (!g || !g.player) return false;
    st.on = true; st.t = 0; st.t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000; st.refresh = 0;
    st.marks = Z.collect(gatherOf(g));
    st.wow = Z.wowLine(nextWow(g));
    if (hasDoc) {
      build();
      st.head.innerHTML = '';
      const b = document.createElement('b'); b.textContent = '🔮 ' + T('g.zb.title');
      const w = document.createElement('span'); w.textContent = st.wow;
      const h = document.createElement('i'); h.textContent = T('g.zb.hint');
      st.head.appendChild(b); st.head.appendChild(w); st.head.appendChild(h);
      void st.root.offsetWidth; st.root.style.opacity = '1';   // (a reflow first: the fade-in transition runs)
    }
    if (VR.Funke && VR.Funke.scan) { try { VR.Funke.scan(g); } catch (e) { /* no scan */ } }
    const au = g.audio; if (au && au.ctx && au.tone) { const t = au.ctx.currentTime; au.tone(392, 0.03, 0.5, 'sine', true, t); au.tone(587, 0.025, 0.6, 'sine', true, t + 0.07); au.tone(880, 0.02, 0.8, 'sine', true, t + 0.15); }
    return true;
  };
  Z.close = function () { st.on = false; if (st.root) { st.root.style.opacity = '0'; const r = st.root; setTimeout(() => { if (!st.on && r.parentNode) r.parentNode.removeChild(r); if (!st.on) st.root = null; }, 350); } };
  Z.toggle = function (g) { if (st.on) { Z.close(); return true; } return Z.open(g); };
  Z.isOpen = () => st.on;
  Z.frame = function (g, dt) {
    if (!st.on) return;
    st.t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000 - st.t0;   // (real seconds: six of them even on a slow frame rate)
    if (st.t >= Z.DUR || !g || !g.player || g.state !== 'play') { Z.close(); return; }
    if ((st.refresh -= dt) <= 0) { st.refresh = 0.5; st.marks = Z.collect(gatherOf(g)); }
    const r = g.renderer; if (!r || !st.root || !r.viewProj || !r.cam) return;
    const VP = r.viewProj, cam = r.cam, el0 = st.root.getBoundingClientRect ? st.root.getBoundingClientRect() : { width: 1280, height: 720 };
    const W = el0.width || 1280, H = el0.height || 720, L = lang();
    for (let i = 0; i < st.marks.length; i++) {
      const m = st.marks[i], el = markEl(i);
      const x = m.pos[0] - cam.x, y = m.pos[1] - cam.y, z = m.pos[2] - cam.z;
      const clip = [VP[0] * x + VP[4] * y + VP[8] * z + VP[12], VP[1] * x + VP[5] * y + VP[9] * z + VP[13], VP[2] * x + VP[6] * y + VP[10] * z + VP[14], VP[3] * x + VP[7] * y + VP[11] * z + VP[15]];
      const pl = Z.place(clip, W, H, 56);
      el.style.display = '';
      el.style.left = pl.x.toFixed(1) + 'px'; el.style.top = pl.y.toFixed(1) + 'px';
      el.className = 'zbm' + (pl.edge ? ' edge' : '') + (m.type === 'way' ? ' way' : '');
      el.children[0].textContent = m.icon;
      el.children[1].innerHTML = '';
      el.children[1].appendChild(document.createTextNode(m.label));
      const dd = document.createElement('span'); dd.className = 'zd'; dd.textContent = Z.dist(m.d, L); el.children[1].appendChild(dd);
      el.children[2].style.transform = 'rotate(' + (-pl.ang).toFixed(3) + 'rad)';
    }
    for (let i = st.marks.length; i < st.els.length; i++) if (st.els[i]) st.els[i].style.display = 'none';
    if (st.t > Z.DUR - Z.FADE && st.root) st.root.style.opacity = String(Math.max(0, (Z.DUR - st.t) / Z.FADE));
  };
})(VR);

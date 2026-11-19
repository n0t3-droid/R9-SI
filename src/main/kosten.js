// ============================================================================
// /kosten · what each part of the picture costs on THIS graphics card, measured in the running game. Software tests
// cannot tell (a software GPU spends its time elsewhere), so the game measures itself: for each experiment the settings
// change, the GPU timer queries (gpuprof.js, per pass) settle, and the frame's GPU time is compared with the plain one.
// The table goes to the chat: "Ferne aus −4.1 ms (far)". /kosten runs the standard list; /kosten far only the far ones.
// Nothing stays changed: every experiment is undone, the settings end as they were.
// ============================================================================
(function (VR) {
  'use strict';
  const K = VR.Kosten = {};
  K.SETTLE = 4000; K.MEASURE = 3000;   // (the settings' apply redraws the shadow map over some frames: the settle waits it out)
  // the experiments: name (de, en), the settings it changes, an optional extra knob
  K.LIST = [
    { id: 'base', de: 'So wie jetzt', en: 'As it is', set: {} },
    { id: 'far0', de: 'Ferne aus', en: 'Far land off', set: { horizon: 0 }, grp: 'far' },
    { id: 'farS', de: 'Ferne gröber (Teilung ×0.75)', en: 'Far land coarser (split ×0.75)', set: {}, split: 0.75, grp: 'far' },
    { id: 'farS2', de: 'Ferne viel gröber (×0.55)', en: 'Far land much coarser (×0.55)', set: {}, split: 0.55, grp: 'far' },
    { id: 'farZ', de: 'Ferne mit Tiefenvorlauf', en: 'Far land depth pre-pass', set: {}, knob: ['Horizon', 'ZPRE', true], grp: 'far' },
    { id: 'fade0', de: 'Sanftes Einblenden aus', en: 'Soft fade-in off', set: { fadeIn: false }, grp: 'far' },
    { id: 'uhr0', de: 'Schattenuhr aus', en: 'Sun clock off', set: { sunclock: false } },
    { id: 'sky0', de: 'Himmelslicht + Rückstrahlung + Lampen aus', en: 'Sky light, bounce, lamps off', set: { skylight: false, bounce: false, lamplight: false } },
    { id: 'pbr0', de: 'Material-Glanz (PBR) aus', en: 'Material shine (PBR) off', set: { pbr: 0 } },
    { id: 'hi0', de: 'Detail-Texturen aus', en: 'Hero textures off', set: { texHi: false } },
    { id: 'anim0', de: 'Wind & Animationen aus', en: 'Wind & animation off', set: { anim: false }, grp: 'geo' },
    { id: 'leaf0', de: 'Feines Laub aus', en: 'Fancy leaves off', set: { fancyLeaves: false }, grp: 'geo' },
    { id: 'plant0', de: 'Runde Pflanzen/Möbel aus', en: 'Smooth plants/furniture off', set: { smoothPlants: 0, smoothFurn: 0 }, grp: 'geo' },
    { id: 'sh0', de: 'Sonnenschatten (Karte) aus', en: 'Sun shadow map off', set: { sunShadows: false, shadows: 0 }, grp: 'geo' },
    { id: 'rd2', de: 'Sichtweite −2 Chunks', en: 'View distance −2 chunks', set: {}, rd: -2, grp: 'geo' },
    { id: 'res8', de: 'Auflösung ×0.8', en: 'Resolution ×0.8', set: {}, scale: 0.8 },
    // /kosten ultra · where Ultra's terrain time goes (on the owner's APU 3× Balanced's): each row takes ONE Ultra part
    // down to Balanced's value; the opaque pass's delta is what counts (the shadow map's redraw lands in 'shadow')
    { id: 'rd4', de: 'Sichtweite 16 → 12', en: 'View distance 16 → 12', set: {}, rd: -4, grp: 'ultra' },
    { id: 'vx44', de: 'Mini-Voxel-Detail 96 → 44 Blöcke', en: 'Mini-voxel detail 96 → 44 blocks', set: { vxLod: 44 }, grp: 'ultra' },
    { id: 'mat2', de: 'Material-Stufe 3 → 2 (Spiegelung)', en: 'Material tier 3 → 2 (mirror)', set: { matTier: 2 }, grp: 'ultra' },
    { id: 'wat1', de: 'Wasser 2 → 1', en: 'Water 2 → 1', set: { water: 1 }, grp: 'ultra' },
    { id: 'ray0', de: 'Lichtstrahlen aus', en: 'Light rays off', set: { rays: false }, grp: 'ultra' },
    { id: 'shd2', de: 'Schattenkarte 3 → 2', en: 'Shadow map 3 → 2', set: { shadows: 2 }, grp: 'ultra' },
    { id: 'leafU', de: 'Feines Laub aus', en: 'Fancy leaves off', set: { fancyLeaves: false }, grp: 'ultra' },
    { id: 'resU', de: 'Auflösung ×0.8', en: 'Resolution ×0.8', set: {}, scale: 0.8, grp: 'ultra' },
    { id: 'idx0', de: 'Viereck-Index aus (Dreieckslisten wie früher)', en: 'Indexed quads off (triangle lists as before)', set: {}, idx: false, grp: 'ultra' },
  ];
  K.END = { id: 'base2', de: 'So wie jetzt (nochmal: die Streuung)', en: 'As it is (again: the spread)', set: {} };
  K.plan = (arg) => K.LIST.some(e => e.id === arg && e.id !== 'base') ? [K.LIST[0], K.LIST.find(e => e.id === arg), K.END] : (arg === 'far' || arg === 'geo' || arg === 'ultra' ? K.LIST.filter(e => e.id === 'base' || e.grp === arg) : K.LIST.filter(e => e.grp !== 'geo' && e.grp !== 'ultra')).concat([K.END]);
  K.fmt = (lang, e, r, base) => {
    const name = lang === 'de' ? e.de : e.en, ms = (x) => x.toFixed(1);
    if (!base || e.id === 'base') return `${name}: ${ms(r.total)} ms GPU · ` + K.top(r.times);
    const d = r.total - base.total;
    let big = '', bd = 0; for (const k in base.times) { const dd = (r.times[k] || 0) - base.times[k]; if (Math.abs(dd) > Math.abs(bd)) { bd = dd; big = k; } }
    const op = e.grp === 'ultra' && big !== 'opaque' && base.times.opaque !== undefined ? ' · opaque ' + (((r.times.opaque || 0) - base.times.opaque) >= 0 ? '+' : '−') + ms(Math.abs((r.times.opaque || 0) - base.times.opaque)) : '';
    return `${name}: ${d >= 0 ? '+' : '−'}${ms(Math.abs(d))} ms${big ? ' (' + big + ' ' + (bd >= 0 ? '+' : '−') + ms(Math.abs(bd)) + ')' : ''}${op}`;
  };
  // robust numbers (owner's APU, Ultra: an EMA after a settings apply swung by ±15 ms — the shadow map's redraw, the
  // re-meshed chunks): the frames' trimmed mean (10 % off each end), deltas against the bases before AND after (A/B/A),
  // and a row is measured only once the world is quiet (the worker pool idle, two 1-s windows within 5 %)
  K.TRIM = 0.1; K.WIN = 1000; K.QUIET_MAX = 20000; K.PRE = 2000;
  const tmean = (a) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y), k = Math.floor(b.length * K.TRIM), c = b.slice(k, b.length - k || b.length); let s = 0; for (const v of c) s += v; return s / c.length; };
  K.stat = function (frames) {
    const keys = new Set(); for (const f of frames) for (const k in f.t) keys.add(k);
    const times = {}; for (const k of keys) times[k] = tmean(frames.map(f => f.t[k] || 0));
    return { total: tmean(frames.map(f => f.sum)), times, n: frames.length };
  };
  K.aba = function (a0, b, a1) {
    const d = { total: b.total - (a0.total + a1.total) / 2, times: {} };
    for (const k in b.times) d.times[k] = b.times[k] - ((a0.times[k] || 0) + (a1.times[k] || 0)) / 2;
    for (const k in a0.times) if (!(k in d.times)) d.times[k] = -((a0.times[k] || 0) + (a1.times[k] || 0)) / 2;
    return d;
  };
  K.quiet = (busy, w1, w2) => !busy && Math.abs(w1 - w2) <= 0.05 * Math.max(w1, w2, 0.001);
  K.top = (t) => Object.entries(t || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v.toFixed(1)).join(' · ');
  // (waits by frames, not timers: a hidden or background window throttles timers to one a minute, its frames go on)
  const wait = (ms) => new Promise((res) => { const t0 = performance.now(); const raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (f) => setTimeout(f, 16); const f = () => (performance.now() - t0 >= ms ? res() : raf(f)); raf(f); });
  // the table stays on screen (a panel, top left) until the next run or a click on it — chat lines fade
  K.panel = function (lines) {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('r9kosten');
    if (!el) { el = document.createElement('div'); el.id = 'r9kosten'; el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;max-width:92vw;background:rgba(10,14,22,.88);color:#cfe6ff;font:12px/1.45 monospace;padding:8px 10px;border-radius:8px;white-space:pre-wrap;pointer-events:auto;cursor:pointer'; el.onclick = () => el.remove(); document.body.appendChild(el); }
    el.textContent = lines.join('\n');
  };
  K.run = async function (g, arg) {
    const r = g.renderer, S = g.settings, lang = (VR.I18N && VR.I18N.lang) || 'de', say = (t) => g.ui.chatLine(t, '#bfe3ff');
    if (!r || !r.prof || !r.prof.ext) { say(lang === 'de' ? 'Kosten: dieser Browser verrät keine GPU-Zeiten.' : 'Costs: this browser hides GPU timing.'); return; }
    if (K.busy) return; K.busy = true;
    // /kosten ultra measures Ultra whatever the player runs: the preset goes on for the run, everything comes back after
    const snap = arg === 'ultra' && S.preset !== 'ultra' && g.applyPreset ? Object.assign({}, S) : null;
    if (snap) { g.applyPreset('ultra'); g.applySettings('*'); await wait(K.SETTLE * 3); }   // (16 chunks stream in)
    const dyn = S.dynRes; S.dynRes = false; const warp = S.warp; S.warp = false; r.profDetail = true;
    say(lang === 'de' ? 'Kosten werden gemessen … (bitte nicht bewegen, ca. ' + Math.round(K.plan(arg).length * 2 * (K.MEASURE + 4000) / 1000) + ' s)' : 'Measuring costs … (keep still, about ' + Math.round(K.plan(arg).length * 2 * (K.MEASURE + 4000) / 1000) + ' s)');
    const out = []; let base = null; const lines = ['R9 /kosten · ' + (VR.GL && VR.GL.rendererName || '') + ' · ' + (S.preset || '')]; K.panel(lines.concat('…'));
    // one measurement: wait until the world is quiet, then the frames of K.MEASURE ms → their trimmed mean
    const pool = () => (g.pool && g.pool.busy) | 0;
    const grab = async (ms) => { r.prof.rec = []; await wait(ms); const f = r.prof.rec; r.prof.rec = null; return f; };
    const measure = async () => {
      await wait(K.PRE);
      let prev = K.stat(await grab(K.WIN)).total; const t0 = performance.now();
      while (performance.now() - t0 < K.QUIET_MAX) { const cur = K.stat(await grab(K.WIN)).total; if (K.quiet(pool(), prev, cur)) break; prev = cur; }
      return K.stat(await grab(K.MEASURE));
    };
    const mid = (a, b) => { const m = { total: (a.total + b.total) / 2, times: {} }; for (const k of new Set(Object.keys(a.times).concat(Object.keys(b.times)))) m.times[k] = ((a.times[k] || 0) + (b.times[k] || 0)) / 2; return m; };
    try {
      const plan = K.plan(arg).filter(e => e.id !== 'base' && e.id !== 'base2');
      let a0 = await measure(), first = a0;
      { const ln = K.fmt(lang, K.LIST[0], a0, null); say(ln); lines.push(ln); K.panel(lines.concat(['…'])); out.push({ id: 'base', total: a0.total, times: a0.times }); }
      for (const e of plan) {
        const old = {}; for (const k in e.set) { old[k] = S[k]; S[k] = e.set[k]; }
        const oldSplit = VR.Horizon && VR.Horizon.SPLIT_MUL, oldScale = S.scale;
        if (e.split && VR.Horizon) { VR.Horizon.SPLIT_MUL = e.split; if (g.horizon) g.horizon.setLevel(g.horizon.level); }
        if (e.scale) S.scale = (S.scale || 1) * e.scale;
        const oldRd = S.renderDist; if (e.rd) S.renderDist = Math.max(2, (S.renderDist | 0) + e.rd);
        const kOld = e.knob && VR[e.knob[0]] ? VR[e.knob[0]][e.knob[1]] : undefined; if (e.knob && VR[e.knob[0]]) VR[e.knob[0]][e.knob[1]] = e.knob[2];
        const idxOld = r.idx; if (e.idx !== undefined) { r.idx = e.idx; if (g.remeshAll) g.remeshAll(); }   // (Viereck-Index: every section meshed again)
        g.applySettings('*');
        const b = await measure();
        if (e.idx !== undefined) { r.idx = idxOld; if (g.remeshAll) g.remeshAll(); }
        for (const k in old) S[k] = old[k];
        if (e.split && VR.Horizon) { VR.Horizon.SPLIT_MUL = oldSplit || 1; if (g.horizon) g.horizon.setLevel(g.horizon.level); }
        if (e.scale) S.scale = oldScale;
        if (e.rd) S.renderDist = oldRd;
        if (e.knob && VR[e.knob[0]]) VR[e.knob[0]][e.knob[1]] = kOld;
        g.applySettings('*');
        const a1 = await measure();   // A/B/A: the base again after every row, the delta against both
        const ref = mid(a0, a1);
        out.push({ id: e.id, total: b.total, times: b.times, ref: ref.total });
        const ln = K.fmt(lang, e, b, ref); say(ln); lines.push(ln); K.panel(lines.concat(['…']));
        a0 = a1;
      }
      const sp = lang === 'de' ? 'Streuung der Basis: ' : 'Base spread: ';
      const ln = sp + (a0.total - first.total >= 0 ? '+' : '−') + Math.abs(a0.total - first.total).toFixed(1) + ' ms'; say(ln); lines.push(ln); K.panel(lines);
    } finally {
      S.dynRes = dyn; S.warp = warp; r.profDetail = !!g.debugOn; K.busy = false;
      if (snap) { for (const k in snap) S[k] = snap[k]; g.applySettings('*'); }   // (the snapshot holds the player's own dynRes and warp)
    }
    K.last = out; if (typeof console !== 'undefined') console.log('R9 kosten', JSON.stringify(out));
    return out;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

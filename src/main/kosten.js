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
  K.SETTLE = 2500; K.MEASURE = 2500;
  // the experiments: name (de, en), the settings it changes, an optional extra knob
  K.LIST = [
    { id: 'base', de: 'So wie jetzt', en: 'As it is', set: {} },
    { id: 'far0', de: 'Ferne aus', en: 'Far land off', set: { horizon: 0 }, grp: 'far' },
    { id: 'farS', de: 'Ferne gröber (Teilung ×0.75)', en: 'Far land coarser (split ×0.75)', set: {}, split: 0.75, grp: 'far' },
    { id: 'farS2', de: 'Ferne viel gröber (×0.55)', en: 'Far land much coarser (×0.55)', set: {}, split: 0.55, grp: 'far' },
    { id: 'fade0', de: 'Sanftes Einblenden aus', en: 'Soft fade-in off', set: { fadeIn: false }, grp: 'far' },
    { id: 'uhr0', de: 'Schattenuhr aus', en: 'Sun clock off', set: { sunclock: false } },
    { id: 'sky0', de: 'Himmelslicht + Rückstrahlung + Lampen aus', en: 'Sky light, bounce, lamps off', set: { skylight: false, bounce: false, lamplight: false } },
    { id: 'pbr0', de: 'Material-Glanz (PBR) aus', en: 'Material shine (PBR) off', set: { pbr: 0 } },
    { id: 'hi0', de: 'Detail-Texturen aus', en: 'Hero textures off', set: { texHi: false } },
    { id: 'res8', de: 'Auflösung ×0.8', en: 'Resolution ×0.8', set: {}, scale: 0.8 },
  ];
  K.plan = (arg) => (arg === 'far' ? K.LIST.filter(e => e.id === 'base' || e.grp === 'far') : K.LIST);
  K.fmt = (lang, e, r, base) => {
    const name = lang === 'de' ? e.de : e.en, ms = (x) => x.toFixed(1);
    if (!base || e.id === 'base') return `${name}: ${ms(r.total)} ms GPU · ` + K.top(r.times);
    const d = r.total - base.total;
    let big = '', bd = 0; for (const k in base.times) { const dd = (r.times[k] || 0) - base.times[k]; if (Math.abs(dd) > Math.abs(bd)) { bd = dd; big = k; } }
    return `${name}: ${d >= 0 ? '+' : '−'}${ms(Math.abs(d))} ms${big ? ' (' + big + ' ' + (bd >= 0 ? '+' : '−') + ms(Math.abs(bd)) + ')' : ''}`;
  };
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
    const dyn = S.dynRes; S.dynRes = false; const warp = S.warp; S.warp = false; r.profDetail = true;
    say(lang === 'de' ? 'Kosten werden gemessen … (bitte nicht bewegen, ca. ' + Math.round(K.plan(arg).length * (K.SETTLE + K.MEASURE) / 1000) + ' s)' : 'Measuring costs … (keep still, about ' + Math.round(K.plan(arg).length * (K.SETTLE + K.MEASURE) / 1000) + ' s)');
    const out = []; let base = null; const lines = ['R9 /kosten · ' + (VR.GL && VR.GL.rendererName || '') + ' · ' + (S.preset || '')]; K.panel(lines.concat('…'));
    try {
      for (const e of K.plan(arg)) {
        const old = {}; for (const k in e.set) { old[k] = S[k]; S[k] = e.set[k]; }
        const oldSplit = VR.Horizon && VR.Horizon.SPLIT_MUL, oldScale = S.scale;
        if (e.split && VR.Horizon) { VR.Horizon.SPLIT_MUL = e.split; if (g.horizon) g.horizon.setLevel(g.horizon.level); }
        if (e.scale) S.scale = (S.scale || 1) * e.scale;
        if (Object.keys(e.set).length || e.scale) g.applySettings('*');
        await wait(K.SETTLE);
        r.prof.times = {}; r.prof.total = undefined;
        await wait(K.MEASURE);
        const res = { total: r.prof.total || 0, times: Object.assign({}, r.prof.times) };
        if (e.id === 'base') base = res;
        out.push({ id: e.id, total: res.total, times: res.times });
        const ln = K.fmt(lang, e, res, base); say(ln); lines.push(ln); K.panel(lines.concat(out.length < K.plan(arg).length ? ['…'] : []));
        for (const k in old) S[k] = old[k];
        if (e.split && VR.Horizon) { VR.Horizon.SPLIT_MUL = oldSplit || 1; if (g.horizon) g.horizon.setLevel(g.horizon.level); }
        if (e.scale) S.scale = oldScale;
        if (Object.keys(e.set).length || e.scale) g.applySettings('*');
      }
    } finally { S.dynRes = dyn; S.warp = warp; r.profDetail = !!g.debugOn; K.busy = false; }
    K.last = out; if (typeof console !== 'undefined') console.log('R9 kosten', JSON.stringify(out));
    return out;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

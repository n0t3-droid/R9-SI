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
  ];
  K.END = { id: 'base2', de: 'So wie jetzt (nochmal: die Streuung)', en: 'As it is (again: the spread)', set: {} };
  K.plan = (arg) => (arg === 'far' || arg === 'geo' || arg === 'ultra' ? K.LIST.filter(e => e.id === 'base' || e.grp === arg) : K.LIST.filter(e => e.grp !== 'geo' && e.grp !== 'ultra')).concat([K.END]);
  K.fmt = (lang, e, r, base) => {
    const name = lang === 'de' ? e.de : e.en, ms = (x) => x.toFixed(1);
    if (!base || e.id === 'base') return `${name}: ${ms(r.total)} ms GPU · ` + K.top(r.times);
    const d = r.total - base.total;
    let big = '', bd = 0; for (const k in base.times) { const dd = (r.times[k] || 0) - base.times[k]; if (Math.abs(dd) > Math.abs(bd)) { bd = dd; big = k; } }
    const op = e.grp === 'ultra' && big !== 'opaque' && base.times.opaque !== undefined ? ' · opaque ' + (((r.times.opaque || 0) - base.times.opaque) >= 0 ? '+' : '−') + ms(Math.abs((r.times.opaque || 0) - base.times.opaque)) : '';
    return `${name}: ${d >= 0 ? '+' : '−'}${ms(Math.abs(d))} ms${big ? ' (' + big + ' ' + (bd >= 0 ? '+' : '−') + ms(Math.abs(bd)) + ')' : ''}${op}`;
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
    // /kosten ultra measures Ultra whatever the player runs: the preset goes on for the run, everything comes back after
    const snap = arg === 'ultra' && S.preset !== 'ultra' && g.applyPreset ? Object.assign({}, S) : null;
    if (snap) { g.applyPreset('ultra'); g.applySettings('*'); await wait(K.SETTLE * 3); }   // (16 chunks stream in)
    const dyn = S.dynRes; S.dynRes = false; const warp = S.warp; S.warp = false; r.profDetail = true;
    say(lang === 'de' ? 'Kosten werden gemessen … (bitte nicht bewegen, ca. ' + Math.round(K.plan(arg).length * (K.SETTLE + K.MEASURE) / 1000) + ' s)' : 'Measuring costs … (keep still, about ' + Math.round(K.plan(arg).length * (K.SETTLE + K.MEASURE) / 1000) + ' s)');
    const out = []; let base = null; const lines = ['R9 /kosten · ' + (VR.GL && VR.GL.rendererName || '') + ' · ' + (S.preset || '')]; K.panel(lines.concat('…'));
    try {
      for (const e of K.plan(arg)) {
        const old = {}; for (const k in e.set) { old[k] = S[k]; S[k] = e.set[k]; }
        const oldSplit = VR.Horizon && VR.Horizon.SPLIT_MUL, oldScale = S.scale;
        if (e.split && VR.Horizon) { VR.Horizon.SPLIT_MUL = e.split; if (g.horizon) g.horizon.setLevel(g.horizon.level); }
        if (e.scale) S.scale = (S.scale || 1) * e.scale;
        const oldRd = S.renderDist; if (e.rd) S.renderDist = Math.max(2, (S.renderDist | 0) + e.rd);
        const kOld = e.knob && VR[e.knob[0]] ? VR[e.knob[0]][e.knob[1]] : undefined; if (e.knob && VR[e.knob[0]]) VR[e.knob[0]][e.knob[1]] = e.knob[2];
        g.applySettings('*');   // (the base too: every row pays the same apply)
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
        if (e.rd) S.renderDist = oldRd;
        if (e.knob && VR[e.knob[0]]) VR[e.knob[0]][e.knob[1]] = kOld;
        g.applySettings('*');
      }
    } finally {
      S.dynRes = dyn; S.warp = warp; r.profDetail = !!g.debugOn; K.busy = false;
      if (snap) { for (const k in snap) S[k] = snap[k]; g.applySettings('*'); }   // (the snapshot holds the player's own dynRes and warp)
    }
    K.last = out; if (typeof console !== 'undefined') console.log('R9 kosten', JSON.stringify(out));
    return out;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

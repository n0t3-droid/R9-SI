// regress: skip — a-story8 (docs/superpowers/plans/2026-11-01-a-story8.md): Arc 2's beauty, chapters 15–16 in the
// browser. One run (and the music's offline renders: audio), German UI, 1280 × 720, Balanced view 6, seed 4242, an Abenteuer world (Kreativ):
//   herz   Herzwelt at night: 15.2 Funke's close-up (from the front, his rim light) · the choice (stay) → 15.3 Wiegelinds Ruh
//   visit  her place afterwards, outside a scene, at night: Wiegelind resting over the circle (wide and close); then the
//          other choice on a second record (sow): Wiegelinds Saatwiese with its far Flausel
//   fest   the village at nightfall on the Dreilichterfest: 16.1 the festival (the ring, the children's lanterns, the
//          Flausel) · the round · Funke · 16.2 the last picture; the costs (ms a drawn frame) Very Low and High
// → test/shots/s8_*.png, test/shots/story8_sheet.jpg (pairs.py), .tmp_tests/story8_after.json
// usage: nohup bash test/wt_run.sh story8.mjs 3600 > .tmp_tests/story8.log 2>&1 &     ONLY=audio,herz,visit,fest,cost
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = 'file://' + ROOT + 'dist/index.html';
const TAG = process.env.TAG || 'after';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const N = { tag: TAG, pics: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/story8_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const want = (s) => !ONLY || ONLY.includes(s);

// ---------------------------------------------------------------- the main page (story.mjs's harness)
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const run = async (n, dtms = 33, until, arg) => {
  let done = 0;
  for (let k = 0; k < n; k += 30) {
    const r = await ev(([m, d, u, a]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) { g.last = performance.now() - d; window.__step(performance.now()); if (u && window.__c[u](a)) return { n: i + 1, hit: true }; }
      return { n: m, hit: false };
    }, [Math.min(30, n - k), dtms, until || null, arg === undefined ? null : arg]);
    done += r.n;
    if (r.hit) return { n: done, hit: true };
  }
  return { n: done, hit: false };
};
const draw = (tod, dtms = 33) => ev(([tod, d]) => { window.__norender = false; const g = VR.game; if (tod !== null && tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - d; window.__step(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, [tod === undefined ? null : tod, dtms]);
const shot = async (name) => {
  await ev(() => { for (const a of document.getAnimations()) { try { if (a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations !== Infinity) a.finish(); } catch (e) { /* */ } } }); await wait(200);
  const f = SHOTS + 's8_' + name + '.png';
  try { await page.screenshot({ path: f, timeout: 150000 }); } catch (e) { console.log('  !! screenshot ' + name); fails++; return null; }
  console.log('     shot ' + name + ' (' + secs() + ')'); N.pics[name] = f; save(); return f;
};
const settle = async (sec, tag) => { const t = Date.now(); let n = 0; while (Date.now() - t < sec * 1000) { n += (await run(4)).n; await wait(300); } console.log('     settled ' + sec + ' s (' + n + ' frames' + (tag ? ', ' + tag : '') + ', ' + secs() + ')'); };
const sceneTo = (t) => run(Math.ceil(t / 0.033) + 60, 33, 'sceneT', t);
const nightTod = async () => { for (const tod of [18000, 15000, 21000, 12000, 0, 3000]) { await ev((t) => VR.game.env.setTime(t), tod); await run(3); const up = await ev(() => VR.StoryPlay.ctx3(VR.game).sunUp); if (up === false) return tod; } return null; };
const trip = async (dim) => {
  await ev((d) => { window.__lastTrip = VR.Travel.last; VR.Travel.go(VR.game, { dim: d, via: 'cmd' }); }, dim);
  let s = null;
  for (let i = 0; i < 900; i++) { await run(10); s = await ev((d) => { const g = VR.game, L = VR.Travel.last; return { state: g.state, dim: g.dim, arrived: !!(L && L !== window.__lastTrip && L.to === d) }; }, dim); if (s.arrived && s.state === 'play') break; await wait(20); }
  check(s && s.dim === dim, 'the trip to ' + dim + ' (' + secs() + ')');
  if (s && s.dim === dim) await settle(18, dim);
  return s && s.dim === dim;
};
const play = async (id, t, name, tod) => {
  await ev((id) => VR.StoryPlay.debug.play(id), id);
  await sceneTo(t);
  const st = await ev(() => { const sc = VR.game.story.scene; return sc ? { id: sc.b.id, shot: sc.shot, fx: sc.fxKind || null, who: sc.lines.map(l => l.who).join(' ') } : null; });
  await draw(tod); const f = await shot(name);
  console.log('     ' + name + ' ' + JSON.stringify(st).slice(0, 300));
  return { st, f };
};
const skipScene = async () => { while (await ev(() => VR.StoryPlay.holds(VR.game))) { await ev(() => VR.game.story.skip()); await run(5); } };
// the drawn frame's luminance: its mean, the share of near-white pixels, the brightest 0.2 %'s place (x, y in 0…1)
const lum = () => ev(() => {
  const gl = VR.game.renderer.gl, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
  window.__norender = false; const g = VR.game; g.last = performance.now() - 33; window.__step(performance.now()); window.__norender = true;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let s = 0, n = 0, wh = 0; const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 16) { const L = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) | 0; s += L; n++; hist[L]++; if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) wh++; }
  let c = 0, p998 = 255; for (let L = 255; L >= 0; L--) { c += hist[L]; if (c > n * 0.002) { p998 = L; break; } }
  let p50 = 0; c = 0; for (let L = 0; L < 256; L++) { c += hist[L]; if (c > n * 0.5) { p50 = L; break; } }
  return { mean: +(s / n).toFixed(1), p50, p998, white: +(wh / n * 100).toFixed(2) };
});

try {
  await page.goto(DIST);
  const atTitle = () => ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title');
  for (let i = 0; i < 160; i++) { await wait(500); if (await atTitle()) break; }
  // ---------------------------------------------------------------- the music: offline renders (score2.mjs's way) of the waltz and the story cues
  if (want('audio')) {
    console.log('audio · the Mondstein waltz, Wiegelind\'s story cues (offline renders)');
    const OUT = ROOT + 'test/shots/story8_audio/'; fs.mkdirSync(OUT, { recursive: true });
    const wav = (file, i16, sr, ch) => { const b = Buffer.alloc(44 + i16.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + i16.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(i16.length * 2, 40); Buffer.from(i16.buffer, i16.byteOffset, i16.byteLength).copy(b, 44); fs.writeFileSync(file, b); };
    const R = [['waltz', 'waltz', 'night', 1, 3, 7, 1, 20], ['waltz_t0', 'waltz', 'night', 1, 0, 7, 1, 20], ['waltz_B', 'waltz', 'night', 1, 3, 7, 1, 44], ['st_warm', 'st_warm', 'day', 0, 3, 0, -1, 0], ['st_wide', 'st_wide', 'day', 0, 3, 0, -1, 0], ['st_rise', 'st_rise', 'day', 0, 3, 0, -1, 0], ['st_tense', 'st_tense', 'day', 0, 3, 0, -1, 0], ['p_zinn_B', 'p_zinn', 'day', 1, 3, 2, -1, 44], ['p_basalt', 'p_basalt', 'day', 1, 3, 11, -1, 20]];
    const summary = [];
    for (const [name, id, variant, lv, tier, seed, season, cap] of R) {
      const r = await ev(async ([id, variant, lv, tier, seed, season, cap]) => {
        const SR = 32000, full = VR.Score.cueLen(id, variant, seed), dur = cap ? Math.min(cap, full) : full, len = Math.ceil((dur + 4) * SR);
        const c = new OfflineAudioContext(2, len, SR); c.resume = () => Promise.resolve();   // (audio.js resumes its context: an offline one starts by rendering)
        let oscs = 0; const co = c.createOscillator.bind(c); c.createOscillator = () => { oscs++; return co(); };
        const a = new VR.Audio(); a.setTier(tier); a.init(c); a.setVolumes({ master: 1, music: 1 });
        a.music.plan = VR.Klang.musicPlan(12); a.scoreDay = 12;
        a.startCue({ id, variant, lv, at: 0.05, dur: full, seed, colour: '', season });
        a.run.stopAt = 0.05 + dur; a.pump(a.run, 0, 0.05 + dur);
        const buf = await c.startRendering();
        const L = buf.getChannelData(0), Rr = buf.getChannelData(1); let peak = 0;
        for (let i = 0; i < L.length; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (p > peak) peak = p; }
        const i16 = new Int16Array(L.length * 2);
        for (let i = 0; i < L.length; i++) { i16[2 * i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))); i16[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(Rr[i] * 32767))); }
        let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return { dur, full, oscs, notes: a.noteCount, peak, sr: SR, form: VR.Score.THEMES[id].sting ? 'A' : VR.Score.formOf(id, seed), insts: [...new Set(a.run.evs.filter(e => e.t < dur).map(e => e.inst + ':' + e.layer))].join(','), b64: btoa(s) };
      }, [id, variant, lv, tier, seed, season, cap]);
      const buf = Buffer.from(r.b64, 'base64'); wav(OUT + name + '.wav', new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2), r.sr, 2);
      const db = 20 * Math.log10(Math.max(1e-9, r.peak));
      summary.push({ name, id, tier, seed, form: r.form, dur: r.dur, oscs: r.oscs, notes: r.notes, peakDb: db, insts: r.insts });
      console.log('     ' + name.padEnd(9) + ' ' + r.form.padEnd(3) + ' ' + r.dur.toFixed(1) + ' s · ' + r.notes + ' notes · ' + (r.oscs / r.dur).toFixed(1) + ' osc/s · peak ' + db.toFixed(1) + ' dBFS · ' + r.insts.slice(0, 160));
      check(r.notes > 4 && db <= -0.5 && r.peak > 0.01, name + ': it sounds, no clipping');
    }
    fs.writeFileSync(OUT + 'summary.json', JSON.stringify(summary, null, 1));
    const S0 = (n) => summary.find(x => x.name === n);
    check(S0('waltz').insts.includes('choir:oo') && S0('waltz_B').form.includes('B') && S0('waltz_B').dur > 30, 'the waltz: the choir\'s line heard, its B-section rendered (' + S0('waltz_B').form + ')');
    check(S0('waltz_t0').oscs / S0('waltz_t0').dur < 10 * 0.6 * 4, 'Very Low: the waltz ' + (S0('waltz_t0').oscs / S0('waltz_t0').dur).toFixed(1) + ' osc/s (High ' + (S0('waltz').oscs / S0('waltz').dur).toFixed(1) + ')');
  }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Wiegenlied',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.env.wx.force('klar');
    const st = document.createElement('style'); st.textContent = '#hints,#lockhint,#toasts,.toast{display:none !important}'; document.head.appendChild(st);
    const A = VR.Adventure; A.setOn(true); A.setEnc('normal');
    window.__ft0 = (x, y, z) => { const b = g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !b || !(VR.R.T.flags[b] & VR.F.SOLID); };
    window.__c = { sceneT: (t) => { const s = g.story; return !s || !s.scene || s.scene.t >= t; } };
  });
  await settle(20, 'the world opened');


  // the frame's time: n drawn frames (gl.finish each), ms a frame
  const frameMs = (n) => ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); gl.finish(); } window.__norender = true; return +((performance.now() - t0) / n).toFixed(1); }, n);
  const preset = async (p) => { await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); }, p); await run(20); };
  const off6 = (on) => ev((on) => { VR.StoryNeb.off = !on; }, on);

  const st = () => ev(() => { const s = VR.game.story, sc = s && s.scene; return sc ? { id: sc.b.id, t: +sc.t.toFixed(1), shot: sc.shot, fx: sc.fxKind || null, who: sc.lines.map(l => l.who).join(' '), blocked: sc.blocked ? Object.keys(sc.blocked).join(',') : '' } : null; });
  const at = async (id, ts, names, tod) => {   // one scene, a picture at each time
    await ev((id) => { VR.game.story.lastScene = null; VR.StoryPlay.debug.play(id); }, id);
    const out = [];
    for (let i = 0; i < ts.length; i++) { await sceneTo(ts[i]); await draw(tod); const f = await shot(names[i]); const s = await st(); console.log('     ' + names[i] + ' ' + JSON.stringify(s)); out.push(s); }
    await skipScene(); return out;
  };
  const NIGHT = 17500, DUSK = 12600;
  const toward = (x, y, z, d, h) => ev(([x, y, z, d, h]) => { const g = VR.game, p = g.player; let e = null;
    for (let k = 0; k < 16 && !e; k++) { const a = k * Math.PI / 8, cx = x + Math.sin(a) * d, cz = z + Math.cos(a) * d, top = g.world.topAt(Math.floor(cx), Math.floor(cz)); if (top < 0) continue; const c = [cx, top + 1 + h, cz]; let ok = true; for (let s = 1; s <= 20 && ok; s++) { const u = s / 20 * 0.85; ok = window.__ft0(c[0] + (x - c[0]) * u, c[1] + 1.6 + (y + 1 - c[1] - 1.6) * u, c[2] + (z - c[2]) * u); } if (ok) e = c; }
    if (!e) { const top = g.world.topAt(Math.floor(x + d), Math.floor(z)); e = [x + d, top + 1, z]; }
    p.flying = false; p.noclip = false; p.teleport(e[0], e[1], e[2]); const dx = x - e[0], dz = z - e[2]; p.yaw = p.viewYaw = Math.atan2(-dx, -dz); p.pitch = 0; return e.map(v => +v.toFixed(1)); }, [x, y, z, d, h]);
  const fairyAt = async (kind) => { for (let i = 0; i < 40; i++) { const s = await ev((k) => { const F = VR.Fairy, S0 = F && F.state; const s = S0 && S0.sites.find(q => (!k || q.kind === k || q.id === k) && q.y !== null); return s ? { id: s.id, kind: s.kind, x: s.x, y: s.y, z: s.z } : (S0 && S0.sites[0] ? { far: S0.sites.map(q => q.id + '@' + q.x + ',' + q.z).join(' ') } : null); }, kind); if (s && s.id) return s; if (s && s.far && i % 5 === 0) { const m = /@(-?\d+),(-?\d+)/.exec(s.far); if (m) await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.teleport(+x + 20, 120, +z); }, [m[1], m[2]]); } await run(20); await wait(300); } return null; };
  await ev(() => { if (VR.game.funke) VR.game.funke.fresh = false; });   // (a fresh world hides Funke for its first 75 s of game time — an Arc-2 player is hours in)
  await ev(() => { const g = VR.game, r = g.story.rec; r.choices.c6 = 'lumi'; r.choices.how = 'build'; VR.StoryPlay.debug.reach('c13.b1'); });

  // ---------------------------------------------------------------- Herzwelt by night: 13 and 15
  if (want('herz')) {
    console.log('herz · Herzwelt at night');
    const tree = await fairyAt('tree');
    check(!!tree, 'the Schlummerbaum settled (' + JSON.stringify(tree) + ')');
    if (tree) {
      console.log('     stand ' + JSON.stringify(await toward(tree.x, tree.y, tree.z, 13, 0)));
      await ev((t) => VR.game.env.setTime(t), NIGHT); await settle(20, 'the tree');
      const ctx = await ev(() => { const c = VR.StoryPlay.ctxOf(VR.game, VR.game.story); return { fairy: Math.round(c.near.fairy), home: Math.round(c.near.home), hour: c.hour, why: VR.Story.why(VR.Story.byId('c13.b1'), Object.assign(c, { calm: 30 }), VR.game.story.rec) }; });
      console.log('     ctx ' + JSON.stringify(ctx));
      check(ctx.fairy < 45 && ctx.why === null, 'by the tree at night: c13.b1 holds, a fairy place near (' + ctx.fairy + ' m, why ' + ctx.why + ')');
      await ev(() => { const s = VR.game.story; VR.StoryPlay.debug.reach('c15.b1'); });
      await ev(() => { const s = VR.game.story; s.rec.choices.style = 'build'; VR.Story.markAct(s.rec, 'c15.b1'); VR.StoryPlay.debug.reach('c15.b2'); });
      await at('c15.b2', [17], ['c15_2_funke'], NIGHT);
      const ch = await ev(() => { const g = VR.game, s = g.story; VR.Story.mark(s.rec, 'c15.b2'); const ok = s.choose('stay'); return { ok, gift: s.rec.gift, n: VR.StoryArc2.stats.found }; });
      console.log('     chosen ' + JSON.stringify(ch));
      check(ch.ok && ch.gift && ch.gift.place.kind === 'circle', 'chosen: she stays — Wiegelinds Ruh founded');
      if (ch.gift) {
        const pc = ch.gift.place; await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.teleport(x + 30, 110, z + 30); }, [pc.x, pc.z]); await settle(14, 'the new place');
        const ws = await fairyAt('overworld:wiege');
        check(!!ws, 'the new place stands among the fairy places (' + JSON.stringify(ws) + ')');
        if (ws) { console.log('     stand ' + JSON.stringify(await toward(ws.x, ws.y, ws.z, 26, 0))); await settle(8, 'Wiegelinds Ruh'); }
        await at('c15.b3', [2.5, 10], ['c15_3_descend', 'c15_3_place'], NIGHT);
      }
    }
  }

  // ---------------------------------------------------------------- her place afterwards (outside a scene), then the Saatwiese
  if (want('visit')) {
    console.log('visit · Wiegelinds Ruh afterwards, the Saatwiese');
    const ws = await fairyAt('overworld:wiege');
    if (ws) {
      console.log('     stand ' + JSON.stringify(await toward(ws.x, ws.y, ws.z, 16, 0)));
      await ev((t) => VR.game.env.setTime(t), NIGHT); await settle(10, 'her place');
      const wi = await ev(() => { const S0 = VR.Fairy.state, s = S0.near; return { near: s && s.id, story: !!(s && s.story), wiege: !!(s && s.parts && s.parts.some(q => q.m === 'fy_wiege')), n: VR.StoryArc2b.stats.wiege }; });
      console.log('     place ' + JSON.stringify(wi));
      check(wi.near === 'overworld:wiege' && wi.wiege, 'Wiegelind rests at her place (outside a scene)');
      await ev(() => { const p = VR.game.player; p.pitch = 0.08; }); await draw(NIGHT); await shot('visit_ruh');
      console.log('     stand ' + JSON.stringify(await toward(ws.x, ws.y, ws.z, 4.5, 0)));
      await ev(() => { const p = VR.game.player; p.pitch = 0.22; }); await run(20); await draw(NIGHT); await shot('visit_close');
      const lm = await lum(); console.log('     lum ' + JSON.stringify(lm));
      // the other choice: she sows on (a second record) — the Saatwiese at the same spot
      const sw = await ev(() => { const g = VR.game, s = g.story; const keep = JSON.stringify(s.rec); window.__keepRec = keep; s.rec.gift = null; s.rec.choices.c15 = 'sow'; const ok = VR.StoryArc2.found(g, 'sow'); return { ok, kind: s.rec.gift && s.rec.gift.place.kind }; });
      check(sw.ok && sw.kind === 'shroom', 'the other choice founds Wiegelinds Saatwiese (' + JSON.stringify(sw) + ')');
      await settle(10, 'the Saatwiese');
      const ss = await fairyAt('overworld:wiege');
      if (ss) {
        console.log('     stand ' + JSON.stringify(await toward(ss.x, ss.y, ss.z, 12, 0))); await settle(6, 'the Saatwiese');
        const fo = await ev(() => { const s = VR.Fairy.state.near; return s ? { kind: s.kind, folk: s.folk.map(f => f.who).join(' ') } : null; });
        console.log('     folk ' + JSON.stringify(fo));
        check(fo && fo.kind === 'shroom' && /saemli/.test(fo.folk), 'the far Flausel settled at the Saatwiese');
        await ev(() => { VR.game.player.pitch = 0.05; }); await draw(NIGHT); await shot('visit_saat');
      }
      await ev(() => { const g = VR.game, s = g.story; s.rec = Object.assign(s.rec, JSON.parse(window.__keepRec)); g.meta.story = s.rec; VR.Fairy.state.key = ''; }); await settle(4, 'back to her rest');
    }
  }
  // ---------------------------------------------------------------- the Dreilichterfest at the village
  if (want('fest')) {
    console.log('fest · the village on the Dreilichterfest');
    await ev(() => { const g = VR.game, s = g.story; if (!s.rec.gift) { s.rec.choices.c15 = 'stay'; VR.Story.found(s.rec, { opt: 'stay', x: g.player.pos[0] + 60, z: g.player.pos[2] }, g.env.day | 0); } VR.StoryPlay.debug.reach('c16.b1'); });
    let V = null;
    for (let i = 0; i < 30 && !V; i++) { V = await ev(() => { const v = VR.StoryPlay.village(VR.game) || (VR.game.villages.sites[0] ? { s: VR.game.villages.sites[0] } : null); return v ? { x: v.s.x, y: v.s.y || 70, z: v.s.z } : null; }); if (!V) { await run(20); await wait(200); } }
    check(!!V, 'a village near (' + JSON.stringify(V) + ')');
    if (V) {
      await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x + 10, V.y + 30, V.z + 10); }, V); await settle(20, 'the village');
      const pz = await ev(() => { const H = VR.StoryArc2.homeNear(VR.game); return H ? { x: H.at.x, y: H.at.y, z: H.at.z } : null; });
      console.log('     stand ' + JSON.stringify(await toward(pz.x, pz.y, pz.z, 18, 0)));
      await ev((t) => VR.game.env.setTime(t), DUSK - 600); await run(300); await ev((t) => VR.game.env.setTime(t), DUSK - 400); await settle(30, 'nightfall: the village gathers'); await ev((t) => VR.game.env.setTime(t), DUSK);
      const fs0 = await ev(() => { const g = VR.game, v = [...g.villages.known.values()][0]; return { fest: v ? g.villages.festivalDay(v) : null, day: g.env.day, gift: g.story.rec.gift && g.story.rec.gift.fest, home: Math.round(VR.StoryPlay.ctxOf(g, g.story).near.home) }; });
      console.log('     festival ' + JSON.stringify(fs0));
      check(fs0.fest === true, 'the village celebrates the Dreilichterfest tonight');
      await at('c16.b1', [3, 10.5, 17], ['c16_1_fest', 'c16_1_round', 'c16_1_funke'], DUSK);
      const fx = await ev(() => VR.StoryArc2b.stats); console.log('     staged ' + JSON.stringify(fx));
      check(fx.stage > 0 && fx.folk > 0 && fx.rim > 0, 'the festival staged and drawn (people ' + fx.folk + '), Funke\'s rim light');
      await at('c16.b2', [4.5, 12, 20], ['c16_2_sky', 'c16_2_home', 'c16_2_funke'], DUSK);
    }
  }
  // ---------------------------------------------------------------- the costs: ms a drawn frame outside a scene and in one
  if (want('cost')) {
    console.log('cost · Very Low and High, outside a scene and in one (' + secs() + ')');
    for (const pr of ['potato', 'high']) {
      await preset(pr); console.log('     preset ' + pr + ' (' + secs() + ')'); await draw(null); await frameMs(8); N['out_' + pr] = await frameMs(8); console.log('     out ' + N['out_' + pr] + ' ms (' + secs() + ')');
      await ev(() => VR.StoryPlay.debug.play('c16.b1')); await sceneTo(4); await frameMs(4);
      const pf = async (k, n) => { const t0 = await ev(() => { const S0 = VR.StoryArc2b.stats; return [S0.ms, S0.draws, (VR.StoryPlay.stats.glows || 0)]; }); const ms = await frameMs(n); const t1 = await ev(() => { const S0 = VR.StoryArc2b.stats; return [S0.ms, S0.draws]; }); N[k + pr] = ms; N[k + pr + '_fest'] = +((t1[0] - t0[0]) / Math.max(1, t1[1] - t0[1])).toFixed(2); console.log('     ' + k + ' ' + ms + ' ms (the festival\'s people ' + N[k + pr + '_fest'] + ' ms a frame, ' + secs() + ')'); };
      await pf('in_', 6);
      await ev(() => { VR.StoryArc2b.off = true; }); await frameMs(2); await pf('inOff_', 6); await ev(() => { VR.StoryArc2b.off = false; });
      await skipScene();
    }
    N.brainMs = await ev(() => { const S0 = VR.StoryPlay.stats; return +(S0.brainMs / Math.max(1, S0.brains)).toFixed(3); });
    N.arc2 = await ev(() => VR.StoryArc2.stats);
    console.log('     costs ' + JSON.stringify({ out_potato: N.out_potato, in_potato: N.in_potato, inOff_potato: N.inOff_potato, out_high: N.out_high, in_high: N.in_high, inOff_high: N.inOff_high, fest: [N.in_potato_fest, N.in_high_fest], brainMs: N.brainMs, arc2: N.arc2, b: await ev(() => VR.StoryArc2b.stats) }));
    save();
  }
} catch (e) { fails++; console.log('  ✗ stopped: ' + (e.stack || e.message).slice(0, 900)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ').slice(0, 600) : ''));
save();
try {
  const P = (n) => SHOTS + 's8_' + n + '.png', ex = (n) => fs.existsSync(P(n));
  const rows = [['15 · Funke (von vorn, Randlicht) · Wiegelind sinkt herab · Wiegelinds Ruh', ['c15_2_funke', 'c15_3_descend', 'c15_3_place']],
    ['danach: Wiegelinds Ruh · nah · Wiegelinds Saatwiese', ['visit_ruh', 'visit_close', 'visit_saat']],
    ['16 · das Dreilichterfest · im Kreis · Funke', ['c16_1_fest', 'c16_1_round', 'c16_1_funke']], ['16 · das letzte Bild: der Himmel · das Dorf · Funke', ['c16_2_sky', 'c16_2_home', 'c16_2_funke']]]
    .map(([label, ns]) => ({ label, imgs: ns.filter(ex).map(P) })).filter(r => r.imgs.length);
  fs.writeFileSync(ROOT + '.tmp_tests/story8_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'story8_sheet.jpg', ROOT + '.tmp_tests/story8_sheet.json']);
  console.log('     sheet test/shots/story8_sheet.jpg');
} catch (e) { console.log('  (the sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
await browser.close();
console.log((fails ? 'FAILED ' + fails : 'ALL OK') + ' (' + secs() + ')');
process.exit(fails ? 1 : 0);

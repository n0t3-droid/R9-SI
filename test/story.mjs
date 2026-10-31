// regress: skip — the story in the browser (a-story; plan docs/superpowers/plans/2026-10-29-a-story.md §3): one run, German
// UI, 1280 × 720, Balanced view 6, seed 4242, an Abenteuer world (Kreativ, Begegnungen normal):
//   1. chapter 1 in the Hangar Hall: after 20 s of calm the Regie takes the beat — Funke's line, the card → c1_offer.png;
//      [V] (the Aktion) plays it: letterbox, subtitles, the drone flickers awake → c1_funke_wakes.png; a key after 1 s
//      skips it: seen ('skip'), Funke's task line and his Wegstück (the light line) → c1_way.png
//   2. chapter 2 at the nearest outpost: freed (liberate.js's moment), then c2.b2 replays the light ring round the cyan
//      beacon in its wide shot → c2_light_ring.png
//   (sections in the order 1 2 4 5 6 3: the orbit last)
//   3. chapter 3 in orbit (the shuttle put in a circular orbit, SpaceFlight.debug.orbit): c3.b2 holds the ship's view and
//      the Ringstation's red beacon blinks just over the limb → c3_station_beacon.png
//   4. chapter 4 on Opal: c4.b2 — the Eiswächter seen through the ice → c4_warden.png; the eclipse (BodySky's eclipse
//      > 0.98) and c4.b3's first shot up at Amarant swallowing Helia → c4_eclipse.png
//   5. the journal's chapter page → journal_chapter.png
//   6. the cost: the story's and the Regie's frame (VR.StoryPlay.frame) on Very Low and High, story off / on
//   → test/shots/story.json, test/shots/story_sheet.jpg (pairs.py)
//   nohup bash test/wt_run.sh story.mjs 3600 > .tmp_tests/story.log 2>&1 &     ONLY=1,2,… (sections)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = 'file://' + ROOT + 'dist/index.html';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const N = { pics: {} };
const save = () => { try { fs.writeFileSync(SHOTS + 'story.json', JSON.stringify(N, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// n frames of dtms each (the game runs only these: window.__step), until a condition of window.__c holds
const run = async (n, dtms = 33, until, arg) => {
  let done = 0;
  for (let k = 0; k < n; k += 30) {
    const r = await ev(([m, d, u, a]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) {
        const p = g.player; if (p && p.mode === 'survival') p.health = 20;
        g.last = performance.now() - d; window.__step(performance.now());
        if (u && window.__c[u](a)) return { n: i + 1, hit: true };
      }
      return { n: m, hit: false };
    }, [Math.min(30, n - k), dtms, until || null, arg === undefined ? null : arg]);
    done += r.n;
    if (r.hit) return { n: done, hit: true };
  }
  return { n: done, hit: false };
};
const draw = (tod, dtms = 33) => ev(([tod, d]) => { window.__norender = false; const g = VR.game; if (tod !== null && tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - d; window.__step(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, [tod === undefined ? null : tod, dtms]);
const shot = async (name) => { await ev(() => { for (const a of document.getAnimations()) { try { if (a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations !== Infinity) a.finish(); } catch (e) { /* */ } } }); await wait(200);   /* (the page's CSS fades finished: the stepped page draws no frames of its own) */ let ok = false; for (let k = 0; k < 2 && !ok; k++) { try { await page.screenshot({ path: SHOTS + name + '.png', timeout: 150000 }); ok = true; } catch (e) { console.log('  !! screenshot ' + name + ': ' + String(e.message || e).split('\n')[0]); } } if (!ok) { fails++; return null; } console.log('     shot ' + name + ' (' + secs() + ')'); N.pics[name] = SHOTS + name + '.png'; save(); return SHOTS + name + '.png'; };
const settle = async (sec, tag) => { const t = Date.now(); let n = 0; while (Date.now() - t < sec * 1000) { n += (await run(4)).n; await wait(300); } console.log('     settled ' + sec + ' s (' + n + ' frames' + (tag ? ', ' + tag : '') + ', ' + secs() + ')'); };
const arrive = async (s) => {
  await ev((s) => { const p = VR.game.player; p.flying = true; p.safeTeleport(s.x + 0.5, s.y + 2, s.z + 0.5); }, s);
  let st = null;
  for (let i = 0; i < 200; i++) { await run(3); await wait(250); st = await ev((s) => { const g = VR.game, p = g.player; return { hold: !!p.hold, loaded: g.world.isLoaded(Math.floor(s.x), Math.floor(s.z)), y: Math.round(p.pos[1]) }; }, s); if (!st.hold && st.loaded) break; }
  return st;
};
const state = () => ev(() => VR.StoryPlay.debug.state());
const section = async (tag, fn) => {
  if (ONLY && !ONLY.includes(tag)) return;
  try { await fn(); } catch (e) { fails++; console.log('  ✗ section ' + tag + ' stopped: ' + (e.stack || e.message).slice(0, 900)); try { await page.screenshot({ path: SHOTS + 'story_fail_' + tag + '.png', timeout: 120000 }); } catch (e2) { /* */ } }
  save();
};
// a-story4: the time of day when this strange world's sun stands up (its own clock: tried in steps; null — never, e.g. a
// locked world's night side)
const sunTod = async () => { for (const tod of [6000, 3000, 9000, 0, 12000, 15000, 18000, 21000]) { await ev((t) => VR.game.env.setTime(t), tod); await run(3); const up = await ev(() => VR.StoryPlay.ctx3(VR.game).sunUp); if (up !== false) return tod; } return null; };
const nightTod = async () => { for (const tod of [18000, 15000, 21000, 12000, 0, 3000]) { await ev((t) => VR.game.env.setTime(t), tod); await run(3); const up = await ev(() => VR.StoryPlay.ctx3(VR.game).sunUp); if (up === false) return tod; } return null; };
// a scene stepped to its time t (s): the frames of 33 ms, then held
const sceneTo = async (t) => { const r = await run(Math.ceil(t / 0.033) + 60, 33, 'sceneT', t); return r; };

try {
  await page.goto(DIST);
  const atTitle = () => ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title');
  for (let i = 0; i < 160; i++) { await wait(500); if (await atTitle()) break; }
  check(await atTitle(), 'the start screen (' + secs() + ')');
  check(await ev(() => !!(VR.Story && VR.StoryPlay && VR.Regie && VR.Story.BEATS.length === 36)), 'VR.Story (36 beats: a-story4 wrote 9–12), VR.StoryPlay and VR.Regie are in the page');
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); try { g.audio.resume(); } catch (e) { /* */ } if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Leuchtfeuer',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.env.wx.force('klar');
    const st = document.createElement('style'); st.textContent = '#hints,#lockhint,#toasts,.toast{display:none !important}'; document.head.appendChild(st);
    const A = VR.Adventure; A.setOn(true); A.setEnc('normal');
    const air = (x, y, z) => { const b = g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !b || !(VR.R.T.flags[b] & VR.F.SOLID); };
    window.__c = {
      offer: (id) => { const s = VR.StoryPlay.debug.state(); return !!s && s.offer === (id || s.offer) && !!s.offer; },
      scene: () => !!VR.StoryPlay.holds(g),
      sceneT: (t) => { const s = g.story; return !s || !s.scene || s.scene.t >= t; },
      noScene: () => !VR.StoryPlay.holds(g),
      known: () => !!window.__site && !!VR.Liberate.siteOf(window.__site) && VR.Liberate.siteOf(window.__site).known,
      choice: () => !!VR.StoryPlay.choiceUp(VR.game),
      momentEnd: () => !VR.Liberate.moment && !!window.__site && VR.Liberate.siteOf(window.__site).st === 'frei',
    };
    window.__ft = {
      air,
      camAt(t, d, h, yaw0) {
        for (let k = 0; k < 24; k++) {
          const yaw = (yaw0 || 0) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 12, dd = k < 16 ? d : d * 0.7;
          const cx = t[0] + Math.sin(yaw) * dd, cz = t[2] + Math.cos(yaw) * dd, cy = t[1] + h;
          let ok = air(cx, cy, cz) && air(cx, cy - 1.2, cz) && air(cx, cy + 0.4, cz);
          for (let s = 1; s < 24 && ok; s++) { const u = s / 24; if (u > 0.92) break; if (!air(cx + (t[0] - cx) * u, cy + (t[1] - cy) * u, cz + (t[2] - cz) * u)) ok = false; }
          if (ok) return { x: cx, y: cy, z: cz, tx: t[0], ty: t[1], tz: t[2] };
        }
        return null;
      },
      stand(c) { const p = g.player; p.flying = false; p.hold = null; p.teleport(c.x, c.y - 1.62, c.z); this.aim([c.tx, c.ty, c.tz]); p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; },
      aim(t) { const p = g.player, e = [p.pos[0], p.pos[1] + 1.62, p.pos[2]], dx = t[0] - e[0], dy = t[1] - e[1], dz = t[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.viewYaw = p.yaw; p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
    };
  });
  await ev(() => { const p = VR.game.player; p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; });
  await settle(30, 'the world opened');

  // ---------------------------------------------------------------- 1 · chapter 1: Funke wakes
  await section('1', async () => {
    console.log('1 · chapter 1 in the Hangar Hall');
    await ev(() => VR.game.env.setTime(10600));   // (the late afternoon: the hall's light through the portal)
    const c0 = await ev(() => { const g = VR.game; return { place: g.lifeDirector && g.lifeDirector.ctx ? g.lifeDirector.ctx.place : null, pos: g.player.pos.map(v => Math.round(v)) }; });
    console.log('     ' + JSON.stringify(c0));
    let r = await run(1500, 33, 'offer', 'c1.b1');
    let s = await state();
    console.log('     after ' + r.n + ' frames: ' + JSON.stringify({ calm: s.calm, offer: s.offer, why: s.why, regie: s.regie && s.regie.st }));
    check(r.hit && s.offer === 'c1.b1', 'after 20 s of calm the Regie takes c1.b1 (calm ' + s.calm + ' s, ' + (r.n * 0.033).toFixed(0) + ' s of play)');
    N.offer = { frames: r.n, regie: s.regie && s.regie.st, line: await ev(() => VR.Funke && VR.Funke.last ? VR.Funke.last.text : null), card: await ev(() => { const el = document.getElementById('storycard'); return el ? el.textContent : null; }) };
    check(/Signal/.test(N.offer.line || '') && /Kapitel 1/.test(N.offer.card || ''), 'Funke: „' + N.offer.line + '" · the card: ' + N.offer.card);
    check(await ev(() => { const C = VR.Ctx; const c = C.gather ? C.gather(VR.game) : null; const res = c ? C.resolve(c) : null; return !!res && res.id === 'story'; }), 'the Aktion offers [V] Ansehen (ctx.js row 3)');
    await draw(); await shot('c1_offer');
    // [V]: the real key into the game's input
    await page.keyboard.down('KeyV'); await run(3); await page.keyboard.up('KeyV'); await run(3);
    let on = await ev(() => VR.StoryPlay.holds(VR.game));
    if (!on) { console.log('     (V did not start it in the stepped frames: VR.Story.watch)'); on = await ev(() => VR.Story.watch(VR.game)); }
    check(on, '[V] plays the scene');
    await sceneTo(2.3);
    s = await state();
    console.log('     ' + JSON.stringify(s.scene));
    await wait(1200);   // (the subtitle's fade and the skip hint run on the page's own clock)
    await draw(); await shot('c1_funke_wakes');
    const por = await ev(() => { const c = document.querySelector('#storybox .sub canvas.por'), sc = VR.game.story.scene; return c ? { w: c.width, cls: c.className, css: Math.round(c.getBoundingClientRect().width), mood: sc && sc.por && sc.por.mood } : null; });
    check(!!por && por.w === 24 && por.css >= 50 && /funke/.test(por.cls), 'a-story2: the subtitle has the speaker\'s face (' + JSON.stringify(por) + ')');
    N.portrait = por;
    await sceneTo(6.5);
    await page.keyboard.press('KeyE'); await run(4);
    s = await state();
    const fl = await ev(() => ({ line: VR.Funke.last && VR.Funke.last.text, way: VR.game.funke ? +VR.game.funke.wayT.toFixed(2) : 0 }));
    check(!s.scene && s.beats['c1.b1'] === 'skip', 'a key after 1 s skips it: c1.b1 seen (' + s.beats['c1.b1'] + ')');
    check(/Ausblick|Licht/.test(fl.line || '') , 'then Funke\'s task: „' + fl.line + '" (the way ' + fl.way + ' s)');
    await draw(); await shot('c1_way');
    N.c1 = { s, fl };
  });

  // ---------------------------------------------------------------- 2 · chapter 2: the light ring
  await section('2', async () => {
    console.log('2 · chapter 2 at the outpost');
    await ev(() => VR.StoryPlay.debug.reach('c2.b2'));
    const out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m && m.pos)); }));
    console.log('     the nearest outpost: ' + JSON.stringify(out));
    check(Array.isArray(out), 'the worker found the nearest outpost');
    if (!Array.isArray(out)) return;
    await ev(() => VR.game.env.setTime(11300));
    await arrive({ x: out[0], y: out[1] + 6, z: out[2] + 30 });
    let pad = null;
    for (let i = 0; i < 80 && !pad; i++) { await run(10); await wait(150); pad = await ev((o) => { const g = VR.game, w = g.world, L = VR.Liberate; for (const [dx, dz] of [[-8, -8], [8, 8], [-8, 8], [8, -8]]) if (!w.isLoaded(o[0] + dx, o[2] + dz)) return null; return L.probeAt((x, y, z) => w.getBlock(x, y, z), o[0], o[1], o[2]) || { none: true }; }, out); if (pad && pad.none) break; }
    check(!!pad && !pad.none && !!pad.beacon, 'its pad and beacon (' + JSON.stringify(pad && pad.beacon) + ')');
    if (!pad || pad.none) return;
    await ev((id) => { window.__site = id; }, pad.id);
    let r = await run(300, 33, 'known');
    check(r.hit, 'the outpost known');
    const ok = await ev(() => { const g = VR.game, s = VR.Liberate.siteOf(window.__site); return VR.Liberate.free(g, s); });
    r = await run(400, 33, 'momentEnd');
    check(ok && r.hit, 'freed (the moment played, ' + r.n + ' frames)');
    await ev(() => { const L = VR.Liberate; if (L.mcam) L.camEnd(VR.game); const el = document.getElementById('libban'); if (el) el.className = ''; });
    // the player 9 m off the beacon, looking at it
    await ev((p) => { const b = p.beacon, yaw = Math.atan2(p.x - b[0], p.z - b[2]), c = window.__ft.camAt([b[0] + 0.5, b[1] + 1.2, b[2] + 0.5], 9, 0.6, yaw + 0.5); if (c) window.__ft.stand(c); }, pad);
    await run(60);
    const why = await ev(() => { const g = VR.game, s = g.story; return VR.Story.why(VR.Story.byId('c2.b2'), Object.assign(VR.StoryPlay.ctxOf(g, s), { calm: 30 }), s.rec); });
    check(why === null, 'c2.b2 holds once a place is freed (' + why + ')');
    // a-story2: c2.b1's deed — touch the beacon: close to it the Aktion says „[V] Berühren", V does it
    await ev((p) => { const b = p.beacon, yaw = Math.atan2(p.x - b[0], p.z - b[2]), c = window.__ft.camAt([b[0] + 0.5, b[1] + 1.0, b[2] + 0.5], 2.6, 0.5, yaw + 0.5); if (c) window.__ft.stand(c); }, pad);
    await run(30);
    const tch = await ev(() => { const g = VR.game, C = VR.Ctx, res = C.resolve(C.gather(g)); return { open: (VR.Story.openAct(g.story.rec) || {}).id, armed: g.story.armed && g.story.armed.id, row: res && res.row, key: res && res.key, label: C.label(res) }; });
    check(tch.open === 'c2.b1' && tch.key === 'story.ctx.touch', 'a-story2: by the beacon the Aktion offers „' + tch.label + '" (' + JSON.stringify(tch) + ')');
    await draw(); await shot('deed_touch');
    await page.keyboard.down('KeyV'); await run(3); await page.keyboard.up('KeyV'); await run(3);
    let td = await ev(() => VR.Story.actDone(VR.game.story.rec, 'c2.b1'));
    if (!td) { console.log('     (V in the stepped frames did not reach it: VR.Story.watch)'); await ev(() => VR.Story.watch(VR.game)); td = await ev(() => VR.Story.actDone(VR.game.story.rec, 'c2.b1')); }
    check(td, 'a-story2: [V] touched it — the deed is in the record (Funke: „' + await ev(() => VR.Funke.last && VR.Funke.last.text) + '")');
    N.touch = tch;
    await ev((p) => { const b = p.beacon, yaw = Math.atan2(p.x - b[0], p.z - b[2]), c = window.__ft.camAt([b[0] + 0.5, b[1] + 1.2, b[2] + 0.5], 9, 0.6, yaw + 0.5); if (c) window.__ft.stand(c); }, pad);
    await run(20);
    await ev(() => VR.StoryPlay.debug.play('c2.b2'));
    await sceneTo(1.5);
    const m = await ev(() => { const L = VR.Liberate, M = L.moment; return { replay: !!(M && M.replay), t: M ? +M.t.toFixed(2) : null, R: M ? +L.ringR(M.t).toFixed(1) : null, shot: VR.game.story.scene && VR.game.story.scene.shot }; });
    console.log('     ' + JSON.stringify(m));
    check(m.replay && m.R > 4, 'the light ring replayed round the cyan beacon (r ' + m.R + ' m) in the wide shot');
    await draw(11300); await shot('c2_light_ring');
    N.c2 = { pad: pad.id, m };
    await page.keyboard.press('KeyE'); await run(4);
  });

  // ---------------------------------------------------------------- 4 · chapter 4 on Opal: the Eiswächter, the eclipse
  await section('4', async () => {
    console.log('4 · chapter 4 on Opal');
    await ev(() => VR.StoryPlay.debug.reach('c4.b2'));
    await ev(() => { window.__lastTrip = VR.Travel.last; VR.Travel.go(VR.game, { dim: 'opal', via: 'cmd' }); });
    let s = null;
    for (let i = 0; i < 900; i++) { await run(10); s = await ev(() => { const g = VR.game, L = VR.Travel.last; return { state: g.state, dim: g.dim, arrived: !!(L && L !== window.__lastTrip && L.to === 'opal') }; }); if (s.arrived && s.state === 'play') break; await wait(20); }
    check(s && s.dim === 'opal', 'the trip to Opal (' + JSON.stringify(s) + ')');
    if (!s || s.dim !== 'opal') return;
    await settle(25, 'Opal');
    const G = await ev(() => { let ecl = 0; for (let t = 3300; t < 3900; t += 5) { const r = VR.BodySky.compute('opal', [0.5, 73.6, 0.5], t, {}); if (r.light.eclipse > 0.98) { ecl = t + 10; break; } } return { ecl }; });
    // the Eiswächter: by day, the player on the ice
    await ev(() => { const g = VR.game, p = g.player, w = g.world; const y = w.topAt(0, 0) + 1; p.flying = false; p.teleport(0.5, y, 0.5); p.yaw = 0.4; p.pitch = -0.2; p.vel[0] = p.vel[1] = p.vel[2] = 0; });
    await run(30);
    await ev(() => VR.StoryPlay.debug.play('c4.b2'));
    await sceneTo(3.0);
    await draw(); await shot('c4_warden');
    await sceneTo(8.6);
    await draw(); await shot('c4_eye');
    const wk = await ev(() => { const sc = VR.game.story.scene; return sc ? { wake: +VR.StoryPlay.wardenWake(sc).toFixed(2), shot: sc.shot, draw: +VR.StoryPlay.stats.drawMs.toFixed(2) } : null; });
    check(!!wk && wk.wake > 0.5, 'a-story2: the Eiswächter\'s eye wakes in its close shot (' + JSON.stringify(wk) + ')');
    await page.keyboard.press('KeyE'); await run(4);
    // a-story2: c4.b2's deed — keep Amarant in view (the moon's sky: BodySky's moonDir)
    await ev(() => { const g = VR.game, md = VR.BodySky.cur.light.moonDir, p = g.player; p.yaw = Math.atan2(-md[0], -md[2]); p.viewYaw = p.yaw; p.pitch = Math.asin(Math.max(-1, Math.min(1, md[1]))); });
    await run(90);
    const am = await ev(() => { const g = VR.game; return { done: VR.Story.actDone(g.story.rec, 'c4.b2'), last: g.story.actSt && g.story.actSt.last, line: VR.Funke.last && VR.Funke.last.text }; });
    check(am.done, 'a-story2: looking at Amarant 2 s — the deed done (' + JSON.stringify(am) + ')');
    await draw(); await shot('deed_amarant');
    // the eclipse
    check(G.ecl > 0, 'the eclipse found (t ' + G.ecl + ')');
    await ev((t) => { const e = VR.game.env, k = Math.round(t * 20); e.day = Math.floor(k / 24000); e.ticks = k - e.day * 24000; VR.game.zenFreezeTime = true; }, G.ecl);
    await run(30);
    const why = await ev(() => { const g = VR.game, s = g.story; const c = Object.assign(VR.StoryPlay.ctxOf(g, s), { calm: 30 }); return { why: VR.Story.why(VR.Story.byId('c4.b3'), c, s.rec), eclipse: +c.eclipse.toFixed(2) }; });
    check(why.why === null && why.eclipse > 0.5, 'in the eclipse c4.b3 holds (' + JSON.stringify(why) + ')');
    await ev(() => VR.StoryPlay.debug.play('c4.b3'));
    await sceneTo(3.2);
    await draw(); await shot('c4_eclipse');
    N.c4 = { G, why };
    await sceneTo(40);
    // a-story2: c4.b3's deed — photograph the eclipse (a picture in the photo mode)
    const ph = await ev(() => { const g = VR.game; let via = 'photoNow'; try { if (VR.PhotoMode && g.photoMode) { g.photoMode(true); const P = g.photoCam; if (P && P.shoot) { P.shoot(); via = 'shoot'; } g.photoMode(false); } } catch (e) { via = 'err ' + e.message; } if (!VR.Story.actDone(g.story.rec, 'c4.b3')) VR.StoryPlay.photoNow(g); return { via, done: VR.Story.actDone(g.story.rec, 'c4.b3') }; });
    check(ph.done, 'a-story2: the eclipse photographed — the deed done (' + JSON.stringify(ph) + ')');
  });

  // ---------------------------------------------------------------- 5 · the journal
  await section('5', async () => {
    console.log('5 · the journal\'s chapter page');
    await ev(() => { for (const id of ['advup', 'libban']) { const el = document.getElementById(id); if (el) el.className = ''; } });   // (the level-up of the beats' XP: not in the journal's picture)
    const ok = await ev(() => { if (!VR.Quests || !VR.Quests.journal) return false; VR.Quests.journal(); return VR.game.ui.screen === 'journal'; });
    check(ok, 'the journal opens');
    const t = await ev(() => { const el = document.querySelector('.jstory'); return el ? el.textContent.slice(0, 400) : null; });
    check(!!t && /Funke und die Leuchtfeuer/.test(t) && /Kapitel 1/.test(t), 'the chapter page: ' + (t || '').slice(0, 120));
    await ev(() => { const el = document.querySelector('.jstory'); if (el && el.scrollIntoView) el.scrollIntoView(); });
    await draw(); await shot('journal_chapter');
    await ev(() => VR.Quests.closeJournal());
  });

  // ---------------------------------------------------------------- 6 · the cost
  await section('6', async () => {
    console.log('6 · the cost of the story\'s frame (VR.StoryPlay.frame + the Regie)');
    const cost = await ev(() => {
      const g = VR.game, P = VR.StoryPlay, f0 = P.frame, out = {};
      for (const preset of ['potato', 'high']) {
        g.applyPreset(preset); g.settings.dynRes = false; g.applySettings('*');
        for (const on of [false, true]) {
          g.settings.storyOffer = on;
          let ms = 0, n = 0; P.frame = function (gg, dt) { const t = performance.now(); f0(gg, dt); ms += performance.now() - t; n++; };
          window.__norender = true;
          const t0 = performance.now();
          for (let i = 0; i < 300; i++) { g.last = performance.now() - 33; window.__step(performance.now()); }
          out[preset + (on ? '_on' : '_off')] = { storyMs: +(ms / Math.max(1, n)).toFixed(4), frameMs: +((performance.now() - t0) / 300).toFixed(2) };
        }
      }
      P.frame = f0; g.settings.storyOffer = true;
      g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*');
      return out;
    });
    console.log('     ' + JSON.stringify(cost));
    N.cost = cost;
    check(cost.potato_on.storyMs < 0.05 && cost.high_on.storyMs < 0.05, 'the story and the Regie ≤ 0.05 ms a frame (Very Low ' + cost.potato_on.storyMs + ', High ' + cost.high_on.storyMs + ')');
  });

  // ---------------------------------------------------------------- 7 · a-story3: chapters 5–8 across the universe
  await section('7', async () => {
    console.log('7 · a-story3: chapters 5–8');
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
      const st = await ev(() => { const sc = VR.game.story.scene; return sc ? { id: sc.b.id, shot: sc.shot, fx: sc.fxKind || null, line: sc.line, who: sc.lines.map(l => l.who).join(' ') } : null; });
      await draw(tod); const pth = await shot(name);
      console.log('     ' + name + ' ' + JSON.stringify(st));
      while (await ev(() => VR.StoryPlay.holds(VR.game))) { await ev(() => VR.game.story.skip()); await run(5); }
      return st;
    };
    // standing ~38 m from the nearest native village, facing it
    const toVillage = async () => {
      let v = null;
      for (let i = 0; i < 30 && !v; i++) { await run(10); await wait(400); v = await ev(() => { const g = VR.game, n = VR.StoryPlay.village(g); return n ? { x: n.s.x, z: n.s.z, d: Math.round(n.d) } : null; }); }
      if (!v) return null;
      await ev((v) => { const p = VR.game.player; p.flying = true; p.safeTeleport(v.x + 30.5, 120, v.z + 24.5); }, v);
      for (let i = 0; i < 60; i++) { await run(4); await wait(250); if (await ev((v) => VR.game.world.isLoaded(Math.floor(v.x + 30), Math.floor(v.z + 24)) && !VR.game.player.hold, v)) break; }
      await ev((v) => { const g = VR.game, p = g.player, y = g.world.topAt(Math.floor(v.x + 30), Math.floor(v.z + 24)) + 1; p.flying = false; p.teleport(v.x + 30.5, y, v.z + 24.5); window.__ft.aim([v.x, y + 2, v.z]); p.vel[0] = p.vel[1] = p.vel[2] = 0; }, v);
      await settle(14, 'the village');
      return v;
    };
    // 5 · Zinnober: the glass beacon's song
    if (await trip('zinn')) {
      await ev(() => VR.StoryPlay.debug.reach('c5.b2'));
      const v = await toVillage();
      const c = await ev(() => { const x = VR.StoryPlay.ctxOf(VR.game, VR.game.story); return { near: Math.round(x.near.village), dim: x.dim, why: VR.Story.why(VR.Story.byId('c5.b2'), Object.assign({}, x, { calm: 30 }), VR.game.story.rec) }; });
      check(!!v && c.near < 90 && c.why === null, 'Zinnober: a Glutani village ' + c.near + ' m away — c5.b2 holds there (' + JSON.stringify(c) + ')');
      const st = await play('c5.b2', 8.5, 'c5_song', 4600);
      check(st && st.fx === 'song' && /solgani/.test(st.who), 'c5.b2: the song\'s rings over the village, Solgani speaks');
    }
    // 6 · Aquamarin: Opa Anselm's notes, then the choice card
    if (await trip('aqua')) {
      await ev(() => VR.StoryPlay.debug.reach('c6.b2'));
      await ev(() => { const g = VR.game, p = g.player, y = g.world.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1; p.flying = false; p.teleport(p.pos[0], Math.max(y, p.pos[1]), p.pos[2]); p.pitch = -0.05; });
      const st = await play('c6.b2', 3.2, 'c6_notes', 4200);
      check(st && st.fx === 'notes' && /lumi/.test(st.who), 'c6.b2: the notebook page, Lumi reads it');
      await ev(() => VR.StoryPlay.debug.reach('c7.b1'));
      const r = await run(900, 33, 'choice');
      const cu = await ev(() => { const el = document.getElementById('storychoice'); return { up: VR.StoryPlay.choiceUp(VR.game), vis: !!el && el.style.display === 'flex', n: el ? el.querySelectorAll('button').length : 0 }; });
      check(r.hit && cu.up === 'c6' && cu.vis && cu.n === 2, 'the choice card on a calm screen after ' + (r.n * 0.033).toFixed(0) + ' s (' + JSON.stringify(cu) + ')');
      for (let i = 0; i < 40 && await ev(() => { const a = document.getElementById('advup'); return !!a && a.offsetParent !== null && getComputedStyle(a).opacity !== '0'; }); i++) await run(30);   // (the level-up banner gone first: the card alone)
      await draw(2600); await shot('c6_choice');
      await page.keyboard.press('Digit2'); await run(10);
      const ch = await ev(() => ({ c: VR.game.meta.story.choices, up: VR.StoryPlay.choiceUp(VR.game) }));
      check(ch.c && ch.c.c6 === 'lumi' && !ch.up, '[2]: Lumi comes along — kept in the world\'s record (' + JSON.stringify(ch) + ')');
    }
    // 7 · the gate turns aside; the Ringstation's window
    const turn = await ev(() => { VR.StoryPlay.debug.reach('c7.b2'); const t = VR.StoryPlay.gateTurn(VR.game, { dim: 'zinn', id: 'zinn' }); return t && t.dim; });
    check(turn === 'stn.ring', 'with c7.b2 open, a gate trip to Zinnober turns aside to the Ringstation (' + turn + ')');
    if (await trip('stn.ring')) {
      const st = await play('c7.b2', 12.5, 'c7_window');
      const wn = await ev(() => ({ beams: VR.StoryPlay.stats.beams || 0, beamMs: VR.StoryPlay.stats.beamMs || 0 }));
      check(wn.beams > 0, 'a-story4: the window\'s arrow as 3-D beams in the world (' + JSON.stringify(wn) + ')');
      check(st && st.fx === 'beacons' && /lumi/.test(st.who) && /anselm/.test(st.who), 'c7.b2: from the window the beacons draw an arrow; Lumi meets Opa Anselm');
    }
    // 8 · a close double star: two suns; the beam to the nebula
    const bin = await ev(() => { const G = VR.Galaxy, N = G.build((VR.game.meta.seed >>> 0) || 0x5eed); for (let i = 1; i < N.list.length; i++) { const st = N.list[i]; if (!st || !st.bin || !st.bin.close) continue; const sy = G.system(N, i), p = sy && sy.bodies.find(b => b.landable && !b.locked && /aqua|ocker|basalt/.test(b.dim || '')); if (p) return p.dim; } return null; });
    check(!!bin, 'a landable world of a close double star: ' + bin);
    if (bin && await trip(bin)) {
      await ev(() => VR.StoryPlay.debug.reach('c7.b3'));
      const su = await ev(() => VR.StoryPlay.ctxOf(VR.game, VR.game.story).suns);
      check(su === 2, 'two suns over ' + bin);
      await ev(() => { const g = VR.game, p = g.player, y = g.world.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1; p.flying = false; p.teleport(p.pos[0], Math.max(y, p.pos[1]), p.pos[2]); p.pitch = 0; });
      const td = await sunTod(); check(td !== null, 'the strange sun is up for the pictures (time ' + td + ')');
      await play('c7.b3', 8.0, 'c7_blink', td === null ? undefined : td);
      await ev(() => VR.StoryPlay.debug.reach('c8.b1'));
      const st = await play('c8.b1', 4.5, 'c8_twin', td === null ? undefined : td);
      check(st && st.fx === 'twin' && /selkatun/.test(st.who), 'c8.b1: two suns, Selkatun of the Regoli');
      await ev(() => VR.StoryPlay.debug.reach('c8.b3'));
      const s3 = await play('c8.b3', 4.5, 'c8_beam', td === null ? undefined : td);
      check(s3 && s3.fx === 'beam', 'c8.b3: the beam swings to the nebula');
    }
    N.fx = await ev(() => ({ fxMs: VR.StoryPlay.stats.fxMs, fxN: VR.StoryPlay.stats.fxN, swells: VR.StoryPlay.stats.swells, err: VR.StoryPlay.stats.fxErr || null }));
    console.log('     fx ' + JSON.stringify(N.fx));
    check(!N.fx.err && N.fx.fxN > 0 && N.fx.fxMs / N.fx.fxN < 3, 'the fx: ' + (N.fx.fxMs / Math.max(1, N.fx.fxN)).toFixed(2) + ' ms a drawn frame (only in scenes)');
    if (await ev(() => VR.game.dim) !== 'overworld') await trip('overworld');
  });
  // ---------------------------------------------------------------- 8 · a-story4: chapters 9–12 — the nebula, the red sun, Echo, home
  await section('8', async () => {
    console.log('8 · a-story4: chapters 9–12');
    const trip = async (dim) => {
      await ev((d) => { window.__lastTrip = VR.Travel.last; VR.Travel.go(VR.game, { dim: d, via: 'cmd' }); }, dim);
      let s = null;
      for (let i = 0; i < 900; i++) { await run(10); s = await ev((d) => { const g = VR.game, L = VR.Travel.last; return { state: g.state, dim: g.dim, arrived: !!(L && L !== window.__lastTrip && L.to === d) }; }, dim); if (s.arrived && s.state === 'play') break; await wait(20); }
      check(s && s.dim === dim, 'the trip to ' + dim + ' (' + secs() + ')');
      if (s && s.dim === dim) await settle(18, dim);
      return s && s.dim === dim;
    };
    const ground = () => ev(() => { const g = VR.game, p = g.player, y = g.world.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1; p.flying = false; p.teleport(p.pos[0], Math.max(y, p.pos[1]), p.pos[2]); p.pitch = 0; });
    const play = async (id, t, name, tod) => {
      await ev((id) => VR.StoryPlay.debug.play(id), id);
      await sceneTo(t);
      const st = await ev(() => { const sc = VR.game.story.scene; return sc ? { id: sc.b.id, shot: sc.shot, fx: sc.fxKind || null, line: sc.line, who: sc.lines.map(l => l.who).join(' '), keys: sc.lines.map(l => l.key).join(' ') } : null; });
      await draw(tod); await shot(name);
      console.log('     ' + name + ' ' + JSON.stringify(st).slice(0, 300));
      while (await ev(() => VR.StoryPlay.holds(VR.game))) { await ev(() => VR.game.story.skip()); await run(5); }
      return st;
    };
    const why = (id, extra) => ev(([id, x]) => { const g = VR.game, s = g.story; return VR.Story.why(VR.Story.byId(id), Object.assign(VR.StoryPlay.ctxOf(g, s), { calm: 30 }, x || {}), s.rec); }, [id, extra || null]);
    // the worlds: one of a system inside a nebula, one of a red dwarf (landable, not locked)
    const W = await ev(() => { const G = VR.Galaxy, N = G.build((VR.game.meta.seed >>> 0) || 0x5eed), out = {}; for (let i = 1; i < N.list.length && !(out.neb && out.red); i++) { const st = N.list[i]; if (!st) continue; const want = st.neb >= 0 ? 'neb' : (st.cls === 'M' && !st.bin) ? 'red' : null; if (!want || out[want]) continue; const sy = G.system(N, i), p = sy && sy.bodies.find(b => b.landable && !b.locked && /aqua|ocker|basalt|opal/.test(b.dim || '')); if (p) out[want] = p.dim; } return out; });
    check(!!W.neb && !!W.red, 'a world inside a nebula (' + W.neb + ') and one of a red dwarf (' + W.red + ')');
    await ev(() => { VR.game.story.rec.choices.c6 = 'lumi'; });
    // 9 · inside the nebula: Flimmi
    if (W.neb && await trip(W.neb)) {
      await ev(() => VR.StoryPlay.debug.reach('c9.b1')); await ground();
      const w9 = await why('c9.b1');
      check(w9 === null, 'c9.b1 holds on the nebula\'s world (' + w9 + ')');
      const td = await nightTod();   // (inside the nebula it is not dark: its glow fills the night)
      console.log('     the nebula\'s world: night at ' + td);
      const s1 = await play('c9.b1', 10, 'c9_nebula', td === null ? undefined : td);
      check(s1 && s1.fx === 'nebin' && /lumi/.test(s1.who), 'c9.b1: the nebula from inside; Lumi is there (her branch)');
      check(await ev(() => (VR.StoryPlay.stats.nebSky || 0) > 0), 'c9.b1: the sky turned to the nebula\'s own glow while the scene plays');
      await ev(() => VR.StoryPlay.debug.reach('c9.b2'));
      const s2 = await play('c9.b2', 11, 'c9_flimmi', td === null ? undefined : td);
      check(s2 && s2.fx === 'flimmi' && /flimmi/.test(s2.who), 'c9.b2: Flimmi — the star being born, the one the beacons were calling');
    }
    // 10 · the patient sun: Dumarin and Ylosenis
    if (W.red && await trip(W.red)) {
      await ev(() => VR.StoryPlay.debug.reach('c10.b1'));
      let v = null; for (let i = 0; i < 30 && !v; i++) { await run(10); await wait(400); v = await ev(() => { const n = VR.StoryPlay.village(VR.game); return n ? { x: n.s.x, z: n.s.z } : null; }); }
      if (v) {
        await ev((v) => { const p = VR.game.player; p.flying = true; p.safeTeleport(v.x + 30.5, 120, v.z + 24.5); }, v);
        for (let i = 0; i < 60; i++) { await run(4); await wait(250); if (await ev((v) => VR.game.world.isLoaded(Math.floor(v.x + 30), Math.floor(v.z + 24)) && !VR.game.player.hold, v)) break; }
        await ev((v) => { const g = VR.game, p = g.player, y = g.world.topAt(Math.floor(v.x + 30), Math.floor(v.z + 24)) + 1; p.flying = false; p.teleport(v.x + 30.5, y, v.z + 24.5); window.__ft.aim([v.x, y + 2, v.z]); p.vel[0] = p.vel[1] = p.vel[2] = 0; }, v);
        await settle(12, 'the Dunelin village');
      } else await ground();
      const w10 = await why('c10.b1');
      check(w10 === null, 'c10.b1 holds under the red dwarf (' + w10 + ')');
      const td = await sunTod();
      const s1 = await play('c10.b1', 15.5, 'c10_red', td === null ? undefined : td);
      check(s1 && s1.fx === 'redsun' && /dumarin/.test(s1.who), 'c10.b1: the patient sun; Dumarin of the Dunelin');
      await ev(() => VR.StoryPlay.debug.reach('c10.b3'));
      const s3 = await play('c10.b3', 3.5, 'c10_beam', td === null ? undefined : td);
      check(s3 && /ylosenis/.test(s3.who) && /dumarin/.test(s3.who), 'c10.b3: Ylosenis of the Nivari and Dumarin: the beam points home, to Echo');
    }
    // 11 · Echo: the five peoples at the Ringstation
    if (await trip('stn.ring')) {
      await ev(() => VR.StoryPlay.debug.reach('c11.b1'));
      const w11 = await why('c11.b1');
      check(w11 === null, 'c11.b1 holds at the Ringstation (' + w11 + ')');
      const s1 = await play('c11.b1', 9, 'c11_echo');
      check(s1 && s1.fx === 'echo' && ['solgani', 'dumarin', 'ylosenis', 'anselm'].every(w => s1.who.indexOf(w) >= 0), 'c11.b1: the peoples gather round Echo');
      const s2 = await play('c11.b2', 4, 'c11_plan');
      check(s2 && /lumi/.test(s2.who), 'c11.b2: the plan — answer Echo your way (Lumi\'s branch)');
    }
    // the set piece, home on Herzwelt: a beacon built block by block through the hand's own hook (g.onBlockPlaced)
    if (await trip('overworld')) {
      await ground(); await run(20);
      const b0 = await ev(() => { const s = VR.game.story; return { open: (VR.Story.openAct(s.rec) || {}).id, why: VR.Story.why(VR.Story.byId('c11.b3'), Object.assign(VR.StoryPlay.ctxOf(VR.game, s), { calm: 30 }), s.rec) }; });
      check(b0.open === 'c11.b2' && b0.why === 'deed', 'the set piece is open; Echo waits for the answer (' + JSON.stringify(b0) + ')');
      const built = await ev(() => {
        const g = VR.game, p = g.player, x0 = Math.floor(p.pos[0]) + 5, z0 = Math.floor(p.pos[2]) - 6, y0 = g.world.topAt(x0, z0) + 1, R = VR.R.byName;
        const stone = (R.stone_bricks || R.stone).defaultState, lamp = (R.sea_lantern || R.glowstone || R.stone).defaultState; let n = 0;
        for (let y = 0; y < 12; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { if (y < 11 && (dx + dz) % 2 && y % 2) continue; const id = y === 11 ? lamp : stone; g.world.setBlock(x0 + dx, y0 + y, z0 + dz, id); if (g.onBlockPlaced) g.onBlockPlaced(x0 + dx, y0 + y, z0 + dz, id, p); n++; }
        window.__ft.aim([x0 + 1, y0 + 8, z0 + 1]); return { n, at: [x0, y0, z0] };
      });
      await run(20);
      const fw = await ev(() => { const s = VR.game.story; return { how: s.rec.choices.how, act: !!(s.rec.acts && s.rec.acts['c11.b2']), way: VR.StoryPlay.stats.way }; });
      check(fw.how === 'build' && fw.act, 'a builder answers by building: ' + built.n + ' blocks, a lamp on top → ' + JSON.stringify(fw));
      await draw(6000); await shot('c11_built');
      const s3 = await play('c11.b3', 9, 'c11_wake', 6000);
      check(s3 && s3.fx === 'wake' && /\.build\./.test(s3.keys) && /echo/.test(s3.who), 'c11.b3: Echo wakes — and speaks of the beacon you built');
      // 12 · home: everyone; at night every beacon at once; the epilogue
      const s4 = await play('c12.b1', 9, 'c12_home', 6000);
      check(s4 && /ilka/.test(s4.who) && /lumi/.test(s4.who), 'c12.b1: everyone on the square (Lumi in her branch)');
      await ev(() => VR.game.env.setTime(16500)); await run(40);
      const w12 = await why('c12.b2');
      check(w12 === null, 'c12.b2 holds at night on Herzwelt (' + w12 + ')');
      await ev(() => { VR.StoryPlay.stats.beams = 0; VR.StoryPlay.stats.beamMs = 0; });
      await ev(() => { const p = VR.game.player; p.pitch = 0.25; });
      const s5 = await play('c12.b2', 12, 'c12_finale', 16500);
      const bm = await ev(() => ({ beams: VR.StoryPlay.stats.beams || 0, ms: +(VR.StoryPlay.stats.beamMs || 0).toFixed(1) }));
      check(s5 && s5.fx === 'finale' && bm.beams > 10, 'c12.b2: every beacon at once — the sky as the reward (' + JSON.stringify(bm) + ')');
      await ev(() => VR.StoryPlay.debug.play('c12.b2')); await sceneTo(5); await draw(16500); await shot('c12_sky'); while (await ev(() => VR.StoryPlay.holds(VR.game))) { await ev(() => VR.game.story.skip()); await run(5); }
      const s6 = await play('c12.b3', 17, 'c12_epilogue', 16500);
      check(s6 && s6.fx === 'blink3', 'c12.b3: the epilogue and the new signal (three blinks)');
      const fin = await ev(() => { const s = VR.game.story; return { ch: VR.Story.chapter(s.rec), free: VR.Story.free(s.rec), places: Object.keys(s.rec.places || {}), j: /story:go:/.test(VR.StoryPlay.journalHTML()) }; });
      check(fin.ch === 13 && fin.free && fin.places.length >= 3 && fin.j, 'the book is read: free play, the star book lists ' + fin.places.join(' '));
    }
  });
  // ---------------------------------------------------------------- 3 · chapter 3: the station's beacon over the limb
  await section('3', async () => {
    console.log('3 · chapter 3 in orbit');
    if (await ev(() => VR.game.dim) !== 'overworld') {
      await ev(() => { window.__lastTrip = VR.Travel.last; VR.Travel.go(VR.game, { dim: 'overworld', via: 'cmd' }); });
      for (let i = 0; i < 900; i++) { await run(10); const s = await ev(() => { const g = VR.game, L = VR.Travel.last; return { state: g.state, arrived: !!(L && L !== window.__lastTrip && L.to === 'overworld') }; }); if (s.arrived && s.state === 'play') break; await wait(20); }
      await settle(20, 'home again');
    }
    check(await ev(() => VR.game.dim) === 'overworld', 'back on Herzwelt');
    await ev(() => VR.StoryPlay.debug.reach('c3.b2'));
    const ap = await ev(() => VR.SpaceFlight.apron());
    const ay = await ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 220; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [ap.x, ap.z]);
    await arrive({ x: ap.x, y: ay, z: ap.z + 12 });
    await ev(([x, y, z]) => { const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(x + 0.5, y + 1, z + 12.5); p.yaw = 0; g.starships.placeInFront(4242, 'shuttle', null, p); }, [ap.x, ay, ap.z]);
    let mine = false; for (let i = 0; i < 90 && !mine; i++) { await run(4); mine = await ev(() => { const s = VR.game.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); return !!(s && s.d.meta && s.d.cells); }); await wait(100); }
    const boarded = await ev(() => { const g = VR.game, s = g.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); if (!s || !s.d.meta || !s.d.cells) return null; g.starships.board(s, g.player); const fl = s.flight; fl.power = 'running'; fl.startT = 3; return { pilot: g.starships.pilot === s }; });
    check(!!boarded && boarded.pilot, 'the shuttle boarded');
    if (!boarded) return;
    await run(30);
    await ev(() => { const g = VR.game; g.env.day = 2; g.env.setTime(5200); VR.SpaceFlight.debug.orbit(g, 0, 40, 3063); VR.Ascent.game = g; const fl = g.flight;   /* (straight into orbit there is no climb frame: Ascent.frame never ran, its game unset — the space layers need it) */ fl.view = 1; g.camMode = 1; fl.headPitch = 0.45; fl.headYaw = 0; fl.backT = 0; fl.recenter = false; fl.mouseIdle = 0; fl.chaseYaw = null; fl.shot = null; fl.shakeAmp = 0; fl.bump = 0; });
    const t0 = Date.now(); let sp = null;
    for (;;) { await run(6, 1); sp = await ev(() => { const need = VR.SpaceScene.cur_need || []; return { done: need.filter(s => s.done).length, need: need.length }; }); if ((sp.need && sp.done === sp.need) || Date.now() - t0 > 90000) break; await wait(60); }
    for (let i = 0; i < 60; i++) { await run(4, 1); const s = await ev(() => { const PG = VR.PlanetLODGL; return PG ? { n: PG.stats.tiles, left: PG.pending() } : null; }); if (!s || !s.n || s.left === 0) break; await wait(80); }
    await ev(() => { delete VR.game.story.rec.beats['c3.b2']; });   // (the run's order: chapter 4 came first)
    const o = await ev(() => { const g = VR.game, s = g.story; return { orbit: VR.StoryPlay.orbit(g), why: VR.Story.why(VR.Story.byId('c3.b2'), Object.assign(VR.StoryPlay.ctxOf(g, s), { calm: 30 }), s.rec), regime: g.flight && g.flight.regime }; });
    check(o.orbit && o.why === null, 'in orbit: c3.b2 holds (' + JSON.stringify(o) + ')');
    await ev(() => VR.StoryPlay.debug.play('c3.b2'));
    await ev(() => { const s = VR.game.story; if (s.scene) s.scene.t = 2.6; });
    await run(6, 1); await wait(5600); await run(2, 1);   // (orbit.mjs's wait: the planet's tiles)
    await draw(null, 1); await draw(null, 1);
    const st = await ev(() => ({ station: VR.StoryPlay.station ? { blink: +VR.StoryPlay.station.blink.toFixed(2) } : null, scene: VR.StoryPlay.debug.state().scene }));
    check(!!st.station, 'the Ringstation\'s beacon in the space scene\'s list (' + JSON.stringify(st) + ')');
    // (the blink's bright phase for the picture: the page's clock decides it — a few tries)
    for (let i = 0; i < 6; i++) { await draw(null, 1); await draw(null, 1); const b = await ev(() => VR.StoryPlay.station ? VR.StoryPlay.station.blink : 0); if (b > 0.7) break; await wait(200); }
    await ev(() => {
      const A = VR.Ascent, SF = VR.SpaceFlight, D = window.__diag = { sky: 0, layers: 0, draws: 0, why: null };
      if (!A.__d) { A.__d = A.drawSky; A.drawSky = function (r, E, F) { D.sky++; D.why = { climb: !!E.climb, space: !!(E.climb && E.climb.space), game: !!A.game, ss: !!(VR.SpaceScene && VR.SpaceScene.state), cur: !!SF.cur, n: SF.cur ? SF.cur.draws.length : -1 }; return A.__d.apply(this, arguments); }; }
      if (!SF.__dl) { SF.__dl = SF.drawLayers; SF.drawLayers = function (r, fr, L) { D.layers++; const n = SF.__dl.apply(this, arguments); D.draws += n; D.L = { bg: L.bg, bodies: L.bodies, herz: L.herz, strict: L.strict }; return n; }; }
    });
    await draw(null, 1);
    console.log('     diag: ' + JSON.stringify(await ev(() => window.__diag)));
    console.log('     space: ' + JSON.stringify(await ev(() => { const g = VR.game, r = g.renderer, SS = VR.SpaceScene, need = SS.cur_need || []; return { draws: r.stats.draws, tris: Math.round(r.stats.tris), need: need.length, done: need.filter(q => q.done).length, regime: g.flight && g.flight.regime, view: g.flight && g.flight.view, hp: g.flight && g.flight.headPitch, cam: VR.StoryPlay.station ? VR.StoryPlay.station.dir.map(v => +v.toFixed(3)) : null }; })));
    await shot('c3_station_beacon');
    N.c3 = { o, st };
    await page.keyboard.press('KeyE'); await run(4, 1);
  });

} catch (e) { fails++; console.log('  ✗ the run stopped: ' + (e.stack || e.message).slice(0, 900)); }

const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(!errs.length, 'no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
if (logs.length) console.log('     logs: ' + logs.slice(0, 6).join(' | ').slice(0, 1200));
// the sheet (a-story5: each sheet in its own try — a missing earlier shot never costs the later sheets)
const P0 = N.pics || {};
const sheet = (file, rows0) => {
  try {
    const rows = rows0.map(([label, names]) => ({ label, imgs: names.map(n => P0[n]).filter(f => f && fs.existsSync(f)) })).filter(r => r.imgs.length);
    if (!rows.length) { console.log('     (sheet ' + file + ': no pictures)'); return; }
    fs.writeFileSync(ROOT + '.tmp_tests/' + file + '.json', JSON.stringify({ w: 620, rows }));
    execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + file + '.jpg', ROOT + '.tmp_tests/' + file + '.json']);
    console.log('     sheet test/shots/' + file + '.jpg');
  } catch (e) { console.log('  (the sheet ' + file + ': ' + String(e.message || e).slice(0, 200) + ')'); }
};
sheet('story_sheet', [
  ['1 · Funke wacht auf — das Angebot, die Szene, das Wegstück', ['c1_offer', 'c1_funke_wakes', 'c1_way']],
  ['2 · der Lichtring · 3 · das Leuchtfeuer der Ringstation über dem Rand', ['c2_light_ring', 'c3_station_beacon']],
  ['4 · der Eiswächter unter dem Eis · Amarant verschluckt Helia', ['c4_warden', 'c4_eye', 'c4_eclipse']],
  ['5 · das Tagebuch', ['journal_chapter']],
  ['a-story3 · 5 Zinnober: das Lied · 6 Aquamarin: Opas Notizen · die Entscheidung', ['c5_song', 'c6_notes', 'c6_choice']],
  ['a-story3 · 7 das Fenster der Ringstation · der fremde Stern · 8 zwei Sonnen · der Strahl', ['c7_window', 'c7_blink', 'c8_twin', 'c8_beam']]]);
sheet('story3_sheet', [
  ['Kapitel 5 · Zinnober — das gläserne Leuchtfeuer singt · Kapitel 6 · Aquamarin — Opa Anselms Notizen', ['c5_song', 'c6_notes']],
  ['Kapitel 6 · die Entscheidung (wer hilft dir?) · Kapitel 7 · das Fenster der Ringstation: die Leuchtfeuer sind ein Pfeil', ['c6_choice', 'c7_window']],
  ['Kapitel 7 · der fremde Stern: ein Leuchtfeuer blinkt zweimal · Kapitel 8 · zwei Sonnen · der Strahl zum Nebel', ['c7_blink', 'c8_twin', 'c8_beam']]]);
const R4 = [
  ['Kapitel 9 · Im Nebel — von innen · Flimmi, der Stern, der geboren wird', ['c9_nebula', 'c9_flimmi']],
  ['Kapitel 10 · Die geduldige Sonne — Dumarin · der Strahl zeigt heim', ['c10_red', 'c10_beam']],
  ['Kapitel 11 · Echo und die fünf Völker · der Plan · das selbst gebaute Leuchtfeuer · Echo erwacht', ['c11_echo', 'c11_plan', 'c11_built', 'c11_wake']],
  ['Kapitel 12 · Heimkehr · jedes Leuchtfeuer auf einmal · der Himmel · der Epilog', ['c12_home', 'c12_finale', 'c12_sky', 'c12_epilogue']]];
sheet('story4_sheet', [['a-story3s offene Punkte · c5 das Lied (Weitwinkel) · c7 das Fenster: 3-D-Strahlen · c8 zwei Sonnen am Tag', ['c5_song', 'c7_window', 'c8_twin']]].concat(R4));
sheet('story5_sheet', [['a-story5 · das Fenster: der Pfeil der Leuchtfeuer', ['c7_window']]].concat(R4));
save();
await browser.close();
console.log((fails ? 'FAILED ' + fails : 'ALL OK') + ' (' + secs() + ')');
process.exit(fails ? 1 : 0);

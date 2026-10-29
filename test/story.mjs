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
const shot = async (name) => { await wait(200); try { await page.screenshot({ path: SHOTS + name + '.png', timeout: 150000 }); } catch (e) { console.log('  !! screenshot ' + name + ': ' + String(e.message || e).split('\n')[0]); return null; } console.log('     shot ' + name + ' (' + secs() + ')'); N.pics[name] = SHOTS + name + '.png'; save(); return SHOTS + name + '.png'; };
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
// a scene stepped to its time t (s): the frames of 33 ms, then held
const sceneTo = async (t) => { const r = await run(Math.ceil(t / 0.033) + 60, 33, 'sceneT', t); return r; };

try {
  await page.goto(DIST);
  const atTitle = () => ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title');
  for (let i = 0; i < 160; i++) { await wait(500); if (await atTitle()) break; }
  check(await atTitle(), 'the start screen (' + secs() + ')');
  check(await ev(() => !!(VR.Story && VR.StoryPlay && VR.Regie && VR.Story.BEATS.length === 12)), 'VR.Story (12 beats), VR.StoryPlay and VR.Regie are in the page');
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
    await draw(); await shot('c1_funke_wakes');
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
    await page.keyboard.press('KeyE'); await run(4);
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
  // ---------------------------------------------------------------- 3 · chapter 3: the station's beacon over the limb
  await section('3', async () => {
    console.log('3 · chapter 3 in orbit');
    if (await ev(() => VR.game.dim) !== 'overworld') {
      await ev(() => { window.__lastTrip = VR.Travel.last; VR.Travel.go(VR.game, { dim: 'overworld', via: 'cmd' }); });
      for (let i = 0; i < 900; i++) { await run(10); const s = await ev(() => { const g = VR.game, L = VR.Travel.last; return { state: g.state, arrived: !!(L && L !== window.__lastTrip && L.to === 'overworld') }; }); if (s.arrived && s.state === 'play') break; await wait(20); }
      await settle(20, 'home again');
    }
    check(await ev(() => VR.game.dim) === 'overworld', 'back on Herzwelt');
    const ap = await ev(() => VR.SpaceFlight.apron());
    const ay = await ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 220; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [ap.x, ap.z]);
    await arrive({ x: ap.x, y: ay, z: ap.z + 12 });
    await ev(([x, y, z]) => { const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(x + 0.5, y + 1, z + 12.5); p.yaw = 0; g.starships.placeInFront(4242, 'shuttle', null, p); }, [ap.x, ay, ap.z]);
    let mine = false; for (let i = 0; i < 90 && !mine; i++) { await run(4); mine = await ev(() => { const s = VR.game.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); return !!(s && s.d.meta && s.d.cells); }); await wait(100); }
    const boarded = await ev(() => { const g = VR.game, s = g.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); if (!s || !s.d.meta || !s.d.cells) return null; g.starships.board(s, g.player); const fl = s.flight; fl.power = 'running'; fl.startT = 3; return { pilot: g.starships.pilot === s }; });
    check(!!boarded && boarded.pilot, 'the shuttle boarded');
    if (!boarded) return;
    await run(30);
    await ev(() => { const g = VR.game; g.env.day = 2; g.env.setTime(5200); VR.SpaceFlight.debug.orbit(g, 0, 40, 3063); const fl = g.flight; fl.view = 1; g.camMode = 1; fl.headPitch = 0.45; fl.headYaw = 0; fl.backT = 0; fl.recenter = false; fl.mouseIdle = 0; fl.chaseYaw = null; fl.shot = null; fl.shakeAmp = 0; fl.bump = 0; });
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
    console.log('     space: ' + JSON.stringify(await ev(() => { const g = VR.game, r = g.renderer, SS = VR.SpaceScene, need = SS.cur_need || []; return { draws: r.stats.draws, tris: Math.round(r.stats.tris), need: need.length, done: need.filter(q => q.done).length, regime: g.flight && g.flight.regime, view: g.flight && g.flight.view, hp: g.flight && g.flight.headPitch, cam: VR.StoryPlay.station ? VR.StoryPlay.station.dir.map(v => +v.toFixed(3)) : null }; })));
    await shot('c3_station_beacon');
    N.c3 = { o, st };
    await page.keyboard.press('KeyE'); await run(4, 1);
  });

} catch (e) { fails++; console.log('  ✗ the run stopped: ' + (e.stack || e.message).slice(0, 900)); }

const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(!errs.length, 'no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
if (logs.length) console.log('     logs: ' + logs.slice(0, 6).join(' | ').slice(0, 1200));
// the sheet
try {
  const P0 = N.pics, rows = [];
  const add = (label, names) => { const imgs = names.map(n => P0[n]).filter(Boolean); if (imgs.length) rows.push({ label, imgs }); };
  add('1 · Funke wacht auf — das Angebot, die Szene, das Wegstück', ['c1_offer', 'c1_funke_wakes', 'c1_way']);
  add('2 · der Lichtring · 3 · das Leuchtfeuer der Ringstation über dem Rand', ['c2_light_ring', 'c3_station_beacon']);
  add('4 · der Eiswächter unter dem Eis · Amarant verschluckt Helia', ['c4_warden', 'c4_eye', 'c4_eclipse']);
  add('5 · das Tagebuch', ['journal_chapter']);
  fs.writeFileSync(ROOT + '.tmp_tests/story_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'story_sheet.jpg', ROOT + '.tmp_tests/story_sheet.json']);
  console.log('     sheet test/shots/story_sheet.jpg');
} catch (e) { console.log('  (the sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
await browser.close();
console.log((fails ? 'FAILED ' + fails : 'ALL OK') + ' (' + secs() + ')');
process.exit(fails ? 1 : 0);

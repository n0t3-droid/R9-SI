// Das Abenteuer, Teil 1 in the page (a-quests; plan docs/superpowers/plans/2026-10-22-a-quests.md): the quests of the
// villagers and the shops. One run, German UI, 1280 × 720:
//   1. the create form at 720 px (Profi, ⚔ Abenteuer chosen — its tallest state): „Welt erstellen" in view without
//      scrolling (a-core's open item) → abenteuer_create_720.png; ⚔ Abenteuer + Überleben makes the world
//   2. to the nearest village: the places (the worker's vistas, the villages near), the givers of the day get the ✦
//   3. the ✦ over a giver's head (a giver under the open sky) → abenteuer_quest_marker.png; the talk: „✦ Hast du einen
//      Auftrag?" in place of „Kann ich helfen?", the offer → abenteuer_quest_offer.png; ✓ Mach ich! → in the Tagebuch,
//      tracked; up to two more accepted through the talk
//   4. a riddle (today's, or the first day a villager here has one): ✓ Mach ich! shows the three answers at once →
//      abenteuer_quest_riddle.png; a wrong one is struck through (nothing lost), the right one: 20 EP, 15 Heliataler,
//      a heart → abenteuer_quest_reward.png
//   5. J: the Tagebuch → abenteuer_journal.png (open quests with where, how far, which way, the reward; the riddle
//      done); 🧭 tracks another; the compass line ✦; J and Esc close it; the pause menu: 📖 Tagebuch after ⚔ Abenteuer
//      → abenteuer_pause.png, and Esc from the Tagebuch steps back to the pause menu
//   5b. Suchen to the end: to the vista, the lost thing lying there in the evening light → abenteuer_quest_find.png;
//      picked up („✦ Gefunden!"), back in the village the giver's cyan ✦, „✓ Erledigt!" → abenteuer_quest_done.png
//   6. the Hangar (the pilot's or the flight controller's, or opened directly) → the engine step 1 →
//      abenteuer_shop_hangar.png; selling iron at the Hangar (Überleben) → abenteuer_shop_sell.png
//   6b. the supermarket: a cashier here or in the next village — at the till she invites once →
//      abenteuer_cashier_till.png; her 🛒 Einkaufen → a buy → abenteuer_shop_supermarkt.png; too few Taler → the
//      refusal → abenteuer_shop_poor.png
// (run 1 lost the player on arrival: the test's fast clock let the hold give up before the city had loaded — arrive()
//  now runs the clock slowly while a place loads)
//   7. the numbers: Q.make in the page (≤ 0.2 ms), the givers, the mark pass (cached and a new day), the 2-Hz tick,
//      Q.draw per drawn frame, the game loop on Very Low and High with the Abenteuer off and on (alternating blocks of
//      200 frames, CPU), the record in IndexedDB, no page error
// → test/shots/abenteuer_*.png, abenteuer_sheet.jpg, abenteuer_numbers.json
//   nohup bash test/wt_run.sh abenteuer.mjs 3600 > .tmp_tests/abenteuer.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = 'file://' + ROOT + 'dist/index.html';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const N = {};   // the numbers for the plan
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// the simulation without drawing (SwiftShader draws slowly); a frame is drawn only for a picture
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 20) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dtms]); } };
const draw = (tod) => ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, tod);
const shot = async (name) => { await wait(150); await page.screenshot({ path: SHOTS + name + '.png', timeout: 120000 }); console.log('shot ' + name + ' (' + secs() + ')'); return SHOTS + name + '.png'; };
const hold = (ms) => ev((ms) => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = ms; } catch (e) { /* */ } } }, ms);
const release = () => ev(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) { /* */ } } });
const screen = () => ev(() => VR.game.ui.screen);
const pics = {};
// one section stopping (a throw) is one failure and its picture; the next section still runs (one run must tell all)
const section = async (tag, fn) => {
  try { await fn(); } catch (e) {
    fails++; console.log('  ✗ section ' + tag + ' stopped: ' + (e.stack || e.message).slice(0, 900));
    try { await release(); await page.screenshot({ path: SHOTS + 'abenteuer_fail_' + tag + '.png', timeout: 120000 }); } catch (e2) { /* */ }
  }
};
// back to the game from any screen (the talk closes the villages' way)
const toGame = () => ev(() => { const g = VR.game, V = g.villages; if (g.ui.screen === 'talk' && V && V.talking) V.closeTalk(); else if (g.ui.screen) g.ui.resume(); });

try {
  await page.goto(DIST);
  const atTitle = () => ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title');
  for (let i = 0; i < 160; i++) { await wait(500); if (await atTitle()) break; }
  check(await atTitle(), 'the start screen (' + secs() + ')');
  check(await ev(() => !!(VR.Quests && VR.Shop && VR.Adventure && VR.Adventure.ui)), 'VR.Quests, VR.Shop and VR.Adventure are in the page');
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); g.audio.resume(); if (VR.UIPrefs) VR.UIPrefs.set({ pro: true }); if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });   // (run 2: the Bauhand's hint covered the lost scarf)
  // the test's helpers in the page: a camera spot in front of a villager (free line of sight), the view set, the face
  await ev(() => {
    const air = (x, y, z) => !VR.game.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    window.__qt = {
      air,
      sky(a) { const w = VR.game.world; for (let y = Math.floor(a.pos[1] + 2.2); y < a.pos[1] + 18; y++) if (w.getBlock(Math.floor(a.pos[0]), y, Math.floor(a.pos[2]))) return false; return true; },
      camFor(a, d, eyeH, lookH) {
        for (const o of [0, 1, -1, 2, -2, 3, -3, 4]) {
          const yaw = a.yaw + o * Math.PI / 4, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
          let ok = true;
          for (let s = 2; s <= 8 && ok; s++) { const t = s / 8, x = a.pos[0] + fx * d * t, z = a.pos[2] + fz * d * t, y = a.pos[1] + lookH + (eyeH - lookH) * t; if (!air(x, y, z) || !air(x, y + 0.6, z)) ok = false; }
          const cx = a.pos[0] + fx * d, cz = a.pos[2] + fz * d, cy = a.pos[1] + eyeH;
          if (ok && (!air(cx, cy - 1.5, cz) || !air(cx, cy - 0.7, cz) || !air(cx, cy + 0.2, cz))) ok = false;
          if (ok) return { x: cx, y: cy, z: cz, tx: a.pos[0], ty: a.pos[1] + lookH, tz: a.pos[2], o };
        }
        return null;
      },
      look(c) { const p = VR.game.player; p.flying = true; p.hold = null; p.teleport(c.x, c.y - 1.62, c.z); const dx = c.tx - c.x, dy = c.ty - c.y, dz = c.tz - c.z; p.yaw = Math.atan2(-dx, -dz); p.viewYaw = p.yaw; p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
      face(a, c) { a.path = null; a.yaw = Math.atan2(-(c.x - a.pos[0]), -(c.z - a.pos[2])); a.lookAt = [c.x, c.y, c.z]; if (a.vel) { a.vel[0] = 0; a.vel[2] = 0; } },
      // the camera in front of a (d blocks, the eye eyeH over its feet looking at lookH): true when a spot was found
      frame(a, d, eyeH, lookH) { const c = this.camFor(a, d, eyeH, lookH) || this.camFor(a, d * 0.75, eyeH, lookH); if (!c) return null; this.look(c); this.face(a, c); return c; },
    };
  });
  // to a place the way a player arrives (safeTeleport: the hold waits while it loads). The test's clock runs slowly
  // meanwhile (3 frames a quarter second): the hold gives up after 30 s of game time, and a fast test clock once let it
  // give up before the city had loaded (run 1: „aus der Welt gefallen"). Flying, in case the ground is late.
  const arrive = async (s) => {
    await ev((s) => { const p = VR.game.player; p.flying = true; p.safeTeleport(s.x + 0.5, s.y + 2, s.z + 0.5); }, s);
    let st = null;
    for (let i = 0; i < 280; i++) {
      await step(3); await wait(250);
      st = await ev((s) => { const g = VR.game, p = g.player, v = s.id ? g.villages.known.get(s.id) : null; return { hold: !!p.hold, dead: !!p.dead, loaded: g.world.isLoaded(Math.floor(s.x), Math.floor(s.z)), active: v ? !!v.active : null, agents: v && v.agents ? v.agents.length : null, y: Math.round(p.pos[1]) }; }, s);
      if (st.dead) break;
      if (!st.hold && st.loaded && (!s.id || (st.active && st.agents > 0))) break;
    }
    st.at = secs();
    return st;
  };

  // ---------------------------------------------------------------- 1 · the create form at 720 px
  await section('1', async () => {
    console.log('1 · the create form at 1280 × 720');
    await ev(() => VR.game.ui.show('title'));
    await wait(300);
    await ev(() => document.querySelector('#title [data-act="newworld"]').click());
    await wait(400);
    await ev(() => { document.querySelector('#cw_way [data-v="adv"]').click(); document.querySelector('#cw_mode [data-v="survival"]').click(); const n = document.querySelector('#cw_name'); n.value = 'Aufträge'; document.querySelector('#cw_seed').value = '4242'; });
    await wait(300);
    const cf = await ev(() => {
      const b = document.querySelector('#create [data-act="docreate"]'), r = b.getBoundingClientRect();
      const scr = document.getElementById('create'), panel = scr.querySelector('.panel');
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, hit: !!hit && (hit === b || b.contains(hit)), scroll: [scr.scrollTop, panel.scrollTop], over: [scr.scrollHeight - scr.clientHeight, panel.scrollHeight - panel.clientHeight], panelH: Math.round(panel.getBoundingClientRect().height), text: b.textContent.trim(), note: !document.querySelector('#create .advwaynote').hidden, way: document.querySelector('#cw_way .on').dataset.v, mode: document.querySelector('#cw_mode .on').dataset.v, cols: getComputedStyle(panel).gridTemplateColumns };
    });
    console.log('     ' + JSON.stringify(cf));
    N.create = cf;
    check(cf.text === 'Welt erstellen' && cf.top >= 0 && cf.bottom <= cf.vh && cf.hit && cf.scroll[0] === 0 && cf.scroll[1] === 0, '„Welt erstellen" in view at 1280 × 720 without scrolling (Profi, ⚔ Abenteuer with its note: the button ' + cf.top + '–' + cf.bottom + ' of ' + cf.vh + ' px, nothing over it)');
    check(cf.way === 'adv' && cf.mode === 'survival' && cf.note, '⚔ Abenteuer and Überleben chosen, the note shown');
    pics.create = await shot('abenteuer_create_720');
    await ev(() => document.querySelector('#create [data-act="docreate"]').click());
    for (let i = 0; i < 180; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
    check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
    for (let i = 0; i < 14; i++) { await step(20); await wait(250); }
    const w = await ev(() => { const g = VR.game; return { on: VR.Adventure.on(), mode: g.player.mode, quests: VR.Quests.on(), vgen: g.meta.vgen, dim: g.dim }; });
    check(w.on && w.quests && w.mode === 'survival', 'an Abenteuer world in Überleben: the quests on (' + JSON.stringify(w) + ')');
  });

  // ---------------------------------------------------------------- 2 · the village, the places, the givers
  let site = null;
  await section('2', async () => {
    console.log('2 · to the nearest village');
    for (let i = 0; i < 40; i++) { if (await ev(() => !!(VR.game.villages && VR.game.villages.sites.length))) break; await step(20); await wait(300); }
    site = await ev(() => { const g = VR.game, V = g.villages, p = g.player; const n = V.nearestSite(p.pos[0], p.pos[2]); return n ? { id: n.site.id, x: n.site.x, y: n.site.y, z: n.site.z, name: n.site.name, d: Math.round(n.dist), all: V.sites.length } : null; });
    console.log('     ' + JSON.stringify(site));
    check(!!site, 'a village near (' + (site ? site.name + ', ' + site.d + ' m, ' + site.all + ' in the list' : 'none') + ')');
    if (!site) return;
    await ev(() => VR.game.env.setTime(5200));
    const st = await arrive(site);
    check(!!st && st.active && st.agents > 0 && !st.dead, 'arrived: ' + site.name + ' is awake, the player alive (' + JSON.stringify(st) + ')');
    await step(20);
    // the places come from the worker (the vistas) and the villages' list asked near the village; then the ✦
    let r = null;
    for (let i = 0; i < 80; i++) {
      r = await ev((id) => { const Q = VR.Quests, V = VR.game.villages, vil = V.known.get(id), pl = vil && Q.placesFor(vil); return { places: pl ? pl.length : null, kinds: pl ? pl.reduce((m, p) => (m[p.kind] = (m[p.kind] || 0) + 1, m), {}) : null, marks: Q.stats.marks, ticks: Q.stats.ticks }; }, site.id);
      if (r.places !== null && r.marks > 0) break;
      await step(20); await wait(400);
    }
    console.log('     ' + JSON.stringify(r));
    N.places = r;
    check(r.places > 0 && r.marks > 0, 'the places of ' + site.name + ' (' + JSON.stringify(r.kinds) + ') and the givers of the day marked: ' + r.marks + ' ✦ (the 2-Hz timer: ' + r.ticks + ' ticks)');
    const offers = await ev(() => { const Q = VR.Quests, V = VR.game.villages; return V.agents.filter(a => a.qMark === 1).map(a => { const o = Q.offerOf(a); return o ? { name: a.p.name, role: a.role, kind: o.k, size: o.s, title: Q.title(o), ask: Q.ask(o).slice(0, 140), where: (() => { const w = Q.where(o); return w ? (w.sky ? 'sky' : w.id + ' ' + Math.round(Math.hypot(w.x - a.pos[0], w.z - a.pos[2])) + ' m') : null; })() } : null; }); });
    for (const o of offers) console.log('     ✦ ' + JSON.stringify(o));
    N.offers = offers;
    check(offers.length > 0 && offers.every(o => o && o.title && o.ask.length > 10 && o.where), 'every offer has a title, the giver\'s words and somewhere to go (' + offers.map(o => o && o.kind).join(', ') + ')');
  });

  // ---------------------------------------------------------------- 3 · the ✦, the talk, accepting
  await section('3', async () => {
    console.log('3 · the ✦ and the talk');
    // a giver under the open sky (another day another giver, when none is outside today)
    let gv = null;
    for (let d = 0; d < 8; d++) {
      gv = await ev(() => {
        const V = VR.game.villages, qt = window.__qt;
        const list = V.agents.filter(a => a.qMark === 1 && a.pose !== 'sleep' && a.pose !== 'sit');
        list.sort((a, b) => (qt.sky(b) - qt.sky(a)) || ((a.kid ? 1 : 0) - (b.kid ? 1 : 0)));
        const a = list[0]; if (!a) return null;
        window.__qa = a;
        return { name: a.name, role: a.role, kid: !!a.kid, sky: qt.sky(a), day: VR.game.env.day };
      });
      if (gv && gv.sky) break;
      await ev(() => { const g = VR.game; g.env.day++; VR.Quests.mark(g.villages); });
    }
    console.log('     the giver: ' + JSON.stringify(gv));
    check(!!gv, 'a giver with the ✦ (' + (gv ? gv.name + ', ' + gv.role + (gv.sky ? ', under the open sky' : ', indoors') : 'none') + ')');
    if (!gv) return;
    const c = await ev(() => window.__qt.frame(window.__qa, 2.7, 1.75, 1.35));
    check(!!c, 'a camera spot in front of ' + gv.name + ' (' + JSON.stringify(c && { o: c.o }) + ')');
    const d0 = await ev(() => VR.Quests.stats.draws);
    await draw(9600);
    const d1 = await ev(() => VR.Quests.stats.draws);
    check(d1 > d0, 'the ✦ drawn over the giver\'s head (' + (d1 - d0) + ' star draws in two frames)');
    pics.marker = await shot('abenteuer_quest_marker');
    // the talk: the ✦ button in place of „Kann ich helfen?"
    await ev(() => VR.game.villages.openTalk(window.__qa));
    await wait(300);
    const tk = await ev(() => { const box = document.querySelector('#tk_opts'), bs = [...box.querySelectorAll('button')]; return { btns: bs.map(b => b.textContent), q: (box.querySelector('[data-q="quest"]') || {}).textContent || null, help: bs.some(b => b.textContent === 'Kann ich helfen?'), styled: (() => { const b = box.querySelector('[data-q="quest"]'); return b ? getComputedStyle(b).borderTopColor : null; })() }; });
    console.log('     ' + JSON.stringify(tk));
    check(tk.q === '✦ Hast du einen Auftrag?' && !tk.help, 'the talk: „✦ Hast du einen Auftrag?" in place of „Kann ich helfen?" (' + tk.btns.join(' · ') + ')');
    await ev(() => document.querySelector('#tk_opts [data-q="quest"]').click());
    await wait(300);
    const off = await ev(() => ({ text: document.querySelector('#tk_text').textContent, btns: [...document.querySelectorAll('#tk_opts button')].map(b => b.textContent) }));
    console.log('     „' + off.text + '"');
    check(off.text.length > 20 && off.btns.includes('✓ Mach ich!') && off.btns.includes('Später'), 'the offer in the giver\'s words, „✓ Mach ich!" and „Später"');
    pics.offer = await shot('abenteuer_quest_offer');
    await ev(() => document.querySelector('#tk_opts [data-q="accept"]').click());
    await wait(400);
    const acc = await ev(() => { const Q = VR.Quests, a = window.__qa, r = Q.get(VR.Adventure.rec, a.p.id); return r ? { k: r.k, s: r.s, title: Q.title(r), tracked: VR.Adventure.rec.me.quests['~track'] === a.p.id, screen: VR.game.ui.screen, mark: a.qMark, toast: [...document.querySelectorAll('#toasts > *')].map(t => t.textContent.replace(/\s+/g, ' ')).slice(-1)[0] || '' } : null; });
    console.log('     ' + JSON.stringify(acc));
    check(!!acc && acc.tracked && acc.mark !== 1 && /Auftrag/.test(acc.toast), 'accepted: „' + (acc && acc.title) + '" in the Tagebuch and tracked, the ✦ gone, a toast');
    await toGame();
    // up to two more through the talk (the Tagebuch shows a few)
    const more = await ev(() => {
      const g = VR.game, V = g.villages, Q = VR.Quests, out = [];
      for (const a of V.agents.slice()) {
        if (out.length >= 2) break;
        if (a.qMark !== 1 || a === window.__qa) continue;
        V.openTalk(a);
        const b = document.querySelector('#tk_opts [data-q="quest"]'); if (!b) { V.closeTalk(); continue; }
        b.click();
        const ok = document.querySelector('#tk_opts [data-q="accept"]'); if (!ok) { if (g.ui.screen === 'talk') V.closeTalk(); continue; }
        ok.click();
        const r = Q.get(VR.Adventure.rec, a.p.id);
        out.push(r ? { name: a.p.name, k: r.k, s: r.s, title: Q.title(r) } : { name: a.p.name, none: true });
        if (g.ui.screen === 'talk' && V.talking) V.closeTalk();
      }
      return out;
    });
    console.log('     more: ' + JSON.stringify(more));
    check(more.every(m => !m.none), 'more quests accepted through the talk (' + more.map(m => m.k).join(', ') + ')');
  });

  // ---------------------------------------------------------------- 4 · the riddle
  await section('4', async () => {
    console.log('4 · a riddle');
    await toGame();
    // an open riddle (accepted just now), today's offer, or the first day a villager here has one
    const rf = await ev(() => {
      const g = VR.game, V = g.villages, Q = VR.Quests, r0 = VR.Adventure.rec, d0 = g.env.day;
      for (const a of V.agents) { const r = Q.get(r0, a.p.id); if (r && r.k === 'riddle' && r.st === 'open') { window.__qr = a; return { open: true, name: a.p.name, rid: r.q.rid, day: d0 }; } }
      for (let d = d0; d < d0 + 60; d++) {
        g.env.day = d;
        for (const a of V.agents) { if (Q.get(r0, a.p.id)) continue; a._qoff = null; const o = Q.offerOf(a); if (o && o.k === 'riddle') { window.__qr = a; Q.mark(V); return { open: false, name: a.p.name, role: a.role, rid: o.q.rid, day: d, d0 }; } }
      }
      g.env.day = d0; return null;
    });
    console.log('     ' + JSON.stringify(rf));
    check(!!rf, 'a riddle in ' + (site ? site.name : 'the village') + (rf ? ' (' + rf.name + ', day ' + rf.day + ': ' + rf.rid + ')' : ''));
    if (!rf) return;
    const c = await ev(() => window.__qt.frame(window.__qr, 2.6, 1.7, 1.4));
    if (!c) console.log('     (no free spot in front of the riddle giver: the talk over the last view)');
    await draw(9600);
    await ev(() => { VR.game.villages.openTalk(window.__qr); document.querySelector('#tk_opts [data-q="quest"]').click(); });
    await wait(250);
    if (!rf.open) {
      const q = await ev(() => document.querySelector('#tk_text').textContent);
      check(/^Ich habe ein Rätsel für dich!/.test(q), 'the offer: „' + q.slice(0, 110) + '"');
      await ev(() => document.querySelector('#tk_opts [data-q="accept"]').click());
      await wait(250);
    }
    const rid = await ev(() => { const bs = [...document.querySelectorAll('#tk_opts [data-q="answer"]')], r = VR.Quests.get(VR.Adventure.rec, window.__qr.p.id); return { n: bs.length, texts: bs.map(b => b.textContent), text: document.querySelector('#tk_text').textContent, order: r && r.q.order, rid: r && r.q.rid }; });
    console.log('     ' + JSON.stringify(rid));
    check(rid.n === 3 && new Set(rid.texts).size === 3 && rid.text.length > 15, 'accepted: the question stays, the three answers at once (' + rid.texts.join(' | ') + ')');
    pics.riddle = await shot('abenteuer_quest_riddle');
    const before = await ev(() => { const me = VR.Adventure.rec.me; return { xp: me.xp, taler: me.taler, rep: window.__qr.vil.st.rep || 0 }; });
    const wrong = await ev(() => { const r = VR.Quests.get(VR.Adventure.rec, window.__qr.p.id), i = r.q.order.findIndex(v => v !== 0); document.querySelector(`#tk_opts [data-q="answer"][data-i="${i}"]`).click(); const b = document.querySelector(`#tk_opts [data-q="answer"][data-i="${i}"]`); return { i, text: document.querySelector('#tk_text').textContent, dis: !!(b && b.disabled), tried: !!(b && b.classList.contains('tried')), still: !!VR.Quests.get(VR.Adventure.rec, window.__qr.p.id), xp: VR.Adventure.rec.me.xp }; });
    check(wrong.dis && wrong.tried && wrong.still && wrong.xp === before.xp && /nicht ganz/.test(wrong.text), 'a wrong answer: struck through, „' + wrong.text + '", nothing lost');
    await ev(() => { const r = VR.Quests.get(VR.Adventure.rec, window.__qr.p.id), i = r.q.order.indexOf(0); document.querySelector(`#tk_opts [data-q="answer"][data-i="${i}"]`).click(); });
    await wait(300);
    const right = await ev(() => { const me = VR.Adventure.rec.me; return { text: document.querySelector('#tk_text').textContent, xp: me.xp, taler: me.taler, rep: window.__qr.vil.st.rep || 0, open: !!VR.Quests.get(VR.Adventure.rec, window.__qr.p.id), log: VR.Quests.log(VR.Adventure.rec).length, hearts: (document.querySelector('#tk_rep') || {}).textContent }; });
    console.log('     „' + right.text + '"');
    N.riddle = { before, after: { xp: right.xp, taler: right.taler, rep: right.rep } };
    check(!right.open && right.xp - before.xp >= 20 && right.taler - before.taler >= 15 && right.rep - before.rep === 2 && /^Richtig!/.test(right.text) && /\+20 EP · \+15 Heliataler · ♥ \+1/.test(right.text), 'the right answer: „Richtig!", why, +20 EP · +15 Heliataler · ♥ +1 (' + (right.xp - before.xp) + ' EP, ' + (right.taler - before.taler) + ' Taler, love ' + before.rep + ' → ' + right.rep + ')');
    await step(3); await draw();
    pics.reward = await shot('abenteuer_quest_reward');
    await toGame();
  });

  // ---------------------------------------------------------------- 5 · the Tagebuch
  await section('5', async () => {
    console.log('5 · the Tagebuch');
    await toGame();
    await ev(() => { const a = window.__qa; if (a) window.__qt.frame(a, 5, 2.2, 1.4); });
    await draw(9600);
    await page.keyboard.press('j');
    await wait(400);
    const jn = await ev(() => { const s = document.getElementById('journal'), p = s && s.querySelector('.panel'); return { screen: VR.game.ui.screen, shown: !!s && getComputedStyle(s).display !== 'none', cards: p ? p.querySelectorAll('.jq').length : 0, tracked: p ? p.querySelectorAll('.jq.tracked').length : 0, where: p ? [...p.querySelectorAll('.jq .jl')].filter(e => /🧭/.test(e.textContent)).map(e => e.textContent) : [], chips: p ? p.querySelectorAll('.jq .chip').length : 0, done: p ? p.querySelectorAll('.jdone > div').length : 0, title: p && p.querySelector('h2') ? p.querySelector('h2').textContent : '', h: p ? Math.round(p.getBoundingClientRect().height) : 0, open: VR.Quests.open(VR.Adventure.rec).length }; });
    console.log('     ' + JSON.stringify(jn));
    check(jn.screen === 'journal' && jn.shown && jn.title === '📖 Tagebuch', 'J opens „📖 Tagebuch"');
    check(jn.cards === jn.open && jn.cards >= 1 && jn.tracked === 1 && jn.chips >= 3 * jn.cards, 'every open quest a card (' + jn.cards + '), one tracked, its reward as chips (EP, Heliataler, ♥)');
    check(jn.where.length >= 1 && jn.where.every(t => /\d+ m Richtung/.test(t) || /Zurück|Himmel/.test(t)), 'where, how far and which way: ' + jn.where.join(' | '));
    check(jn.done >= 1, 'the riddle under „Zuletzt erledigt" (' + jn.done + ')');
    check(jn.h <= 700, 'the Tagebuch fits a 720-px screen (' + jn.h + ' px)');
    pics.journal = await shot('abenteuer_journal');
    const tr = await ev(() => { const b = [...document.querySelectorAll('#journal [data-jact="track"]')].find(x => !x.classList.contains('on')); if (!b) return null; const pid = b.getAttribute('data-pid'); b.click(); return { pid, now: VR.Adventure.rec.me.quests['~track'], on: !!document.querySelector(`#journal [data-jact="track"][data-pid="${pid}"].on`) }; });
    check(!tr || (tr.now === tr.pid && tr.on), '🧭 tracks another quest' + (tr ? '' : ' (only one open)'));
    await page.keyboard.press('j'); await wait(250);
    check(await screen() === null, 'J again closes it');
    await step(12);
    const comp = await ev(() => ({ html: document.getElementById('compass').textContent, t: VR.Quests.target() }));
    console.log('     ' + JSON.stringify(comp).slice(0, 300));
    check(/✦/.test(comp.html) && !!comp.t, 'the compass shows the tracked quest: „' + comp.html.split('✦').slice(-1)[0].trim() + '"');
    await page.keyboard.press('j'); await wait(200);
    const s1 = await screen();
    await page.keyboard.press('Escape'); await wait(250);
    const s2 = await screen();
    check(s1 === 'journal' && s2 === null, 'Esc closes it too (' + s1 + ' → ' + s2 + ')');
    await ev(() => VR.game.ui.pause()); await wait(350);
    const pz = await ev(() => { const b = document.querySelector('#pause [data-act="journal"]'); return b ? { text: b.textContent, prev: b.previousElementSibling && b.previousElementSibling.dataset.act, shown: getComputedStyle(b).display !== 'none' } : null; });
    check(!!pz && pz.text === '📖 Tagebuch' && pz.prev === 'adventure' && pz.shown, 'the pause menu: „📖 Tagebuch" after „⚔ Abenteuer" (' + JSON.stringify(pz) + ')');
    pics.pause = await shot('abenteuer_pause');
    await ev(() => document.querySelector('#pause [data-act="journal"]').click()); await wait(250);
    const s3 = await screen();
    await page.keyboard.press('Escape'); await wait(250);
    const s4 = await screen();
    check(s3 === 'journal' && s4 === 'pause', 'from the pause menu: Esc steps back to it (' + s3 + ' → ' + s4 + ')');
    await toGame();
  });

  // ---------------------------------------------------------------- 5b · the lost thing: at the vista, found, handed back
  await section('5b', async () => {
    console.log('5b · the lost thing (Suchen)');
    await toGame();
    const fq = await ev(() => {
      const Q = VR.Quests, r0 = VR.Adventure.rec, V = VR.game.villages;
      const r = Q.open(r0).find(x => x.k === 'find' && x.st === 'open' && !x.q.got); if (!r) return null;
      const vil = V.known.get(r.vid), places = vil ? Q.placesFor(vil) : null, lm = places ? places.find(p => p.kind === 'lm' && p.lm === r.q.at.lm) : null;
      return { pid: r.pid, thing: r.q.thing, spot: r.q.spot, at: { x: r.q.at.x, y: r.q.at.y, z: r.q.at.z, lm: r.q.at.lm, kind: r.q.at.kind }, lm: lm ? { x: lm.x, z: lm.z, top: lm.top } : null, title: Q.title(r), vid: r.vid };
    });
    console.log('     ' + JSON.stringify(fq));
    if (!fq) { console.log('     (no open Suchen quest: skipped)'); return; }
    // to the place (4 blocks short of the spot, on the side away from the landmark the vista faces)
    const dx = fq.lm ? fq.lm.x - fq.spot[0] : 0, dz = fq.lm ? fq.lm.z - fq.spot[1] : -1, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const st = await arrive({ x: fq.spot[0] - ux * 4, y: Number.isFinite(fq.at.y) ? fq.at.y : 80, z: fq.spot[1] - uz * 4 });
    check(!!st && !st.dead && !st.hold && st.loaded, 'at the place of the lost ' + fq.thing + ' (' + JSON.stringify(st) + ')');
    // the timer (twice a second) finds the ground under the spot; the thing lies there
    let sy = null;
    for (let i = 0; i < 20 && !Number.isFinite(sy); i++) { await step(2); await wait(600); sy = await ev((pid) => { const r = VR.Quests.get(VR.Adventure.rec, pid); return r ? r.q.sy : null; }, fq.pid); }
    check(Number.isFinite(sy), 'the ground under the spot found by the timer (y ' + sy + ')');
    if (!Number.isFinite(sy)) return;
    await ev(([fq, sy, ux, uz]) => { const p = VR.game.player, air = window.__qt.air; p.flying = true; p.hold = null; const cx = fq.spot[0] - ux * 3.6, cz = fq.spot[1] - uz * 3.6; let cy = sy + 0.3; for (let k = 0; k < 10 && !(air(cx, cy + 0.4, cz) && air(cx, cy + 1.62, cz)); k++) cy += 1; p.teleport(cx, cy, cz); const tx = fq.spot[0] + ux * 9, tz = fq.spot[1] + uz * 9, ty = sy + 0.6; const ddx = tx - cx, ddz = tz - cz, ddy = ty - (cy + 1.62); p.yaw = Math.atan2(-ddx, -ddz); p.viewYaw = p.yaw; p.pitch = Math.atan2(ddy, Math.hypot(ddx, ddz)); }, [fq, sy, ux, uz]);
    await wait(700);
    const tg = await ev(() => (VR.Quests.drawTargets || []).map(d => d.kind));
    const d0 = await ev(() => VR.Quests.stats.draws);
    await draw(10600);
    const d1 = await ev(() => VR.Quests.stats.draws);
    check(tg.includes(fq.thing) && d1 > d0, 'the lost ' + fq.thing + ' lies at the vista, the evening light behind (targets: ' + tg.join(', ') + '; ' + (d1 - d0) + ' draws)');
    pics.find = await shot('abenteuer_quest_find');
    // picked up: standing on the spot
    await ev(([fq, sy]) => { const p = VR.game.player; p.teleport(fq.spot[0], sy, fq.spot[1]); }, [fq, sy]);
    let got = null;
    for (let i = 0; i < 8; i++) { await step(2); await wait(600); got = await ev((pid) => { const r = VR.Quests.get(VR.Adventure.rec, pid); return r ? { st: r.st, got: r.q.got } : null; }, fq.pid); if (got && got.st === 'ready') break; }
    const toast = await ev(() => [...document.querySelectorAll('#toasts > *')].map(t => t.textContent).join(' | '));
    check(!!got && got.st === 'ready' && got.got && /Gefunden/.test(toast), 'picked up: „' + toast.slice(-90) + '"');
    // back to the giver: the cyan ✦, „✓ Erledigt!", the reward
    const home = await ev((vid) => { const V = VR.game.villages, s = V.sites.find(x => x.id === vid) || (V.known.get(vid) && V.known.get(vid).plan); return s ? { id: vid, x: s.x, y: s.y, z: s.z } : null; }, fq.vid);
    const st2 = await arrive(home);
    check(!!st2 && st2.active && !st2.dead, 'back in the village (' + JSON.stringify(st2) + ')');
    await wait(700);
    const gv = await ev((pid) => { const V = VR.game.villages, a = V.agents.find(x => x.p && x.p.id === pid); window.__qf = a || null; return a ? { name: a.name, mark: a.qMark } : null; }, fq.pid);
    check(!!gv && gv.mark === 2, 'the giver carries the cyan ✦ (ready to hand in): ' + JSON.stringify(gv));
    if (!gv) return;
    const before = await ev(() => ({ xp: VR.Adventure.rec.me.xp, taler: VR.Adventure.rec.me.taler }));
    await ev(() => window.__qt.frame(window.__qf, 2.7, 1.75, 1.35));
    await draw(10600);
    await ev(() => VR.game.villages.openTalk(window.__qf)); await wait(250);
    const rb = await ev(() => { const b = document.querySelector('#tk_opts [data-q="quest"]'); return b ? b.textContent : null; });
    check(rb === '✓ Erledigt!', 'the talk: „✓ Erledigt!" (' + rb + ')');
    if (rb) await ev(() => document.querySelector('#tk_opts [data-q="quest"]').click());
    await wait(300);
    const done = await ev((pid) => ({ text: document.querySelector('#tk_text').textContent, open: !!VR.Quests.get(VR.Adventure.rec, pid), xp: VR.Adventure.rec.me.xp, taler: VR.Adventure.rec.me.taler }), fq.pid);
    console.log('     „' + done.text + '"');
    check(!done.open && done.xp - before.xp >= 20 && done.taler - before.taler >= 15 && /gefunden/.test(done.text) && /Heliataler/.test(done.text), 'handed back: „' + done.text.slice(0, 120) + '" (+' + (done.xp - before.xp) + ' EP, +' + (done.taler - before.taler) + ' Heliataler)');
    pics.done = await shot('abenteuer_quest_done');
    await toGame();
  });

  // ---------------------------------------------------------------- 6 · the shops
  await section('6', async () => {
    console.log('6 · the shops: the Hangar');
    await toGame();
    await ev(() => VR.game.env.setTime(6500));   // (the working hours: the keepers at their counters)
    await step(20);
    const kp = await ev(() => { const V = VR.game.villages, h = V.agents.find(a => (a.role === 'pilot' || a.role === 'operator') && a.pose !== 'sleep') || null; window.__qh = h; return { hangar: h ? h.name + ' (' + h.role + ')' : null, roles: [...new Set(V.agents.map(a => a.role))].join(', ') }; });
    console.log('     ' + JSON.stringify(kp));
    // 🚀 the Hangar: the pilot's or the flight controller's (or opened directly), the engine's first step, selling iron
    await ev(() => { const me = VR.Adventure.rec.me; me.taler = 700; VR.Adventure.renderHud(true); });   // (the engine's first step: 600)
    if (kp.hangar) {
      await ev(() => window.__qt.frame(window.__qh, 2.6, 1.7, 1.4));
      await draw(6500);
      await ev(() => VR.game.villages.openTalk(window.__qh)); await wait(250);
      const hb = await ev(() => { const b = document.querySelector('#tk_opts [data-shop="hangar"]'); return b ? b.textContent : null; });
      check(hb === '🚀 Zum Hangar', 'the ' + kp.hangar + '\'s talk: „🚀 Zum Hangar"');
      await ev(() => document.querySelector('#tk_opts [data-shop="hangar"]').click());
    } else {
      console.log('     (no pilot here: the Hangar opened directly)');
      await ev(() => VR.Shop.open('hangar', null, null));
    }
    await wait(300);
    const eng = await ev(() => { const me = VR.Adventure.rec.me, t0 = me.taler, p = document.querySelector('#shop .panel'), ups = p.querySelectorAll('.shopitem .sico').length, b = p.querySelector('[data-sact="buy"][data-key="up:engine"]'); if (!b) return { none: true, ups }; b.click(); const row = [...document.querySelectorAll('#shop .shopitem')].find(r => r.querySelector('[data-key="up:engine"]')); return { ups, paid: t0 - me.taler, price0: VR.Adv.PRICES.engine[0], step: me.owned && me.owned.engine, pips: row ? row.querySelectorAll('.pips i.on').length : -1, pipsAll: row ? row.querySelectorAll('.pips i').length : -1, msg: (document.querySelector('#shop .shopmsg') || {}).textContent, title: p.querySelector('h2').textContent, tabs: [...document.querySelectorAll('#shop .shoptabs button')].map(x => x.textContent), h: Math.round(p.getBoundingClientRect().height) }; });
    console.log('     ' + JSON.stringify(eng));
    check(!eng.none && eng.title === '🚀 Hangar' && eng.ups >= 4 && eng.step === 1 && eng.paid === eng.price0 && eng.pips === 1 && eng.pipsAll >= 2, 'the Hangar: the engine\'s first step bought (' + eng.paid + ' Heliataler; the pips ' + eng.pips + ' of ' + eng.pipsAll + ', „' + eng.msg + '")');
    check(eng.h <= 700, 'the Hangar fits a 720-px screen (' + eng.h + ' px)');
    pics.hangar = await shot('abenteuer_shop_hangar');
    const sell = await ev(() => { const g = VR.game, me = VR.Adventure.rec.me; g.player.inv.add('iron_ingot', 6); document.querySelector('#shop [data-sact="tab"][data-key="sell"]').click(); const t0 = me.taler, n0 = g.player.inv.count('iron_ingot'), b = document.querySelector('#shop [data-sact="sell"][data-key="iron_ingot"][data-n="1"]'); if (b) b.click(); return { listed: !!b, got: me.taler - t0, n0, left: g.player.inv.count('iron_ingot'), price: VR.Adv.sellPrice('iron_ingot'), msg: (document.querySelector('#shop .shopmsg') || {}).textContent, rows: document.querySelectorAll('#shop .shopitem').length }; });
    console.log('     ' + JSON.stringify(sell));
    check(sell.listed && sell.got === sell.price && sell.left === sell.n0 - 1 && /verkauft/.test(sell.msg || ''), 'selling (Überleben): one iron ingot for ' + sell.price + ' Heliataler — „' + sell.msg + '"');
    pics.sell = await shot('abenteuer_shop_sell');
    await toGame();
  });

  await section('6b', async () => {
    console.log('6b · the shops: the supermarket and its cashier');
    await toGame();
    // a cashier here, or in the next village (the Heartland's city has no market)
    const findCashier = () => ev(() => { const V = VR.game.villages, a = V.agents.find(x => x.role === 'cashier' && x.pose !== 'sleep') || null; window.__qc = a; return a ? { name: a.name, vil: a.vil.name } : null; });
    let cas = await findCashier();
    if (!cas) {
      const other = await ev((id) => { const g = VR.game, V = g.villages, p = g.player; const s = V.sites.filter(x => x.id !== id).sort((a, b) => Math.hypot(a.x - p.pos[0], a.z - p.pos[2]) - Math.hypot(b.x - p.pos[0], b.z - p.pos[2]))[0]; return s ? { id: s.id, x: s.x, y: s.y, z: s.z, name: s.name, d: Math.round(Math.hypot(s.x - p.pos[0], s.z - p.pos[2])) } : null; }, site ? site.id : null);
      console.log('     no cashier in ' + (site ? site.name : 'the village') + ': to ' + JSON.stringify(other));
      if (other) {
        await ev(() => VR.game.env.setTime(6500));
        const st = await arrive(other);
        console.log('     ' + JSON.stringify(st));
        check(!!st && st.active && !st.dead, 'arrived in ' + other.name + ' (' + JSON.stringify(st) + ')');
        await step(40);
        cas = await findCashier();
      }
    }
    console.log('     the cashier: ' + JSON.stringify(cas));
    await ev(() => { const me = VR.Adventure.rec.me; me.taler = 260; VR.Adventure.renderHud(true); });
    if (cas) {
      // at the till: the cashier invites once when the player comes near (shop.js, villages.js's one line)
      const till = await ev(() => { const a = window.__qc, shop = (a.vil.workOf.cashier || [])[0], sh = shop && shop.shop; if (!sh) return null; const t = sh.tills[a.p.idx % sh.tills.length]; return { lane: t.lane, cashier: t.cashier }; });
      console.log('     the till: ' + JSON.stringify(till));
      let said = null;
      if (till) {
        await ev((t) => { const p = VR.game.player; p.flying = true; p.hold = null; p.teleport(t.lane[0] + 0.5, t.lane[1], t.lane[2] + 0.5); const dx = t.cashier[0] - t.lane[0], dz = t.cashier[2] - t.lane[2]; p.yaw = Math.atan2(-dx, -dz); p.viewYaw = p.yaw; p.pitch = -0.08; }, till);
        for (let i = 0; i < 24 && !said; i++) { await step(10); said = await ev(() => { const a = window.__qc, want = VR.I18N.t('g.shop.till', { n: a.p.name }); return a.bubble && a.bubble.t > 0 && a.bubble.text === want ? a.bubble.text : null; }); }
        const ws = await ev(() => { const a = window.__qc; return { act: a.act && a.act.type, pose: a.pose, d: Math.round(Math.hypot(a.pos[0] - VR.game.player.pos[0], a.pos[2] - VR.game.player.pos[2]) * 10) / 10 }; });
        console.log('     ' + JSON.stringify({ said, ws }));
        if (ws.act === 'work') check(!!said, 'at the till the cashier invites: „' + said + '"');
        else console.log('     (the cashier is not at work now: ' + ws.act + ' — no invitation to check)');
        if (said) {
          await ev((t) => { const p = VR.game.player, a = window.__qc, dx = a.pos[0] - p.pos[0], dz = a.pos[2] - p.pos[2], dy = a.pos[1] + 1.5 - (p.pos[1] + 1.62); p.yaw = Math.atan2(-dx, -dz); p.viewYaw = p.yaw; p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, till);
          await draw(6500);
          pics.till = await shot('abenteuer_cashier_till');
        }
      }
      if (!pics.till) { await ev(() => window.__qt.frame(window.__qc, 2.6, 1.7, 1.4)); await draw(6500); }
      await ev(() => VR.game.villages.openTalk(window.__qc)); await wait(250);
      const sb = await ev(() => { const b = document.querySelector('#tk_opts [data-shop="supermarkt"]'); return b ? b.textContent : null; });
      check(sb === '🛒 Einkaufen', 'the cashier\'s talk: „🛒 Einkaufen" (' + cas.name + ', ' + cas.vil + ')');
      await ev(() => document.querySelector('#tk_opts [data-shop="supermarkt"]').click());
    } else {
      console.log('     (no market near: the supermarket opened directly)');
      await ev(() => VR.Shop.open('supermarkt', null, null));
    }
    await wait(300);
    const sh = await ev(() => { const p = document.querySelector('#shop .panel'); return { screen: VR.game.ui.screen, title: p.querySelector('h2').textContent, keeper: (p.querySelector('.shophead .note') || {}).textContent || '', cats: [...p.querySelectorAll('.shopcats button')].map(b => b.textContent), items: p.querySelectorAll('.shopitem').length, tal: p.querySelector('.shoptal b').textContent, icons: p.querySelectorAll('canvas[data-icon]').length, h: Math.round(p.getBoundingClientRect().height) }; });
    console.log('     ' + JSON.stringify(sh));
    check(sh.screen === 'shop' && sh.title === '🛒 Supermarkt' && sh.cats.length >= 8 && sh.items >= 3 && sh.icons === sh.items, 'the supermarket: ' + sh.cats.length + ' shelves (' + sh.cats.slice(0, 5).join(', ') + ' …), ' + sh.items + ' things on the first, each with its icon' + (sh.keeper ? ' — „' + sh.keeper + '"' : ''));
    check(sh.h <= 700, 'the shop fits a 720-px screen (' + sh.h + ' px)');
    await ev(() => { const b = document.querySelector('#shop [data-sact="cat"][data-key="fruit"]'); if (b) b.click(); });
    const buy = await ev(() => { const me = VR.Adventure.rec.me, t0 = me.taler, b = document.querySelector('#shop [data-sact="buy"]'), key = b.getAttribute('data-key'), e = VR.Shop.entry('supermarkt', key), n0 = VR.game.player.inv.count(e.id); b.click(); return { key, price: e.price, paid: t0 - me.taler, got: VR.game.player.inv.count(e.id) - n0, msg: (document.querySelector('#shop .shopmsg') || {}).textContent, tal: document.querySelector('#shop .shoptal b').textContent }; });
    console.log('     ' + JSON.stringify(buy));
    check(buy.paid === buy.price && buy.got === 1 && /gekauft/.test(buy.msg || ''), 'bought: „' + buy.msg + '" (' + buy.price + ' Heliataler, one in the backpack, the wallet shows ' + buy.tal + ')');
    pics.supermarkt = await shot('abenteuer_shop_supermarkt');
    const poor = await ev(() => { const me = VR.Adventure.rec.me; me.taler = 2; VR.Shop.render(); const b = [...document.querySelectorAll('#shop [data-sact="buy"]')].find(x => VR.Shop.entry('supermarkt', x.getAttribute('data-key')).price > 2); const key = b.getAttribute('data-key'), e = VR.Shop.entry('supermarkt', key), n0 = VR.game.player.inv.count(e.id); b.click(); return { price: e.price, taler: me.taler, got: VR.game.player.inv.count(e.id) - n0, msg: (document.querySelector('#shop .shopmsg') || {}).textContent, no: !!document.querySelector('#shop .shopmsg.no'), poorRows: document.querySelectorAll('#shop .shopitem.poor').length }; });
    check(poor.taler === 2 && poor.got === 0 && poor.no && /fehlen dir noch \d+ Heliataler/.test(poor.msg || ''), 'too few Taler: „' + poor.msg + '" — nothing paid, nothing given (' + poor.poorRows + ' things greyed)');
    pics.poor = await shot('abenteuer_shop_poor');
    await page.keyboard.press('Escape'); await wait(250);
    const back = await screen();
    check(back === (cas ? 'talk' : null), 'Esc: back to ' + (cas ? 'the talk' : 'the game') + ' (' + back + ')');
    await toGame();
  });

  // ---------------------------------------------------------------- 7 · the numbers
  await section('7', async () => {
    console.log('7 · the numbers');
    await toGame();
    // (the player 40 blocks up while the timer is timed: no repair or find spot can count it as standing there)
    await ev(() => { const p = VR.game.player; p.flying = true; p.teleport(p.pos[0], p.pos[1] + 40, p.pos[2]); });
    const gen = await ev(() => {
      const g = VR.game, V = g.villages, Q = VR.Quests, vil = [...V.known.values()].find(v => v.active), places = Q.placesFor(vil), P = vil.plan;
      const village = { x: P.x, y: P.y, z: P.z, name: vil.name, plaza: P.plaza ? [P.plaza.x, P.plaza.y, P.plaza.z] : [P.x, P.y, P.z] };
      const seed = (g.meta.seed >>> 0) || 0, ag = vil.agents, n = 2000, kinds = {};
      let t0 = performance.now();
      for (let i = 0; i < n; i++) { const a = ag[i % ag.length]; const q = Q.make({ seed, vid: vil.id, pid: a.p.id, day: i, role: a.p.role || a.role, age: a.p.age || (a.kid ? 'child' : a.elder ? 'elder' : 'adult'), name: a.p.name, village, places }); if (q) kinds[q.k] = (kinds[q.k] || 0) + 1; }
      const make = (performance.now() - t0) / n;
      t0 = performance.now(); for (let i = 0; i < 500; i++) Q.givers(seed, vil.id, i, vil.people); const givers = (performance.now() - t0) / 500;
      t0 = performance.now(); for (let i = 0; i < 200; i++) Q.mark(V); const markCached = (performance.now() - t0) / 200;
      let fresh = 0; const d0 = g.env.day;
      for (let i = 0; i < 20; i++) { g.env.day = d0 + 100 + i; for (const a of V.agents) a._qoff = null; const t1 = performance.now(); Q.mark(V); fresh += performance.now() - t1; }
      g.env.day = d0; for (const a of V.agents) a._qoff = null; Q.mark(V);
      t0 = performance.now(); for (let i = 0; i < 200; i++) Q.tick(); const tick = (performance.now() - t0) / 200;
      return { make: +make.toFixed(4), givers: +givers.toFixed(4), markCached: +markCached.toFixed(4), markNewDay: +(fresh / 20).toFixed(4), tick: +tick.toFixed(4), kinds, places: places.length, people: vil.people.length, agents: V.agents.length };
    });
    console.log('     ' + JSON.stringify(gen));
    N.gen = gen;
    check(gen.make <= 0.2, 'Q.make in the page: ' + (gen.make * 1000).toFixed(1) + ' µs a quest (≤ 0.2 ms; 2000 quests of ' + gen.people + ' villagers over 2000 days)');
    check(Object.keys(gen.kinds).length >= 6, 'the kinds over 2000 days: ' + JSON.stringify(gen.kinds));
    check(gen.markNewDay <= 1 && gen.tick <= 0.5, 'the 2-Hz work: the marks ' + (gen.markCached * 1000).toFixed(1) + ' µs (a new day ' + (gen.markNewDay * 1000).toFixed(1) + ' µs), the whole tick ' + (gen.tick * 1000).toFixed(1) + ' µs — twice a second, not per frame');
    // Q.draw per drawn frame near the givers (Very Low), and nothing without a mark
    await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('renderDist'); });
    // (a marked giver in view: today's givers here — another day when everyone here is done)
    const mk = await ev(() => { const g = VR.game, V = g.villages, Q = VR.Quests; let a = null; for (let i = 0; i < 6 && !a; i++) { Q.mark(V); a = V.agents.find(x => x.qMark && window.__qt.camFor(x, 5, 2.2, 1.4)); if (!a) g.env.day++; } if (a) window.__qt.frame(a, 5, 2.2, 1.4); return a ? { name: a.name, mark: a.qMark, day: g.env.day } : null; });
    console.log('     framed for Q.draw: ' + JSON.stringify(mk));
    await step(4);
    await ev(() => { const Q = VR.Quests; if (!Q.__d) { const od = Q.draw; Q.__d = { t: 0, n: 0, od }; Q.draw = function () { const t = performance.now(); try { return od.apply(this, arguments); } finally { Q.__d.t += performance.now() - t; Q.__d.n++; } }; } Q.__d.t = 0; Q.__d.n = 0; Q.__d.s0 = Q.stats.draws; });
    for (let i = 0; i < 4; i++) await draw();
    const qd = await ev(() => { const Q = VR.Quests, d = Q.__d; return { ms: d.n ? d.t / d.n : 0, calls: d.n, stars: Q.stats.draws - d.s0, marks: Q.stats.marks, err: Q.stats.drawErr, lastErr: Q.lastDrawErr || null }; });
    await ev(() => { VR.Adventure.setOn(false); VR.Quests.mark(VR.game.villages); const d = VR.Quests.__d; d.t = 0; d.n = 0; d.s0 = VR.Quests.stats.draws; VR.Quests.drawTargets = null; });
    for (let i = 0; i < 2; i++) await draw();
    const qd0 = await ev(() => { const Q = VR.Quests, d = Q.__d; return { ms: d.n ? d.t / d.n : 0, calls: d.n, stars: Q.stats.draws - d.s0, marks: Q.stats.marks }; });
    await ev(() => { VR.Adventure.setOn(true); const Q = VR.Quests; Q.draw = Q.__d.od; delete Q.__d; Q.mark(VR.game.villages); });
    N.qdraw = { on: qd, off: qd0 };
    console.log('     ' + JSON.stringify(N.qdraw));
    if (!mk) console.log('     (no marked giver with a free view here: the star draw not timed)');
    else check(qd.stars >= 1 && qd.ms < 2, 'Q.draw on Very Low: ' + qd.ms.toFixed(3) + ' ms a call with ' + qd.marks + ' ✦ near (' + qd.stars + ' star draws in ' + qd.calls + ' calls; SwiftShader' + (qd.err ? '; ' + qd.err + ' errors: ' + qd.lastErr : '') + ')');
    check(qd0.stars === 0 && qd0.ms < 0.02, 'the Abenteuer off: no star, the draw hook returns at once (' + qd0.ms.toFixed(4) + ' ms a call)');
    // the game loop on Very Low and High, the Abenteuer off and on (alternating blocks of 200 frames, CPU, drawing off)
    const frames = (n) => ev((n) => { const g = VR.game; window.__norender = true; const a = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } return (performance.now() - a) / n; }, n);
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    N.cost = {};
    for (const preset of ['potato', 'high']) {
      await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('renderDist'); }, preset);
      await step(120);
      const offs = [], ons = [];
      for (let r = 0; r < 5; r++) {
        await ev(() => VR.Adventure.setOn(false)); await step(20); offs.push(await frames(200));
        await ev(() => VR.Adventure.setOn(true)); await step(20); ons.push(await frames(200));
      }
      // (the best block of each side: a shared machine's bursts land in whole blocks — run 2 had blocks from 1.5 to
      // 7.8 ms on both sides; the medians are kept in the numbers too)
      const o = Math.min(...offs), n = Math.min(...ons);
      N.cost[preset] = { off: +o.toFixed(3), on: +n.toFixed(3), medOff: +med(offs).toFixed(3), medOn: +med(ons).toFixed(3), offs: offs.map(v => +v.toFixed(3)), ons: ons.map(v => +v.toFixed(3)) };
      check(n <= o * 1.1 + 0.1, (preset === 'potato' ? 'Very Low' : 'High') + ': the game loop ' + o.toFixed(3) + ' ms off → ' + n.toFixed(3) + ' ms on with ' + (await ev(() => VR.Quests.open(VR.Adventure.rec).length)) + ' quests open (the best of five blocks of 200 frames each; CPU, drawing off; test/quests_cost.js times the hooks themselves)');
    }
    await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('renderDist'); });
    // the record in IndexedDB
    const saved = await ev(async () => { const g = VR.game; await g.saveMeta(); const ws = await g.store.listWorlds(); const w = ws.find(x => x.id === g.meta.id), q = w && w.adventure && w.adventure.me.quests; return q ? { open: Object.keys(q).filter(k => k[0] !== '~').length, live: VR.Quests.open(VR.Adventure.rec).length, log: (q['~log'] || []).length, track: q['~track'] || null, engine: w.adventure.me.owned && w.adventure.me.owned.engine, bytes: JSON.stringify(q).length } : null; });
    console.log('     ' + JSON.stringify(saved));
    N.saved = saved;
    check(!!saved && saved.open === saved.live && saved.log >= 1 && saved.engine === 1, 'the quests in IndexedDB with the world: ' + (saved ? saved.open + ' open, ' + saved.log + ' done, the engine step kept, ' + saved.bytes + ' bytes' : 'none'));
  });

  // ---------------------------------------------------------------- no page errors
  const pageErrs = logs.filter(l => l.startsWith('[pageerror]'));
  check(pageErrs.length === 0, 'no page errors (' + pageErrs.length + ')' + (pageErrs.length ? '\n' + pageErrs.slice(0, 4).join('\n') : ''));
  const qErrs = logs.filter(l => /quests|Quests|shop|Shop|journal/.test(l));
  check(qErrs.length === 0, 'no console message from the quests or the shops (' + qErrs.length + ')' + (qErrs.length ? '\n' + qErrs.slice(0, 4).join('\n') : ''));
  console.log('console messages: ' + logs.length + (logs.length ? '\n' + logs.slice(0, 10).join('\n') : ''));
} catch (e) {
  fails++; console.log('  ✗ the run stopped: ' + (e.stack || e.message).slice(0, 1200));
  try { await page.screenshot({ path: SHOTS + 'abenteuer_fail.png' }); } catch (e2) { /* */ }
} finally {
  fs.writeFileSync(SHOTS + 'abenteuer_numbers.json', JSON.stringify(N, null, 1));
  try {
    // (the sheet's labels: plain letters — sheet.py's font has no emoji, no umlauts and no „ quotes)
    const spec = { cols: [], w: 640, rows: [
      { label: 'create', labels: ['1 - Neue Welt bei 1280x720: Welt erstellen ohne Scrollen', '3 - der Stern ueber dem Kopf: ein Auftrag'], imgs: [pics.create || null, pics.marker || null] },
      { label: 'talk', labels: ['3 - das Angebot im Gespraech', '4 - ein Raetsel: drei Antworten'], imgs: [pics.offer || null, pics.riddle || null] },
      { label: 'reward', labels: ['4 - richtig: EP, Heliataler, ein Herz', '5 - das Tagebuch (J)'], imgs: [pics.reward || null, pics.journal || null] },
      { label: 'find', labels: ['5b - der vergessene Schal am Aussichtspunkt', '5b - zurueckgebracht: Erledigt'], imgs: [pics.find || null, pics.done || null] },
      { label: 'hangar', labels: ['6 - Hangar: Antrieb Stufe 1', '6 - Verkaufen im Hangar (Ueberleben)'], imgs: [pics.hangar || null, pics.sell || null] },
      { label: 'till', labels: ['6b - an der Kasse: die Kassiererin laedt ein', '6b - Supermarkt: gekauft'], imgs: [pics.till || null, pics.supermarkt || null] },
      { label: 'pause', labels: ['6b - zu wenig Heliataler', '5 - Pause: Tagebuch nach Abenteuer'], imgs: [pics.poor || null, pics.pause || null] },
    ] };
    fs.writeFileSync(SHOTS + 'abenteuer_sheet.json', JSON.stringify(spec));
    execFileSync('python3', ['/root/r9coord/sheet.py', SHOTS + 'abenteuer_sheet.jpg', SHOTS + 'abenteuer_sheet.json'], { stdio: 'inherit' });
  } catch (e) { console.log('sheet: ' + e.message); }
  await browser.close();
  console.log('numbers ' + JSON.stringify(N));
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
}

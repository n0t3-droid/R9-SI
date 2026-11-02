// regress: skip — f-quiet2's before | after probe (plan docs/superpowers/plans/2026-11-02-f-quiet2.md):
//  A · the calm screen, before | after (env BEFORE: the base build's index.html): an „Abenteuer, sanft" world (seed 4242),
//      the arrival skipped, PLAY_S s of the f-quiet script (walk 4 s · stand and look 4 s) and the same burst of messages
//      from every source through the channels both builds have (the wander director's toasts, gossip's visit and level-up,
//      the fairies, the story's festival, the tales' asides, a 🧭 hint) — critic_ux's calm-screen sampler once a second:
//      message-seconds, distinct texts, duplicates shown (a gist appearing again), text in the centre, and the way pointers'
//      seconds (#wcompass ✨, #f2point ⚔). After: duplicates ≤ 2, the pointers gone in ≥ 80 % of the samples after 60 s.
//  B · after only (a Kreativ world, seed 4242, stepped frames): a crowd of six talking near you → ≤ 2 text bubbles, the
//      rest 💬; the five tale endings staged (VR.TaleEnd: the touch of each, the lost child's gift and her run), framed by
//      u-folk3's director, the skip.
// Pictures test/shots/quiet2_*.png, the sheet test/shots/quiet2_sheet.jpg, test/shots/quiet2_probe.json.
//   BEFORE=$PWD/.tmp_tests/base/dist/index.html nohup bash test/wt_run.sh quiet2_probe.mjs 3600 > .tmp_tests/quiet2_probe.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/\.tmp_tests\/$/, '/');
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const check = (ok, m) => { console.log((ok ? '  ok   ' : '  FAIL ') + m + ' (' + secs() + ')'); if (!ok) fails++; };
const OUT = {};
const PLAY = +(process.env.PLAY_S || 150) * 1000;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
// critic_ux's calm-screen sampler (test/critic_ux.mjs SAMPLE), plus the way pointers' visibility
const SAMPLE = () => {
  const W = innerWidth, H = innerHeight, out = [];
  const CHROME = '#hotbar, #stats, #xpbar, #xplvl, #minimap, #compass, #modebadge, #fps, #debug, #itemname, #advhud, #petchip, #vehiclehud, .screen, #touch, #wcompass, #bauhud, #lockhint, #crosshair, #bhBtn, #mirrorchip';
  const WIDGET = '#f2point, #intentbar, #rpgfind';
  const all = document.querySelectorAll('#app *, body > div *, body > div');
  const seen = new Set();
  const visible = (e) => { for (let a = e; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.15) return false; } return true; };
  for (const e of all) {
    let own = ''; for (const n of e.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.trim(); if (!own || own.length < 2) continue;
    if (e.closest(CHROME)) continue;
    const wid = !!e.closest(WIDGET);
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    if (!visible(e)) continue;
    let m = e; while (m && !m.id && m.parentElement) m = m.parentElement;
    const key = m && m.id ? '#' + m.id : e.tagName;
    const cx = r.right > W * 0.3 && r.left < W * 0.7 && r.bottom > H * 0.3 && r.top < H * 0.62;
    if (key === '#notes') { out.push({ w: wid, k: key, t: own.replace(/\s+/g, ' ').slice(0, 70), cx }); continue; }   // (each notice line apart)
    if (seen.has(key)) { const o = out.find(x => x.k === key); if (o) o.cx = o.cx || cx; continue; }
    seen.add(key);
    out.push({ w: wid, k: key, t: (m.textContent || own).trim().replace(/\s+/g, ' ').slice(0, 70), cx });
  }
  const pt = {}; for (const id of ['wcompass', 'f2point']) { const e = document.getElementById(id); pt[id] = !!(e && e.textContent && e.getBoundingClientRect().width > 2 && visible(e)); }
  return { items: out, pt, play: !!(window.VR && VR.game && VR.game.state === 'play' && !VR.game.ui.screen && !VR.game.arrival) };
};
const GIST_SRC = "(s) => String(s || '').toLowerCase().replace(/[^\\p{L}\\p{N}\\s]+/gu, ' ').split(/\\s+/).filter(w => w && !/^\\p{N}+$/u.test(w)).join(' ')";
const gist = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(w => w && !/^\p{N}+$/u.test(w)).join(' ').replace(/ ×$/, '');
// the burst (s of play → a message through a channel both builds have)
const BURST = [];
for (let t = 10; t < 150; t += 35) BURST.push([t, 'toast', '🌿 Ein Fuchs', 'schleicht vorbei']);
for (let t = 15; t < 150; t += 40) BURST.push([t, 'note', '🗞 Mara hat von dir gehört', 'gs:visit']);
for (let t = 30; t < 150; t += 60) BURST.push([t, 'note', '🗞 Mara hat von dir gehört', 'gs:up']);
for (let t = 25; t < 150; t += 45) BURST.push([t, 'note', '✿ Die Feen kichern im Moos', 'fairy']);
for (let t = 35; t < 150; t += 60) BURST.push([t, 'note', '🎉 Das Fest beginnt am Platz', 'story-fest']);
for (let t = 45; t < 150; t += 50) BURST.push([t, 'note', 'Ein Kind winkt dir zu', 'tl:say']);
for (let t = 50; t < 150; t += 30) BURST.push([t, 'hint', '🧭 Drücke V, um mit Leuten zu reden']);
BURST.sort((a, b) => a[0] - b[0]);

async function calm(tag, url) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'potato', dynRes: false })); localStorage.setItem('r9si.lang', 'de'); } catch (e) { /* */ } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  const wait = (ms) => page.waitForTimeout(ms), ev = (fn, a) => page.evaluate(fn, a);
  const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn).catch(() => false)) return Date.now() - t; await wait(400); } return -1; };
  const shot = async (n) => { try { await page.screenshot({ path: SHOTS + 'quiet2_' + tag + '_' + n + '.png', timeout: 240000 }); } catch (e) { console.log('  (no shot ' + n + ')'); } };
  await page.goto(url);
  await until(() => VR.game && VR.game.state === 'title', 240000); await wait(3000);
  await page.click('#title [data-act="newworld"]', { timeout: 15000 }).catch(() => ev(() => document.querySelector('#title [data-act="newworld"]').click()));
  await wait(1500);
  await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } });
  await ev(() => { const b = document.querySelector('#cw_way [data-v="gentle"]'); if (b) b.click(); });
  await wait(400);
  await ev(() => document.querySelector('#create .btn.primary').click());
  check(await until(() => VR.game && VR.game.state === 'play', 300000) >= 0, tag + ': the Abenteuer world');
  for (let i = 0; i < 40; i++) { const a = await ev(() => { const g = VR.game; if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* */ } } return !!g.arrival; }).catch(() => true); if (!a) break; await wait(1500); }
  // (the sampler and the burst run in the page, once a second by its own clock: an evaluate from outside waits behind
  // SwiftShader's slow frames — run 1 got 19 samples in 150 s)
  await ev(([SRC, GSRC, BURST]) => {
    const S = eval('(' + SRC + ')'), gist = eval('(' + GSRC + ')');
    const A = window.__q2 = { samples: 0, msgSecs: 0, centre: 0, distinct: 0, dups: 0, dupList: [], pt: { n: 0, on: 0, late: 0, lateOn: 0 }, by: {} };
    const shownG = new Map(); let prev = new Set(), bi = 0; const t0 = performance.now(); let last = t0;
    window.__q2iv = setInterval(() => { try {
      const el = performance.now() - t0, g = VR.game;
      while (bi < BURST.length && BURST[bi][0] * 1000 <= el) { const b = BURST[bi++]; try { if (b[1] === 'toast') g.ui.toast(b[2], b[3]); else if (b[1] === 'hint') g.ui.hint(b[2], 4000); else if (VR.Quiet && VR.Quiet.note) VR.Quiet.note(b[2], 2, b[3]); else g.ui.hint(b[2], 4000); } catch (e) { /* */ } }
      const s = S(), now = performance.now(), dt = Math.min(3, (now - last) / 1000); last = now;
      if (!s.play) return;
      A.samples++; let cx = false; const cur = new Set();
      for (const it of s.items) {
        if (it.w) continue;
        A.msgSecs += dt; if (it.cx) cx = true;
        const k = it.k + ' ' + gist(it.t); cur.add(k);
        A.by[it.k] = +((A.by[it.k] || 0) + dt).toFixed(1);
        if (!prev.has(k)) { const g0 = gist(it.t); if (g0.length > 3) { if (shownG.has(g0)) { A.dups++; if (A.dupList.length < 12) A.dupList.push([Math.round(el / 1000), it.t]); } shownG.set(g0, el); } }
      }
      prev = cur; if (cx) A.centre++;
      const on = s.pt.wcompass || s.pt.f2point; A.pt.n++; if (on) A.pt.on++;
      if (el > 60000) { A.pt.late++; if (on) A.pt.lateOn++; }
      A.distinct = shownG.size; A.el = Math.round(el / 1000);
    } catch (e) { window.__q2err = String(e); } }, 1000);
  }, [SAMPLE.toString(), GIST_SRC, BURST]);
  let shotN = 0; const shotsAt = [20000, 100000, PLAY - 6000];
  const t0 = Date.now();
  while (Date.now() - t0 < PLAY) {
    const el = Date.now() - t0;
    const ph = el < 8000 ? 'stand' : (Math.floor((el - 8000) / 4000) % 2 ? 'look' : 'walk');
    if (ph === 'walk') await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
    if (ph === 'look') await ev(() => { VR.game.player.yaw += 0.18; }).catch(() => {});
    if (shotN < shotsAt.length && el >= shotsAt[shotN]) { shotN++; await shot('t' + shotN); }
    await wait(1000);
  }
  await page.keyboard.up('KeyW');
  const A = OUT[tag] = await ev(() => { clearInterval(window.__q2iv); const A = window.__q2; A.msgSecs = +A.msgSecs.toFixed(1); A.err = window.__q2err || null; return A; });
  A.quiet = await ev(() => VR.Quiet ? { cost: VR.Quiet.cost, stats: VR.Quiet.notes.stats, pointer: VR.Quiet.pointerStats || null } : null).catch(() => null);
  A.errors = errs.slice(0, 4);
  console.log('  ' + tag + ': ' + JSON.stringify(A).slice(0, 1500));
  await ctx.close();
}

// ---------------------------------------------------------------- B · bubbles and the endings (after)
async function scenes() {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'balanced', dynRes: false })); localStorage.setItem('r9si.lang', 'de'); } catch (e) { /* */ } });
  const page = await ctx.newPage(); const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
  const wait = (ms) => page.waitForTimeout(ms), ev = (fn, a) => page.evaluate(fn, a);
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } for (let i = 0; i < m; i++) { window.__norender = true; g.last = performance.now() - d; g.loop(performance.now()); } window.__norender = true; }, [Math.min(10, n - k), dtms]); await wait(3); } };
  const settle = async (max = 50) => { for (let i = 0; i < max; i++) { await step(20, 16); const s = await ev(() => { const g = VR.game, w = g.world; if (!w || g.state !== 'play') return null; const P = w.pool; return { busy: P && P.busy ? P.busy() : 0, q: w.queue ? w.queue.length : 0 }; }).catch(() => null); if (s && !s.busy && !s.q && i > 2) break; await wait(30); } };
  const loaded = async (C, r) => { for (let i = 0; i < 120; i++) { await step(10, 33); const ok = await ev(([C, r]) => { const w = VR.game.world; for (let dx = -r; dx <= r; dx += 16) for (let dz = -r; dz <= r; dz += 16) if (!w.isLoaded(C[0] + dx, C[2] + dz)) return false; return true; }, [C, r]); if (ok) return true; await wait(25); } return false; };
  const grab = async (name, frames = 4) => {
    const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
    if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
    console.log('  !! no picture ' + name); return null;
  };
  // the DOM over the canvas is not in the canvas: the bubbles and the caption as a page screenshot
  const shotPage = async (name) => { try { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } }); await page.screenshot({ path: SHOTS + name, timeout: 180000 }); console.log('  📷 ' + name); return SHOTS + name; } catch (e) { console.log('  !! no page shot ' + name); return null; } };
  await page.goto(process.env.SCENES_DIST ? 'file://' + process.env.SCENES_DIST : 'file://' + ROOT + 'dist/index.html');   // (f-polish9: SCENES_DIST — the scenes on another build; SHOT_TAG prefixes their pictures)
  for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
  // (as test/folk3.mjs does it: Balanced, render distance 6, the smooth people, then the land settled)
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.smoothFolk = true; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Enden',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state).catch(() => '') === 'play') break; }
  await ev(() => { if (VR.Portal) VR.Portal.GATE_S = 1e9; const g = VR.game; if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* */ } } });
  await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(5200); if (g.ui && g.ui.show) g.ui.show(null); });
  await settle(30);
  let list = null;
  for (let i = 0; i < 60 && !(list && list.length); i++) { await step(20, 33); list = await ev(() => { const g = VR.game, p = g.player.pos; return g.villages.sites.filter(s => !/^eco:/.test(s.id)).map(s => ({ id: s.id, x: s.x, y: s.y, z: s.z, name: s.name, d: Math.round(Math.hypot(s.x - p[0], s.z - p[2])) })).sort((a, b) => a.d - b.d).slice(0, 4); }); }
  if (!(list && list.length)) console.log('  !! no village sites: ' + JSON.stringify(await ev(() => { const g = VR.game; return { dim: g.dim, st: g.state, V: !!g.villages, n: g.villages ? g.villages.sites.length : -1, pos: g.player.pos.map(Math.round), arrival: !!g.arrival }; })));
  let HV = null, HP = null;
  for (const cand of list || []) {
    HV = cand; HP = null;
    await ev(([x, y, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x + 6, y + 8, z + 6); }, [cand.x, cand.y, cand.z]);
    await loaded([cand.x, cand.y, cand.z], 48);
    for (let i = 0; i < 40 && !HP; i++) { await step(20, 33); HP = await ev((vid) => { const v = VR.game.villages.known.get(vid); if (!v || !v.active) return null; const P = v.plan.plaza; return { plaza: [P.x + 0.5, P.y, P.z + 0.5], n: v.agents.length, kids: v.agents.filter(a => a.kid).length }; }, cand.id); }
    console.log('  · ' + cand.name + ' ' + cand.d + ' m: ' + JSON.stringify(HP));
    if (HP && HP.n >= 8 && HP.kids >= 1) break;
  }
  check(!!HP && HP.n >= 6, 'a village lives (' + (HV && HV.name) + ', ' + (HP ? HP.n : 0) + ' people)');
  if (!HP) { await ctx.close(); return; }
  // stand on the plaza
  await ev(([x, y, z]) => { const p = VR.game.player, w = VR.game.world; p.flying = false; p.noclip = false; const h = w.topAt ? w.topAt(Math.floor(x + 3), Math.floor(z + 3)) : y; p.teleport(x + 3, (h > 0 ? h + 1 : y + 1), z + 3); p.vel[0] = p.vel[1] = p.vel[2] = 0; }, HP.plaza);
  await step(120, 33);
  await ev((P) => { window.__plaza = P; }, HP.plaza);
  const B = OUT.scenes = { shots: {} };
  // B1 · the crowd: six near you speak at once
  if (want('bubbles')) {
    const r = await ev(() => { const g = VR.game, V = g.villages, p = g.player.pos; const near = V.agents.filter(a => !a.kid && a.pose !== 'sleep' && a.drawn !== false).sort((x, y) => Math.hypot(x.pos[0] - p[0], x.pos[2] - p[2]) - Math.hypot(y.pos[0] - p[0], y.pos[2] - p[2])).slice(0, 6);
      const lines = ['Schönes Wetter heute!', 'Hast du Mara gesehen?', 'Der Markt ist offen.', 'Hallo, Reisende!', 'Die Brücke ist fertig!', 'Komm doch mal vorbei!'];
      near.forEach((a, i) => { const dx = a.pos[0] - p[0], dz = a.pos[2] - p[2]; if (Math.hypot(dx, dz) > 12) { const L = Math.hypot(dx, dz) || 1; a.pos = [p[0] + dx / L * (3 + i * 1.3), a.pos[1], p[2] + dz / L * (3 + i * 1.3)]; } a.path = null; a.act = { type: 'teEnd' }; a.teHold = true; a.say(lines[i], 30); });
      // face their middle
      let cx = 0, cz = 0; near.forEach(a => { cx += a.pos[0]; cz += a.pos[2]; }); cx /= near.length || 1; cz /= near.length || 1; g.player.yaw = Math.atan2(-(cx - p[0]), -(cz - p[2])); g.player.pitch = -0.1;
      window.__crowd = near; return near.length; });
    await step(10, 33);
    const pic = await shotPage('quiet2_bubbles.png');
    const b = await ev(() => { const bs = [...document.querySelectorAll('.vbub')].filter(e => e.style.display !== 'none' && e.getBoundingClientRect().width > 2); const r = { text: bs.filter(e => !e.classList.contains('ico')).length, ico: bs.filter(e => e.classList.contains('ico')).map(e => e.textContent).join(''), all: bs.length }; for (const a of window.__crowd || []) { a.teHold = false; a.act = null; a.bubble = null; } return r; });
    B.bubbles = Object.assign({ crowd: r }, b); B.shots.bubbles = pic;
    check(r >= 4 && b.text <= 2 && b.all >= 3, `a crowd of ${r} speaking: ${b.text} text bubbles (≤ 2), the rest small icons (${b.ico})`);
  }
  // B2 · the five endings, each held at its touch (and the lost child's gift and her run)
  if (want('endings')) {
    const done = new Set();
    const T = ['lost', 'ingr', 'home', 'letter', 'beacon'];
    for (const tt of T) {
      const st = await ev(([tt, used]) => {
        const g = VR.game, V = g.villages, TE = VR.TaleEnd, p = g.player.pos; if (!TE) return { err: 'no TaleEnd' };
        const ok = (a) => a.p && !a.kid && a.pose !== 'sleep' && a.pose !== 'sit' && used.indexOf(String(a.p.id)) < 0 && Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]) < 40;
        const famOf = (a) => V.agents.filter(b => b !== a && b.p && b.p.fam === a.p.fam && b.pose !== 'sleep');
        let gv = null, kid = null;
        if (tt === 'lost') { for (const a of V.agents) { if (!ok(a)) continue; const k = V.agents.find(b => b.kid && b.p.fam !== a.p.fam && b.pose !== 'sleep'); if (k) { gv = a; kid = k; break; } } }
        else gv = V.agents.filter(ok).sort((x, y) => famOf(y).length - famOf(x).length)[0];
        if (!gv) return { err: 'no friend' };
        // (f-quiet2 run 2: placed round you, some stood against the hall's walls) — on the plaza: the pair across its
        // middle, you 7 m off to the side; each template turns the pair a little
        const ang = { lost: 0.3, ingr: 1.5, home: 2.7, letter: 3.9, beacon: 5.1 }[tt], ux = Math.cos(ang), uz = Math.sin(ang), Pz = window.__plaza;
        const gy = (x, z) => { const h = g.world.topAt ? g.world.topAt(Math.floor(x), Math.floor(z)) : Pz[1]; return h > 0 ? h + 1 : Pz[1] + 1; };
        const put = (a, x, z) => { a.pos = [x, gy(x, z), z]; a.path = null; a.goal = null; a.vel = [0, 0, 0]; a.act = null; a.bubble = null; };
        const cx = Pz[0] + 2 * Math.cos(ang * 2), cz = Pz[2] + 2 * Math.sin(ang * 2);
        put(gv, cx - ux * 1.6, cz - uz * 1.6);
        const pt0 = tt === 'lost' ? kid : (famOf(gv)[0] || null); if (pt0) put(pt0, cx + ux * 1.6, cz + uz * 1.6);
        const pl = g.player, px = cx - uz * 7, pz = cz + ux * 7; pl.teleport(px, gy(px, pz), pz); pl.vel[0] = pl.vel[1] = pl.vel[2] = 0; pl.yaw = Math.atan2(-(cx - px), -(cz - pz)); pl.pitch = -0.15;
        if (tt === 'lost' && kid) kid.pose = 'stand';
        TE.hold = true;
        const ok2 = TE.start(V, { t: tt, giver: gv, kid, text: '„' + (gv.p.name || 'Freund') + ': Danke — ohne dich hätten wir es nie geschafft!"' });
        const C = TE.cur;
        return { ok: ok2, gv: gv.p.name, id: String(gv.p.id), pt: C && C.pt ? (C.pt.kid ? 'kid ' : '') + C.pt.p.name : null, shot: !!(C && C.shot), framed: TE.stats.framed, log: TE.log.slice(-2) };
      }, [tt, [...done]]);
      console.log('  · ' + tt + ': ' + JSON.stringify(st));
      if (!st || !st.ok) { check(false, tt + ': the ending staged (' + JSON.stringify(st) + ')'); await ev(() => { if (VR.TaleEnd) { VR.TaleEnd.end(); VR.TaleEnd.hold = false; } }); continue; }
      done.add(st.id);
      if (tt === 'lost') { await ev(() => VR.TaleEnd.seek(1.4)); await step(20, 33); B.shots.lost_come = await grab('quiet2_end_' + (process.env.SHOT_TAG || '') + 'lost_come.png'); }
      await ev(() => VR.TaleEnd.seek(3.6)); await step(30, 33);
      const touch = await ev(() => { const C = VR.TaleEnd.cur; if (!C) return null; const a = C.gv, b = C.pt; return { pose: [a.pose, b ? b.pose : null], d: b ? +Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]).toFixed(2) : null, cap: VR.TaleEnd.caption(), hud: document.getElementById('hud').style.visibility }; });
      B.shots[tt] = await shotPage('quiet2_end_' + (process.env.SHOT_TAG || '') + tt + '.png');
      B[tt] = Object.assign({}, st, { touch });
      check(!!touch && (st.pt === null ? !st.shot : touch.d !== null && touch.d <= 1.0) && (touch.pose[0] === 'hug' || touch.pose[0] === 'stand'), `${tt}: ${st.gv} and ${st.pt || 'you (nobody of theirs near: your own view)'} touch (${touch && touch.pose.join('/')}, ${touch && touch.d} m apart), framed by the director: ${st.shot}`);
      if (tt === 'lost' || tt === 'home') { await ev(() => VR.TaleEnd.seek(5.7)); await step(24, 33); const cap = await ev(() => VR.TaleEnd.caption()); B.shots[tt + '_gift'] = await shotPage('quiet2_end_' + tt + '_gift.png'); B[tt].gift = cap; check(/🎁|💛/.test(cap), tt + ': the gift moment with its caption „' + cap + '"'); }
      await ev(() => { VR.TaleEnd.hold = false; VR.TaleEnd.seek(VR.TaleEnd.DUR + 0.1); }); await step(6, 33);
      const after = await ev(() => ({ cur: !!VR.TaleEnd.cur, hud: document.getElementById('hud').style.visibility, hide: !!VR.game.hideHud }));
      check(!after.cur && !after.hide && after.hud !== 'hidden', `${tt}: the scene ends, the HUD back (${JSON.stringify(after)})`);
    }
    // the skip: a key in the middle → the camera back within a second
    const sk = await ev(() => { const g = VR.game, V = g.villages, TE = VR.TaleEnd, p = g.player.pos; const a = V.agents.find(b => !b.kid && b.pose !== 'sleep' && Math.hypot(b.pos[0] - p[0], b.pos[2] - p[2]) < 30); if (!a) return null; TE.hold = false; const ok = TE.start(V, { t: 'letter', giver: a, text: 'x' }); return ok; });
    await step(20, 33);
    await ev(() => { const I = VR.game.input; if (I.pressed && I.pressed.add) I.pressed.add('F13'); });
    await step(2, 33);
    const sk2 = await ev(() => { const C = VR.TaleEnd.cur; const I = VR.game.input; if (I.pressed && I.pressed.clear) I.pressed.clear(); return C ? { t: +C.t.toFixed(2), skipped: !!C.skipped } : { ended: true }; });
    await step(40, 33);
    const sk3 = await ev(() => ({ cur: !!VR.TaleEnd.cur, stats: VR.TaleEnd.stats, log: VR.TaleEnd.log.slice(-3) }));
    B.skip = { sk, sk2, sk3 };
    check(!!sk && (sk2.ended || (sk2.skipped && sk2.t >= VR_BACK)) && !sk3.cur, 'a key skips: ' + JSON.stringify(B.skip).slice(0, 300));
    check(sk3.stats.framed >= 4, `u-folk3's director framed ${sk3.stats.framed} of ${sk3.stats.started} scenes`);
  }
  B.errors = logs.slice(0, 5);
  check(!logs.length, 'B: no page errors ' + JSON.stringify(logs.slice(0, 2)));
  await ctx.close();
}
const VR_BACK = 6.7;

if (want('calm')) {
  if (process.env.BEFORE) await calm('before', 'file://' + process.env.BEFORE);
  await calm('after', 'file://' + ROOT + 'dist/index.html');
  const A = OUT.after, B = OUT.before;
  check(A.dups <= 2, `after: ${A.dups} duplicates shown in ${(PLAY / 60000).toFixed(1)} min (≤ 2)` + (B ? ` · before ${B.dups}` : ''));
  check(A.pt.late > 20 && A.pt.lateOn / A.pt.late <= 0.2, `after: the way pointer shows in ${A.pt.lateOn} of ${A.pt.late} samples after 60 s (≤ 20 %)` + (B ? ` · before ${B.pt.lateOn} of ${B.pt.late}` : ''));
  check(A.centre / Math.max(1, A.samples) <= 0.05, `after: text in the centre in ${A.centre} of ${A.samples} samples (≤ 5 %)` + (B ? ` · before ${B.centre} of ${B.samples}` : ''));
  check(!A.errors.length, 'after: no page errors ' + JSON.stringify(A.errors));
  if (B) console.log(`  message-seconds: before ${B.msgSecs} (${B.samples} samples) · after ${A.msgSecs} (${A.samples}); distinct ${B.distinct} → ${A.distinct}; duplicates ${B.dups} → ${A.dups}`);
}
if (want('bubbles') || want('endings')) await scenes();
if (ONLY) { try { const old = JSON.parse(fs.readFileSync(SHOTS + 'quiet2_probe.json', 'utf8')); for (const k in old) if (!(k in OUT)) OUT[k] = old[k]; } catch (e) { /* the first run */ } }
fs.writeFileSync(SHOTS + 'quiet2_probe.json', JSON.stringify(OUT, null, 1));
try {
  const S = (OUT.scenes && OUT.scenes.shots) || {};
  const rows = [];
  if (fs.existsSync(SHOTS + 'quiet2_before_t3.png')) rows.push({ label: 'vorher | nachher — Abenteuer nach 2½ min: die Wegzeiger oben, die Meldungen links', imgs: [SHOTS + 'quiet2_before_t3.png', SHOTS + 'quiet2_after_t3.png'] });
  if (fs.existsSync(SHOTS + 'quiet2_before_t2.png')) rows.push({ label: 'vorher | nachher — nach 100 s', imgs: [SHOTS + 'quiet2_before_t2.png', SHOTS + 'quiet2_after_t2.png'] });
  const bub = S.bubbles || (fs.existsSync(SHOTS + 'quiet2_bubbles.png') ? SHOTS + 'quiet2_bubbles.png' : null);
  if (bub) rows.push({ label: 'sechs reden zugleich: zwei Sprechblasen, der Rest als kleines Symbol', imgs: [bub] });
  if (S.lost_come || S.lost) rows.push({ label: 'Das verirrte Kind: es läuft der Freundin in die Arme', imgs: [S.lost_come, S.lost].filter(Boolean) });
  if (S.lost_gift) rows.push({ label: 'Das verirrte Kind: das Geschenk', imgs: [S.lost_gift] });
  if (S.ingr || S.letter) rows.push({ label: 'Die Festzutat · der Brief: eine Umarmung mit der Familie', imgs: [S.ingr, S.letter].filter(Boolean) });
  if (S.home || S.beacon) rows.push({ label: 'Das Flausel-Haus · das Leuchtfeuer: Hand in Hand', imgs: [S.home, S.beacon].filter(Boolean) });
  if (S.home_gift) rows.push({ label: 'Das Flausel-Haus: das Geschenk', imgs: [S.home_gift] });
  fs.writeFileSync(ROOT + '.tmp_tests/quiet2_sheet.json', JSON.stringify({ w: 620, rows }));
  console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'quiet2_sheet.jpg', ROOT + '.tmp_tests/quiet2_sheet.json']).toString().trim());
} catch (e) { console.log('  (no sheet: ' + String(e).slice(0, 160) + ')'); }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');

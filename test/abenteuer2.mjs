// Das Abenteuer, Teil 2 in the page (a-foes; plan docs/superpowers/plans/2026-10-23-a-foes.md §3): the foes and the
// freeing of an outpost. One run, German UI, 1280 × 720, seed 4242:
//   1. a builder's world (no Abenteuer) at the nearest outpost: no foe, the launch beacon as it was → outpost_builder.png
//   2. the Abenteuer switched on with Begegnungen (VR.Adventure.enc() read, not assumed): the launch beacon becomes
//      the red-violet Leuchtfeuer, the outpost's strays stand there → outpost_before.png
//   3. a Bohrläufer's warning toward the player (the optic flaring, ≥ 0.6 s) → foe_bohrlaeufer.png
//   4. the power-down: kneeling, steam, sparks, plates → powerdown.png (parts, Taler, XP)
//   5. [V] at a stray: „[V] Beruhigen" (e-ctx's row 4), the timing ring → calm.png; a press in the arc calms it
//   6. the rest powered down: bereit; the Lichtleiter half turned → lichtleiter.png (closed again)
//   7. the capture ring held (Normal 45 s) through two drone waves → foe_drones.png; ≤ 2 attacking at any time
//   8. the MOMENT: cyan, the beam, the light ring over the land, the banner ✦ BEFREIT ✦ → outpost_after.png
//   9. the Helfer standing up, one following → helfer.png
//  10. the night: shadow wisps → foe_wisps_night.png; an Ohnmacht wakes at the freed beacon
//  11. the numbers: the game loop with 0 and 12 foes (Very Low and High, CPU, drawing off), F.draw on Very Low, the
//      foe message's size, no page error
// → test/shots/{outpost_builder,outpost_before,foe_bohrlaeufer,powerdown,calm,lichtleiter,foe_drones,outpost_after,
//   helfer,foe_wisps_night}.png, abenteuer2_sheet.jpg, abenteuer2_numbers.json
//   nohup bash test/wt_run.sh abenteuer2.mjs 3600 > .tmp_tests/abenteuer2.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = 'file://' + ROOT + 'dist/index.html';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const N = {};
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// the simulation without drawing (SwiftShader draws slowly); a frame is drawn only for a picture. god: the player's
// hearts kept full before each frame (the pictures need the player standing); until: a named condition (window.__ft.c)
const run = async (n, opt) => {
  let done = 0;
  for (let k = 0; k < n; k += 30) {
    const r = await ev(([m, o]) => {
      const g = VR.game, ft = window.__ft;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) {
        if (o.god) { const p = g.player; if (p.mode === 'survival') p.health = 20; if (VR.Foes.hp !== null) VR.Foes.hp = VR.Foes.hpMax(); }
        g.last = performance.now() - 33; (window.__step || ((t) => g.loop(t)))(performance.now());
        if (o.cb && ft.cb[o.cb]) ft.cb[o.cb](o.arg2 !== undefined ? o.arg2 : o.arg);
        if (o.until && ft.c[o.until](o.arg)) return { n: i + 1, hit: true };
      }
      return { n: m, hit: false };
    }, [Math.min(30, n - k), opt || {}]);
    done += r.n;
    if (r.hit) return { n: done, hit: true };
  }
  return { n: done, hit: false };
};
const draw = (tod) => ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; (window.__step || ((t) => g.loop(t)))(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, tod);
const shot = async (name) => { await wait(150); await page.screenshot({ path: SHOTS + name + '.png', timeout: 120000 }); console.log('shot ' + name + ' (' + secs() + ')'); return SHOTS + name + '.png'; };
// the CSS animations held at a moment: {elementId: ms} (an element's animations and its children's)
const hold = (map) => ev((map) => { for (const a of document.getAnimations()) { const t = a.effect && a.effect.target; let ms = null; for (const id in map) { const el = document.getElementById(id); if (el && t && (t === el || el.contains(t))) ms = map[id]; } if (ms === null) continue; try { a.pause(); a.currentTime = ms; } catch (e) { /* */ } } }, map);
const release = () => ev(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) { /* */ } } });
const pics = {};
// a-foes2: the world settles in the test's own frames (the lost run's real-time frames lost the player out of the world)
const settle = async (sec, tag) => { const t = Date.now(); let n = 0; while (Date.now() - t < sec * 1000) { n += (await run(4, { god: true })).n; await wait(300); } console.log('     settled ' + sec + ' s (' + n + ' frames' + (tag ? ', ' + tag : '') + ', ' + secs() + ')'); };
const section = async (tag, fn) => {
  try { await fn(); } catch (e) {
    fails++; console.log('  ✗ section ' + tag + ' stopped: ' + (e.stack || e.message).slice(0, 900));
    try { await release(); await page.screenshot({ path: SHOTS + 'abenteuer2_fail_' + tag + '.png', timeout: 120000 }); } catch (e2) { /* */ }
  }
};

try {
  await page.goto(DIST);
  const atTitle = () => ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title');
  for (let i = 0; i < 160; i++) { await wait(500); if (await atTitle()) break; }
  check(await atTitle(), 'the start screen (' + secs() + ')');
  check(await ev(() => !!(VR.Foes && VR.Liberate && VR.Adventure && VR.R.byName.leuchtfeuer)), 'VR.Foes, VR.Liberate and the Leuchtfeuer are in the page');
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); g.audio.resume(); if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  // the test's helpers in the page
  await ev(() => {
    const g = () => VR.game;
    const air = (x, y, z) => { const b = g().world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !b || !(VR.R.T.flags[b] & VR.F.SOLID); };
    window.__ft = {
      air,
      // a camera d blocks from t at h over it, a clear line to t; yaw0: the side preferred (t → camera)
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
      look(c) { const p = g().player; p.flying = true; p.hold = null; p.teleport(c.x, c.y - 1.62, c.z); this.aim([c.tx, c.ty, c.tz]); p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; },
      aim(t) { const p = g().player, e = [p.pos[0], p.pos[1] + 1.62, p.pos[2]], dx = t[0] - e[0], dy = t[1] - e[1], dz = t[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.viewYaw = p.yaw; p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
      foes() { return g().entities.mobs.filter(m => m.foe && !m.foe.gone); },
      // a spot d blocks beyond the beacon, away from the pad's middle, on the ground
      outer(d) { const s = this.site(), b = s.beacon, dx = b[0] + 0.5 - s.x, dz = b[2] + 0.5 - s.z, l = Math.hypot(dx, dz) || 1, x = b[0] + 0.5 + dx / l * d, z = b[2] + 0.5 + dz / l * d; return [x, g().world.topAt(Math.floor(x), Math.floor(z)) + 1, z]; },
      site() { return window.__site ? VR.Liberate.siteOf(window.__site) : null; },
      strays() { const s = this.site(); return s ? this.foes().filter(m => m.foe.site === s.id && !m.foe.wave && !m.foe.helper) : []; },
      tok() { let n = 0; for (const m of this.foes()) if (m.foe.tok) n++; return n; },
      c: {
        known: () => !!window.__ft.site() && window.__ft.site().known,
        guards: () => { const s = window.__ft.site(); return !!s && typeof s.strays === 'number' && window.__ft.strays().length >= s.strays; },
        tele: (id) => { const m = g().entities.mobs.find(x => x.id === id); return !!m && m.foe.st === 'tele' && m.foe.t >= 0.5; },
        downT: (a) => { const m = g().entities.mobs.find(x => x.id === a[0]); return !m || m.foe.st !== 'down' || m.foe.t >= a[1]; },
        arc: () => !!VR.Liberate.calmSt && VR.Liberate.calmPress(VR.Liberate.calmSt, g().time || 0),
        ringNear: (n) => window.__ft.foes().filter(m => m.foe.wave && Math.hypot(m.pos[0] - g().player.pos[0], m.pos[2] - g().player.pos[2]) < 15).length >= n,
        moment: (t) => !!VR.Liberate.moment && VR.Liberate.moment.t >= t,
        momentEnd: () => !VR.Liberate.moment && window.__ft.site() && window.__ft.site().st === 'frei',
        noFaint: () => !VR.Foes.fainting,
        bow: (id) => { const m = g().entities.mobs.find(x => x.id === id); return !!m && VR.Foes.bowOf(m.foe) > 0.22; },
        near: (id) => { const m = g().entities.mobs.find(x => x.id === id), p = g().player.pos; return !!m && Math.hypot(m.pos[0] - p[0], m.pos[2] - p[2]) < 5.5 && Math.hypot(m.vel[0], m.vel[2]) < 0.4; },
        wispNear: () => window.__ft.foes().filter(m => m.foe.k === 'wisp' && m.foe.st !== 'patrol').length >= 2,
      },
      cb: {
        // the capture ring held: a hit's knock-back may not carry the test's player out of the circle (a player walks back)
        ringHold: (q) => { window.__ft.cb.watch(); const p = g().player, s = window.__ft.site(), b = s.beacon; if (Math.hypot(p.pos[0] - b[0] - 0.5, p.pos[2] - b[2] - 0.5) > 9) { p.teleport(q[0], q[1], q[2]); p.vel[0] = 0; p.vel[2] = 0; } },
        // the most attacking at once, the waves seen, the shortest warning
        watch: () => { const ft = window.__ft, W = ft.w || (ft.w = { tok: 0, wave: 0, tele: new Map(), minTele: 9, strikes: 0, bolts: 0 }); W.tok = Math.max(W.tok, ft.tok()); const t = g().time || 0; for (const m of ft.foes()) { const f = m.foe; if (f.wave) W.wave = Math.max(W.wave, ft.foes().filter(x => x.foe.wave).length); if (f.st === 'tele' && !W.tele.has(m.id)) W.tele.set(m.id, t - f.t); else if (f.st === 'strike' && W.tele.has(m.id)) { W.minTele = Math.min(W.minTele, t - W.tele.get(m.id)); W.tele.delete(m.id); W.strikes++; } else if (f.st !== 'tele' && f.st !== 'strike') W.tele.delete(m.id); } W.bolts = Math.max(W.bolts, VR.Foes.bolts.length); },
      },
    };
  });
  // to a place the way a player arrives (safeTeleport: the hold waits while it loads), flying
  const arrive = async (s) => {
    await ev((s) => { const p = VR.game.player; p.flying = true; p.safeTeleport(s.x + 0.5, s.y + 2, s.z + 0.5); }, s);
    let st = null;
    for (let i = 0; i < 200; i++) {
      await run(3); await wait(250);
      st = await ev((s) => { const g = VR.game, p = g.player; return { hold: !!p.hold, dead: !!p.dead, loaded: g.world.isLoaded(Math.floor(s.x), Math.floor(s.z)), y: Math.round(p.pos[1]) }; }, s);
      if (st.dead || (!st.hold && st.loaded)) break;
    }
    st.at = secs();
    return st;
  };

  // ---------------------------------------------------------------- 1 · a builder's world at the outpost
  let out = null, cam0 = null;
  await section('1', async () => {
    console.log('1 · a builder\'s world at the nearest outpost');
    await ev(`VR.game.createWorld({name:'Begegnungen',mode:'survival',difficulty:'normal',type:'default',seed:'4242',cheats:true})`);
    for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
    check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
    // (a-foes2) from here the game runs only the test's own frames, and the world settles 30 s
    await ev(() => { const g = VR.game, L0 = Object.getPrototypeOf(g).loop; if (window.__step) return; window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); }; });
    await ev(() => { const p = VR.game.player; p.flying = true; p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; });
    await settle(30, 'the world opened');
    out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m && m.pos)); }));
    console.log('     the nearest outpost: ' + JSON.stringify(out));
    check(Array.isArray(out), 'the worker found the nearest outpost');
    await ev(() => VR.game.env.setTime(5200));
    const st = await arrive({ x: out[0], y: out[1] + 6, z: out[2] + 30 });
    console.log('     ' + JSON.stringify(st));
    // the pad as liberate.js finds it from the worker's centre: the launch beacon at y + 1 for one of the four turns,
    // once the pad's columns are in (the columns' own spawns are taken by gadgets.js when they load)
    let pad = null;
    for (let i = 0; i < 80 && !pad; i++) {
      await run(10); await wait(150);
      pad = await ev((o) => { const g = VR.game, w = g.world, L = VR.Liberate; for (const [dx, dz] of [[-8, -8], [8, 8], [-8, 8], [8, -8]]) if (!w.isLoaded(o[0] + dx, o[2] + dz)) return null; return L.probeAt((x, y, z) => w.getBlock(x, y, z), o[0], o[1], o[2]) || { none: true }; }, out);
      if (pad && pad.none) break;
    }
    console.log('     the pad: ' + JSON.stringify(pad));
    check(!!pad && !pad.none && !!pad.beacon, 'its pad loaded, the launch beacon on it (' + (pad && pad.beacon ? pad.id + ', turn ' + pad.dir + ', beacon ' + pad.beacon.join(' ') : 'none') + ')');
    if (!pad || pad.none) return;
    out = [pad.x, pad.y, pad.z]; N.pad = pad;
    await ev((id) => { window.__site = id; }, pad.id);
    const w = await ev(() => { const g = VR.game; return { on: VR.Foes.on(g), adv: !!(VR.Adventure.on && VR.Adventure.on()), foes: window.__ft.foes().length, sites: VR.Liberate.sites().size }; });
    check(!w.on && !w.adv && w.foes === 0 && w.sites === 0, 'a builder\'s world: no Abenteuer, no foe, no outpost to free (' + JSON.stringify(w) + ')');
    cam0 = await ev((p) => { const b = p.beacon, yaw = Math.atan2(b[0] - p.x, b[2] - p.z); return window.__ft.camAt([b[0] + 0.5, b[1] + 1.2, b[2] + 0.5], 16, 5, yaw); }, pad);   // (run 3: 24 blocks off, the beacon small behind the ship)
    check(!!cam0, 'a camera spot with the beacon in view (' + JSON.stringify(cam0 && [Math.round(cam0.x), Math.round(cam0.y), Math.round(cam0.z)]) + ')');
    if (!cam0) return;
    await ev((c) => window.__ft.look(c), cam0);
    await settle(75, 'before the postcards');
    await ev((c) => window.__ft.look(c), cam0);
    await run(10);
    await draw(11300);
    pics.builder = await shot('outpost_builder');
  });

  // ---------------------------------------------------------------- 2 · the Abenteuer with Begegnungen
  // from here the game runs only the test's own frames: run 3 lost its player in the real-time frames between two
  // evaluates (a screenshot on SwiftShader takes 20–60 s, each of those frames a step without the test's guard)
  await ev(() => { const g = VR.game, L0 = Object.getPrototypeOf(g).loop; if (window.__step) return; window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); }; });
  await section('2', async () => {
    console.log('2 · the Abenteuer switched on, with Begegnungen');
    const a = await ev(() => { const A = VR.Adventure; A.setOn(true); A.setEnc('normal'); return { on: A.on(), enc: A.enc(), diff: VR.game.difficulty, foesOn: VR.Foes.on(VR.game) }; });
    check(a.on && a.enc === 'normal' && a.diff === 'peaceful' && a.foesOn, 'VR.Adventure.on(), enc() → normal, the world peaceful for the old hostiles, VR.Foes on (' + JSON.stringify(a) + ')');
    let r = await run(240, { until: 'known' });
    const s = await ev(() => { const s = window.__ft.site(), g = VR.game; if (!s) return null; const b = s.beacon, st = g.world.getBlock(b[0], b[1], b[2]); return { id: s.id, tier: s.tier, known: s.known, beacon: b, lf: st === VR.R.byName.leuchtfeuer.state({ frei: 0 }), name: VR.Liberate.nameOf(s) }; });
    console.log('     ' + JSON.stringify(s));
    check(!!s && s.known && s.lf, 'the outpost „' + (s && s.name) + '" known, its launch beacon now the red-violet Leuchtfeuer (tier ' + (s && s.tier) + ')');
    await ev((c) => window.__ft.look(c), cam0);
    r = await run(300, { until: 'guards', god: true });
    const gd = await ev(() => { const s = window.__ft.site(); return { strays: s.strays, kinds: window.__ft.strays().map(m => m.foe.k), st: window.__ft.strays().map(m => m.foe.st) }; });
    console.log('     ' + JSON.stringify(gd) + ' after ' + r.n + ' frames');
    check(gd.strays >= 1 && gd.kinds.length >= gd.strays, 'its strays stand there: ' + gd.kinds.join(', ') + ' (' + gd.strays + ' by Normal)');
    N.guards = gd;
    await ev((c) => window.__ft.look(c), cam0);
    await run(20, { god: true });
    await draw(11300);
    pics.before = await shot('outpost_before');
    N.mood0 = await ev(() => ({ k: +VR.Liberate.moodNow.toFixed(2), sat: +VR.game.env.E.saturation.toFixed(3), grade: VR.game.env.E.grade.map(v => +v.toFixed(3)) }));
    check(N.mood0.k > 0.6, 'the land round the disturbed outpost tinted red-violet (k ' + N.mood0.k + ', saturation ' + N.mood0.sat + ', grade ' + N.mood0.grade.join(',') + ')');
  });

  // ---------------------------------------------------------------- 3 · a Bohrläufer's warning
  let dr = null;
  await section('3', async () => {
    console.log('3 · a Bohrläufer\'s warning');
    dr = await ev(() => {
      const ft = window.__ft, g = VR.game, Fo = VR.Foes, s = ft.site();
      let m = ft.strays().find(x => x.foe.k === 'driller');
      if (!m) m = Fo.guard(g, g.entities, s, 2, false, Object.assign(Fo.ctx(g), { lastBuild: -1e12 }));   // (a site of a crane and a Wächter: one more, for the picture)
      if (!m) return null;
      const yaw = m.yaw + Math.PI, c = ft.camAt([m.pos[0], m.pos[1] + 0.7, m.pos[2]], 5, 1.0, yaw);
      if (!c) return null;
      ft.look(c);
      for (const x of ft.foes()) if (x !== m) { if (x.foe.tok) { Fo.W.tokens.give(x.id); x.foe.tok = false; } if (x.foe.st === 'tele' || x.foe.st === 'strike' || x.foe.st === 'recover') { x.foe.st = 'approach'; x.foe.t = 0; } x.foe.cool = 12; }   // (run 3: the other two held both tokens)
      m.foe.st = 'approach'; m.foe.t = 0; m.foe.cool = 0;
      return { id: m.id, k: m.foe.k };
    });
    check(!!dr, 'a Bohrläufer in front of the player (' + JSON.stringify(dr) + ')');
    if (!dr) return;
    const r = await run(150, { until: 'tele', arg: dr.id, god: true, cb: 'watch' });
    const t = await ev((id) => { const m = VR.game.entities.mobs.find(x => x.id === id), f = m.foe; window.__ft.aim([m.pos[0], m.pos[1] + 0.6, m.pos[2]]); return { st: f.st, t: +f.t.toFixed(2), flare: +f.flare.toFixed(2), tele: VR.Foes.teleOf('driller', VR.Adventure.rec.band), d: +Math.hypot(m.pos[0] - VR.game.player.pos[0], m.pos[2] - VR.game.player.pos[2]).toFixed(1) }; }, dr.id);
    console.log('     ' + JSON.stringify(t) + ' after ' + r.n + ' frames');
    check(r.hit && t.st === 'tele' && t.flare > 0.5, 'it announces its charge: the optic flares (' + t.flare + ' of 1 after ' + t.t + ' s of ' + t.tele + ' s)');
    await draw();
    pics.driller = await shot('foe_bohrlaeufer');
    // a-foes2: the same warning 1.2 blocks from the eye — the lost run saw an opaque lilac disc over a quarter of the screen
    await ev((id) => { const m = VR.game.entities.mobs.find(x => x.id === id), f = m.foe, K = VR.Foes.KINDS[f.k], y = m.pos[1] + 13 / 16, fx = m.pos[0] - Math.sin(m.yaw) * 1.8, fz = m.pos[2] - Math.cos(m.yaw) * 1.8; window.__ft.look({ x: fx, y: y + 0.25, z: fz, tx: m.pos[0], ty: y, tz: m.pos[2] }); for (const x of window.__ft.foes()) if (x !== m && Math.hypot(x.pos[0] - fx, x.pos[2] - fz) < 6) { x.pos[0] += (x.pos[0] - fx) * 2; x.pos[2] += (x.pos[2] - fz) * 2; x.foe.cool = 9; } f.st = 'tele'; f.t = 0.3; f.flare = 0.9; void K; }, dr.id);
    await run(3, { god: true });
    await ev((id) => { const f = VR.game.entities.mobs.find(x => x.id === id).foe; f.st = 'tele'; f.flare = 0.9; f.t = 0.4; }, dr.id);
    await draw();
    pics.close = await shot('foe_close');
    await run(90, { god: true, cb: 'watch' });
    const w = await ev(() => window.__ft.w && { tok: window.__ft.w.tok, minTele: window.__ft.w.minTele, strikes: window.__ft.w.strikes });
    console.log('     ' + JSON.stringify(w));
    check(w && w.strikes >= 1 && w.minTele >= 0.6 - 0.04, 'the charge came after its warning (the shortest warning ' + (w && w.minTele.toFixed(2)) + ' s, frames of 33 ms)');
  });

  // ---------------------------------------------------------------- 4 · the power-down
  await section('4', async () => {
    console.log('4 · the power-down');
    if (!dr) return;
    const b = await ev((id) => { const g = VR.game, m = g.entities.mobs.find(x => x.id === id); if (!m) return null; const A = VR.Adventure.rec; window.__x0 = { xp: A.me.xp, taler: A.me.taler, items: g.entities.items.length }; const c = window.__ft.camAt([m.pos[0], m.pos[1] + 0.6, m.pos[2]], 4.5, 0.9, m.yaw + Math.PI * 0.75); if (c) window.__ft.look(c); g.entities.hurtMob(m, 99, [m.pos[0] + Math.sin(m.yaw) * 2, m.pos[1] + 0.6, m.pos[2] + Math.cos(m.yaw) * 2]); return { st: m.foe.st, why: m.foe.why }; }, dr.id);
    check(!!b && b.st === 'down', 'struck at its back vent: it powers down (' + JSON.stringify(b) + ')');
    await run(60, { until: 'downT', arg: [dr.id, 0.95], god: true });
    await draw();
    pics.down = await shot('powerdown');
    await run(120, { god: true });
    const a = await ev(() => { const g = VR.game, A = VR.Adventure.rec, x0 = window.__x0; return { xp: A.me.xp - x0.xp, taler: A.me.taler - x0.taler, items: g.entities.items.length - x0.items, bits: VR.Foes.bits.length, gone: !g.entities.mobs.some(m => m.foe && m.foe.k === 'driller' && m.foe.st === 'down') }; });
    console.log('     ' + JSON.stringify(a));
    check(a.gone && a.items >= 1 && a.xp > 0 && a.taler > 0, 'gone into parts: ' + a.items + ' items on the ground, ' + a.bits + ' plates and gears, XP +' + a.xp + ', Taler +' + a.taler);
  });

  // ---------------------------------------------------------------- 5 · [V] Beruhigen
  await section('5', async () => {
    console.log('5 · [V] Beruhigen');
    const c = await ev(() => {
      const ft = window.__ft, g = VR.game, m = ft.strays().find(x => x.foe.k !== 'crane' && x.foe.st !== 'down' && x.foe.st !== 'calm') || ft.strays().find(x => x.foe.st !== 'down' && x.foe.st !== 'calm');
      if (!m) return null;
      const K = VR.Foes.KINDS[m.foe.k], cc = ft.camAt([m.pos[0], m.pos[1] + K.h * 0.55, m.pos[2]], 3.2, 0.9, m.yaw + Math.PI);
      if (!cc) return null;
      ft.look(cc); m.vel[0] = 0; m.vel[2] = 0;
      for (const x of ft.foes()) if (x !== m) { if (x.foe.tok) { VR.Foes.W.tokens.give(x.id); x.foe.tok = false; } if (x.foe.st === 'tele' || x.foe.st === 'strike') { x.foe.st = 'approach'; x.foe.t = 0; } x.foe.cool = 9; }   // (the others hold back while this one listens: the picture and the press)
      const C = VR.Ctx, res = C.resolve(C.gather(g));
      const txt = C.text(res);
      const ok = res && res.act === 'calm' ? C.act(g, res) : false;
      return { id: m.id, k: m.foe.k, txt, act: res && res.act, began: !!VR.Liberate.calmSt, ok };
    });
    console.log('     ' + JSON.stringify(c));
    check(!!c && /Beruhigen/.test(c.txt) && c.began, 'looking at a ' + (c && c.k) + ': „' + (c && c.txt) + '" — [V] opens the timing ring');
    if (!c || !c.began) return;
    await run(20, { god: true });
    await draw();
    pics.calm = await shot('calm');
    const r = await run(90, { until: 'arc', god: true });
    const k = await ev((id) => { const g = VR.game, C = VR.Ctx, res = C.resolve(C.gather(g)), ok = res && res.act === 'calm' ? C.act(g, res) : false; const m = g.entities.mobs.find(x => x.id === id); return { ok, st: m && m.foe.st, res: window.__ft.site().res, cal: window.__ft.site().cal }; }, c.id);
    console.log('     ' + JSON.stringify(k) + ' after ' + r.n + ' frames');
    check(r.hit && k.st === 'calm' && k.cal >= 1, '[V] while the needle is in the green arc: calmed (' + JSON.stringify(k) + ')');
  });

  // ---------------------------------------------------------------- 6 · bereit; the Lichtleiter
  await section('6', async () => {
    console.log('6 · the rest powered down; the Lichtleiter');
    await ev(() => { const g = VR.game; for (const m of window.__ft.strays()) if (m.foe.st !== 'calm' && m.foe.st !== 'down') g.entities.hurtMob(m, 99, [m.pos[0] + Math.sin(m.yaw) * 2, m.pos[1] + 0.6, m.pos[2] + Math.cos(m.yaw) * 2]); });
    await run(150, { god: true });
    const s = await ev(() => { const s = window.__ft.site(); return { st: VR.Liberate.state(s), res: s.res, strays: s.strays, cal: s.cal }; });
    check(s.st === 'bereit', 'every stray powered down or calmed: bereit (' + JSON.stringify(s) + ')');
    await ev((c) => window.__ft.look(c), cam0);
    const p = await ev(() => { const L = VR.Liberate, s = window.__ft.site(); const ok = L.openPuzzle(VR.game, s); const pz = s.pz, path = pz.tiles.map((t, i) => (t.path ? i : -1)).filter(i => i >= 0); let turned = 0; const sorted = path.slice().sort((a, b) => (a % pz.n) - (b % pz.n)); for (const i of sorted.slice(0, Math.ceil(sorted.length * 0.5))) { const tl = pz.tiles[i]; for (let k = 0; k < 4 && L.maskOf(tl) !== L.rotMask(tl.t, tl.sol); k++) { L.puzAct('t', i); turned++; } } const fl = L.flood(pz); return { ok, n: pz.n, path: path.length, turned, lit: fl.lit.reduce((a, b) => a + b, 0), solved: fl.solved, screen: VR.game.ui.screen }; });
    console.log('     ' + JSON.stringify(p));
    check(p.ok && p.screen === 'lichtleiter' && p.lit >= 2 && !p.solved, 'the Lichtleiter (' + p.n + '×' + p.n + '): half the conduits turned, the light runs through ' + p.lit + ' tiles, the lamp still dark');
    await ev(() => { const el = document.getElementById('advup'); if (el) el.style.display = 'none'; });
    await draw(11300);
    pics.puzzle = await shot('lichtleiter');
    await ev(() => { const el = document.getElementById('advup'); if (el) el.style.display = ''; });
    await ev(() => VR.Liberate.closePuzzle());
  });

  // ---------------------------------------------------------------- 7 · the capture ring and the drone waves
  await section('7', async () => {
    console.log('7 · the capture ring and the drone waves');
    await ev(() => { const g = VR.game, s = window.__ft.site(), p = g.player, q = window.__ft.outer(3.5); p.flying = false; p.teleport(q[0], q[1], q[2]); window.__ft.w = null; });   // (just off the pad's corner, outside the parked ship)
    const spot = await ev(() => window.__ft.outer(3.5));
    let r = await run(900, { until: 'ringNear', arg: 3, god: true, cb: 'ringHold', arg2: spot });
    const d = await ev(() => { const ft = window.__ft, p = VR.game.player, L = VR.Liberate, ws = ft.foes().filter(m => m.foe.wave); let cx = 0, cy = 0, cz = 0; for (const m of ws) { cx += m.pos[0]; cy += m.pos[1]; cz += m.pos[2]; } const n = ws.length || 1; ft.aim([cx / n, cy / n + 0.3, cz / n]); return { drones: ws.length, ring: L.ringSite ? +(L.ringSite.ringObj.p * 100).toFixed(0) : null, st: ws.map(m => m.foe.st), tok: ft.w.tok }; });
    const pl = await ev(() => ({ dead: !!VR.game.player.dead, faint: !!VR.Foes.fainting, faints: VR.Adventure.rec.faints.length, y: Math.round(VR.game.player.pos[1]) }));
    console.log('     ' + JSON.stringify(d) + ' after ' + r.n + ' frames; the player ' + JSON.stringify(pl));
    check(r.hit && d.drones >= 3, 'the first wave: ' + d.drones + ' shadow drones round the player at ' + d.ring + ' % of the ring');
    await draw();
    pics.drones = await shot('foe_drones');
    await ev(() => { VR.game.settings.wowMoments = true; });   // (a-foes2: the moment's camera follows ⚙ Wow-Momente)
    r = await run(2400, { until: 'moment', arg: 0.01, god: true, cb: 'ringHold', arg2: spot });
    const w = await ev(() => { const ft = window.__ft; return { tok: ft.w.tok, wave: ft.w.wave, minTele: +ft.w.minTele.toFixed(2), strikes: ft.w.strikes, bolts: ft.w.bolts }; });
    console.log('     ' + JSON.stringify(w) + ' after ' + r.n + ' more frames');
    N.ring = w;
    check(r.hit, 'the ring held to the end: the moment begins');
    check(w.tok <= 2, 'never more than two attacking at once (' + w.tok + ')');
    check(w.strikes >= 2 && w.minTele >= 0.6 - 0.04, w.strikes + ' attacks, each announced ≥ 0.6 s (the shortest ' + w.minTele + ' s), ' + w.bolts + ' slow bolts in the air at most');
  });

  // ---------------------------------------------------------------- 8 · the MOMENT
  await section('8', async () => {
    console.log('8 · the moment');
    let r = await run(60, { until: 'moment', arg: 1.2, god: true });
    const c1 = await ev(() => { const L = VR.Liberate; return { cam: !!L.mcam, t: L.mcam ? +L.mcam.t.toFixed(2) : null, ring: +L.ringR(L.moment.t).toFixed(1), k: +L.moodNow.toFixed(2), pass: L.passAt !== null }; });
    console.log('     at 1.2 s: ' + JSON.stringify(c1));
    check(c1.cam, 'the moment\'s camera swings out over the land (' + JSON.stringify(c1) + ')');
    await draw(11300);
    pics.heal = await shot('outpost_heal');
    r = await run(120, { until: 'moment', arg: 2.55, god: true });
    await ev((c) => { window.__ft.look(c); clearTimeout(VR.Liberate.banT); }, cam0);   // (the banner kept up for the picture: the real clock runs on while SwiftShader draws)
    const m = await ev(() => { const L = VR.Liberate, s = window.__ft.site(), g = VR.game, b = s.beacon; return { t: +L.moment.t.toFixed(2), st: s.st, cyan: g.world.getBlock(b[0], b[1], b[2]) === VR.R.byName.leuchtfeuer.state({ frei: 1 }), banner: (document.getElementById('libban') || {}).className || '', said: (g.funke && g.funke.last) || null }; });
    console.log('     ' + JSON.stringify(m) + ' after ' + r.n + ' frames');
    check(m.st === 'frei' && m.cyan && /on/.test(m.banner), 'freed: the Leuchtfeuer cyan, the banner up at ' + m.t + ' s of the moment');
    await hold({ libban: 650, libbloom: 2600 });
    await draw(11300);
    pics.after = await shot('outpost_after');
    await release();
    // a key in the camera's hold: the view turns back from where it is, no jump (the lost run: 2.2 blocks)
    const sk = await ev(() => {
      const g = VR.game, L = VR.Liberate, p = g.player, e = [p.pos[0], p.pos[1] + 1.62, p.pos[2]], base = { x: e[0], y: e[1], z: e[2], yaw: p.yaw, pitch: p.pitch, fov: 1.2 };
      if (!L.mcam) return null;
      const st = []; const at = () => { const c = L.cam(g, base); return c ? [c.x, c.y, c.z] : null; };
      let prev = at(), worst = 0, t0 = L.mcam.t;
      for (let i = 0; i < 6; i++) { if (i === 2) g.input.pressed.add('Pause'); g.last = performance.now() - 33; window.__step(performance.now()); const c = at(); if (c && prev) worst = Math.max(worst, Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2])); if (c) prev = c; st.push(L.mcam ? +L.mcam.t.toFixed(2) : null); }
      return { t0: +t0.toFixed(2), skipped: !!(L.mcam && L.mcam.skipped), worst: +worst.toFixed(3), ts: st };
    });
    console.log('     the key in the hold: ' + JSON.stringify(sk));
    N.skip = sk;
    check(!!sk && sk.skipped && sk.worst < 0.6, 'a key in the hold: the camera turns back from where it is (at most ' + (sk && sk.worst) + ' blocks a frame)');
    // the strays stand up one by one with a small bow: a close look at the next one to bow
    const sb = await ev(() => {
      const ft = window.__ft, L = VR.Liberate, F = VR.Foes; L.camEnd(VR.game);
      const hs = ft.foes().filter(m => m.foe.helper && m.foe.site !== undefined);
      const nx = hs.filter(m => m.foe.rise > 0 || (m.foe.bowT !== null && m.foe.bowT !== undefined && m.foe.bowT < 0.9)).sort((a, b) => (a.foe.rise || 0) - (b.foe.rise || 0))[0] || hs[0];
      if (!nx) return null;
      const K = F.KINDS[nx.foe.k], c = ft.camAt([nx.pos[0], nx.pos[1] + K.h * 0.5, nx.pos[2]], 4.5, 0.9, nx.yaw + Math.PI);
      if (c) ft.look(c);
      window.__bw = nx.id;
      return { id: nx.id, k: nx.foe.k, rise: +(nx.foe.rise || 0).toFixed(2), n: hs.length, rises: hs.map(m => +(m.foe.rise || 0).toFixed(2)) };
    });
    console.log('     the stand-up: ' + JSON.stringify(sb));
    if (sb) { const rr = await run(150, { until: "bow", arg: sb.id, god: true }); check(rr.hit, 'a freed stray stands up and bows (' + sb.k + ', ' + sb.n + ' rising ' + sb.rises.join(' · ') + ' s apart)'); }
    await ev(() => { const el = document.getElementById('libban'); if (el) el.style.visibility = 'hidden'; });   // (the banner: in outpost_after)
    await draw(11300);
    pics.stand = await shot('stand');
    await ev(() => { const el = document.getElementById('libban'); if (el) el.style.visibility = ''; });
    await ev(() => { const el = document.getElementById('libban'); if (el) el.className = ''; });
    const a = await ev(() => { const A = VR.Adventure.rec, s = window.__ft.site(); return { freed: !!A.freed[s.id], xp: A.me.xp, taler: A.me.taler, ev: VR.EventLog && VR.EventLog.peaks ? VR.EventLog.peaks().length : null }; });
    const md = await ev(() => ({ k: +VR.Liberate.moodNow.toFixed(2), pass: VR.Liberate.passAt !== null, sat: +VR.game.env.E.saturation.toFixed(3) }));
    N.mood1 = md;
    check(md.k < 0.5, 'the land healed: the red-violet tint gone where the ring passed (k ' + md.k + ', saturation ' + md.sat + ')');
    check(a.freed, 'in the record: meta.adventure.freed[' + (await ev(() => window.__ft.site().id)) + '] (XP ' + a.xp + ', Taler ' + a.taler + ')');
  });

  // ---------------------------------------------------------------- 9 · the Helfer
  await section('9', async () => {
    console.log('9 · the Helfer');
    await run(260, { until: 'momentEnd', god: true });
    await ev(() => { const p = VR.game.player, q = window.__ft.outer(6); p.flying = false; p.teleport(q[0], q[1], q[2]); });
    const h0 = await ev(() => { const f = window.__ft.foes().find(m => m.foe.mine); return f ? f.id : null; });
    check(!!h0, 'a Helfer stood up and follows the player');
    if (!h0) return;
    await run(200, { until: 'near', arg: h0 });
    const h = await ev((id) => { const ft = window.__ft, m = VR.game.entities.mobs.find(x => x.id === id), tr = ft.foes().find(x => x.foe.trader); const c = ft.camAt([m.pos[0], m.pos[1] + 0.8, m.pos[2]], 4.2, 0.6, m.yaw + Math.PI * 0.8); if (c) ft.look(c); m.yaw = Math.atan2(-(c.x - m.pos[0]), -(c.z - m.pos[2])); return { k: m.foe.k, st: m.foe.st, trader: tr ? tr.foe.k : null, cam: !!c }; }, h0);
    console.log('     ' + JSON.stringify(h));
    check(h.st === 'helper' && !!h.trader, 'the Helfer (' + h.k + ', green optic) beside the player; a ' + h.trader + ' keeps the trading post');
    await run(4);
    await ev(() => { const el = document.getElementById('advup'); if (el) el.style.display = 'none'; });   // (the level-up after the moment: not in this picture)
    await draw(11300);
    pics.helfer = await shot('helfer');
    await ev(() => { const el = document.getElementById('advup'); if (el) el.style.display = ''; });
    const t = await ev(() => { const g = VR.game, tr = window.__ft.foes().find(x => x.foe.trader); window.__ft.look({ x: tr.pos[0] + 2.2, y: tr.pos[1] + 1.62, z: tr.pos[2], tx: tr.pos[0], ty: tr.pos[1] + 0.7, tz: tr.pos[2] }); const C = VR.Ctx, res = C.resolve(C.gather(g)); return C.text(res); });
    check(/Einkaufen/.test(t), 'at the trading post: „' + t + '"');
  });

  // ---------------------------------------------------------------- 10 · the night: shadow wisps; an Ohnmacht
  await section('10', async () => {
    console.log('10 · the night');
    const c = await ev(() => {
      const g = VR.game, s = window.__ft.site(), b = s.beacon, w = g.world, ft = window.__ft;
      const dx = b[0] - s.x, dz = b[2] - s.z, l = Math.hypot(dx, dz) || 1, x = Math.floor(b[0] + dx / l * 44), z = Math.floor(b[2] + dz / l * 44);
      const y = w.topAt(x, z) + 1, p = g.player; p.flying = false; p.teleport(x + 0.5, y, z + 0.5);
      g.env.setTime(18000);
      const out = [];
      for (let i = 0; i < 3; i++) { const a = Math.atan2(dx, dz) + (i - 1) * 0.45, r = 7 + i, px = Math.floor(x + Math.sin(a) * r), pz = Math.floor(z + Math.cos(a) * r), py = w.topAt(px, pz) + 1; const m = g.entities.summon('foe_wisp', px + 0.5, py + 0.3, pz + 0.5); if (!m) continue; m.foe = VR.Foes.make('wisp', m.id, m.pos); m.foe.zone = { id: 'test', kind: 'ruin', x, z, r: 32 }; out.push(m.id); }
      ft.aim([x + dx / l * 8, y + 0.8, z + dz / l * 8]);
      return { at: [x, y, z], wisps: out.length, night: g.env.E ? +g.env.E.night.toFixed(2) : null, light: VR.Foes.W.light(x, y + 1, z) };
    });
    console.log('     ' + JSON.stringify(c));
    const r = await run(150, { until: 'wispNear', god: true });
    const s = await ev(() => { const ft = window.__ft, ws = ft.foes().filter(m => m.foe.k === 'wisp'); let cx = 0, cy = 0, cz = 0; for (const m of ws) { cx += m.pos[0]; cy += m.pos[1]; cz += m.pos[2]; } const n = ws.length || 1; ft.aim([cx / n, cy / n + 0.7, cz / n]); return { n: ws.length, st: ws.map(m => m.foe.st), night: +VR.game.env.E.night.toFixed(2) }; });
    console.log('     ' + JSON.stringify(s) + ' after ' + r.n + ' frames');
    check(s.n >= 2 && s.night > 0.5, 'shadow wisps in the night (' + s.st.join(', ') + ')');
    await draw();
    pics.wisps = await shot('foe_wisps_night');
    // a lamp dissolves them: the held light
    // an Ohnmacht: the last hit wakes the player at the freed beacon, everything kept
    const f0 = await ev(() => { const g = VR.game, p = g.player; p.health = 1; VR.Foes.hitPlayer(g, { p: VR.Foes.W.player, dmg: 2, x: p.pos[0], y: p.pos[1], z: p.pos[2] }); return { fainting: !!VR.Foes.fainting, inv: p.inv.slots.filter(Boolean).length }; });
    check(f0.fainting, 'a last hit: Ohnmacht instead of death');
    await run(90, { until: 'noFaint' });
    await run(10);
    const f1 = await ev(() => { const g = VR.game, p = g.player, b = window.__ft.site().beacon; return { d: +Math.hypot(p.pos[0] - b[0] - 0.5, p.pos[2] - b[2] - 0.5).toFixed(2), pitch: +p.pitch.toFixed(2), health: p.health, dead: !!p.dead, inv: p.inv.slots.filter(Boolean).length, faints: VR.Adventure.rec.faints.length }; });
    console.log('     ' + JSON.stringify(f1));
    check(f1.d > 4 && f1.d < 6.5 && f1.health >= 20 && !f1.dead && f1.inv === f0.inv, 'woke 5 blocks out from the freed beacon with full hearts and everything kept (' + JSON.stringify(f1) + ')');
    await run(20);
    await draw();
    pics.wake = await shot('wake');
  });

  // ---------------------------------------------------------------- 11 · the numbers
  await section('11', async () => {
    console.log('11 · the numbers');
    await ev(() => { const g = VR.game; g.env.setTime(6000); const p = g.player; p.flying = false; window.__help = VR.Adventure.rec.helper; VR.Adventure.rec.helper = null; });   // (no Helfer coming back in the blocks without foes)
    await ev(() => {
      const g = VR.game, Fo = VR.Foes;
      window.__ft.clear = () => { const En = g.entities; for (let i = En.mobs.length - 1; i >= 0; i--) if (En.mobs[i].foe) En.mobs.splice(i, 1); Fo.bolts.length = 0; Fo.bits.length = 0; Fo.W.tokens.clear(); Fo.enc0 = null; };
      window.__ft.spawn12 = (r0) => {
        const En = g.entities, p = g.player.pos, w = g.world, ids = [];
        const kinds = ['driller', 'driller', 'driller', 'driller', 'sentry', 'sentry', 'sentry', 'sentry', 'drone', 'drone', 'drone', 'drone'];
        kinds.forEach((k, i) => { const a = i / 12 * Math.PI * 2, r = (r0 || 9) + (i % 3) * 2, x = Math.floor(p[0] + Math.sin(a) * r), z = Math.floor(p[2] + Math.cos(a) * r), y = w.topAt(x, z) + 1 + (k === 'drone' ? 4 : 0); const m = En.summon('foe_' + k, x + 0.5, y, z + 0.5); if (!m) return; m.foe = Fo.make(k, m.id, m.pos); m.foe.zone = { id: 'cost', kind: 'outpost', x: p[0], z: p[2], r: 40 }; m.foe.st = 'approach'; ids.push(m.id); });
        return ids.length;
      };
    });
    // the place: 70 blocks off the freed outpost (no Helfer round, no beacon light)
    await ev(() => { const g = VR.game, s = window.__ft.site(), b = s.beacon, dx = b[0] - s.x, dz = b[2] - s.z, l = Math.hypot(dx, dz) || 1; let d = 72, x = 0, z = 0; for (; d >= 40; d -= 8) { x = Math.floor(b[0] - dz / l * d); z = Math.floor(b[2] + dx / l * d); if (g.world.isLoaded(x, z)) break; } g.player.flying = false; g.player.teleport(x + 0.5, g.world.topAt(x, z) + 1, z + 0.5); });   // (off the freed outpost: its trader stays at its post, 64 blocks away)
    await run(30);
    const n12 = await ev(() => { window.__ft.clear(); return window.__ft.spawn12(); });
    await run(60, { god: true });
    const msg = await ev(() => { const g = VR.game, p = g.player.pos, M = VR.Foes.message(g.entities.mobs, p, { players: [p], bolts: VR.Foes.bolts, events: [[1, 'tele'], [2, 'down']], hits: [] }); const u = VR.Foes.unpack(JSON.parse(JSON.stringify(M))); return { bytes: JSON.stringify(M).length, n: M.n, bolts: u.bolts.length, back: u.foes.length }; });
    console.log('     the message: ' + JSON.stringify(msg));
    N.msg = msg;
    const alive = await ev(() => window.__ft.foes().length);
    check(n12 === 12 && alive >= 11 && msg.n === alive && msg.back === alive && msg.bytes <= 1024, 'the foe message with 12 foes and ' + msg.bolts + ' bolts: ' + msg.bytes + ' bytes (≤ 1 KB), read back whole');
    const frames = (n) => ev((n) => { const g = VR.game; window.__norender = true; const a = performance.now(); for (let i = 0; i < n; i++) { const p = g.player; if (p.mode === 'survival') p.health = 20; g.last = performance.now() - 33; (window.__step || ((t) => g.loop(t)))(performance.now()); } return (performance.now() - a) / n; }, n);
    N.cost = {};
    for (const preset of ['potato', 'high']) {
      await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('renderDist'); }, preset);
      await run(60);
      const offs = [], ons = [], own = [];
      const cm = () => ev(() => ({ ms: VR.Foes.cost.ms, f: VR.Foes.cost.frames }));
      const ownOf = async (fn) => { const a = await cm(); const v = await fn(); const b = await cm(); own.push(b.f > a.f ? (b.ms - a.ms) / (b.f - a.f) : 0); return v; };
      for (let r = 0; r < 5; r++) {
        await ev(() => window.__ft.clear()); await run(10); offs.push(await frames(150));
        await ev(() => window.__ft.spawn12()); await run(10, { god: true }); ons.push(await ownOf(() => frames(150)));
      }
      const o = Math.min(...offs), n = Math.min(...ons), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
      const fc = await ev(() => { const C = VR.Foes.cost; return { frames: C.frames, ms: C.ms, ai: C.ai, aiMs: C.aiMs }; });
      N.cost[preset] = { own: +med(own).toFixed(3), off: +o.toFixed(3), on: +n.toFixed(3), medOff: +med(offs).toFixed(3), medOn: +med(ons).toFixed(3), offs: offs.map(v => +v.toFixed(3)), ons: ons.map(v => +v.toFixed(3)), foes: fc };
      console.log('     ' + preset + ': ' + JSON.stringify(N.cost[preset]));
      if (preset === 'potato') {   // (a-foes2) the same twelve patrolling 34–38 blocks off (none has noticed the player)
        const po = [], pn = []; own.length = 0;
        for (let r = 0; r < 5; r++) { await ev(() => window.__ft.clear()); await run(10); po.push(await frames(150)); await ev(() => window.__ft.spawn12(34)); await run(10, { god: true }); pn.push(await ownOf(() => frames(150))); }
        N.cost.patrol = { own: +med(own).toFixed(3), off: +Math.min(...po).toFixed(3), on: +Math.min(...pn).toFixed(3), medOff: +med(po).toFixed(3), medOn: +med(pn).toFixed(3) };
        console.log('     potato, patrolling: ' + JSON.stringify(N.cost.patrol));
      }
    }
    // F.draw on Very Low: the foes in view, drawn
    await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('renderDist'); window.__ft.clear(); window.__ft.spawn12(); });
    await run(20, { god: true });
    await ev(() => { const ft = window.__ft, ms = ft.foes(); let cx = 0, cy = 0, cz = 0; for (const m of ms) { cx += m.pos[0]; cy += m.pos[1]; cz += m.pos[2]; } const n = ms.length || 1, p = VR.game.player; p.flying = true; p.teleport(cx / n + 14, p.pos[1] + 8, cz / n + 14); ft.aim([cx / n, cy / n, cz / n]); const C = VR.Foes.cost; window.__d0 = { draws: C.draws, ms: C.drawMs }; });
    const t0 = Date.now();
    for (let i = 0; i < 3; i++) await draw();
    const dc = await ev(() => { const C = VR.Foes.cost, d0 = window.__d0; return { draws: (C.draws - d0.draws) / 6, ms: (C.drawMs - d0.ms) / 6, inView: window.__ft.foes().length }; });
    console.log('     F.draw on Very Low: ' + JSON.stringify(dc) + ' (' + (Date.now() - t0) + ' ms for 6 drawn frames)');
    N.draw = dc;
    const vl = N.cost.potato, hi = N.cost.high, add = vl.on - vl.off + dc.ms;
    N.add12 = +add.toFixed(3);
    check(add <= 0.8, 'Very Low: 12 foes add ' + add.toFixed(3) + ' ms a frame on the main thread (the loop ' + vl.off.toFixed(3) + ' → ' + vl.on.toFixed(3) + ' ms, best of five blocks of 150 frames, CPU; F.draw ' + dc.ms.toFixed(3) + ' ms for ' + dc.draws.toFixed(0) + ' draws) — ≤ 0.8 ms');
    check(hi.on - hi.off <= 0.8, 'High: the loop ' + hi.off.toFixed(3) + ' → ' + hi.on.toFixed(3) + ' ms with 12 foes');
    await ev(() => { window.__ft.clear(); VR.Adventure.rec.helper = window.__help; const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('renderDist'); });
  });

  // ---------------------------------------------------------------- no page errors
  const pageErrs = logs.filter(l => l.startsWith('[pageerror]'));
  check(pageErrs.length === 0, 'no page errors (' + pageErrs.length + ')' + (pageErrs.length ? '\n' + pageErrs.slice(0, 4).join('\n') : ''));
  const fErrs = logs.filter(l => /foes|liberate|Foes|Liberate/.test(l));
  check(fErrs.length === 0, 'no console message from the foes or the freeing (' + fErrs.length + ')' + (fErrs.length ? '\n' + fErrs.slice(0, 4).join('\n') : ''));
  console.log('console messages: ' + logs.length + (logs.length ? '\n' + logs.slice(0, 10).join('\n') : ''));
} catch (e) {
  fails++; console.log('  ✗ the run stopped: ' + (e.stack || e.message).slice(0, 1200));
  try { await page.screenshot({ path: SHOTS + 'abenteuer2_fail.png' }); } catch (e2) { /* */ }
} finally {
  fs.writeFileSync(SHOTS + 'abenteuer2_numbers.json', JSON.stringify(N, null, 1));
  try {
    // (the sheet's labels: plain letters — sheet.py's font has no emoji, no umlauts and no „ quotes)
    // (a-foes2) pairs.py: a row a moment, two pictures each; every row a real picture
    const R = [
      ['1 Bauwelt: kein Gegner  |  2 Abenteuer: gestoert, das Land rot-violett getoent', [pics.builder, pics.before]],
      ['8a der Lichtring heilt das Land (1,2 s)  |  8b BEFREIT: Strahl, Banner (2,5 s)', [pics.heal, pics.after]],
      ['8c sie stehen nacheinander auf, mit kleiner Verbeugung  |  9 der Helfer folgt', [pics.stand, pics.helfer]],
      ['3 Bohrlaeufer: die Warnung  |  3b dieselbe Warnung 1,2 Bloecke vor dem Auge', [pics.driller, pics.close]],
      ['4 Abschalten  |  5 Beruhigen: der Zeitring', [pics.down, pics.calm]],
      ['6 Lichtleiter  |  7 Schattendrohnen, Welle 1', [pics.puzzle, pics.drones]],
      ['10 Schattenwesen bei Nacht  |  10b Ohnmacht: Aufwachen am befreiten Leuchtfeuer', [pics.wisps, pics.wake]],
    ];
    const rows = R.filter(([, im]) => im.every(Boolean)).map(([label, imgs]) => ({ label, imgs }));
    const lum = (f) => { try { return +execFileSync('python3', ['-c', 'import sys; from PIL import Image, ImageStat; print(sum(ImageStat.Stat(Image.open(sys.argv[1]).convert("L")).mean))', f]).toString().trim(); } catch (e) { return 0; } };
    const dark = []; for (const [, im] of R) for (const f of im) if (f && lum(f) < 16) dark.push(f.split('/').pop());
    check(rows.length === R.length && !dark.length, 'every sheet row a real picture (' + rows.length + ' of ' + R.length + (dark.length ? '; dark: ' + dark.join(', ') : '') + ')');
    const spec = { w: 620, rows };
    fs.writeFileSync(SHOTS + 'abenteuer2_sheet.json', JSON.stringify(spec));
    execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'abenteuer2_sheet.jpg', SHOTS + 'abenteuer2_sheet.json'], { stdio: 'inherit' });
  } catch (e) { console.log('sheet: ' + e.message); }
  await browser.close();
  console.log('numbers ' + JSON.stringify(N));
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
}

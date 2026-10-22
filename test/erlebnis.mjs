// e-ctx · the action key, travel by intent, the travel camera and the fading HUD in the game (erlebnis §1, §2, §4; plan
// docs/superpowers/plans/2026-10-22-e-ctx.md §3). One browser run: a new default world (seed 4242, the Heartland), Kreativ ·
// Friedlich, Balanced at 960 × 540, de-DE, the weather held clear, the clock ours (no animation frames; a picture only when
// asked, after a few warm-up frames).
//   A · the prompt on six kinds of things — a villager, a door, a chest, a bed, the hangar's shuttle, a travel target
//       (the Turmzitadelle from the Gate Plaza): the prompt's text and a picture each (erlebnis_prompt_<kind>.jpg)
//   B · plaza → Turmzitadelle: V tapped with the citadel in the aim → a ship is called, lands, takes you aboard, flies,
//       lands by the citadel, the arrival's framing, out — one picture per phase (erlebnis_trip_<n>_<phase>.jpg), the
//       phases' times, the shots, the cuts ≥ 4 s, the end beside the citadel
//   C · the HUD faded and back (Überleben): standing still 10 s, then a slot change and a hurt (erlebnis_hud_*.jpg)
//   D · a walk to a waypoint 70 m away, taken over by W after 3 s: the trip ends, the view blends back
//   E · the cost per frame of ctx + intent + the HUD fade on Very Low and High (the switches on / off)
// → test/shots/erlebnis_*.jpg, erlebnis.json, erlebnis_sheet.jpg (python3 /root/r9coord/sheet.py)
//   nohup bash test/wt_run.sh erlebnis.mjs 3600 > .tmp_tests/erlebnis.log 2>&1 &
//   ONLY=A,B,C,D,E · SEED=4242 · NO_COST=1
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHOTS = ROOT + 'test/shots/';
const DIST = process.env.DIST || new URL('../dist/index.html', import.meta.url).href;
const SEED = +(process.env.SEED || 4242), VW = 960, VH = 540;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
fs.mkdirSync(SHOTS, { recursive: true });
const OUT = { seed: SEED, prompts: {}, trip: null, hud: null, walk: null, cost: null, pictures: [] };

const { chromium } = await import('/home/dev/.npm-global/lib/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
// (each page error is also printed as it comes: a run cut short still says what went wrong)
const note = (l) => { logs.push(l); if (logs.length <= 30) console.log('    [page] ' + l.slice(0, 600)); };
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) note(`[${t}] ${s.slice(0, 500)}`); });
page.on('pageerror', e => note('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(DIST);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title')).catch(() => false)) break; }
check(await ev(() => !!(VR.Ctx && VR.Intent && VR.DirCam && VR.HudFade)), 'the bundle has VR.Ctx, VR.Intent, VR.DirCam, VR.HudFade');
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.autoJump = 'on'; g.settings.wowMoments = false; g.applySettings('*'); });
await ev((seed) => VR.game.createWorld({ name: 'Erlebnis', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: String(seed), cheats: true, kit: true }), SEED);
let inPlay = false;
for (let i = 0; i < 300 && !inPlay; i++) { await wait(1000); inPlay = await ev(() => !!(VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)).catch(() => false); }
const meta = await ev(() => { const g = VR.game; return { state: g.state, vgen: (g.meta && g.meta.vgen) | 0, pos: g.player.pos.map(v => +v.toFixed(1)), preset: g.settings.preset }; });
console.log(`world (${secs()}): ${JSON.stringify(meta)}`);
check(inPlay && meta.vgen >= 11, `a new Heartland world (vgen ${meta.vgen})`);
if (!inPlay) { for (const l of logs.slice(0, 20)) console.log(l); await browser.close(); console.log('FAILED ' + Math.max(1, fails)); process.exit(1); }

// ---------------------------------------------------------------- the page's helpers: our clock, the pictures, the keys
await ev(() => {
  const g = VR.game;
  window.requestAnimationFrame = () => 0;
  if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
  window.__norender = true;
  g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; g.env.setTime(5200); g.zenFreezeTime = true;
  if (g.renderer.q) g.renderer.q.upload = 24;
  const E = window.__E = { log: [], shots: [] };
  E.frame = (render) => { window.__norender = !render; const t0 = performance.now(); g.last = t0 - 1000 / 30; g.loop(t0); if (render) { try { g.renderer.gl.finish(); } catch (e) { /* */ } } window.__norender = true; };
  E.frames = (n, every) => { for (let i = 0; i < n; i++) E.frame(!!every && i % every === every - 1); return E.state(); };
  E.capture = () => { const c = g.canvas || document.getElementById('gl'); return c.toDataURL('image/jpeg', 0.86); };
  E.pic = (warm) => { for (let i = 0; i < (warm || 5); i++) E.frame(true); return E.capture(); };
  // the HUD drawn over the picture: the canvas only holds the 3-D world, so the prompt, the ring, the bar and the
  // letterbox are painted on top from their DOM boxes (what a player sees)
  E.picHud = (warm) => {
    for (let i = 0; i < (warm || 5); i++) E.frame(true);
    const src = g.canvas || document.getElementById('gl'), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const kx = src.width / innerWidth, ky = src.height / innerHeight;
    const box = (el) => { const r = el.getBoundingClientRect(); return [r.left * kx, r.top * ky, r.width * kx, r.height * ky]; };
    // (an element switched on fades in over a CSS transition that runs in real time, between our frames: it counts as
    // shown at its end state — the prompt, the bar, the caption — and the letterbox at its full 7.5 % height)
    const vis = (el) => { if (!el) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && (+s.opacity > 0.05 || el.classList.contains('on')) && el.getBoundingClientRect().width > 0; };
    for (const el of document.querySelectorAll('.lbx')) if (el.classList.contains('on')) { const b = box(el), h = 0.075 * innerHeight * ky; x.fillStyle = '#000'; x.fillRect(b[0], el.classList.contains('t') ? 0 : src.height - h, b[2], h); }
    const txt = (el, size, col, bg) => { if (!vis(el)) return; const b = box(el); if (bg) { x.fillStyle = bg; x.fillRect(b[0], b[1], b[2], b[3]); } x.font = `600 ${size * kx}px sans-serif`; x.fillStyle = col; x.textAlign = 'center'; const lines = el.innerText.split('\n'); lines.forEach((l, i) => x.fillText(l, b[0] + b[2] / 2, b[1] + (i + 0.8) * size * 1.25 * ky)); };
    const onEl = (id) => { const el = document.getElementById(id); return el && el.classList.contains('on') ? el : null; };   // (these three show by their 'on' class)
    txt(onEl('ctxprompt'), 14, '#f4f7ff', 'rgba(6,9,20,0.42)');
    txt(onEl('intentbar'), 15, '#eef6ff');
    txt(onEl('intentcap'), 30, '#ffffff');
    const mk = document.getElementById('intentmark'); if (vis(mk)) { const b = box(mk); x.strokeStyle = '#9affd8'; x.lineWidth = 2 * kx; x.strokeRect(b[0] + b[2] / 2 - 8 * kx, b[1] + 4 * ky, 16 * kx, 16 * ky); txt(mk.querySelector('b'), 13, '#e8fff6'); }
    const ch = document.getElementById('crosshair'); if (vis(ch)) { const b = box(ch); x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 2; const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2; if (ch.classList.contains('hf-ring')) { x.beginPath(); x.arc(cx, cy, 9 * kx, 0, 6.3); x.stroke(); } x.fillStyle = '#fff'; x.fillRect(cx - 2, cy - 2, 4, 4); if (!ch.classList.contains('hf-dot') && !ch.classList.contains('hf-ring')) { x.fillRect(cx - 9, cy - 1, 18, 2); x.fillRect(cx - 1, cy - 9, 2, 18); } }
    // the HUD's own elements: shown or faded, as boxes with their names (the canvas cannot hold their DOM pictures)
    const lab = (id, name) => { const el = document.getElementById(id); if (!el || getComputedStyle(el).display === 'none') return; const b = box(el); if (b[2] < 2) return; const off = el.classList.contains('hf-off'); x.strokeStyle = off ? 'rgba(255,255,255,0.18)' : 'rgba(154,255,216,0.95)'; x.setLineDash(off ? [4, 4] : []); x.lineWidth = 2; x.strokeRect(b[0], b[1], b[2], b[3]); x.setLineDash([]); x.font = `600 ${12 * kx}px sans-serif`; x.fillStyle = off ? 'rgba(255,255,255,0.35)' : '#9affd8'; x.textAlign = 'left'; x.fillText(name + (off ? ' (aus)' : ''), b[0] + 3, b[1] - 4); };
    if (E.hudBoxes) { lab('hotbar', 'Leiste'); lab('stats', 'Herzen'); lab('xpbar', 'XP'); lab('minimap', 'Karte'); lab('vehiclehud', 'Fahrzeug'); }
    return c.toDataURL('image/jpeg', 0.86);
  };
  E.press = (code, frames) => { const I = g.input; I.keys.add(code); I.pressed.add(code); E.frames(frames || 1); I.keys.delete(code); I.released.add(code); E.frame(false); };
  E.lookAt = (x, y, z) => { const p = g.player, e = p.eyePos(), dx = x - e[0], dy = y - e[1], dz = z - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); if (p.viewYaw !== undefined) p.viewYaw = p.yaw; };
  E.ready = (r, rm) => { const w = g.world, p = g.player, pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let miss = 0, dirty = 0; for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const d2 = dx * dx + dz * dz; if (d2 > r * r) continue; const c = w.col(pcx + dx, pcz + dz); if (!c) { miss++; continue; } if (d2 <= rm * rm) for (const s of c.sec) if (s && (s.dirty || s.pending)) dirty++; } return { miss, dirty }; };
  E.pump = (r, rm) => { const p = g.player; try { g.world.update(p.pos[0], p.pos[1], p.pos[2], performance.now()); } catch (e) { /* */ } return E.ready(r, rm); };
  E.state = () => {
    const I = VR.Intent, c = I.cur, p = g.player, S = g.starships, fl = g.flight, pr = document.getElementById('ctxprompt');
    return { t: +(+g.time).toFixed(2), pos: p.pos.map(v => +v.toFixed(1)), yaw: +p.yaw.toFixed(3), camMode: g.camMode, prompt: pr && pr.classList.contains('on') ? pr.textContent : '', row: g.ctxRow || 0,
      aimed: I.aimed ? I.aimed.id : null, intent: c ? { means: c.means, phase: c.phase, ending: !!c.ending, dist: c.dist !== undefined ? +(+c.dist).toFixed(1) : null, shot: c.seq ? c.seq.kind : null, shotT: c.seq ? +c.seq.t.toFixed(2) : 0, ship: c.ship && c.ship.pos ? c.ship.pos.map(v => +v.toFixed(1)) : null, stage: c.shipStage || null, pad: c.pad || null } : null,
      flight: fl ? { state: fl.state, auto: !!fl.auto, alt: +fl.b.pos[1].toFixed(1), speed: +(fl.speed || 0).toFixed(1), landing: !!(fl.auto && fl.auto.landing), spot: fl.auto && fl.auto.spot ? fl.auto.spot.map(v => +(+v).toFixed(1)) : null } : null,
      pilot: !!(S && S.pilot), cam: g.cam ? { x: +g.cam.x.toFixed(1), y: +g.cam.y.toFixed(1), z: +g.cam.z.toFixed(1), shot: g.cam.shot || null } : null,
      lastEnd: I.lastEnd || null };
  };
  VR.Intent.debug = true;   // (lastEnd says where a trip was ended from)
});
const save = (name, url) => { const f = SHOTS + name; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); OUT.pictures.push(f); return f; };
const settle = async (maxS, r, rm) => { const t = Date.now(); let s = null; while (Date.now() - t < maxS * 1000) { s = await ev(([r, rm]) => window.__E.pump(r, rm), [r, rm]); if (s.miss === 0 && s.dirty === 0) break; await wait(80); } return s; };
// n seconds of play in half-second chunks, the world streamed ahead of the player before each (columns within 64 m, sections within 32 m)
async function play(sec, onChunk) {
  const n = Math.round(sec * 2);
  for (let i = 0; i < n; i++) {
    let s = await ev(() => window.__E.ready(4, 2));
    if (s.miss || s.dirty > 8) { const w0 = Date.now(); while ((s.miss || s.dirty > 8) && Date.now() - w0 < (s.miss ? 20000 : 6000)) { await wait(60); s = await ev(() => window.__E.pump(4, 2)); } }
    const st = await ev(() => window.__E.frames(15));
    if (onChunk && (await onChunk(st, i)) === false) return st;
  }
  return await ev(() => window.__E.state());
}
const PLAZA = [0.5, 48.5];
const toPlaza = async () => { await ev(([x, z]) => { const g = VR.game, w = g.world; const y = w.topAt(Math.floor(x), Math.floor(z)) + 1; g.player.safeTeleport ? g.player.safeTeleport(x, y, z) : g.player.teleport(x, y, z); }, PLAZA); await settle(40, 4, 2); await ev(() => window.__E.frames(20)); };

// ================================================================ A · the prompt on six kinds of things
if (want('A')) {
  console.log(`== A · the prompt (${secs()})`);
  await settle(40, 4, 2);
  const kinds = [];
  // the hangar's shuttle on the deck (the spawn) — or a parked ship anywhere near; none: one is set down on the plaza
  const findShip = () => ev(() => { const S = VR.game.starships, p = VR.game.player; const s = S.ships.filter(q => q.d && q.d.meta && q.state === 'parked' && !q.hidden && Math.hypot(q.pos[0] - p.pos[0], q.pos[2] - p.pos[2]) < 300).sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0]; return s ? { pos: s.pos.slice(), yaw: s.yaw, h: s.d.meta.height, w: s.d.meta.width, l: s.d.meta.length, hangar: !!s.hangar } : null; });
  let ship = await findShip();
  if (!ship) {
    await toPlaza();
    await ev(() => { const g = VR.game; window.__E.lookAt(g.player.pos[0] + 20, g.player.pos[1] + 1.6, g.player.pos[2]); g.starships.placeInFront(5151, 'shuttle', null, g.player); });
    for (let i = 0; i < 60 && !ship; i++) { await wait(500); await ev(() => window.__E.frames(2)); ship = await findShip(); }
  }
  if (ship) {
    await ev((s) => { const g = VR.game, p = g.player, x = s.pos[0] + Math.cos(s.yaw) * (s.w * 0.5 + 3), z = s.pos[2] - Math.sin(s.yaw) * (s.w * 0.5 + 3); p.teleport(x, s.pos[1] + 0.1, z); window.__E.lookAt(s.pos[0], s.pos[1] + s.h * 0.45, s.pos[2]); }, ship);
    await settle(20, 3, 2);
    await ev(() => window.__E.frames(6));
    await ev((s) => { window.__E.lookAt(s.pos[0], s.pos[1] + s.h * 0.45, s.pos[2]); }, ship);
    const st = await ev(() => window.__E.frames(4));
    OUT.prompts.ship = st.prompt; kinds.push(['ship', st.prompt]);
    save('erlebnis_prompt_ship.jpg', await ev(() => window.__E.picHud(4)));
  } else kinds.push(['ship', '(no parked ship near)']);
  // a door, a chest, a bed: set on the plaza in a row, each looked at from 2.5 m
  await toPlaza();
  const placed = await ev(([px, pz]) => {
    const g = VR.game, R = VR.R, w = g.world, y = w.topAt(Math.floor(px), Math.floor(pz)) + 1;
    const find = (f) => R.types.find(t => t && t.o && f(t));
    const door = find(t => t.o.kind === 'door' && !t.o.ironDoor && /oak/.test(t.name)) || find(t => t.o.kind === 'door' && !t.o.ironDoor);
    const chest = R.byName.chest || find(t => t.o.ui === 'chest');
    const bed = find(t => t.o.kind === 'bed');
    const out = [];
    const put = (t, x, z, upper) => { if (!t) return null; let s = t.defaultState; w.setBlock(x, y, z, s, 4); if (upper && t.has && t.has('half')) w.setBlock(x, y + 1, z, t.with(s, 'half', 1), 4); return [x, y, z]; };
    out.push(['door', put(door, Math.floor(px) - 4, Math.floor(pz) + 3, true), door && door.name]);
    out.push(['chest', put(chest, Math.floor(px), Math.floor(pz) + 3), chest && chest.name]);
    out.push(['bed', put(bed, Math.floor(px) + 4, Math.floor(pz) + 3), bed && bed.name]);
    return out;
  }, PLAZA);
  await ev(() => window.__E.frames(12));
  await settle(20, 2, 2);   // (the placed blocks meshed before their pictures)
  for (const [kind, at, name] of placed) {
    if (!at) { kinds.push([kind, '(no block)']); continue; }
    await ev((a) => { const g = VR.game, p = g.player; p.teleport(a[0] + 0.5, a[1], a[2] - 2.2); window.__E.lookAt(a[0] + 0.5, a[1] + 0.45, a[2] + 0.5); }, at);
    const st = await ev(() => window.__E.frames(5));
    OUT.prompts[kind] = st.prompt; kinds.push([kind, st.prompt + ' (' + name + ')']);
    save(`erlebnis_prompt_${kind}.jpg`, await ev(() => window.__E.picHud(4)));
  }
  // a villager: the nearest one walking about (the plaza, else Nova Haven's)
  let vil = await ev(() => { const V = VR.game.villages, p = VR.game.player; const a = (V && V.agents || []).filter(q => q && q.pos && q.p).sort((x, y) => Math.hypot(x.pos[0] - p.pos[0], x.pos[2] - p.pos[2]) - Math.hypot(y.pos[0] - p.pos[0], y.pos[2] - p.pos[2]))[0]; return a ? { pos: a.pos.slice(), name: a.p.name } : null; });
  if (!vil) { await ev(() => { const g = VR.game, w = g.world; g.player.teleport(0.5, w.topAt(0, -120) + 1, -120.5); }); await settle(40, 4, 2); await play(6); vil = await ev(() => { const V = VR.game.villages, p = VR.game.player; const a = (V && V.agents || []).filter(q => q && q.pos && q.p).sort((x, y) => Math.hypot(x.pos[0] - p.pos[0], x.pos[2] - p.pos[2]) - Math.hypot(y.pos[0] - p.pos[0], y.pos[2] - p.pos[2]))[0]; return a ? { pos: a.pos.slice(), name: a.p.name } : null; }); }
  if (vil) {
    let st = null;
    for (let k = 0; k < 6; k++) {
      st = await ev((name) => { const V = VR.game.villages, a = V.agents.find(q => q.p && q.p.name === name), p = VR.game.player; if (!a) return null; const d = 2.6, yaw = Math.atan2(p.pos[0] - a.pos[0], p.pos[2] - a.pos[2]); p.teleport(a.pos[0] + Math.sin(yaw) * d, a.pos[1] + 0.05, a.pos[2] + Math.cos(yaw) * d); window.__E.lookAt(a.pos[0], a.pos[1] + 1.3, a.pos[2]); window.__E.frames(2); window.__E.lookAt(a.pos[0], a.pos[1] + 1.3, a.pos[2]); return window.__E.frames(3); }, vil.name);
      if (st && /reden|Auftrag/.test(st.prompt)) break;
    }
    OUT.prompts.villager = st ? st.prompt : ''; kinds.push(['villager', st ? st.prompt : '(lost)']);
    save('erlebnis_prompt_villager.jpg', await ev(() => window.__E.picHud(4)));
  } else kinds.push(['villager', '(no villager)']);
  // (the ship set down for the prompt goes again: the trip in B calls its own)
  await ev(() => { const S = VR.game.starships, s = S.ships.find(q => q.d && q.d.seed === 5151); if (s) { S.ships.splice(S.ships.indexOf(s), 1); S.refreshNear(true); } });
  // the travel target: the citadel from the plaza
  await toPlaza();
  await ev(() => { window.__E.lookAt(-420, 175, 380); window.__E.frames(8); window.__E.lookAt(-420, 175, 380); });
  const stT = await ev(() => window.__E.frames(6));
  OUT.prompts.travel = stT.prompt; kinds.push(['travel', stT.prompt + ' (aimed ' + stT.aimed + ')']);
  save('erlebnis_prompt_travel.jpg', await ev(() => window.__E.picHud(4)));
  for (const [k, p] of kinds) console.log(`    ${k}: ${p}`);
  check(/Einsteigen/.test(OUT.prompts.ship || ''), `a ship: „${OUT.prompts.ship}"`);
  check(/Öffnen|Schließen/.test(OUT.prompts.door || ''), `a door: „${OUT.prompts.door}"`);
  check(/Öffnen/.test(OUT.prompts.chest || ''), `a chest: „${OUT.prompts.chest}"`);
  check(/Schlafen/.test(OUT.prompts.bed || ''), `a bed: „${OUT.prompts.bed}"`);
  check(/reden|Auftrag/.test(OUT.prompts.villager || ''), `a villager: „${OUT.prompts.villager}"`);
  check(/^\[V\] Reise zur Turmzitadelle · \d/.test(OUT.prompts.travel || ''), `the citadel in the aim: „${OUT.prompts.travel}"`);
}

// ================================================================ B · plaza → Turmzitadelle
if (want('B')) {
  console.log(`== B · plaza → Turmzitadelle (${secs()})`);
  await toPlaza();
  await ev(() => { window.__E.lookAt(-420, 175, 380); window.__E.frames(6); window.__E.lookAt(-420, 175, 380); window.__E.frames(4); });
  const s0 = await ev(() => window.__E.state());
  console.log('    before:', JSON.stringify(s0));
  await ev(() => window.__E.press('KeyV', 2));
  let st = await ev(() => window.__E.frames(2));
  console.log('    after V:', JSON.stringify(st));
  check(st.intent && st.intent.means === 'call', `V with the citadel in the aim calls a ship (means ${st.intent && st.intent.means}, phase ${st.intent && st.intent.phase})`);
  const trip = { phases: [], shots: [], track: [], t0: st.t };
  const seen = new Set(), picsAt = {};
  let n = 0, lastPhase = null, lastShot = null, cruisePics = 0, done = false;
  const wantPic = (ph, s) => {
    const it = s.intent; if (!it) return null;
    if (ph === 'call' && !picsAt.call && it.stage === 'cruise' && it.ship && Math.hypot(it.ship[0] - s.pos[0], it.ship[2] - s.pos[2]) < 260) return 'call';
    if (ph === 'call' && !picsAt.callland && (it.stage === 'settle')) return 'callland';
    if (ph === 'board' && !picsAt.board) return 'board';
    if (ph === 'takeoff' && !picsAt.takeoff && it.shotT > 2.2) return 'takeoff';
    if (ph === 'cruise' && cruisePics < 3 && it.shotT > 1.4 && it.shot !== lastShotPic) return 'cruise' + (cruisePics + 1);
    if (ph === 'approach' && !picsAt.approach && it.shotT > 2) return 'approach';
    if (ph === 'land' && !picsAt.land && it.shotT > 1.2) return 'land';
    if (ph === 'arrive' && !picsAt.arrive && it.shot === 'arrive' && it.shotT > 1.4) return 'arrive';
    return null;
  };
  let lastShotPic = null;
  const real0 = Date.now();
  while (!done && Date.now() - real0 < 25 * 60 * 1000) {
    let s = await ev(() => window.__E.ready(4, 2));
    if (s.miss || s.dirty > 8) { const w0 = Date.now(); while ((s.miss || s.dirty > 8) && Date.now() - w0 < (s.miss ? 20000 : 6000)) { await wait(60); s = await ev(() => window.__E.pump(4, 2)); } }
    for (let k = 0; k < 6 && !done; k++) {
      st = await ev(() => window.__E.frames(3));
      n++;
      const it = st.intent;
      if (!it) { done = true; break; }
      if (it.phase !== lastPhase) { trip.phases.push({ phase: it.phase, t: st.t }); console.log(`    ${st.t.toFixed(1)} s: ${it.phase} (${it.means}) shot ${it.shot} · ship ${JSON.stringify(it.ship)} · flight ${JSON.stringify(st.flight)}`); lastPhase = it.phase; }
      if (it.shot !== lastShot) { trip.shots.push({ shot: it.shot, t: st.t, phase: it.phase }); lastShot = it.shot; }
      if (n % 10 === 0) trip.track.push({ t: st.t, phase: it.phase, shot: it.shot, pos: st.pos, cam: st.cam, flight: st.flight, stage: it.stage, dist: it.dist });
      const pk = wantPic(it.phase, st);
      if (pk && !seen.has(pk)) {
        seen.add(pk); picsAt[pk] = st.t;
        if (pk.startsWith('cruise')) { cruisePics++; lastShotPic = it.shot; }
        const f = save(`erlebnis_trip_${String(Object.keys(picsAt).length).padStart(2, '0')}_${pk}.jpg`, await ev(() => window.__E.picHud(5)));
        console.log(`    picture ${pk} at ${st.t.toFixed(1)} s (shot ${it.shot}) → ${f}`);
      }
      if (it.ending) done = true;
    }
  }
  // the end: out of the ship, facing the citadel
  st = await ev(() => window.__E.frames(20));
  save('erlebnis_trip_99_out.jpg', await ev(() => window.__E.picHud(5)));
  trip.end = st; trip.t1 = st.t;
  OUT.trip = trip;
  const ph = trip.phases.map(p => p.phase);
  console.log('    phases: ' + trip.phases.map(p => `${p.phase} ${(p.t - trip.t0).toFixed(1)}`).join(' · '));
  console.log('    shots: ' + trip.shots.map(s => `${s.shot} ${(s.t - trip.t0).toFixed(1)}`).join(' · '));
  console.log('    the end: ' + JSON.stringify(st.lastEnd));
  check(['call', 'board', 'takeoff', 'cruise', 'approach', 'land', 'arrive'].every(p => ph.includes(p)), 'every phase in order: ' + ph.join(' → '));
  const callT = trip.phases.find(p => p.phase === 'board'), callS = trip.phases.find(p => p.phase === 'call');
  check(callT && callS && callT.t - callS.t >= 8 && callT.t - callS.t <= 32, `the ship came and landed in ${callT && callS ? (callT.t - callS.t).toFixed(1) : '?'} s (10–30 + the wait for its design)`);
  const sh = trip.shots.filter(s => s.shot);
  const short = sh.filter((s, i) => i < sh.length - 1 && sh[i + 1].t - s.t < 3.9);
  check(!short.length, `${sh.length} shots, each ≥ 4 s (` + sh.map(s => s.shot).join(', ') + ')' + (short.length ? ' — short: ' + short.map(s => s.shot).join(', ') : ''));
  const dEnd = Math.hypot(st.pos[0] + 420, st.pos[2] - 380);
  check(dEnd < 140 && !st.pilot && !st.intent, `out of the ship ${dEnd.toFixed(0)} m from the citadel, the trip over`);
  check(Object.keys(picsAt).length >= 8, `a picture per phase (${Object.keys(picsAt).join(', ')})`);
}

// ================================================================ C · the HUD faded and back (Überleben)
if (want('C')) {
  console.log(`== C · the HUD (${secs()})`);
  await toPlaza();
  await ev(() => { const g = VR.game; g.player.setMode('survival'); g.player.health = 20; g.player.food = 20; window.__E.hudBoxes = true; window.__E.lookAt(40, 90, 120); });
  await play(10);
  const cls = () => ev(() => { const o = {}; for (const id of ['hotbar', 'stats', 'xpbar', 'minimap', 'compass', 'vehiclehud', 'crosshair']) { const e = document.getElementById(id); o[id] = e ? e.className : null; } return o; });
  const faded = await cls();
  save('erlebnis_hud_1_faded.jpg', await ev(() => window.__E.picHud(4)));
  await ev(() => { const g = VR.game, p = g.player; p.inv.sel = (p.inv.sel + 1) % 9; p.inv.changed = true; p.health = 13; });
  await play(1);
  const back = await cls();
  save('erlebnis_hud_2_back.jpg', await ev(() => window.__E.picHud(4)));
  await play(8);
  const again = await cls();
  await ev(() => { VR.game.settings.hudMode = 'always'; });
  await play(1);
  const always = await cls();
  save('erlebnis_hud_3_always.jpg', await ev(() => window.__E.picHud(4)));
  await ev(() => { const g = VR.game; g.settings.hudMode = 'auto'; g.player.health = 4; });
  await play(8);
  const danger = await cls();
  save('erlebnis_hud_4_danger.jpg', await ev(() => window.__E.picHud(4)));
  await ev(() => { const g = VR.game; g.player.health = 20; g.player.setMode('creative'); window.__E.hudBoxes = false; });
  OUT.hud = { faded, back, again, always, danger };
  const off = (o, id) => /hf-off/.test(o[id] || '');
  console.log('    ' + JSON.stringify(OUT.hud));
  check(off(faded, 'hotbar') && off(faded, 'stats') && off(faded, 'minimap') && /hf-dot/.test(faded.crosshair), 'standing still 10 s: the hotbar, the hearts and the map faded, a dot');
  check(!off(back, 'hotbar') && !off(back, 'stats'), 'a slot change and a hurt: the hotbar and the hearts are back');
  check(off(again, 'hotbar') && !off(again, 'stats'), '8 s later: the hotbar faded again, the hearts stay (they regenerate: a change every few seconds)');
  check(['hotbar', 'stats', 'minimap'].every(id => !off(always, id)), 'Immer: everything shown');
  check(!off(danger, 'stats'), 'hearts at 20 %: never hidden');
}

// ================================================================ D · a walk, taken over by W
if (want('D')) {
  console.log(`== D · a walk, taken over (${secs()})`);
  await toPlaza();
  const wp = await ev(() => { const g = VR.game, w = g.world, x = 59, z = 74, y = w.topAt(x, z) + 1; g.gadgets.addWaypoint(x, y, z, 'Laterne'); return [x, y, z]; });
  await play(1.5);
  await ev((a) => { window.__E.lookAt(a[0] + 0.5, a[1] + 1.5, a[2] + 0.5); window.__E.frames(4); window.__E.lookAt(a[0] + 0.5, a[1] + 1.5, a[2] + 0.5); }, wp);
  let st = await ev(() => window.__E.frames(4));
  const prompt = st.prompt;
  await ev(() => window.__E.press('KeyV', 2));
  const p0 = (await ev(() => window.__E.state())).pos;
  st = await play(3);
  const walking = st.intent;
  save('erlebnis_walk_1.jpg', await ev(() => window.__E.picHud(4)));
  const moved = Math.hypot(st.pos[0] - p0[0], st.pos[2] - p0[2]);
  await ev(() => window.__E.press('KeyW', 2));
  const afterW = await ev(() => window.__E.state());
  const st2 = await ev(() => window.__E.frames(14));
  save('erlebnis_walk_2_taken.jpg', await ev(() => window.__E.picHud(3)));
  OUT.walk = { prompt, walking, moved, afterW, after: st2 };
  console.log(`    prompt „${prompt}", walking ${JSON.stringify(walking)}, moved ${moved.toFixed(1)} m; after W ${JSON.stringify(afterW.intent)}; 0.5 s later ${JSON.stringify(st2.intent)} camMode ${st2.camMode}`);
  check(/Wegpunkt Laterne/.test(prompt), `the waypoint in the aim: „${prompt}"`);
  check(walking && walking.means === 'walk' && moved > 6, `V walks there (${moved.toFixed(1)} m in 3 s, shot ${walking && walking.shot})`);
  check(afterW.intent && afterW.intent.ending, 'W takes over at once (the blend back runs)');
  check(!st2.intent && st2.camMode === 0, 'after 0.4 s: your own view, first person');
}

// ================================================================ E · the cost
if (want('E') && !process.env.NO_COST) {
  console.log(`== E · the cost (${secs()})`);
  await toPlaza();
  const bench = async (preset, on) => {
    await ev(([pr, on]) => { const g = VR.game; if (g.settings.preset !== pr) { g.applyPreset(pr); g.settings.dynRes = false; g.applySettings('*'); } VR.Ctx.on = on; VR.Intent.on = on; VR.HudFade.on = on; for (const o of [VR.Ctx.cost, VR.Intent.cost, VR.HudFade.cost]) for (const k in o) o[k] = 0; window.__E.lookAt(-420, 175, 380); }, [preset, on]);
    await settle(30, 4, 2);
    const n = preset === 'high' ? 40 : 90;   // (a High frame takes seconds on this software GPU)
    await ev((w) => window.__E.frames(w, 1), preset === 'high' ? 10 : 30);
    const r = await ev((n) => { for (const o of [VR.Ctx.cost, VR.Intent.cost, VR.HudFade.cost]) for (const k in o) o[k] = 0; const t0 = performance.now(); for (let i = 0; i < n; i++) window.__E.frame(true); const wall = (performance.now() - t0) / n; const C = VR.Ctx.cost, I = VR.Intent.cost, H = VR.HudFade.cost; const trim = (o) => (o.frames > 1 ? +((o.ms - o.worst) / (o.frames - 1)).toFixed(4) : 0);   // (without the one worst frame: a busy test machine preempts the page now and then)
      return { wall: +wall.toFixed(2), ctx: C.frames ? +(C.ms / C.frames).toFixed(4) : 0, intent: I.frames ? +(I.ms / I.frames).toFixed(4) : 0, hud: H.frames ? +(H.ms / H.frames).toFixed(4) : 0, ctxTrim: trim(C), intentTrim: trim(I), hudTrim: trim(H), ctxWorst: +C.worst.toFixed(3), intentWorst: +I.worst.toFixed(3), gathers: C.gathers, gatherMs: C.gathers ? +(C.gatherMs / C.gathers).toFixed(4) : 0, frames: n }; }, n);
    return r;
  };
  const cost = {};
  for (const pr of ['potato', 'high']) { cost[pr + '_on'] = await bench(pr, true); cost[pr + '_off'] = await bench(pr, false); console.log(`    ${pr}: on ${JSON.stringify(cost[pr + '_on'])} · off ${JSON.stringify(cost[pr + '_off'])}`); }
  await ev(() => { const g = VR.game; VR.Ctx.on = true; VR.Intent.on = true; VR.HudFade.on = true; g.applyPreset('balanced'); g.applySettings('*'); });
  OUT.cost = cost;
  const per = (c) => c.ctx + c.intent + c.hud, perT = (c) => c.ctxTrim + c.intentTrim + c.hudTrim;
  check(perT(cost.potato_on) <= 0.05 && perT(cost.high_on) <= 0.05, `ctx + intent + HUD fade per frame: Very Low ${perT(cost.potato_on).toFixed(4)} ms, High ${perT(cost.high_on).toFixed(4)} ms without the one worst frame (≤ 0.05; with it ${per(cost.potato_on).toFixed(4)} / ${per(cost.high_on).toFixed(4)}, worst ${cost.potato_on.ctxWorst} / ${cost.high_on.ctxWorst} ms)`);
}

// ================================================================ the record, the sheet
fs.writeFileSync(SHOTS + 'erlebnis.json', JSON.stringify(OUT, null, 1));
const rows = [];
const P = (n) => (fs.existsSync(SHOTS + n) ? SHOTS + n : null);
rows.push({ label: 'Die Aktion: Schiff · Tür · Truhe', imgs: [P('erlebnis_prompt_ship.jpg'), P('erlebnis_prompt_door.jpg'), P('erlebnis_prompt_chest.jpg')], labels: ['[V] ' + (OUT.prompts.ship || '—'), OUT.prompts.door || '—', OUT.prompts.chest || '—'] });
rows.push({ label: 'Die Aktion: Bett · Dorfbewohner · Reiseziel', imgs: [P('erlebnis_prompt_bed.jpg'), P('erlebnis_prompt_villager.jpg'), P('erlebnis_prompt_travel.jpg')], labels: [OUT.prompts.bed || '—', OUT.prompts.villager || '—', OUT.prompts.travel || '—'] });
const tp = fs.readdirSync(SHOTS).filter(f => /^erlebnis_trip_\d\d_/.test(f)).sort();
for (let i = 0; i < tp.length; i += 3) rows.push({ label: 'Platz → Turmzitadelle', imgs: tp.slice(i, i + 3).map(f => SHOTS + f).concat([null, null, null]).slice(0, 3), labels: tp.slice(i, i + 3).map(f => f.replace(/^erlebnis_trip_\d\d_|\.jpg$/g, '')).concat(['', '', '']).slice(0, 3) });
rows.push({ label: 'HUD', imgs: [P('erlebnis_hud_1_faded.jpg'), P('erlebnis_hud_2_back.jpg'), P('erlebnis_hud_4_danger.jpg')], labels: ['10 s still: faded', 'slot + hurt: back', 'hearts 20 %: never hidden'] });
rows.push({ label: 'Gehen', imgs: [P('erlebnis_walk_1.jpg'), P('erlebnis_walk_2_taken.jpg'), P('erlebnis_hud_3_always.jpg')], labels: ['walking to the waypoint (follow shot)', 'W: taken over, first person', 'HUD: Immer'] });
fs.writeFileSync(SHOTS + 'erlebnis_sheet.json', JSON.stringify({ cols: [], w: 560, rows }));
try { console.log(execSync(`python3 /root/r9coord/sheet.py ${SHOTS}erlebnis_sheet.jpg ${SHOTS}erlebnis_sheet.json`).toString().trim()); } catch (e) { console.log('  (sheet: ' + e.message.split('\n')[0] + ')'); }
console.log(`--- logs (${logs.length})`); for (const l of logs.slice(0, 25)) console.log(l);
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
check(!logs.some(l => /ctx\.js|intent\.js|directorcam\.js|hudfade\.js/.test(l)), 'no error from the new modules');
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// regress: skip — the critic's new-player look (docs/reviews/v0.52.md): a fresh browser profile, German UI, 1280 × 720,
// Balanced (set, as SwiftShader would auto-pick Very Low), real clicks like a first-time player:
//   the start screen → „＋ Neue Welt" → the create dialog → create → loading → the first 60 s (standing, then W held,
//   then a look around) → Esc (pause) → ⚙ settings → back → the keys E, J, M, F1 one at a time (each closed with Esc).
//   pictures test/shots/critic_ux_<step>.png; the visible texts of each screen in test/shots/critic_ux.json
// f-first (docs/superpowers/plans/2026-10-30-f-first.md) adds the checks of the review's first five (R53-01…06, -08, -09):
//   the title: its land finished or still in the haze (no half-built land shown), its texts ≥ 13 px and light;
//   the loading tip ≥ 13 px; the arrival over without a key within 9 s of the world's start, at 15 s the HUD up and W
//   moving ≥ 2 m; the held block's name German (no English item word in a de-DE HUD); the pause panel inside 720 px
//   with ≤ 6 buttons at the top level; a story offer shows one „V" prompt; then an „Abenteuer, sanft" world: its
//   nearest outpost ≤ 320 m from the spawn, ≥ 5 minutes of day light ahead
// f-first2 (docs/superpowers/plans/2026-10-30-f-first2.md, the v0.53 review's R54-01…06) adds: W moves the player within
//   its first second; ≥ 20 m from the spawn at 3 minutes; the held block ≤ 3 % of the frame (at 60 s and 180 s); the
//   settings: the preview lit (luma sd > 10), ≤ 20 controls in Einfach; J and O answer (a screen or a toast); the
//   Abenteuer start: no „Zen" in its HUD, a badge „ABENTEUER", no stack of 64 in the bar, the minimap drawn at 4 s
// f-first2 (restart): under SwiftShader a play frame took ~6 s (4 frames in 25 s): W's first second is 1 s and 3 frames
//   with W held; the arrival over by the first frame after 9 s; the player keeps the wall clock (First2.stepPlayer)
// env: TAG (picture prefix, default none) · DIST (another build, e.g. file://…/.tmp_tests/dist_before/index.html)
// usage: R9_EXCLUSIVE=1 nohup bash test/wt_run.sh critic_ux.mjs 1800 > .tmp_tests/critic_ux.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
let fails = 0; const check = (ok, m) => { console.log((ok ? '  ok   ' : '  FAIL ') + m); if (!ok) fails++; };
const OUT = { steps: [] };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
await ctx.addInitScript(() => { try { if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'balanced', dynRes: false })); } catch (e) { /* */ } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 300)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
const texts = () => ev(() => { const s = (VR.game && VR.game.ui && VR.game.ui.screen) || ''; const vis = [...document.querySelectorAll('#ui button, #ui h1, #ui h2, #ui h3, #ui label, #hint, #hud .tip, .toast, #ui .hint')].filter(e => e.offsetParent !== null && e.textContent.trim()).map(e => e.textContent.trim().slice(0, 60)); return { screen: s, state: VR.game && VR.game.state, n: vis.length, vis: vis.slice(0, 40) }; }).catch(() => ({}));
const TAG = process.env.TAG ? process.env.TAG + '_' : '';
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'critic_ux_' + TAG + name + '.png', timeout: 120000 }); } catch (e) { console.log('  (no shot ' + name + ')'); } const t = await texts(); OUT.steps.push({ name, ...t }); console.log('  · ' + name + ' ' + JSON.stringify(t).slice(0, 400)); };
// f-first3 (docs/superpowers/plans/2026-10-31-f-first3.md, the v0.54 review's R55-03/-04/-10/-12/-13): the probes read the
// pictures' own pixels (the PNG decoded in the page): skyBlob — the largest dark mass (4×4 cells ≥ 25 % luma < 40) in the
// upper 56 % that touches no edge of that band (trees stand on the ground and run out of it; the minimap's corner left out)
// and has a lit ring (mean luma > 90: the sky round it); crop — luma sd and mean HSV saturation of a box of the picture
const pngOf = (name) => fs.readFileSync(SHOTS + 'critic_ux_' + TAG + name + '.png').toString('base64');
const pixProbe = (name, box) => ev(async ([b64, box]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const W0 = img.naturalWidth, H0 = img.naturalHeight, cv = document.createElement('canvas'); cv.width = W0; cv.height = H0;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const D = cx.getImageData(0, 0, W0, H0).data, lum = (i) => 0.2126 * D[i] + 0.7152 * D[i + 1] + 0.0722 * D[i + 2];
  if (box) {
    const [x0, y0, x1, y1] = box.map(Math.round); let m = 0, m2 = 0, n = 0, sat = 0, ns = 0;
    for (let y = Math.max(0, y0); y < Math.min(H0, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W0, x1); x++) { const i = (y * W0 + x) * 4, L = lum(i); m += L; m2 += L * L; n++; const mx = Math.max(D[i], D[i + 1], D[i + 2]), mn = Math.min(D[i], D[i + 1], D[i + 2]); if (mx > 50) { sat += (mx - mn) / mx; ns++; } }
    m /= Math.max(1, n); return { sd: +Math.sqrt(Math.max(0, m2 / Math.max(1, n) - m * m)).toFixed(1), mean: +m.toFixed(1), sat: +(sat / Math.max(1, ns)).toFixed(3) };
  }
  const CW = W0 >> 2, CH = Math.floor(H0 * 0.56) >> 2, dark = new Uint8Array(CW * CH), avg = new Float32Array(CW * CH);
  for (let cy = 0; cy < CH; cy++) for (let c = 0; c < CW; c++) { let n = 0, s = 0; for (let y = cy * 4; y < cy * 4 + 4; y++) for (let x = c * 4; x < c * 4 + 4; x++) { const L = lum((y * W0 + x) * 4); s += L; if (L < 40) n++; } avg[cy * CW + c] = s / 16; dark[cy * CW + c] = n >= 4 && !(c > CW * 0.83 && cy < 60) ? 1 : 0; }
  const seen = new Uint8Array(CW * CH); let best = { share: 0, box: null };
  for (let k = 0; k < CW * CH; k++) {
    if (!dark[k] || seen[k]) continue;
    const st = [k], comp = []; seen[k] = 1;
    while (st.length) { const q = st.pop(); comp.push(q); const qx = q % CW, qy = (q / CW) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = qx + dx, b = qy + dy; if (a < 0 || b < 0 || a >= CW || b >= CH) continue; const r = b * CW + a; if (dark[r] && !seen[r]) { seen[r] = 1; st.push(r); } } }
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const q of comp) { const qx = q % CW, qy = (q / CW) | 0; x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy); }
    if (x0 === 0 || y0 === 0 || x1 === CW - 1 || y1 === CH - 1) continue;   // (a tree, a roof: it runs out of the band)
    let rs = 0, rn = 0;
    for (let b = Math.max(0, y0 - 2); b <= Math.min(CH - 1, y1 + 2); b++) for (let a = Math.max(0, x0 - 2); a <= Math.min(CW - 1, x1 + 2); a++) { if (a >= x0 && a <= x1 && b >= y0 && b <= y1) continue; rs += avg[b * CW + a]; rn++; }
    const share = comp.length * 16 / (W0 * H0);
    if (rn && rs / rn > 90 && share > best.share) best = { share, box: [x0 * 4, y0 * 4, x1 * 4 + 4, y1 * 4 + 4], ring: Math.round(rs / rn) };
  }
  best.share = +(best.share * 100).toFixed(3); return best;
}, [pngOf(name), box || null]).catch((e) => ({ err: String(e).slice(0, 120) }));
// Funke: his distance from the eye, his screen box (the 64 cm span of his rotors, the camera's fov) when in the frame, and the murmuration's state
const f3Probe = () => ev(() => {
  const g = VR.game, fk = g.funke, c = g.cam, FK = VR.Funke, Mu = g.wild && g.wild.murm;
  const o = { murm: Mu ? { state: Mu.state, n: Mu.n, d: Mu.fl && Mu.fl.ctr ? Math.round(Math.hypot(Mu.fl.ctr[0] - c.x, Mu.fl.ctr[2] - c.z)) : -1 } : null, murmK: g.wild ? g.wild.murmK : null };
  if (fk && fk.pos && c) {
    const dx = fk.pos[0] - c.x, dy = fk.pos[1] - c.y, dz = fk.pos[2] - c.z, d = Math.hypot(dx, dy, dz), cp = Math.cos(c.pitch || 0), sp = Math.sin(c.pitch || 0);
    const f = [-Math.sin(c.yaw) * cp, sp, -Math.cos(c.yaw) * cp], r = [Math.cos(c.yaw), 0, -Math.sin(c.yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const ah = dx * f[0] + dy * f[1] + dz * f[2], fov = c.fov > 4 ? c.fov * Math.PI / 180 : (c.fov || 75 * Math.PI / 180), t = Math.tan(fov / 2), A = innerWidth / innerHeight;
    const sx = ah > 0 ? (dx * r[0] + dz * r[2]) / ah / (t * A) : 9, sy = ah > 0 ? Math.abs(dx * u[0] + dy * u[1] + dz * u[2]) / ah / t : 9;
    const inFrame = ah > 0 && Math.abs(sx) < 1.1 && sy < 1.1;
    o.funkeD = +d.toFixed(2); o.funkeX = +sx.toFixed(2); o.funkeBox = inFrame && FK && FK.screenShare ? +(FK.screenShare(d, 0.64, fov * 180 / Math.PI, A) * 100).toFixed(2) : 0; o.funkeCentre = inFrame && Math.abs(sx) < 1 / 3 && sy < 1 / 3; o.funkeHidden = !!(FK && FK.inAim && (g.camMode | 0) === 0 && FK.inAim(c.yaw, c.pitch, dx, dy, dz));   // (f-first3: the lagging spring in the aim is not drawn)
  }
  return o;
}).catch((e) => ({ err: String(e).slice(0, 120) }));
// the spawn's view: the nearest block in the centre third of the frame (Travel.facing at the eye's own yaw and pitch)
const viewClear = () => ev(() => { const g = VR.game, c = g.cam, p = g.player, TR = VR.Travel; if (!TR || !TR.facing) return -1; const f = TR.facing((x, y, z) => g.world.getBlock(x, y, z), [c.x, c.y, c.z], [], { yaw0: c.yaw, pitch0: c.pitch, feet: p.pos[1], keep0: true, n: 1, want: 1e9, fov: (c.fov > 4 ? c.fov : c.fov * 180 / Math.PI) || 75 }); return +f.clear.toFixed(2); }).catch(() => -1);
OUT.f3 = {};
const untilState = async (st, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await ev(() => VR.game && VR.game.state).catch(() => null); if (s === st) return Date.now() - t; await wait(400); } return -1; };
// a player's click: the real one first; if Playwright cannot (covered, moving), what lies on top is logged and the click forced
const click = async (sel, what) => { try { await page.click(sel, { timeout: 6000 }); return 'real'; } catch (e) {
  const top = await ev((sel) => { const b = document.querySelector(sel); if (!b) return 'none'; const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t ? (t.tagName + '#' + t.id + '.' + t.className + ' ' + (t === b || b.contains(t))) : 'null'; }, sel).catch(() => '?');
  console.log('  (' + what + ': no real click — on top: ' + top + '; ' + e.message.split('\n')[0].slice(0, 120) + ')'); OUT['blocked_' + what] = top;
  try { await page.click(sel, { timeout: 6000, force: true }); return 'force'; } catch (e2) { await ev((sel) => { const b = document.querySelector(sel); if (b) b.click(); }, sel).catch(() => {}); return 'js'; } } };
const t0 = Date.now();
// (f-first2) a key held at least ms of wall time AND n game frames (under SwiftShader a frame can take seconds; cap 90 s)
const holdFor = async (key, ms, n) => { const f0 = await ev(() => VR.game.frame).catch(() => 0), t = Date.now(); await page.keyboard.down(key); await wait(ms);
  while (Date.now() - t < 90000) { const f = await ev(() => VR.game.frame).catch(() => f0 + n); if (f - f0 >= n) break; await wait(200); } await page.keyboard.up(key); };
// (f-first2) Esc and keys are read in the next frame: wait until the screen is closed (cap 60 s)
const untilClosed = async () => { const t = Date.now(); while (Date.now() - t < 60000) { const s = await ev(() => VR.game.ui && VR.game.ui.screen).catch(() => null); if (!s || s === 'hud' || s === 'play') return true; await wait(300); } return false; };
await page.goto(DIST);
check(await untilState('title', 240000) >= 0, 'the start screen');
await wait(8000); await shot('01_title');
// R53-03 / R53-08: the title's land finished or still in its haze; its texts big and light enough
OUT.titleLand = await ev(() => { const s = VR.game.titleScene; return s ? { reveal: +s.reveal.toFixed(2), ready: !!(s.landReady && s.landReady()), mode: s.mode } : null; }).catch(() => null);
const textsOk = (sel) => ev((sel) => { const out = []; for (const e of document.querySelectorAll(sel)) { if (e.offsetParent === null || !e.childNodes.length) continue; const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) continue; const cs = getComputedStyle(e); if (+cs.opacity === 0) continue; const m = cs.color.match(/[\d.]+/g).map(Number), L = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255, a = m.length > 3 ? m[3] : 1; if (a === 0) continue; out.push({ t: e.textContent.trim().slice(0, 30), px: parseFloat(cs.fontSize), L: +(L * a).toFixed(2) }); } return out; }, sel).catch(() => []);
OUT.titleTexts = await textsOk('#title *');
{ const small = OUT.titleTexts.filter(x => x.px < 13), pale = OUT.titleTexts.filter(x => x.L < 0.55);
  check(OUT.titleLand && (OUT.titleLand.mode === 'still' || OUT.titleLand.ready || OUT.titleLand.reveal <= 0.35), 'the title shows no half-built land: ' + JSON.stringify(OUT.titleLand));
  check(!small.length && !pale.length, 'the title\'s texts ≥ 13 px and light (' + OUT.titleTexts.length + ')' + (small.length + pale.length ? ': ' + JSON.stringify(small.concat(pale).slice(0, 6)) : '')); }
// ＋ Neue Welt
OUT.newworld = await click('#title [data-act="newworld"]', 'newworld');
await wait(1500); await shot('02_create');
OUT.createFields = await ev(() => [...document.querySelectorAll('#create input, #create select, #create button, #create label')].filter(e => e.offsetParent !== null).map(e => (e.tagName + ':' + (e.id || '') + ':' + (e.textContent || e.value || '').trim().slice(0, 50)))).catch(() => []);
console.log('  create: ' + JSON.stringify(OUT.createFields).slice(0, 900));
await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } }).catch(() => {});
const tc = Date.now();
OUT.create = await click('#create .btn.primary', 'create');
if (await ev(() => VR.game.state) === 'title' && await ev(() => VR.game.ui.screen) !== 'create') { console.log('  (still on the title: ▶ Losspielen)'); await click('#title .tile[data-tile="play"]', 'play'); }
await wait(2500); await shot('03_loading');
{ const lt = await textsOk('#loading *'); OUT.loadTexts = lt; const small = lt.filter(x => x.px < 13); check(lt.length && !small.length, 'the loading screen\'s texts ≥ 13 px' + (small.length ? ': ' + JSON.stringify(small.slice(0, 4)) : '')); }
const lt = await untilState('play', 300000); OUT.loadMs = lt >= 0 ? Date.now() - tc : -1;
check(lt >= 0, 'into the world in ' + OUT.loadMs + ' ms');
const tPlay = Date.now();
// (v0.54 review: the owner's wish „a calm screen") the first three minutes sampled once a second with f-quiet's sampler
// (quiet_probe.mjs): message-seconds outside the HUD chrome, distinct messages, text in the centre, any „Funke fragen"
const SAMPLE = () => {
  const W = innerWidth, H = innerHeight, out = [];
  const CHROME = '#hotbar, #stats, #xpbar, #xplvl, #minimap, #compass, #modebadge, #fps, #debug, #itemname, #advhud, #petchip, #vehiclehud, .screen, #touch, #wcompass, #bauhud, #lockhint, #crosshair, #bhBtn, #mirrorchip';
  const WIDGET = '#f2point, #intentbar, #rpgfind';   // (way pointers: counted apart as widgets, not as messages)
  const all = document.querySelectorAll('#app *, body > div *, body > div');
  const seen = new Set();
  for (const e of all) {
    let own = ''; for (const n of e.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.trim(); if (!own || own.length < 2) continue;
    if (e.closest(CHROME)) continue;
    const wid = !!e.closest(WIDGET);
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    let vis = true; for (let a = e; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.15) { vis = false; break; } }
    if (!vis) continue;
    // the message element: the nearest ancestor with an id
    let m = e; while (m && !m.id && m.parentElement) m = m.parentElement;
    const key = m && m.id ? '#' + m.id : e.tagName;
    if (seen.has(key)) { const o = out.find(x => x.k === key); if (o) { o.cx = o.cx || (r.right > W * 0.3 && r.left < W * 0.7 && r.bottom > H * 0.3 && r.top < H * 0.62); } continue; }
    seen.add(key);
    out.push({ w: wid, k: key, t: (m.textContent || own).trim().replace(/\s+/g, ' ').slice(0, 70), cx: r.right > W * 0.3 && r.left < W * 0.7 && r.bottom > H * 0.3 && r.top < H * 0.62 });
  }
  return { items: out, play: !!(window.VR && VR.game && VR.game.state === 'play' && !VR.game.ui.screen && !VR.game.arrival) };
};
await ev((src) => { const S = eval('(' + src + ')'); const C = window.__calm = { n: 0, secs: 0, centre: 0, funke: 0, msgs: {} };
  window.__calmIv = setInterval(() => { try { const r = S(); if (!r.play) return; C.n++; let cx = false; for (const it of r.items) { if (it.w) continue; C.secs++; cx = cx || it.cx; C.msgs[it.k + ' ' + it.t.slice(0, 40)] = (C.msgs[it.k + ' ' + it.t.slice(0, 40)] || 0) + 1; if (/Funke fragen|Ask Funke/.test(it.t)) C.funke++; } if (cx) C.centre++; } catch (e) { /* */ } }, 1000); }, SAMPLE.toString()).catch(() => {});
// (the arrival's end measured in the page from here: a screenshot under SwiftShader can take longer than the arrival)
await ev(() => { window.__arr = { end: VR.game.arrival ? -1 : 0, prev: 0 }; const t = performance.now(); let lastF = VR.game.frame, lastT = 0; const iv = setInterval(() => { const f = VR.game.frame; if (f !== lastF) { window.__arr.prev = lastT; lastF = f; lastT = Math.round(performance.now() - t); } if (!VR.game.arrival) { window.__arr.end = Math.round(performance.now() - t); clearInterval(iv); } }, 100); }).catch(() => {});
await wait(1500); await shot('04_t0');
// R53-06: the arrival is short on any machine (no key pressed here), then the HUD and W
{ let arr = -1; while (Date.now() - tPlay < 60000) { const e = await ev(() => window.__arr ? window.__arr.end : -1).catch(() => -1); if (e >= 0) { arr = e; break; } await wait(250); } OUT.arrivalMs = arr;
  const pf = await ev(() => window.__arr ? window.__arr.prev : -1).catch(() => -1); OUT.arrivalPrevFrame = pf;
  check(arr >= 0 && (arr <= 9000 || pf <= 9000), 'the arrival is over in ' + arr + ' ms (≤ 9 s, or on the first frame after 9 s: the frame before at ' + pf + ' ms; no key)'); }
await wait(Math.max(0, 15000 - (Date.now() - tPlay))); await shot('05_t15');
OUT.f3.t15 = { blob: await pixProbe('05_t15'), view3: await viewClear(), pos: await ev(() => VR.game.player.pos.map(v => +v.toFixed(1))).catch(() => null), ...(await f3Probe()) };
console.log('  f3 15 s: ' + JSON.stringify(OUT.f3.t15));
check(OUT.f3.t15.blob && !(OUT.f3.t15.blob.share > 0.3), 'R55-03: at 15 s no dark blob over the horizon (' + JSON.stringify(OUT.f3.t15.blob) + ' ≤ 0.3 %)');
check(OUT.f3.t15.view3 >= 3, 'R55-12: at 15 s no block within 3 m in the view\'s centre third (' + OUT.f3.t15.view3 + ' m)');
OUT.hud15 = await ev(() => { const h = document.getElementById('hud'), cs = h && getComputedStyle(h), A = VR.game.arrival, a = document.activeElement; return h ? { vis: cs.visibility, op: +cs.opacity, hideHud: !!VR.game.hideHud, arrival: A ? { phase: A.phase, holds: A.holds(), t: +(A.t || 0).toFixed(2) } : null, wow: !!(VR.game.wow && VR.game.wow.active), focus: a ? a.tagName + '#' + a.id : '', captured: !!VR.game.input.captured, poll: window.__arr || null } : null; }).catch(() => null);
OUT.moved15 = await ev(() => VR.First2 && VR.First2.moved ? { r: VR.First2.moved.r, phase: VR.First2.moved.phase || 'after' } : null).catch(() => null);
check(!OUT.moved15 || OUT.moved15.phase !== 'after', 'the spawn\'s settle move (first2) under the arrival\'s white: ' + JSON.stringify(OUT.moved15));
check(OUT.hud15 && OUT.hud15.vis !== 'hidden' && OUT.hud15.op > 0.5 && !OUT.hud15.hideHud, 'at 15 s the HUD is up: ' + JSON.stringify(OUT.hud15));
const p0 = await ev(() => VR.game.player.pos.slice()).catch(() => null);
// (W, then S: the spawn may face a bench or a parapet — a key that moves the player at all is the measure)
// (W's first second of play: at least 1 s of wall time and 2 frames with W held — under SwiftShader a frame can take seconds)
const fW0 = await ev(() => VR.game.frame).catch(() => 0), tW0 = Date.now();
await page.keyboard.down('KeyW'); await wait(1000);
{ let fw = 0; while (Date.now() - tW0 < 180000) { fw = await ev(() => VR.game.frame).catch(() => 0); if (fw - fW0 >= 3) break; await wait(200); } OUT.wFirst = { ms: Date.now() - tW0, frames: fw - fW0 }; }
const pW1 = await ev(() => VR.game.player.pos.slice()).catch(() => null);
console.log('  W first second: ' + JSON.stringify(OUT.wFirst) + ' fps ' + await ev(() => +(VR.game.fps || 0).toFixed(2)).catch(() => -1));
{ const f1 = await ev(() => VR.game.frame).catch(() => 0), t1 = Date.now(); await wait(3000); while (Date.now() - t1 < 90000 && (await ev(() => VR.game.frame).catch(() => f1 + 3)) - f1 < 3) await wait(200); } await page.keyboard.up('KeyW');
OUT.walkedW1 = p0 && pW1 ? +Math.hypot(pW1[0] - p0[0], pW1[2] - p0[2]).toFixed(2) : -1;
check(OUT.walkedW1 >= 0.5, 'W moves the player within its first second: ' + OUT.walkedW1 + ' m (≥ 0.5)');
const pW = await ev(() => VR.game.player.pos.slice()).catch(() => null);
await holdFor('KeyS', 3000, 3); await shot('06_t25_walk');
OUT.f3.t25 = await f3Probe(); console.log('  f3 25 s: ' + JSON.stringify(OUT.f3.t25));
check(OUT.f3.t25.funkeD >= 2 && (OUT.f3.t25.funkeHidden || (OUT.f3.t25.funkeBox <= 2 && !OUT.f3.t25.funkeCentre)), 'R55-04: at 25 s Funke ' + OUT.f3.t25.funkeD + ' m from the eye (≥ 2), his box ' + OUT.f3.t25.funkeBox + ' % (≤ 2), not in the centre third — or not drawn there' + (OUT.f3.t25.funkeHidden ? ' (hidden)' : ''));
{ const p1 = await ev(() => VR.game.player.pos.slice()).catch(() => null); const dW = p0 && pW ? Math.hypot(pW[0] - p0[0], pW[2] - p0[2]) : -1, dS = pW && p1 ? Math.hypot(p1[0] - pW[0], p1[2] - pW[2]) : -1;
  OUT.walked = +Math.max(dW, dS).toFixed(2); OUT.walkedW = +dW.toFixed(2); OUT.walkedS = +dS.toFixed(2);
  check(OUT.walked >= 2, 'W held 4 s, then S 3 s, right after: W ' + OUT.walkedW + ' m · S ' + OUT.walkedS + ' m (≥ 2 by one of them)'); }
await page.mouse.move(640, 360); await page.mouse.move(900, 330, { steps: 10 }); await wait(15000); await shot('07_t45');
await wait(15000); await shot('08_t60');
OUT.f3.t60 = { blob: await pixProbe('08_t60'), ...(await f3Probe()) };
console.log('  f3 60 s: ' + JSON.stringify(OUT.f3.t60));
check(OUT.f3.t60.blob && !(OUT.f3.t60.blob.share > 0.3), 'R55-03: at 60 s no dark blob over the horizon (' + JSON.stringify(OUT.f3.t60.blob) + ')');
check(OUT.f3.t60.funkeD >= 2 && (OUT.f3.t60.funkeHidden || (OUT.f3.t60.funkeBox <= 2 && !OUT.f3.t60.funkeCentre)), 'R55-04: at 60 s Funke ' + OUT.f3.t60.funkeD + ' m from the eye (≥ 2), his box ' + OUT.f3.t60.funkeBox + ' % (≤ 2), not in the centre third');
const handProbe = () => ev(() => { const g = VR.game, h = g.player.inv.held, F = VR.First2; return { held: h ? h.id : null, block: !!(h && g.entities && g.entities.itemMesh(h.id).block), cover: F ? +F.handCover(F.HAND, innerWidth / innerHeight).toFixed(4) : 1, cine: F ? F.cine(g) : null }; }).catch(() => null);
OUT.hand60 = await handProbe();
check(OUT.hand60 && (!OUT.hand60.block || OUT.hand60.cover <= 0.03), 'at 60 s the held block covers ≤ 3 % of the frame: ' + JSON.stringify(OUT.hand60));
OUT.hud = await ev(() => [...document.querySelectorAll('#hud *')].filter(e => e.offsetParent !== null && e.children.length === 0 && e.textContent.trim()).map(e => e.textContent.trim().slice(0, 50)).slice(0, 60)).catch(() => []);
console.log('  hud: ' + JSON.stringify(OUT.hud).slice(0, 900));
// R53-02: the held block's name in the player's language — no English item word in a de-DE HUD
OUT.itemNames = [];
for (const k of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']) { await page.keyboard.press(k); await wait(300); OUT.itemNames.push(await ev(() => { const e = document.getElementById('itemname'); return e ? e.textContent : ''; }).catch(() => '')); }
OUT.itemNamesData = await ev(() => { const inv = VR.game.player.inv; return inv.slots.slice(0, 9).map(s => s ? VR.itemName(s.id) : '').filter(Boolean); }).catch(() => []);
{ const EN = /\b(Block|Grass|Stone|Planks|Log|Glass|Dirt|Sand|Oak|Birch|Spruce|Brick|Bricks|Wool|Slab|Stairs|Torch|Lamp|Cobblestone|Wood|Leaves|Door|Fence|Pickaxe|Shovel|Axe|Sword|Bread|Apple)\b/;
  const all = OUT.itemNames.concat(OUT.itemNamesData).filter(Boolean), en = all.filter(n => EN.test(n));
  check(all.length > 0 && !en.length, 'the HUD\'s item names are German (' + all.length + ': ' + all.slice(0, 9).join(' · ') + ')' + (en.length ? ' — English: ' + en.join(', ') : '')); }
// (v0.53 review) the first three minutes as a new player spends them: walking about, looking round; what is on screen
// and which hints the HUD gives at 2 and 3 minutes
OUT.hints3 = [];
const WALK_HOLDS = 6;
// (f-hud) one W hold of the walk: at least 3 s, then on until the player went 3 m or 15 frames passed (cap 240 s) — at a
// frame a minute (the machine under load) a 3-s hold walked 0.2 m; a slow frame walks only 0.1 s (a stall is no walk)
const holdWalk = async () => { const p0 = await ev(() => VR.game.player.pos.slice()).catch(() => null), f0 = await ev(() => VR.game.frame).catch(() => 0), t = Date.now(); await page.keyboard.down('KeyW'); await wait(3000);
  while (Date.now() - t < 240000) { const q = await ev(() => [VR.game.frame, VR.game.player.pos[0], VR.game.player.pos[2]]).catch(() => null); if (!q || !p0 || q[0] - f0 >= 15 || Math.hypot(q[1] - p0[0], q[2] - p0[2]) >= 3) break; await wait(300); } await page.keyboard.up('KeyW'); };
for (const [tEnd, name] of [[120000, '08b_t120'], [180000, '08c_t180']]) {
  // (f-hud: the walk counted in W holds, not wall time — under SwiftShader the wall clock ran out with 17 m walked: six holds of
  //  W (≥ 3 s, then on to 3 m or 15 frames: holdWalk) a sample, small alternating looks so the way keeps a heading, a jump after each)
  for (let i = 0; i < WALK_HOLDS; i++) { await holdWalk(); await page.mouse.move(640 + (i % 2 ? 60 : -60), 360, { steps: 6 }); await page.keyboard.press('Space'); await wait(800); OUT.wHolds = (OUT.wHolds || 0) + 1; }
  await wait(Math.max(0, tEnd - (Date.now() - tPlay))); await shot(name);
  if (name === '08b_t120') { OUT.f3.t120 = { blob: await pixProbe(name), ...(await f3Probe()) }; console.log('  f3 120 s: ' + JSON.stringify(OUT.f3.t120)); check(OUT.f3.t120.blob && !(OUT.f3.t120.blob.share > 0.3), 'R55-03: at 120 s no dark blob over the horizon (' + JSON.stringify(OUT.f3.t120.blob) + ')'); }
  else { OUT.f3.t180 = { blob: await pixProbe(name), hand: await pixProbe(name, [840, 560, 990, 700]), ...(await f3Probe()) }; console.log('  f3 180 s: ' + JSON.stringify(OUT.f3.t180)); check(OUT.f3.t180.hand && OUT.f3.t180.hand.sat <= 0.6, 'R55-13: at 180 s the held block\'s mean saturation ' + (OUT.f3.t180.hand && OUT.f3.t180.hand.sat) + ' ≤ 0.6'); }
  OUT.hints3.push({ name, s: Math.round((Date.now() - tPlay) / 1000), pos: await ev(() => VR.game.player.pos.map(v => Math.round(v))).catch(() => null), hud: await ev(() => [...document.querySelectorAll('#hud *, .toast, #hint')].filter(e => e.offsetParent !== null && e.children.length === 0 && e.textContent.trim()).map(e => e.textContent.trim().slice(0, 60)).slice(0, 30)).catch(() => []) });
}
OUT.hand180 = await handProbe();
check(OUT.hand180 && (!OUT.hand180.block || OUT.hand180.cover <= 0.03), 'at 180 s the held block covers ≤ 3 %: ' + JSON.stringify(OUT.hand180));
{ const last = OUT.hints3[OUT.hints3.length - 1], sp = await ev(() => VR.game.player.spawn).catch(() => null); OUT.away180 = last && last.pos && sp ? Math.round(Math.hypot(last.pos[0] - sp[0], last.pos[2] - sp[2])) : -1;
  check(OUT.away180 >= 20, 'after ' + (OUT.wHolds || 0) + ' W holds (3 minutes) the player is ' + OUT.away180 + ' m from the spawn (≥ 20)'); }
OUT.calm = await ev(() => { clearInterval(window.__calmIv); const C = window.__calm; return C ? { samples: C.n, msgSecs: C.secs, perMin: +(C.secs / Math.max(1, C.n) * 60).toFixed(1), centreShare: +(C.centre / Math.max(1, C.n)).toFixed(3), funke: C.funke, distinct: Object.keys(C.msgs).length, top: Object.entries(C.msgs).sort((a, b) => b[1] - a[1]).slice(0, 12) } : null; }).catch(() => null);
console.log('  calm: ' + JSON.stringify(OUT.calm).slice(0, 1400));
check(OUT.calm && OUT.calm.samples > 20 && !OUT.calm.funke, 'the first three minutes: no standing „Funke fragen" (' + (OUT.calm ? OUT.calm.funke : '?') + ' samples)');
check(OUT.calm && OUT.calm.centreShare <= 0.05, 'the first three minutes: text in the centre in ≤ 5 % of the samples (' + (OUT.calm ? OUT.calm.centreShare : '?') + ')');
console.log('  first 3 min: ' + JSON.stringify(OUT.hints3).slice(0, 1200));
await page.keyboard.press('Escape'); await wait(1500); await shot('09_pause');
// R53-04: the pause menu fits 720 px, few buttons at its top level
OUT.pause = await ev(() => { const p = document.querySelector('#pause > .panel'); if (!p) return null; const r = p.getBoundingClientRect(); const vis = [...p.querySelectorAll('button')].filter(b => b.offsetParent !== null && b.getBoundingClientRect().height > 0); return { bottom: Math.round(r.bottom), top: Math.round(r.top), n: vis.length, labels: vis.map(b => b.textContent.trim().slice(0, 24)) }; }).catch(() => null);
check(OUT.pause && OUT.pause.bottom <= 720 && OUT.pause.top >= 0 && OUT.pause.n <= 6, 'the pause menu: ' + JSON.stringify(OUT.pause));
{ const more = await ev(() => { const b = document.querySelector('#pause [data-act="pausemore"]'); if (!b) return null; b.click(); const p = document.querySelector('#pause > .panel'), r = p.getBoundingClientRect(); return { bottom: Math.round(r.bottom), n: [...p.querySelectorAll('button')].filter(b => b.offsetParent !== null).length }; }).catch(() => null);
  OUT.pauseMore = more; await wait(600); await shot('09b_pause_more');
  check(more && more.bottom <= 720 && more.n >= 6, '„Mehr" opens the rest inside 720 px: ' + JSON.stringify(more));
  await ev(() => { const b = document.querySelector('#pause [data-act="pauseless"]'); if (b) b.click(); }).catch(() => {}); await wait(300); }
OUT.settings = await click('#pause [data-act="settings"]', 'settings');
await wait(2500); await shot('10_settings');
{ const box = await ev(() => { const c = [...document.querySelectorAll('#settings canvas.pv')].find(e => e.offsetParent !== null); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left + 2, r.top + 2, r.right - 2, r.bottom - 2]; }).catch(() => null);
  OUT.f3.preview = box ? Object.assign({ box: box.map(Math.round) }, await pixProbe('10_settings', box)) : null;
  check(OUT.f3.preview && OUT.f3.preview.sd > 10, 'R55-10: the preview element\'s own pixels in the picture show the world (luma sd ' + JSON.stringify(OUT.f3.preview) + ' > 10)'); }
OUT.setUi = await ev(() => { const s = document.getElementById('settings'), c = s && s.querySelector('canvas.pv'); let sd = -1; if (c && c.width) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let m = 0, m2 = 0, n = 0; for (let i = 0; i < d.length; i += 16) { const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; m += L; m2 += L * L; n++; } m /= n; sd = Math.sqrt(Math.max(0, m2 / n - m * m)); } const ctl = s ? [...s.querySelectorAll('button, input, select')].filter(e => e.offsetParent !== null && e.getBoundingClientRect().height > 0).length : -1; return { sd: +sd.toFixed(1), controls: ctl }; }).catch(() => null);
check(OUT.setUi && OUT.setUi.sd > 10, 'the settings\' preview shows the world (luma sd ' + (OUT.setUi && OUT.setUi.sd) + ' > 10)');
check(OUT.setUi && OUT.setUi.controls > 0 && OUT.setUi.controls <= 20, 'Einfach: ' + (OUT.setUi && OUT.setUi.controls) + ' controls (≤ 20)');
await page.keyboard.press('Escape'); await wait(800); await page.keyboard.press('Escape'); await wait(1000);
for (const [k, n] of [['KeyE', '11_E'], ['KeyJ', '12_J'], ['KeyM', '13_M'], ['F1', '14_F1'], ['KeyO', '14b_O']]) {
  const st = await ev(() => VR.game.ui && VR.game.ui.screen).catch(() => '');
  if (st && st !== 'hud' && st !== 'play') { await page.keyboard.press('Escape'); await wait(800); }
  await untilClosed();
  // (f-first2: a toast lives ~4.7 s and a SwiftShader screenshot can take longer — every toast added since the key is counted)
  await ev(() => { window.__toastN = 0; window.__toastT = ''; const box = (window.VR && VR.Quiet && VR.Quiet.box && VR.Quiet.box()) || document.getElementById('toasts');   /* (f-quiet: the notices' line, #notes) */ if (window.__toastMO) window.__toastMO.disconnect(); if (box) { window.__toastMO = new MutationObserver((ms) => { for (const m of ms) for (const nd of m.addedNodes) { window.__toastN++; window.__toastT = (nd.textContent || '').trim().slice(0, 60); } }); window.__toastMO.observe(box, { childList: true }); } }).catch(() => {});
  const toasts0 = 0;
  await page.keyboard.press(k); await wait(1500); await shot(n);
  if (k === 'KeyO') { const t = Date.now(); while (Date.now() - t < 60000 && !(await ev(() => !!(VR.StarMap && VR.StarMap.isOpen()) || !!VR.game.ui.screen).catch(() => true))) await wait(300); }   // (O is read in the next frame: the star map, u-stars2)
  if (k === 'KeyJ' || k === 'KeyO') { const a = await ev(() => ({ screen: VR.game.ui.screen || (VR.StarMap && VR.StarMap.isOpen() ? 'starmap' : ''), toast: window.__toastN > 0, text: window.__toastT || '' })).catch(() => null); OUT['key_' + k] = a;
    check(a && (a.screen || a.toast), k + ' answers: ' + JSON.stringify(a)); }
  await page.keyboard.press('Escape'); await wait(1000);
}
const offerCheck = async (tag) => {
{ for (let i = 0; i < 3; i++) { const st = await ev(() => VR.game.ui && VR.game.ui.screen).catch(() => ''); if (!st || st === 'hud' || st === 'play') break; if (i < 2) await page.keyboard.press('Escape'); else await ev(() => { const u = VR.game.ui; u.show(null); VR.game.input.captured = true; }).catch(() => {}); await wait(1000); }
  OUT['screenAtOffer'] = await ev(() => VR.game.ui.screen).catch(() => '?');
  OUT['offer_' + tag] = await ev(() => { const S = VR.Story, P = VR.StoryPlay; if (!S || !P || !P.debug || !S.BEATS) return null; return P.debug.offer(S.BEATS[0].id); }).catch(() => null);
  await wait(1500); await shot(tag + '_offer');
  OUT['vPrompts_' + tag] = await ev(() => { const k = (VR.Binds && VR.Binds.label) ? VR.Binds.label('KeyV', VR.I18N.lang) : 'V', out = []; const re = new RegExp('\\[' + k + '\\]|\\b' + k + '$'); for (const e of document.querySelectorAll('#ctxprompt.on, #storycard, #funkebub')) { const rr = e.getBoundingClientRect(); if (!(rr.width > 0 && rr.height > 0)) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || +cs.opacity < 0.2 || cs.visibility === 'hidden') continue; const t = e.textContent.trim(); if (re.test(t) || e.querySelector('kbd')) out.push((e.id || e.className) + ': ' + t.slice(0, 50)); } return out; }).catch(() => null);
  check(!OUT['offer_' + tag] || (OUT['vPrompts_' + tag] && OUT['vPrompts_' + tag].length <= 1 && !OUT.screenAtOffer), tag + ': a story offer shows one V prompt (no menu open: ' + (OUT.screenAtOffer || 'none') + '): ' + JSON.stringify(OUT['vPrompts_' + tag])); }
};
// R53-05: a story offer shows one „V" prompt (the card), not three
await offerCheck('15');
// R53-09: an „Abenteuer, sanft" world — its first outpost near, the day long
if (!process.env.NO_ADV) {
  await ev(() => { if (VR.game.state === 'play') { VR.game.ui.show && VR.game.ui.show('pause'); } }).catch(() => {});
  await ev(() => { const b = document.querySelector('#pause [data-act="quit"]'); if (b) b.click(); }).catch(() => {});
  await untilState('title', 120000); await wait(3000);
  await click('#title [data-act="newworld"]', 'newworld2'); await wait(1500);
  await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } }).catch(() => {});
  await click('#cw_way [data-v="gentle"]', 'gentle'); await wait(500);
  await ev(() => { const cl = document.getElementById('chatlog'); window.__chat0 = cl ? cl.children.length : 0; }).catch(() => {});
  await click('#create .btn.primary', 'create2');
  const ta = Date.now(); const ok = await untilState('play', 300000) >= 0; OUT.advLoadMs = Date.now() - ta;
  await wait(4000); await shot('16_adv_t0');
  OUT.advHud = await ev(() => { const vis = (e) => e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden'; const cl = document.getElementById('chatlog'), news = cl ? [...cl.children].slice(window.__chat0 || 0).map(e => e.textContent.trim()) : []; const txt = [...document.querySelectorAll('#hud *, #modebadge')].filter(e => vis(e) && e.children.length === 0 && !(cl && cl.contains(e))).map(e => e.textContent.trim()).filter(Boolean).concat(news); const mm = document.getElementById('minimap'); let sd = -1; if (mm && mm.width) { try { const d = mm.getContext('2d').getImageData(0, 0, mm.width, mm.height).data; let m = 0, m2 = 0, n = 0; for (let i = 0; i < d.length; i += 8) { if (d[i + 3] < 10) continue; const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; m += L; m2 += L * L; n++; } if (n) { m /= n; sd = Math.sqrt(Math.max(0, m2 / n - m * m)); } } catch (e) { sd = -2; } } const inv = VR.game.player.inv.slots.slice(0, 9).filter(Boolean).map(s => s.id + '×' + s.n); return { chat: news.slice(0, 4), zen: txt.filter(t => /zen/i.test(t)).slice(0, 4), badge: (document.getElementById('modebadge') || {}).textContent || '', point: (document.getElementById('f2point') || {}).textContent || '', mapSd: +sd.toFixed(1), bar: inv }; }).catch((e) => ({ err: String(e) }));
  console.log('  adv hud: ' + JSON.stringify(OUT.advHud));
  check(OUT.advHud && !(OUT.advHud.zen || []).length && /ABENTEUER/.test(OUT.advHud.badge || ''), 'Abenteuer: its HUD says ABENTEUER, no „Zen": ' + JSON.stringify({ zen: OUT.advHud && OUT.advHud.zen, badge: OUT.advHud && OUT.advHud.badge, point: OUT.advHud && OUT.advHud.point }));
  check(OUT.advHud && OUT.advHud.bar && OUT.advHud.bar.length && !OUT.advHud.bar.some(x => /×64$/.test(x)), 'Abenteuer: the adventurer\'s bag, no stack of 64: ' + JSON.stringify(OUT.advHud && OUT.advHud.bar));
  check(OUT.advHud && OUT.advHud.mapSd > 10, 'Abenteuer: the minimap drawn at 4 s (luma sd ' + (OUT.advHud && OUT.advHud.mapSd) + ' > 10)');
  OUT.adv = await ev(() => new Promise((res) => { const g = VR.game, p = g.player.pos; const tod = g.env.timeOfDay; setTimeout(() => res({ pos: p.slice(), tod, err: 'timeout' }), 20000); g.pool.direct(0, { type: 'locate', dim: g.dim, biome: 'outpost', x: Math.floor(p[0]), z: Math.floor(p[2]) }, null, (m) => res({ pos: p.slice(), tod, out: m && m.pos, d: m && m.pos ? Math.round(Math.hypot(m.pos[0] - p[0], m.pos[2] - p[2])) : -1, adv: !!(VR.Adventure && VR.Adventure.on && VR.Adventure.on()) })); })).catch((e) => ({ err: String(e) }));
  console.log('  adv: ' + JSON.stringify(OUT.adv));
  // the day light ahead: env.js's sun is up while sin(2π·tod/24000) > 0 (ticks 0…12000); 20 ticks a second
  const light = OUT.adv && Number.isFinite(OUT.adv.tod) ? Math.max(0, 12000 - (OUT.adv.tod % 24000)) / 20 / 60 : -1;
  OUT.advLightMin = +light.toFixed(1);
  check(ok && OUT.adv && OUT.adv.adv && OUT.adv.d >= 0 && OUT.adv.d <= 320, 'Abenteuer: the nearest outpost ' + (OUT.adv && OUT.adv.d) + ' m from the spawn (≤ 320)');
  check(light >= 5, 'Abenteuer: ' + OUT.advLightMin + ' minutes of day light ahead (≥ 5)');
  await wait(20000); await shot('17_adv_t25');
  // f-hud: the Abenteuer start shows its HUD (critic_ux_17 of f-first2: none — F1's hidden HUD of the first world carried
  // over), Funke never in the camera's face, the settle move made under the arrival's white
  OUT.advHud25 = await ev(() => { const g = VR.game, h = document.getElementById('hud'), cs = getComputedStyle(h), fk = g.funke, c = g.cam; return { vis: cs.visibility, op: +cs.opacity, hideHud: !!g.hideHud, storyon: document.body.classList.contains('storyon'), arrival: !!g.arrival, funkeD: fk && fk.pos && c ? +Math.hypot(fk.pos[0] - c.x, fk.pos[1] - c.y, fk.pos[2] - c.z).toFixed(2) : -1, funkeVis: !!(fk && fk.visible), funkeCull: !!(VR.Funke && VR.Funke.camNear), sparkSkip: VR.Funke && VR.Funke.cost ? VR.Funke.cost.sparkSkip || 0 : -1, moved: VR.First2 && VR.First2.moved ? { r: VR.First2.moved.r, phase: VR.First2.moved.phase || 'after' } : null }; }).catch((e) => ({ err: String(e) }));
  console.log('  adv 25 s: ' + JSON.stringify(OUT.advHud25));
  check(OUT.advHud25 && OUT.advHud25.vis !== 'hidden' && OUT.advHud25.op > 0.5 && !OUT.advHud25.hideHud, 'Abenteuer: at 25 s the HUD is up (F1 in the first world does not carry over): ' + JSON.stringify(OUT.advHud25));
  check(OUT.advHud25 && (!OUT.advHud25.funkeVis || OUT.advHud25.funkeD >= 0.6 || OUT.advHud25.funkeCull), 'Abenteuer: Funke not drawn in the camera\'s face (closer than 0.6 m: culled; ' + (OUT.advHud25 && OUT.advHud25.funkeD) + ' m ≥ 0.6)');
  check(OUT.advHud25 && (!OUT.advHud25.moved || OUT.advHud25.moved.phase !== 'after'), 'Abenteuer: the spawn\'s settle move under the arrival\'s white (' + JSON.stringify(OUT.advHud25 && OUT.advHud25.moved) + ')');
  await offerCheck('18');
  // f-hud: the first fight — a Wächter 4 m ahead, three hits (the sparks where it is struck, the rock back, the clank), the
  // power-down (the „+EP" pop where it stood)
  await ev(() => { const u = VR.game.ui; if (u && u.screen && u.show) u.show(null); }).catch(() => {}); await untilClosed();
  OUT.foe = await ev(() => { const g = VR.game, p = g.player, En = g.entities, F = VR.Foes; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), x = p.pos[0] + fx * 4, z = p.pos[2] + fz * 4;
    let y = Math.floor(p.pos[1]) + 3; while (y > p.pos[1] - 6 && !(VR.R.T.flags[g.world.getBlock(Math.floor(x), y - 1, Math.floor(z))] & VR.F.SOLID)) y--;
    const m = En.summon('foe_sentry', x, y, z); if (!m) return null; m.foe = F.make('sentry', m.id, [x, y, z]); m.yaw = p.yaw + Math.PI; window.__m = m; p.pitch = -0.08; return [x, y, z].map(Math.round); }).catch(e => String(e));
  for (let i = 1; i <= 3; i++) { await ev(() => { const g = VR.game; g.entities.hurtMob(window.__m, 3, g.player.pos); }).catch(() => {}); const f0 = await ev(() => VR.game.frame).catch(() => 0); const t = Date.now(); while (Date.now() - t < 60000 && (await ev(() => VR.game.frame).catch(() => f0 + 1)) < f0 + 1) await wait(200); if (i === 2) await shot('19_adv_hit'); }
  OUT.hits = await ev(() => ({ stats: VR.HitFeel && Object.assign({}, VR.HitFeel.stats), clank: VR.HitFeel && VR.HitFeel.clankN, shake: VR.game.settings.hitShake })).catch(() => null);
  check(OUT.hits && OUT.hits.stats && OUT.hits.stats.hits >= 3 && OUT.hits.clank >= 3 && OUT.hits.shake !== true, 'the first fight: three hits felt (sparks, clank, rock back), the shake off by default: ' + JSON.stringify(OUT.hits));
  await ev(() => { const g = VR.game; g.entities.hurtMob(window.__m, 60, g.player.pos); }).catch(() => {});
  // (the power-down lasts 2.4 s of play — 24 frames at least; under load a frame took 10–60 s: the wait counts frames, cap 40 min)
  { const f0 = await ev(() => VR.game.frame).catch(() => 0), t = Date.now(); while (Date.now() - t < 2400000 && !(await ev(() => !!document.querySelector('.hfpop') || VR.HitFeel.stats.pops > 0).catch(() => false)) && (await ev(() => VR.game.frame).catch(() => f0)) - f0 < 80) await wait(500); }
  await shot('20_adv_pop');
  OUT.pop = await ev(() => ({ pops: VR.HitFeel.stats.pops, el: [...document.querySelectorAll('.hfpop')].map(e => e.textContent) })).catch(() => null);
  check(OUT.pop && OUT.pop.pops >= 1, 'the power-down: the EP pop where it stood: ' + JSON.stringify(OUT.pop));
}
OUT.errors = errs; OUT.ms = Date.now() - t0;
fs.writeFileSync(SHOTS + 'critic_ux' + (TAG ? '_' + TAG.slice(0, -1) : '') + '.json', JSON.stringify(OUT, null, 1));
check(errs.length === 0, 'no page errors (' + errs.length + ')' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');

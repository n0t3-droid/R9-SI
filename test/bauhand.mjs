// W2 „Bauhand & ✨" (spec 2026-10-07-all-ages-workflow-design.md §4, §8) — the 🖐 Bauhand in a running game:
// B opens the ring (≥ 6 slots on empty favourites: the starter set), key 1 holds the first (the strip says „Klick setzt"),
// a click places it as one built plan (blocks change in the ghost box) and the toast says Z takes it back, Z takes it back
// (nothing changed), the wheel turns it (the hotbar stays), Survival shows the card and no ring („Kreativ"), a sofa in view
// gets its card and ✏️ opens the Crafter on it (#craft/m/vm_sofa…), standing on the spot: a red ghost and a click that
// changes nothing (LMB never breaks); B does nothing in chat, on a screen, in a vehicle; Esc puts it away; no page errors.
// Screenshots: w2_ring, w2_ghost, w2_placed, w2_ghost_bad, w2_card, w2_survival (each after a 600 ms settle). ONLY=1,3 runs only those sections.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const NAV = { waitUntil: 'domcontentloaded', timeout: 180000 };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404|QuotaExceeded|quota/i.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const safe = async (fn, a) => { try { return await ev(fn, a); } catch (e) { return null; } };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = (n) => page.screenshot({ path: `/home/claude/vr/test/shots/${n}.png`, timeout: 180000 }).catch(() => {});
const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(String(n));
const section = async (n, name, fn) => { if (!want(n)) return; console.log(n + ' · ' + name); try { await fn(); } catch (e) { fails++; console.log('  ✗ ' + name + ' broke: ' + String(e && e.message || e).slice(0, 400)); } };
const until = async (fn, a, maxS = 30) => { for (let i = 0; i < maxS * 4; i++) { const r = await safe(fn, a); if (r) return r; await wait(250); } return null; };
const atTitle = async (maxS = 150) => !!(await until(() => !!(window.VR && VR.game && VR.game.state === 'title'), null, maxS));
const inPlay = async (maxS = 180) => !!(await until(() => { const g = window.VR && VR.game; return !!(g && g.state === 'play' && g.player && !g.player.hold && !g.studioOpen); }, null, maxS));

await page.goto(URL0 + '/index.html', NAV);
check(await atTitle(), 'the game is at its start screen');
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); g.saveSettings(); });
// a flat Zen world: room to place on
await ev(() => VR.game.createWorld({ name: 'Bauhand', mode: 'zen', difficulty: 'peaceful', type: 'flat', seed: '4711', cheats: true, kit: true }));
check(await inPlay(), 'a flat Zen world is open');
await wait(1500);
// stand still on the ground, the hints out of the way (they come one at a time; the test reads the strip and the toast)
await ev(() => { const g = VR.game, p = g.player; p.flying = false; if (VR.Hints) { const H = VR.Hints; for (const k of ['move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) H.done(k); } });
// helpers: the ground under the player, look at a spot d blocks ahead
const ground = () => ev(() => { const g = VR.game, w = g.world, p = g.player, x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]); for (let y = Math.floor(p.pos[1]) + 2; y > 0; y--) { const s = w.getBlock(x, y, z); if (s && (VR.R.T.flags[s] & VR.F.SOLID)) return y; } return -1; });
const lookAhead = (d) => ev((d) => { const p = VR.game.player; p.yaw = 0; const eye = p.pos[1] + (p.eye || 1.62); const gy = Math.floor(p.pos[1]) - 1 + 1; p.pitch = -Math.atan2(eye - gy, d); return { yaw: p.yaw, pitch: p.pitch }; }, d);
const center = async () => { await page.mouse.move(640, 360); };
const ghostNow = () => ev(() => { const a = VR.Bauhand.ghost; return a ? { ok: !!a.ok, why: a.why || '', prep: !!a.prep, x0: a.x0, z0: a.z0, x1: a.x1, z1: a.z1, F: a.F, top: a.bp ? a.bp.top : 0 } : null; });
const boxState = (a) => ev((a) => { const w = VR.game.world, out = []; for (let x = a.x0 - 1; x <= a.x1 + 1; x++) for (let z = a.z0 - 1; z <= a.z1 + 1; z++) for (let y = a.F - 1; y <= a.F + Math.max(3, a.top + 1); y++) out.push(w.getBlock(x, y, z)); return out; }, a);
const diff = (A, B) => { let n = 0; for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) n++; return n; };
const plans = () => ev(() => { const k = VR.game.gadgets.blue.plansKey(); try { return (JSON.parse(localStorage.getItem(k) || 'null') || { plans: [] }).plans; } catch (e) { return []; } });
const g0 = await ground();
console.log('  ground at y ' + g0);

let A = null, before = null, placed = null;
await section(1, 'B opens the ring: the starter set on empty favourites', async () => {
  await center();
  await page.keyboard.press('b');
  const open = await until(() => { const b = document.querySelector('#bauhand'); return b && b.classList.contains('on') ? { slots: [...b.querySelectorAll('.bh-slot[data-ding]')].map(s => ({ id: s.dataset.ding, name: s.title, star: !!s.querySelector('.bh-star') })), neu: !!b.querySelector('.bh-new'), x: !!b.querySelector('.bh-x'), state: VR.Bauhand.state } : null; }, null, 20);
  console.log('  ring', JSON.stringify(open));
  check(!!open && open.state === 'open', 'B → #bauhand.on (state open)');
  check(open && open.slots.length >= 6, '≥ 6 slots on empty favourites (' + (open ? open.slots.length : 0) + ')');
  check(open && /Bank/.test(open.slots.map(s => s.name).join(' ')) && open.slots.every(s => s.star), 'the starter set (Bank … Bungalow), each marked ☆');
  check(open && open.neu && open.x, '„✨ Neu…" at the top and ✕ to close');
  await wait(600);
  await shot('w2_ring');
});

await section(2, 'key 1 holds the first; the ghost on the ground ahead', async () => {
  if (!(await safe(() => VR.Bauhand.state === 'open'))) { await center(); await page.keyboard.press('b'); await wait(500); }
  await page.keyboard.press('1');
  const h = await until(() => { const g = VR.game, H = g.bauhand && g.bauhand.holding; return H ? { ding: H.ding, name: H.name, rot: H.rot, strip: (document.querySelector('#bhStrip') || {}).textContent || '', on: document.querySelector('#bhStrip.on') !== null } : null; }, null, 15);
  console.log('  holding', JSON.stringify(h));
  check(!!h && h.ding === 'm:vm_bench', 'key 1 → g.bauhand.holding is the bench (' + (h && h.ding) + ')');
  check(h && h.on && /Klick setzt/.test(h.strip), 'the strip shows „Klick setzt" (' + (h && h.strip.slice(0, 80)) + ')');
  check(await safe(() => !document.querySelector('#bauhand.on')), 'the ring is gone while holding');
  await lookAhead(5);
  A = await until(async () => null, null, 0);   // (placeholder: wait below)
  for (let i = 0; i < 60; i++) { A = await ghostNow(); if (A && A.ok) break; await wait(250); }
  console.log('  ghost', JSON.stringify(A));
  check(A && A.ok, 'a cyan ghost where the player looks (' + (A && (A.why || 'ok')) + ')');
  const chip = await safe(() => { const c = document.querySelector('#bhChip'); return c ? { t: c.textContent, ok: c.classList.contains('ok') } : null; });
  check(chip && chip.ok && /✓/.test(chip.t), 'the chip at the crosshair: ✓ and the name (' + (chip && chip.t) + ')');
  await wait(600); // the strip and the chip finish their 0.2 s rise before the picture
  await shot('w2_ghost');
});

await section(3, 'a click places it as one built plan; the toast says Z takes it back', async () => {
  if (!A || !A.ok) { check(false, 'no ghost to place'); return; }
  before = await boxState(A);
  const n0 = (await plans()).length, undo0 = await ev(() => VR.game.gadgets.wand.undo.length);
  await page.mouse.click(640, 360, { button: 'left' });
  const r = await until((n0) => { const g = VR.game, k = g.gadgets.blue.plansKey(); const ps = (JSON.parse(localStorage.getItem(k) || 'null') || { plans: [] }).plans; return ps.length > n0 ? ps : null; }, n0, 15);
  await wait(600);
  const after = await boxState(A), ps = (await plans()) || [];
  const mine = ps.filter(p => p.from === 'hand');
  placed = mine[mine.length - 1] || null;
  const st = await ev(() => ({ toast: (document.querySelector('#bhToast') || {}).textContent || '', last: VR.Bauhand.lastToast || '', undo: VR.game.gadgets.wand.undo.length, holding: !!(VR.Bauhand.holding) }));
  console.log('  placed', JSON.stringify({ n: ps.length, plan: placed && { kind: placed.kind, status: placed.status, ding: placed.ding }, changed: diff(before, after), toast: st.toast }));
  check(!!r && mine.length === 1 && placed.status === 'built' && placed.kind === 'model', 'one built plan (kind model, from the hand) in r9si.plans');
  check(diff(before, after) > 0, '> 0 blocks changed in the ghost box (' + diff(before, after) + ')');
  check(st.undo === undo0 + 1, 'one undo step');
  check(/zurück/.test(st.toast || st.last), 'the toast says Z takes it back („' + (st.toast || st.last) + '")');
  check(st.holding, 'the bench stays in the hand');
  await wait(600);
  await shot('w2_placed');
});

await section(4, 'the wheel turns it, the hotbar stays', async () => {
  const s0 = await ev(() => ({ rot: VR.Bauhand.holding ? VR.Bauhand.holding.rot : null, sel: VR.game.player.inv.sel }));
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 120);
  const s1 = await until((r0) => { const H = VR.Bauhand.holding; return H && H.rot !== r0 ? { rot: H.rot, sel: VR.game.player.inv.sel } : null; }, s0.rot, 10);
  console.log('  wheel', JSON.stringify({ s0, s1 }));
  check(s1 && s1.rot === (s0.rot + 1) % 4, 'holding.rot + 1 (' + s0.rot + ' → ' + (s1 && s1.rot) + ')');
  check(s1 && s1.sel === s0.sel, 'the hotbar selection is unchanged (' + s0.sel + ')');
  // R turns it too, the ↻ in the strip as well (the key acts on the press; the test polls for the turn, a slow frame is no fault)
  await page.keyboard.press('r');
  const s2 = await until((r1) => { const H = VR.Bauhand.holding; return H && H.rot !== r1 ? { rot: H.rot } : null; }, s1 ? s1.rot : 0, 10);
  console.log('  R ' + JSON.stringify({ s2, fps: await safe(() => Math.round((VR.game.fps || 0) * 10) / 10) }));
  check(!!s1 && !!s2 && s2.rot === (s1.rot + 1) % 4, 'R turns it once more (' + (s2 ? s2.rot : 'none') + ')');
});

await section(5, 'Z takes exactly that placement back', async () => {
  if (!placed || !A) { check(false, 'nothing placed to take back'); return; }
  await page.keyboard.press('z');
  const ok = await until((id) => { const k = VR.game.gadgets.blue.plansKey(); const ps = (JSON.parse(localStorage.getItem(k) || 'null') || { plans: [] }).plans; return !ps.some(p => p.id === id); }, placed.id, 10);
  await wait(500);
  const after = await boxState(A);
  const t = await ev(() => (document.querySelector('#bhToast') || {}).textContent || '');
  console.log('  undo', JSON.stringify({ gone: !!ok, changed: diff(before, after), toast: t }));
  check(!!ok, 'the plan leaves r9si.plans');
  check(diff(before, after) === 0, '0 blocks changed in the ghost box afterwards (' + diff(before, after) + ')');
  check(/weg/.test(t), 'the toast: „⟲ Bank weg" (' + t + ')');
});

await section(6, 'standing on the spot: a red ghost, a click changes nothing (LMB never breaks)', async () => {
  if (!(await safe(() => VR.Bauhand.state === 'holding'))) { await ev(() => VR.Bauhand.hold('m:vm_bench', { name: 'Bank' })); await wait(300); }
  await ev(() => { const p = VR.game.player; p.pitch = -1.5; });
  let a = null; for (let i = 0; i < 40; i++) { a = await ghostNow(); if (a && !a.ok && a.why === 'step') break; await wait(250); }
  console.log('  bad ghost', JSON.stringify(a));
  check(a && !a.ok && a.why === 'step', 'aiming at your own feet: not ok, „Tritt einen Schritt zurück"');
  const chip = await safe(() => { const c = document.querySelector('#bhChip'); return c ? { t: c.textContent, bad: c.classList.contains('bad') } : null; });
  check(chip && chip.bad && /Schritt zurück/.test(chip.t), 'the chip is red and says why (' + (chip && chip.t) + ')');
  await wait(600);
  await shot('w2_ghost_bad');
  const s0 = a ? await boxState(a) : [], n0 = (await plans()).length, gy = await ground();
  await page.mouse.click(640, 360, { button: 'left' }); await wait(700);
  const s1 = a ? await boxState(a) : [], n1 = (await plans()).length, gy1 = await ground();
  check(diff(s0, s1) === 0 && n1 === n0, 'the click changes nothing (no block, no plan)');
  check(gy1 === gy, 'the ground under you is still there (LMB never breaks while holding)');
});

await section(7, 'B and Esc: put away; B does nothing in chat, on a screen, in a vehicle', async () => {
  if (!(await safe(() => VR.Bauhand.state === 'holding'))) { await ev(() => VR.Bauhand.hold('m:vm_bench', { name: 'Bank' })); await wait(300); }
  await page.keyboard.press('Escape');
  const away = await until(() => (VR.Bauhand.state !== 'holding' && !VR.Bauhand.holding ? { state: VR.Bauhand.state } : null), null, 10);
  check(!!away, 'Esc puts it away (' + (away ? away.state : 'still holding') + ')');
  check(await safe(() => !VR.game.ui.screen && VR.game.state === 'play'), 'Esc does not pause the game (the hand takes the key)');
  await ev(() => { VR.game.ui.resume && VR.game.ui.resume(); }); await wait(400);
  const r = await ev(() => {
    const BH = VR.Bauhand, hit = (k) => k === 'KeyB';
    const fake = (o) => Object.assign({ input: { hit }, ui: { typing: false, screen: null }, gadgets: { controlling: null }, studioOpen: false }, o);
    const out = {};
    out.chat = BH.keys(fake({ ui: { typing: true, screen: null } })) || BH.state !== 'closed';
    out.screen = BH.keys(fake({ ui: { typing: false, screen: 'pause' } })) || BH.state !== 'closed';
    out.vehicle = BH.keys(fake({ gadgets: { controlling: { kind: 'shuttle' } } })) || BH.state !== 'closed';
    return out;
  });
  check(!r.chat && !r.screen && !r.vehicle, 'B in chat, on a screen and in a vehicle does nothing (' + JSON.stringify(r) + ')');
  await center(); await page.keyboard.press('b');
  check(!!(await until(() => VR.Bauhand.state === 'open', null, 8)), 'B opens it again');
  await page.keyboard.press('b'); await wait(400);
  check(await safe(() => VR.Bauhand.state === 'closed' && !document.querySelector('#bauhand.on')), 'B again closes it (one key, one dispatcher)');
});

await section(8, 'a sofa in view: its card, ✏️ opens the Crafter on it', async () => {
  const sofa = await ev(() => Object.keys(VR.VM.MODELS).filter(n => /^vm_sofa/.test(n)).sort()[0] || null);
  if (!sofa) { check(false, 'no sofa model'); return; }
  // a sofa four blocks ahead, built like the Studio's plans (no Ding on it: a plain model in the world)
  const at = await ev((name) => {
    const g = VR.game, p = g.player, blue = g.gadgets.blue, x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]) - 4, F = Math.floor(p.pos[1]);
    const pl = { id: 'tsofa', kind: 'model', name, ox: x, oz: z, F, r: 0, status: 'pending', t: Date.now() };
    blue.plans = blue.plans || []; blue.plans.push(pl);
    const res = blue.tryBuild(pl);
    p.yaw = 0; p.pitch = -Math.atan2((p.eye || 1.62) - 0.5, 3.6);
    return { res, x, z, F };
  }, sofa);
  console.log('  sofa', sofa, JSON.stringify(at));
  await wait(800);
  const tg = await until(() => { const t = VR.Bauhand.target(); return t && t.kind === 'model' ? t : null; }, null, 10);
  check(tg && /^m:vm_sofa/.test(tg.ding), 'it is the target: its Ding is m:' + sofa + ' (' + (tg && tg.ding) + ')');
  await center(); await page.keyboard.press('b');
  const card = await until(() => { const c = document.querySelector('#bauhand.on .bh-card'); return c && c.querySelector('.bh-cname') ? { name: c.querySelector('.bh-cname').textContent, acts: [...c.querySelectorAll('.bh-act')].map(b => b.dataset.act) } : null; }, null, 10);
  console.log('  card', JSON.stringify(card));
  check(card && card.acts.includes('edit'), 'its card on top of the ring, with ✏️ (' + (card && card.acts.join(' ')) + ')');
  await wait(600); // the card and the ring finish fading before the picture
  await shot('w2_card');
  if (!card) return;
  await page.click('#bauhand .bh-card [data-act="edit"]');
  const src = await until(() => { const f = document.getElementById('studioFrame'); return f && f.src && /craft\/m\//.test(f.src) ? f.src : (VR.game.studioOpen && f ? null : null); }, null, 25);
  console.log('  studio', src);
  check(src && /#craft\/m\/vm_sofa/.test(src), '✏️ → the Crafter on it (hash craft/m/vm_sofa…)');
  await ev(() => VR.game.closeStudio(true)); await wait(800);
  await ev(() => { const g = VR.game; g.ui.resume && g.ui.resume(); });
});

await section(9, 'Survival: the card and the way to Zen, no ring', async () => {
  await ev(() => { const g = VR.game; g.player.setMode('survival'); });
  await wait(300); await center(); await page.keyboard.press('b');
  const s = await until(() => { const b = document.querySelector('#bauhand.on'); return b ? { slots: b.querySelectorAll('.bh-slot').length, msg: (b.querySelector('.bh-msg') || {}).textContent || '', zen: !!b.querySelector('.bh-zen'), surv: b.classList.contains('survival') } : null; }, null, 10);
  console.log('  survival', JSON.stringify(s));
  check(s && s.slots === 0 && s.surv, 'no ring in Survival');
  check(s && /Kreativ/.test(s.msg) && s.zen, 'the text says „Kreativ" and offers „Zen einschalten"');
  await wait(600);
  await shot('w2_survival');
  await page.keyboard.press('Escape'); await wait(300);
  await ev(() => { const g = VR.game; g.player.setMode('zen'); });
});

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close(); srv.kill();
process.exit(fails ? 1 : 0);

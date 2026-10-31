// e-access (waves §6.6, erlebnis §6): src/main/a11y.js and its hooks, no browser.
//  (a) the flash limiter: never more than three flashes in any second, whatever asks; pulse() gates a curve's rising edge
//  (b) every effect's schedule: lightning (a storm, and bolts forced every frame), the jump flash, the bloom, the beacon
//      flicker, the fireworks — measured with countFlashes, and each effect's file asks the limiter
//  (c) markers: every pair a player must tell apart differs in shape (and the deutan simulation is the documented one)
//  (d) subtitles: ≥ 0.06 s a character, ≥ 2.5 s a line, ×0.75–×2; a story timeline is stretched, never shortened
//  (e) Ein-Hand: the keyboard preset has no conflicts; the mouse mode turns a right tap into the Aktion, a hold into walking
//  (f) Weniger Bewegung reaches every hook (flight / ascent shake, bob, wow, star jump, glitter, moon shake)
//  (g) the settings rows and their words in both languages; mono on a fake audio graph
//  (h) remapping complete: every key name the game polls belongs to an action (or is a viewer key); every action has a
//      label in both languages
//  (i) the session gate: the builder gated, the adventurer warned
require('./dom_stub.js');
globalThis.VR = {};
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
for (const f of ['i18n', 'lang_en', 'lang_de', 'settings_reg', 'binds', 'pad', 'input', 'weather', 'a11y']) require('../src/main/' + f + '.js');
const SS = require('../src/shared/sessionstats.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const A = VR.A11y;
if (!A || !A.flash) { console.log('VR.A11y missing'); console.log('FAILED 1'); process.exit(1); }
const src = (f) => fs.readFileSync(path.join(ROOT, 'src/main', f), 'utf8');
const DE = VR.I18N.dict.de, EN = VR.I18N.dict.en;

console.log('a · the flash limiter');
{
  const L = new A.Limiter(3, 1); let ok = 0;
  for (let i = 0; i < 100; i++) if (L.allow(i * 0.01, 1)) ok++;
  check(ok === 3, `100 asks in one second → ${ok} allowed (3)`);
  // any 1-s window over 20 s of asks every 50 ms
  const L2 = new A.Limiter(3, 1), at = [];
  for (let i = 0; i < 400; i++) if (L2.allow(i * 0.05, 1)) at.push(i * 0.05);
  let worst = 0; for (let a = 0, b = 0; b < at.length; b++) { while (at[b] - at[a] >= 1 - 1e-9) a++; worst = Math.max(worst, b - a + 1); }
  check(worst <= 3 && at.length >= 55, `asks every 50 ms for 20 s: ${at.length} allowed, at most ${worst} in any second`);
  const L3 = new A.Limiter(3, 1);
  check(L3.allow(0, 2) && !L3.allow(0.1, 2) && L3.allow(0.2, 1) && !L3.allow(0.5, 1) && L3.allow(1.05, 2), 'a bolt asks for two (stroke and flicker): the next pair waits');
  // pulse: a curve rising every 0.1 s is clipped after three
  A.limiter.reset(); A.pulseReset(); let t = 0; A.now = () => t;
  const out = []; for (let i = 0; i < 100; i++) { t = i * 0.01; out.push(A.pulse('test', (i % 10) < 3 ? 1 : 0)); }
  const peaks = out.filter((v, i) => v > 0.5 && (i === 0 || out[i - 1] <= 0.5)).length;
  check(peaks === 3, `a curve pulsing at 10 Hz through pulse(): ${peaks} full pulses pass in a second (3), the rest ≤ ${A.CLIP}`);
  check(A.countFlashes(out, 0.01) <= 3, `countFlashes of the gated curve: ${A.countFlashes(out, 0.01)} (≤ 3)`);
  const raw = []; for (let i = 0; i < 100; i++) raw.push((i % 10) < 3 ? 1 : 0);
  check(A.countFlashes(raw, 0.01) === 10, `the counter sees the ungated 10 Hz curve: ${A.countFlashes(raw, 0.01)} (10)`);
}

console.log('b · every effect\'s schedule');
{
  let t = 0; A.now = () => t; A.limiter.reset();
  // lightning: the schedule of a storm (a bolt every 8–25 s), then a storm forced to strike every frame
  const W = new VR.Weather(); W.setSeed(4242); W.force('gewitter');
  const dt = 1 / 60, series = [];
  for (let i = 0; i < 60 * 240; i++) { t = i * dt; W.update(dt, { ticks: 6000, day: 0, lowK: 0 }); series.push(W.flash); }
  const fl = A.countFlashes(series, dt);
  check(W.strikes >= 8 && fl <= 3, `a 4-minute storm: ${W.strikes} bolts, at most ${fl} flashes in any second`);
  const S2 = []; A.limiter.reset();
  for (let i = 0; i < 60 * 5; i++) { t = 300 + i * dt; if (i % 6 === 0) W.strike(); W.update(dt, { ticks: 6000, day: 0, lowK: 0 }); S2.push(W.flash); }
  const fl2 = A.countFlashes(S2, dt);
  check(fl2 <= 3, `bolts forced ten times a second: ${fl2} flashes in the worst second (≤ 3; the refused bolts stay dim)`);
  // the jump's flash (spaceflight.js SF.jumpFlash, read from the source: pure, at both ends of the jump)
  const m = /SF\.jumpFlash = \(J, s\) => (.+);\n/.exec(src('spaceflight.js'));
  const jf = m ? new Function('J', 's', 'return ' + m[1]) : null;
  const J = { dur: 8 }, js = []; if (jf) for (let s = 0; s < 8; s += dt) js.push(jf(J, s));
  check(!!jf && A.countFlashes(js, dt) <= 1, `the jump's flash: ${jf ? A.countFlashes(js, dt) : '?'} flash a second at most (one at each end)`);
  // the bloom of the freeing moment and the boss finish: asked of the limiter; five blooms in a second → three
  A.limiter.reset(); t = 500; let n = 0; for (let i = 0; i < 5; i++) { t = 500 + i * 0.1; if (A.flash('bloom')) n++; }
  check(n === 3, `five blooms in half a second: ${n} shown (3)`);
  // the disturbed beacon's flicker (liberate.js): the formula from the source, its brightness normalised
  const mf = /const fl = (0\.35 \+ 0\.35 \* Math\.max\(0, Math\.sin\(time \* 7\.3\) \* Math\.sin\(time \* 3\.1 \+ 1\)\));/.exec(src('liberate.js'));
  const ff = mf ? new Function('time', 'return ' + mf[1]) : null, bs = []; if (ff) for (let s = 0; s < 30; s += dt) bs.push(ff(s) / 0.7);
  check(!!ff && A.countFlashes(bs, dt) <= 3, `the disturbed beacon's flicker: ${ff ? A.countFlashes(bs, dt) : '?'} a second at most (≤ 3)`);
  // fireworks: a finale's bursts (one every 80 ms) — the burst flashes the limiter lets through
  A.limiter.reset(); const fw = []; for (let i = 0; i < 60 * 10; i++) { t = 600 + i * dt; fw.push(i % 5 === 0 && A.flash('fireworks') ? 1 : 0); }
  const fwS = []; let left = 0; for (const v of fw) { if (v) left = 12; fwS.push(left-- > 0 ? 1 : 0); }
  check(A.countFlashes(fwS, dt) <= 3, `a fireworks finale, a burst every 80 ms: ${A.countFlashes(fwS, dt)} flashes in the worst second`);
  // every effect's file asks the limiter
  const HOOK = { 'weather.js': "A11y.flash('bolt'", 'festival.js': "A11y.flash('fireworks'", 'liberate.js': "A11y.flash('bloom'", 'spaceflight.js': "A11y.pulse('jump'", 'bodylife.js': "A11y.flash('impact'", 'photomode.js': "A11y.flash('shutter'" };
  for (const f in HOOK) check(src(f).includes(HOOK[f]), `${f} schedules its flash through the limiter (${HOOK[f]})`);
  check(/L\.bloom\(\)/.test(src('rpg_boss.js')), 'the boss finish flashes through L.bloom (the limiter)');
  A.now = () => Date.now() / 1000;
}

console.log('c · markers: a shape as well as a colour');
{
  const groups = {}; for (const m of A.MARKERS) (groups[m.group] || (groups[m.group] = [])).push(m);
  for (const g in groups) {
    const L = groups[g], shapes = new Set(L.map(m => m.shape));
    check(L.length >= 2 && shapes.size === L.length && L.every(m => m.shape && /^#[0-9a-f]{6}$/i.test(m.colour)), `${g}: ${L.map(m => m.id.split('.')[1] + ' ' + m.shape).join(' · ')}`);
  }
  check(/quest_star_c = starModel\([^)]*, 4\)/.test(src('quests.js')), 'the ready ✦ is a four-pointed star (quests.js)');
  check(/if \(ic\.free\) \{[^}]*lineTo\(4\.5, -4\)/.test(src('rpg_boss2.js')) && /\['free', '◈'/.test(src('rpg_boss2.js')), 'a freed outpost: ✓ in its diamond, ◈ in the legend (rpg_boss2.js)');
  check(src('foes.js').includes('VR.A11y.foeRing('), 'a hostile machine\'s weak point gets its ring (foes.js)');
  const K = { fam: 'stray', weak: 'core' };
  check(A.ringOn({ st: 'approach' }, K, 100) && !A.ringOn({ st: 'calm' }, K, 100) && !A.ringOn({ st: 'approach', helper: true }, K, 100) && !A.ringOn({ st: 'approach' }, K, 30 * 30) && !A.ringOn({ st: 'tele' }, { fam: 'shadow', weak: 'light' }, 1), 'the ring: hostile and near only; calm, a Helfer, far or a shadow — none');
  let lo = 1, hi = 0; for (let s = 0; s < 3; s += 0.01) { const v = A.ringK(s); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  check(A.RING_HZ <= 1 && lo >= 0.5 && hi <= 1, `the ring breathes at ${A.RING_HZ} Hz between ${lo.toFixed(2)} and ${hi.toFixed(2)} (soft, not a flash)`);
  const d = A.simDeutan([1, 0, 0]), dg = A.simDeutan([0, 1, 0]);
  check(Math.abs(d[0] - d[1]) < 0.45 && Math.abs(dg[0] - dg[1]) < 0.45, `the deutan simulation (Machado 2009): red → ${d.map(v => v.toFixed(2))}, green → ${dg.map(v => v.toFixed(2))}`);
  const c1 = A.simDeutan(A.hexRgb('#ff29cc')), c2 = A.simDeutan(A.hexRgb('#47ff75'));
  console.log(`    (the foe's two optic colours under deuteranopia: ${c1.map(v => v.toFixed(2))} vs ${c2.map(v => v.toFixed(2))} — the ring tells them apart)`);
}

console.log('d · subtitles');
{
  check(A.subDur('kurz') === 2.5 && Math.abs(A.subDur('x'.repeat(100)) - 6) < 1e-9, `a short line 2.5 s, 100 characters ${A.subDur('x'.repeat(100))} s`);
  check(Math.abs(A.subDur('x'.repeat(100), 2) - 12) < 1e-9 && Math.abs(A.subDur('x'.repeat(100), 9) - 12) < 1e-9 && Math.abs(A.subDur('kurz', 0.1) - 1.875) < 1e-9, 'the speed ×0.75–×2, clamped');
  const texts = ['Hallo.', 'x'.repeat(140), 'Noch eine längere Zeile, die man lesen können muss.'];
  const tl = { len: 9, lines: [{ i: 0, t0: 0.6, t1: 2.0 }, { i: 1, t0: 2.3, t1: 5.0 }, { i: 2, t0: 5.3, t1: 7.5 }] };
  A.stretch(tl, texts, 1);
  const okAll = tl.lines.every(q => q.t1 - q.t0 >= A.subDur(texts[q.i], 1) - 1e-9), noOverlap = tl.lines.every((q, i) => i === 0 || q.t0 >= tl.lines[i - 1].t1);
  check(okAll && noOverlap && tl.len >= tl.lines[2].t1, `a compressed story timeline stretched: ${tl.lines.map(q => (q.t1 - q.t0).toFixed(2)).join(' / ')} s, the scene ${tl.len.toFixed(1)} s`);
  check(/VR\.A11y\.stretch\(tl, texts/.test(src('story.js')), 'story.js stretches every scene');
  check(A.hintMs('a'.repeat(80), 1200, 1) === 4800 && A.hintMs('ok', 6000, 1) === 6000 && A.hintMs('x', 0, 1) === 0, 'a hint lasts as long as its words need (never shorter than asked; a sticky hint stays sticky)');
  // the shared story pins its own times; the stretch only lengthens
  const S = require('../src/shared/story.js'), sh = (S && S.lineDur) ? S : VR.Story;
  if (sh && sh.lineDur) check(sh.lineDur('x'.repeat(200)) <= A.subDur('x'.repeat(200)), `story's own time for 200 characters ${sh.lineDur('x'.repeat(200))} s → the stretch gives ${A.subDur('x'.repeat(200))} s`);
}

console.log('e · Ein-Hand');
{
  const B = VR.Binds; B.current = new B.Bindings();
  const kb = A.presetBindings('keys');
  check(kb.conflicts().length === 0, `the keyboard preset has no conflicts (${JSON.stringify(kb.conflicts())})`);
  check(kb.slots('fwd')[0] === 'ArrowUp' && kb.slots('jump')[0] === 'ShiftRight' && kb.slots('veh')[0] === 'ControlRight', 'arrows walk, right Shift jumps, right Ctrl is the Aktion');
  const extra = Object.values(A.ONEHAND_EXTRA); const owned = extra.filter(c => kb.owners(c).length);
  check(owned.length === 0, `the extra keys (${extra.join(' ')}) belong to no action (${owned.join(' ')})`);
  A.applyHand('keys'); const inKeys = B.current.slots('fwd')[0]; A.applyHand('off');
  check(inKeys === 'ArrowUp' && B.current.slots('fwd')[0] === 'KeyW', 'the preset is an overlay: off brings the player\'s own keys back');
  // mouse mode on a real Input: a tap → veh; a hold → fwd; the middle button places
  const canvas = { addEventListener() {}, requestPointerLock: null };
  const inp = new VR.Input(canvas);
  const frame = (fn) => { fn && fn(inp.mouse); A.inputFrame(inp, 1 / 30, 'mouse'); const r = { veh: inp.padPressed.has('veh'), fwd: inp.padDown.has('fwd'), place: inp.mouse.down[2], fwdName: inp.down('KeyW'), vName: inp.hit('KeyV') }; inp.endFrame(); inp.padDown = new Set(); return r; };
  let r = frame(M => { M.down[2] = true; M.clicked[2] = true; });
  check(!r.veh && !r.place, 'the right button pressed: no place, nothing yet');
  r = frame(M => { M.down[2] = false; M.releasedBtn[2] = true; });
  check(r.veh && r.vName, 'released at once: the Aktion (V) fires');
  frame(M => { M.down[2] = true; M.clicked[2] = true; });
  let walked = false; for (let i = 0; i < 20; i++) { const q = frame(); if (q.fwd && q.fwdName) walked = true; }
  r = frame(M => { M.down[2] = false; M.releasedBtn[2] = true; });
  check(walked && !r.veh, 'held: the player walks ahead (W); letting go after a hold is no Aktion');
  r = frame(M => { M.down[1] = true; M.clicked[1] = true; });
  check(r.place, 'the middle button places (the right button\'s old job)');
  // keys mode: Period breaks, Comma places, PageUp looks up, [ ] the hotbar
  const kf = (codes, pressed) => { inp.keys = new Set(codes); for (const c of pressed || []) inp.pressed.add(c); A.inputFrame(inp, 1 / 30, 'keys'); const q = { brk: inp.mouse.down[0], plc: inp.mouse.down[2], dy: inp.mouse.dy, wheel: inp.mouse.wheel }; inp.endFrame(); return q; };
  const q = kf(['Period', 'PageUp'], ['Period', 'BracketRight']);
  check(q.brk && q.dy < 0 && q.wheel === 1, 'keys only: . breaks, PageUp looks up, ] turns the hotbar');
}

console.log('f · Weniger Bewegung reaches every hook');
{
  const H = { 'flight.js': 'VR.A11y.less(S)', 'ascent.js': 'VR.A11y.less(S)', 'game.js': 'VR.A11y.less(S)', 'wowmoment.js': 'VR.A11y.less(g.settings)', 'starjump.js': 'g.settings.lessMotion', 'festival.js': 'VR.A11y.less()', 'bodylife.js': 'VR.A11y.less(g.settings)' };
  for (const f in H) check(src(f).includes(H[f]), `${f}: ${H[f]}`);
  check(A.less({ lessMotion: true }) && A.less({ reduceMotion: true }) && !A.less({}), 'less(): the switch (and the older reduceMotion name)');
}

console.log('g · settings rows, words, mono');
{
  for (const r of A.ROWS) {
    const it = VR.Settings.byKey(r.key);
    const keys = [r.lab, r.tip].concat((r.opts || []).flatMap(o => [o[1], o[2]]));
    const miss = keys.filter(k => typeof DE[k] !== 'string' || typeof EN[k] !== 'string');
    check(!!it && miss.length === 0, `row ${r.key} (${r.g}/${r.sec}) with its words in both languages${miss.length ? ' — missing ' + miss.join(', ') : ''}`);
  }
  check(VR.Settings.SECTIONS.play.includes('access') && DE['g.set.sec.access'] === 'Zugänglichkeit' && EN['g.set.sec.access'] === 'Accessibility', 'the section „Zugänglichkeit" / Accessibility');
  const d = VR.Settings.defaults();
  check(d.lessMotion === false && d.oneHand === 'off' && d.subSpeed === 1 && d.textSize === 1 && d.highContrast === false && d.monoAudio === false, 'every switch off by default (nothing changes for a player who does not ask)');
  const node = { channelCount: 2, channelCountMode: 'max', channelInterpretation: 'speakers' }, au = { ctx: {}, monoNode: node };
  check(A.applyMono(au, true) && node.channelCount === 1 && node.channelCountMode === 'explicit' && A.applyMono(au, false) && node.channelCount === 2, 'mono: the master bus downmixed to one channel and back');
  check(/this\.monoNode = c\.createGain\(\); comp\.connect\(this\.monoNode\); this\.monoNode\.connect\(c\.destination\)/.test(src('audio.js')), 'audio.js: the mono node between the compressor and the speakers');
}

console.log('h · remapping complete');
{
  const B = VR.Binds, polled = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, 'src/main'))) {
    if (!f.endsWith('.js') || f.startsWith('lang_')) continue;
    const s = src(f), re = /\.(?:down|hit)\(\s*'([A-Za-z0-9]+)'/g; let m;
    while ((m = re.exec(s))) polled.add(m[1]);
  }
  const loose = [...polled].filter(k => !B.byName(k) && !B.reserved(k) && !A.VIEWER_KEYS[k] && !/^F\d+$/.test(k));
  check(loose.length === 0, `every polled key (${polled.size}) is an action, a reserved key or a viewer key${loose.length ? ' — loose: ' + loose.join(' ') : ''}`);
  const noLab = B.ACTIONS.filter(a => typeof DE['ctl.' + a.id] !== 'string' || typeof EN['ctl.' + a.id] !== 'string').map(a => a.id);
  check(noLab.length === 0, `every action (${B.ACTIONS.length}) has its label in both languages${noLab.length ? ' — ' + noLab.join(' ') : ''}`);
  check(new B.Bindings().conflicts().length === 0, 'the defaults (with Bauhand B, Spiegeln L, Stempel U) have no conflicts');
  const sp = fs.readFileSync(path.join(ROOT, 'src/main/settings_panel.js'), 'utf8');
  check(/for \(const a of [^)]*ACTIONS/.test(sp) || /ACTIONS\.filter/.test(sp), 'the controls page lists the actions from VR.Binds.ACTIONS (so every one is rebindable there)');
}

console.log('i · the session gate');
{
  const v = (type, ok) => ({ type, rows: [{ key: 'gap', ok }, { key: 'variety', ok: true }], met: ok ? 2 : 1, total: 2 });
  let G = SS.gate({ builder: v('builder', true), adventurer: v('adventurer', false) });
  check(G.fails === 0 && G.warns === 1, `builder met, adventurer short → pass with a warning (${G.lines.join(' | ')})`);
  G = SS.gate({ builder: v('builder', false), adventurer: v('adventurer', true) });
  check(G.fails === 1, `builder short → the release fails (${G.lines[0]})`);
  G = SS.gate({ adventurer: v('adventurer', true) });
  check(G.fails === 1, 'a builder that did not run fails the gate');
  check(/SESSION_GATE/.test(fs.readFileSync(path.join(ROOT, 'test/session.mjs'), 'utf8')) && /R9_RELEASE[\s\S]*SESSION_GATE=1 run_test session\.mjs/.test(fs.readFileSync(path.join(ROOT, 'test/regress.sh'), 'utf8')), 'session.mjs gates with SESSION_GATE=1; the release lane (R9_RELEASE=1) runs it');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

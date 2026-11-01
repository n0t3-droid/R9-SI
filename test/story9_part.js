// a-story7 · test/story.js section 22 (plan docs/superpowers/plans/2026-11-01-a-story7.md): Arc 2 — „Das Lied der
// Wiegelind", chapters 13–16. The book (≤ 4 beats a chapter, scenes ≤ 25 s, every line in both tables, the new
// speakers' faces), the rules (near a fairy place, near home, the night), the deeds (trip, sign — S.styleWay for the
// builder, the adventurer, the explorer), every beat reachable for each play style × each choice × each helper, kept
// through a save, never while building or fighting; the gifts (the place, the Dreilichterfest); the glue
// (src/main/story_arc2.js) on a stand-in game: the context, the journeys counted, the sign watched, the choice → the
// place and the festival, the fairy places and the villages' festival day, the journal, the music's hook. Required by
// test/story.js.
module.exports = function (S, SP, tr, calm, check, rnd) {
  console.log('22 · a-story7: Arc 2 — chapters 13–16');
  const path = require('path');
  const SRC = path.join(__dirname, '../src/');
  const nb = S.BEATS.filter(b => b.ch >= 13);
  const all = (b) => { const o = []; if (b.scene.alt) for (const k of Object.keys(b.scene.alt)) o.push(...b.scene.alt[k]); else o.push(...b.scene.lines); return o; };
  check(S.CHAPTERS.length === 16 && S.CHAPTERS.filter(c => c.arc === 2).map(c => c.n).join() === '13,14,15,16' && S.CHAPTERS.every(c => c.written), 'four new chapters 13–16, Arc 2, written');
  check([13, 14, 15, 16].every(c => S.ofChapter(c).length >= 2 && S.ofChapter(c).length <= 4 && S.ofChapter(c).every((b, i) => b.n === i + 1)), 'each chapter 2–4 beats in order (' + [13, 14, 15, 16].map(c => S.ofChapter(c).length).join(' ') + ')');
  check(nb.every(b => S.sceneLen(b) <= 25 && S.sceneLen(b) >= 12 && b.scene.shots.every(q => q.dur <= 9)), 'every scene 12–25 s (' + nb.map(b => S.sceneLen(b)).join(' ') + ')');
  check(nb.every(b => b.when.adv === true) && S.byId('c13.b1').when.after === 'c12.b3', 'Arc 2 follows the finale\'s epilogue, in Abenteuer worlds');
  check(nb.every(b => all(b).length >= 3 && all(b).every(l => S.WHO.includes(l.who))) && ['wiegelind', 'borke', 'tauli'].every(w => nb.some(b => all(b).some(l => l.who === w))), 'three to five lines a scene; the new speakers Wiegelind, Mutter Borke, Tauli speak');
  check(nb.every(b => b.scene.shots.some(q => q.fx)) && nb.filter(b => b.scene.shots.some(q => q.swell)).length >= 9, 'every scene has the film\'s own pictures; a swell in each');
  const ck = S.keys().filter(k => /story\.(c1[3-6]\.|choice\.(c15|style)|who\.(wiegelind|borke|tauli))/.test(k));
  const miss = ck.filter(k => !tr('de', k) || !tr('en', k)), same = ck.filter(k => /\.\d$|\.j$|\.after$/.test(k) && tr('de', k) === tr('en', k));
  check(ck.length > 100 && !miss.length, ck.length + ' Arc-2 keys in both tables' + (miss.length ? ': missing ' + miss.slice(0, 6).join(', ') : ''));
  check(!same.length, 'every new German line is German' + (same.length ? ': ' + same.slice(0, 4).join(', ') : ''));
  const longL = ck.filter(k => /\.\d$/.test(k) && ((tr('de', k) || '').length > 110 || (tr('en', k) || '').length > 110));
  check(!longL.length, 'every new line short enough to read (≤ 110 characters) ' + longL.join(', '));
  check(nb.every(b => tr('de', 'story.act.' + b.id) && tr('en', 'story.act.' + b.id) && tr('de', 'story.task.' + b.task.kind) && tr('en', 'story.task.' + b.task.kind)), 'every new deed and task in the tables');
  check(['story.place.stay', 'story.place.sow', 'story.j.arc2', 'story.j.hook2', 'story.j.fest', 'story.j.festNow', 'story.gift.arc2', 'story.fest.tonight'].every(k => tr('de', k) && tr('en', k) && tr('de', k) !== tr('en', k)), 'the gifts\' and the journal\'s words in both tables');
  // the reveal: who blinks three times, tied to the peoples, the Flausel, Echo
  const de = (k) => tr('de', k) || '';
  check(/Wiegelind/.test(de('story.c13.b2.1')) && /Samen/.test(de('story.c13.b2.3')) && /Echo/.test(de('story.c13.b3.1')) && /Lied/.test(de('story.c13.b3.4')), 'the reveal: Wiegelind, the Flausel came as her seeds, Echo learned its blink from her, every people\'s lullaby is her song');
  check(S.byId('c13.b3').task.kind === 'lift' && S.byId('c14.b1').task.kind === 'bridge' && S.byId('c14.b2').task.kind === 'ride' && ['lift', 'bridge', 'ride'].every(k => nb.some(b => b.act.kind === 'trip' && b.act.target === k)), 'the journey uses the seamless travel: the Himmelsleiter, a Lichtbrücke, a caravan (tasks and deeds)');
  check(nb.filter(b => b.when.near && (b.when.near.fairy || b.when.near.home)).length >= 3, 'the fairy places and your home are where it happens');

  // ---- the rules
  const upTo = (id, o) => { const r = S.fresh(); for (const b of S.BEATS) { if (b.id === id) break; S.mark(r, b.id); } r.choices.c6 = (o && o.c6) || 'lumi'; if (o && o.how) r.choices.how = o.how; return r; };
  const r13 = upTo('c13.b1');
  check(S.why(S.byId('c13.b1'), calm({ hour: 'noon' }), r13) === 'hour' && S.why(S.byId('c13.b1'), calm({ hour: 'dusk' }), r13) === null && S.why(S.byId('c13.b1'), calm({ hour: 'night', dim: 'aqua' }), r13) === 'dim', 'c13.b1 at dusk or night on Herzwelt');
  check(S.open(upTo('c13.b1')).id === 'c13.b1' && S.chapter(r13) === 13, 'after the epilogue the next signal is open: chapter 13');
  const r132 = upTo('c13.b2');
  check(S.why(S.byId('c13.b2'), calm({ near: { fairy: 120 } }), r132) === 'near' && S.why(S.byId('c13.b2'), calm({ near: { fairy: 30 } }), r132) === null, 'c13.b2 at a fairy place (≤ 45 m)');
  check(S.why(S.byId('c14.b1'), calm({ dim: 'stn.ring' }), upTo('c14.b1')) === null && S.why(S.byId('c14.b1'), calm(), upTo('c14.b1')) === 'dim', 'c14.b1 at the Ringstation');
  check(S.why(S.byId('c14.b2'), calm({ dim: 'zinn' }), upTo('c14.b2')) === null && S.why(S.byId('c14.b2'), calm({ dim: 'x.3.1.aqua' }), upTo('c14.b2')) === null && S.why(S.byId('c14.b2'), calm(), upTo('c14.b2')) === 'dim', 'c14.b2 on a people\'s world or a strange one');
  const r16 = upTo('c16.b1'); r16.choices.c15 = 'stay';
  check(S.why(S.byId('c16.b1'), calm({ hour: 'dusk', near: { home: 300 } }), r16) === 'near' && S.why(S.byId('c16.b1'), calm({ hour: 'dusk', near: { home: 40 } }), r16) === null && S.why(S.byId('c16.b1'), calm({ hour: 'noon', near: { home: 40 } }), r16) === 'hour', 'c16.b1 at home at nightfall');
  // ---- the deeds
  check(S.ACT_KINDS.includes('trip') && S.ACT_KINDS.includes('sign'), 'two new deed kinds: trip, sign');
  const lift = S.byId('c13.b3').act;
  check(S.actCheck(lift, {}) === 'armed' && S.actCheck(lift, { trip: ['ride'] }) === 'armed' && S.actCheck(lift, { trip: ['lift'] }) === 'ok', 'the trip deed: done by that journey (the Himmelsleiter), not another');
  const rt = S.fresh(); check(S.trip(rt, 'bridge') && S.trip(rt, 'bridge') && !S.trip(rt, 'boat') && rt.trips.bridge === 2, 'journeys counted (rec.trips)');
  const b0 = { placed: 10, span: 0, homes: 1, freed: 2, calms: 0, fairy: 1, trips: 3, places: 4, dims: 6 };
  const W = (o) => S.styleWay(b0, Object.assign({}, b0, o));
  check(W({}) === null, 'nothing done: no sign');
  check(W({ placed: 36, span: 7 }) === 'build' && W({ homes: 2 }) === 'build' && W({ placed: 36, span: 2 }) === null, 'a builder: a tall build (24 blocks, 5 m) or a new home → build');
  check(W({ freed: 3 }) === 'quest' && W({ calms: 1 }) === 'quest' && W({ fairy: 2 }) === 'quest', 'an adventurer: a beacon freed, a machine calmed, a fairy adventure → quest');
  check(W({ trips: 4 }) === 'roam' && W({ places: 6 }) === 'roam' && W({ dims: 7 }) === 'roam' && W({ places: 5 }) === null, 'an explorer: a journey, two new fairy places, a new world → roam');
  const sg = S.byId('c15.b1').act;
  check(sg.kind === 'sign' && S.actCheck(sg, {}) === 'armed' && S.actCheck(sg, { sign: 'roam' }) === 'ok', 'c15.b1\'s deed is the sign');
  const rs = upTo('c15.b2');
  check(S.why(S.byId('c15.b2'), calm(), rs) === 'deed' && S.sign(rs, 'quest') && !S.sign(rs, 'build') && rs.choices.style === 'quest' && S.actDone(rs, 'c15.b1') && S.why(S.byId('c15.b2'), calm(), rs) === null, 'Wiegelind answers only after your sign (kept once)');
  check(S.choicePending(rs) === null && (() => { S.mark(rs, 'c15.b2'); return S.choicePending(rs) === 'c15'; })(), 'after her answer, the choice c15 (stay · sow)');
  for (const w of S.STYLES) { const r = upTo('c15.b2'); S.sign(r, w); const ls = S.linesOf(S.byId('c15.b2'), r); check(ls.length === 4 && ls.every(l => l.key.indexOf('.' + w + '.') > 0) && ls.some(l => l.who === 'wiegelind'), 'c15.b2 speaks of your way: ' + w); }
  check(new Set(S.STYLES.map(w => de('story.c15.b2.' + w + '.1'))).size === 3 && new Set(S.STYLES.map(w => de('story.c15.b2.' + w + '.4'))).size === 3, 'three ways, three first lines and three answers of hers');
  // ---- the gifts
  const rg = S.fresh();
  check(!S.found(rg, { opt: 'nope', x: 1, z: 2 }, 3) && S.found(rg, { opt: 'stay', x: 10.4, z: -7.6 }, 12) && !S.found(rg, { opt: 'sow', x: 0, z: 0 }, 1) && rg.gift.place.kind === 'circle' && rg.gift.place.x === 10 && rg.gift.fest === 12, 'founded once: the place (stay → the stone circle) and the festival\'s day');
  check(S.festDay(rg, 12) && !S.festDay(rg, 13) && S.festDay(rg, 19) && S.festDay(rg, 26) && !S.festDay(rg, 5) && !S.festDay(S.fresh(), 12), 'the Dreilichterfest: the founding night and every 7th after');
  const rgs = S.fresh(); S.found(rgs, { opt: 'sow', x: 0, z: 0 }, 0); check(rgs.gift.place.kind === 'shroom', 'sow → the Sternsaatwiese (the glowing wood)');
  const junk = S.load({ v: 1, beats: {}, trips: { lift: 3, boat: 4, ride: 'x' }, gift: { place: { opt: 'stay', x: 'a', z: 2 }, fest: 3 }, choices: { style: 'dance', c15: 'sow' } });
  check(JSON.stringify(junk.trips) === '{"lift":3}' && junk.gift === null && !junk.choices.style && junk.choices.c15 === 'sow', 'the record sanitises the journeys, the gift and the choices');

  // ---- every beat reachable for each play style, each choice, each helper; kept through a save
  const ctxFor = (b) => { const w = b.when, d = w.dim ? (w.dim[0] === 'stn.*' ? 'stn.ring' : w.dim[0] === 'x.*' ? 'x.4.2.aqua' : w.dim[0]) : 'overworld'; return calm({ dim: d, hour: 'night', near: { outpost: 9999, village: 50, fairy: 20, home: 30 } }); };
  let n = 0;
  for (const style of S.STYLES) for (const opt of ['stay', 'sow']) for (const c6 of ['wellari', 'lumi']) {
    if ((n++ % 2) && c6 === 'wellari') continue;
    const r = upTo('c13.b1', { c6, how: 'fly' }); const path0 = []; let bad = 0;
    for (let i = 0; i < 30; i++) {
      const b = S.open(r); if (!b) break;
      if (S.choicePending(r)) S.choose(r, 'c15', opt);
      const c = ctxFor(b);
      if (b.when.deed) S.sign(r, style);
      if (S.ready(b, Object.assign({}, c, { building: true }), r) || S.ready(b, Object.assign({}, c, { fighting: true }), r)) bad++;
      if (!S.ready(b, c, r)) { check(false, style + '/' + opt + ': ' + b.id + ' not reachable: ' + S.why(b, c, r)); break; }
      path0.push(b.id); S.mark(r, b.id); S.visit(r, c.dim);
      if (b.id === 'c15.b2') S.found(r, { opt: r.choices.c15 || opt, x: 40, z: 40 }, 5);
    }
    if (S.choicePending(r)) S.choose(r, 'c15', opt);
    check(path0.length === nb.length && path0[0] === 'c13.b1' && path0[path0.length - 1] === 'c16.b2' && !bad && S.free2(r), `${style} · ${opt} · ${c6}: all ${nb.length} beats of 13–16 in order, none while building or fighting, the arc ends`);
    const back = S.load(JSON.parse(JSON.stringify(r)));
    check(back.choices.style === style && back.choices.c15 === opt && back.gift && back.gift.place.opt === opt && S.free2(back) && S.linesOf(S.byId('c16.b2'), back).every(l => l.key.indexOf('.' + opt + '.') > 0) && S.linesOf(S.byId('c16.b1'), back).every(l => l.key.indexOf('.' + c6 + '.') > 0), 'kept through a save: your way, the choice, the gift, the lines');
  }
  let rd = 0, bd = 0;
  for (let i = 0; i < 3000; i++) {
    const rec = upTo(S.BEATS[S.BEATS.length - 1 - Math.floor(rnd() * nb.length)].id); if (rnd() < 0.5) S.sign(rec, S.STYLES[Math.floor(rnd() * 3)]); if (rnd() < 0.5) rec.choices.c15 = rnd() < 0.5 ? 'stay' : 'sow';
    const c = { calm: rnd() * 60, building: rnd() < 0.3, fighting: rnd() < 0.3, menu: rnd() < 0.1, landing: rnd() < 0.1, adv: true, dim: ['overworld', 'stn.ring', 'zinn', 'x.1.1.aqua'][Math.floor(rnd() * 4)], hour: rnd() < 0.5 ? 'night' : 'noon', near: { fairy: rnd() * 100, home: rnd() * 200, village: 50, outpost: 999 } };
    for (const b of nb) if (S.ready(b, c, rec)) { rd++; if (c.building || c.fighting || c.menu || c.landing || c.calm < S.CALM_ADV) bd++; }
  }
  check(rd > 50 && !bd, `3,000 contexts on 13–16: ${rd} ready, ${bd} while busy`);

  // ---- the faces and the pictures
  const Po = VR.Portrait;
  if (Po) for (const w of ['wiegelind', 'borke', 'tauli']) { const o = Po.ops(w, 'happy', false, true); check(Po.WHO.includes(w) && o.length > 25 && JSON.stringify(o) !== JSON.stringify(Po.ops('flimmi', 'happy', false, true)) && JSON.stringify(Po.ops(w, 'worried', false, false)) !== JSON.stringify(Po.ops(w, 'happy', false, false)), 'a face of its own: ' + w); }
  const Fx = VR.StoryFx;
  if (Fx) {
    const used = new Set(); for (const b of nb) for (const q of b.scene.shots) if (q.fx) used.add(q.fx);
    check([...used].every(x => Fx.KINDS.includes(x)) && used.size >= 6, 'the new pictures are drawn (' + [...used].join(' ') + ')');
    let calls = 0, err = ''; const grad = { addColorStop() {} };
    const mc = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => grad : () => { calls++; }), set: (o, k, v) => { o[k] = v; return true; } });
    const cnt = {};
    for (const k of used) for (const low of [false, true]) { const c0 = calls; for (const t of [0, 0.2, 2.6, 7]) { try { Fx.draw(mc, k, t, (t / 8) % 1, 640, 360, { low, cam: 'up', wiegeUV: [0.5, 0.3], style: 'build', opt: 'sow' }); } catch (e) { err = k + ': ' + e.message; } } cnt[k + (low ? '0' : '1')] = calls - c0; }
    check(!err && [...used].every(k => cnt[k + '1'] > 0 && cnt[k + '0'] > 0 && cnt[k + '0'] <= cnt[k + '1']), 'they draw on a 2-D canvas, Very Low with less (' + (err || [...used].map(k => k + ' ' + cnt[k + '1'] + '/' + cnt[k + '0']).join(', ')) + ')');
    check(Fx.blink3(0.15) > 0.5 && Fx.blink3(0.6) > 0.5 && Fx.blink3(1.05) > 0.5 && Fx.blink3(2) === 0 && Fx.blink3(0.4) < 0.2, 'her blink: three flashes, then rest');
  }

  // ---- the glue on a stand-in game (src/main/story_arc2.js)
  const sent = [];
  VR.Fairy = { state: { key: 'overworld|9', sites: [{ id: 'overworld:tree', kind: 'tree', x: 100, y: 70, z: 0 }, { id: 'overworld:shroom', kind: 'shroom', x: -200, y: 66, z: 30 }] }, sites: () => [{ id: 'overworld:tree', kind: 'tree', x: 100, z: 0 }] };
  VR.MoveIn = { rec: (g) => g.meta.movein, homesOf: (rec, s) => rec.homes.filter(h => h.set === s.id && h.st === 'home'), plazaOf: (rec, s) => ({ x: s.x, y: s.y, z: s.z }) };
  function Vill(g) { this.g = g; } Vill.prototype.festivalDay = function () { return false; }; VR.Villages = Vill;
  VR.Wander = { note: (meta, page, id, v) => { (meta.wander = meta.wander || {})[page + ':' + id] = v; return true; } };
  const jy = []; VR.Journey = { lift: (g, d, o) => { jy.push('lift'); return true; }, bridge: () => true, ride: () => true };
  require(SRC + 'main/story_arc2.js');
  const A2 = VR.StoryArc2;
  check(!!A2 && typeof A2.found === 'function', 'VR.StoryArc2 (the glue) loads');
  const done = {}; for (const b of S.BEATS) if (b.ch <= 12) done[b.id] = 'done';
  const g = { state: 'play', world: {}, time: 0, dim: 'overworld', env: { day: 30, timeOfDay: 12000 }, settings: { storyOffer: true, preset: 'high' }, meta: { seed: 9, story: { v: 1, beats: done, later: {}, choices: { c6: 'wellari', how: 'build' } }, movein: { homes: [{ set: 'mi:1', st: 'home' }], sets: [{ id: 'mi:1', x: 0, y: 64, z: 60, name: 'Moosgrund' }] } }, ui: { screen: null, hint: (t) => sent.push(t) },
    player: { pos: [90, 70, 0], yaw: 0, pitch: 0, spawn: [0, 70, 0], onGround: true, eyePos() { return [this.pos[0], this.pos[1] + 1.6, this.pos[2]]; } }, cam: { x: 90, y: 71.6, z: 0, yaw: 0, pitch: 0 }, wow: { list: new Map() },
    funke: { on: () => true, show: (t) => sent.push(t), budget: { quiet: () => false }, buildFocus: () => false, startWay: () => {} }, lifeDirector: { ctx: { place: 'wild', hour: 'night' } }, saveMeta: () => {}, audio: { cue: (n) => { sent.push('cue:' + n); return true; } } };
  VR.game = g; SP.frame(g, 0.05);
  const pl = g.story;
  const cx = SP.ctxOf(g, pl);
  check(Math.round(cx.near.fairy) === 10 && Math.round(cx.near.home) === Math.round(Math.hypot(90, 60)), 'the context: near.fairy (10 m to the tree) and near.home (your settlement\'s plaza)');
  const run = (sec) => { for (let i = 0; i < sec * 20; i++) { g.time += 0.05; SP.frame(g, 0.05); } };
  run(15);
  check(pl.offer && pl.offer.b.id === 'c13.b1', 'Arc 2 is offered at night on Herzwelt after the epilogue (' + (pl.offer && pl.offer.b.id || pl.lastWhy) + ')');
  check(S.watch(g) && pl.scene && pl.scene.b.id === 'c13.b1' && sent.includes('cue:wonder'), 'played: the score\'s hook (the wonder sting; storyCue when e-score2 gives one)');
  const tg = pl.scene.tg;
  check(tg.wiege && tg.wiege[1] > 120 && tg.fairy && Math.abs(tg.fairy[0] - 100.5) < 1 && tg.home && Math.abs(tg.home[2] - 60.5) < 1, 'the scene\'s targets: Wiegelind high in the sky, the fairy place, your home');
  const uv = A2.project({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 60 * Math.PI / 180 }, [0, 0, -10], 1); const uv2 = A2.project({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 60 * Math.PI / 180 }, [3, 3, -10], 1);
  check(uv && Math.abs(uv[0] - 0.5) < 1e-6 && Math.abs(uv[1] - 0.5) < 1e-6 && uv2[0] > 0.5 && uv2[1] < 0.5 && A2.project({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, [0, 0, 10], 1) === null, 'her place in the picture: projected through the frame\'s camera (behind it: none)');
  while (SP.holds(g)) { run(1); pl.skip(); }
  check(S.isDone(pl.rec, 'c13.b1') && sent.some(t => /Wald/.test(t)), 'then Funke\'s task: into the woods to the Flausel');
  // the journeys: counted when one starts (a resumed one not)
  VR.Journey.lift(g, null, {}); VR.Journey.lift(g, null, { st: {} });
  check(pl.rec.trips.lift === 2 - 1, 'a Himmelsleiter trip counted (a resumed one not)');
  // the sign, your way: an explorer takes a light bridge
  for (const b of S.BEATS) { if (b.id === 'c15.b1') break; if (!S.isDone(pl.rec, b.id)) S.mark(pl.rec, b.id); }
  S.mark(pl.rec, 'c15.b1'); pl.actSt = null; run(1);
  check(!pl.rec.choices.style, 'the sign: nothing yet');
  VR.Journey.bridge(g, { dim: 'zinn' }); run(1);
  check(pl.rec.choices.style === 'roam' && S.actDone(pl.rec, 'c15.b1') && sent.some(t => t === tr('de', 'story.choice.style.roam.after')), 'a journey taken → your sign is the explorer\'s (roam); Funke says so');
  // the choice → the gifts
  S.mark(pl.rec, 'c15.b2');
  check(SP.choose(g, 'stay') && pl.rec.choices.c15 === 'stay' && pl.rec.gift && pl.rec.gift.fest === 30 && pl.rec.gift.place.kind === 'circle', 'chosen: she stays — the place founded, the festival from tonight');
  const pc = pl.rec.gift.place, dSet = Math.hypot(pc.x - 0, pc.z - 60);
  check(dSet >= 30 && dSet <= 80 && VR.Fairy.state.sites.every(s => Math.hypot(s.x - pc.x, s.z - pc.z) >= 60) && VR.Fairy.state.key === '', 'the place near your settlement (' + dSet.toFixed(0) + ' m), clear of the other fairy places; the fairy places set up again');
  check(VR.Fairy.sites(9, 'overworld').some(s => s.id === 'overworld:wiege' && s.kind === 'circle') && !VR.Fairy.sites(9, 'aqua').some(s => s.id === 'overworld:wiege'), 'the new place stands among Herzwelt\'s fairy places (not elsewhere)');
  check(g.meta.wander && g.meta.wander['places:story:wiege'] === tr('de', 'story.place.stay') && g.meta.wander['people:story:wiegelind'], 'the Wanderbuch\'s pages: the place, Wiegelind, Tauli');
  const v = new VR.Villages(g);
  check(v.festivalDay({}) === true && (g.env.day = 31, v.festivalDay({}) === false) && (g.env.day = 37, v.festivalDay({}) === true), 'every village celebrates the Dreilichterfest: tonight and every 7th night');
  g.env.day = 37; g.env.timeOfDay = 12000; run(6);
  check(sent.some(t => t === tr('de', 'story.fest.tonight')), 'the evening of the festival: one quiet line');
  g.ui.screen = 'journal'; const jh = SP.journalHTML(); g.ui.screen = null;
  check(jh.indexOf(tr('de', 'story.j.arc2')) > 0 && jh.indexOf(tr('de', 'story.place.stay')) > 0 && jh.indexOf(tr('de', 'story.j.festNow')) > 0, 'the journal: Part Two\'s heading, the new place, tonight\'s festival');
  const back = S.load(JSON.parse(JSON.stringify(g.meta.story)));
  check(back.gift && back.gift.place.x === pc.x && back.choices.style === 'roam' && back.choices.c15 === 'stay' && back.trips.lift === 1, 'all of it kept through a save');
  // no settlement: your home is the village near; a builder's sign (a new home moves in)
  g.meta.movein = { homes: [], sets: [] }; g.villages = { nearestSite: () => ({ site: { x: 500, y: 66, z: 0 }, dist: 410 }) };
  const hn = A2.homeNear(g); check(hn && !hn.at.own && hn.d === 410, 'without a settlement, home is the village near');
  const nb0 = A2.signNow(g); g.meta.movein.homes.push({ st: 'home' });
  check(S.styleWay(nb0, A2.signNow(g, nb0)) === 'build', 'a builder\'s sign: a family moves into a home you built');
  g.dim = 'aqua'; check(A2.homeNear(g) === null, 'home is on Herzwelt'); g.dim = 'overworld';
  delete VR.Fairy; delete VR.MoveIn; delete VR.Villages; delete VR.Wander; delete VR.Journey;
};

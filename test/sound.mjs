// Klang (F4) in the browser, against dist/ (run through test/wt_run.sh; the checks read audio.stats() and audio.state()):
//  - walking on four materials (stone, wood, sand, grass): one footstep voice of each family, counted by the player's own
//    distance counter through the game's loop
//  - placing glass (tink) and iron (ding), breaking planks (thock, with the pop); a crackle while stone is broken
//  - a door and a hurt mob at a place are positional voices; a door 60 blocks away is counted but takes no voice; the UI
//    click is counted
//  - indoors (a sealed room of stone, air inside): the room send is on, the ambience bus is lowpassed; outdoors again the
//    room send is off. The room send, the cave impulse and the ambience muffle move over time constants: they are checked
//    only when the audio clock runs (measured first; without it those checks are skipped with a note)
//  - under water the world sound is lowpassed (the listener's flag); on the surface it is open again
//  - music: on at 0.45 it schedules notes on the audio clock; at 0 it schedules none; a hostile mob ducks it
//  - the per-frame cost of listen + updateMusic (ms, reported); no page errors
//   nohup bash test/wt_run.sh sound.mjs 1200 > .tmp_tests/sound.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || t === 'warning') logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ok    ' : '  FAIL  ') + msg); };
const skip = (msg) => console.log('  skip  ' + msg);
const errorsSince = (k) => logs.slice(k).filter(l => l.startsWith('[error]') || l.startsWith('[pageerror]'));

try {
  await page.goto('file:///home/claude/vr/dist/index.html');
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('renderDist'); g.audio.resume(); });
  await ev(`VR.game.createWorld({name:'Klang',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => { VR.game.audio.resume(); window.__norender = true; });
  const k0 = logs.length;

  // the frames are driven by the test: the page's own loop stops, and the renderer is skipped (as in smoke.mjs)
  const frames = (n) => ev((n) => {
    const g = VR.game;
    if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
    window.requestAnimationFrame = () => 0;
    window.__norender = true;
    for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
    return n;
  }, n);
  const clockNow = () => ev(() => (VR.game.audio.ctx ? VR.game.audio.ctx.currentTime : -1));
  // the columns the test builds in must be loaded (setBlock does nothing in an unloaded column)
  const waitCols = async (pts) => {
    for (let i = 0; i < 120; i++) {
      if (await ev((pts) => pts.every(([x, z]) => !!VR.game.world.col(x >> 4, z >> 4)), pts)) return true;
      await frames(5); await wait(100);
    }
    return false;
  };

  await frames(30);
  const c0 = await clockNow(); await wait(400); const c1 = await clockNow();
  const clockRuns = c0 >= 0 && c1 - c0 > 0.2;
  console.log('  info  audio clock ' + c0.toFixed(2) + ' → ' + c1.toFixed(2) + ' s in 0.4 s wall time' + (clockRuns ? '' : ' (not running: the clock-bound checks are skipped)'));

  // ---- a row of platforms of four materials, 20 blocks east of the spawn, one block above the ground
  const spawn = await ev(() => ({ x: Math.floor(VR.game.player.pos[0]), z: Math.floor(VR.game.player.pos[2]) }));
  const bx = spawn.x + 20, bz = spawn.z;
  const loaded = await waitCols([[bx, bz], [bx + 17, bz + 2], [bx + 25, bz + 1], [bx - 9, bz - 9], [bx - 3, bz - 3]]);
  check(loaded, 'the columns of the test area are loaded');
  const base = await ev(([x, z]) => { const g = VR.game, w = g.world; return { x, z, y: w.topAt(x, z) + 1 }; }, [bx, bz]);
  const plats = [['stone', 'stone'], ['oak_planks', 'wood'], ['sand', 'sand'], ['grass_block', 'grass']];
  await ev(([base, plats]) => {
    const g = VR.game, w = g.world, R = VR.R;
    plats.forEach(([name], i) => { for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) w.setBlock(base.x + i * 5 + dx, base.y, base.z + dz, R.byName[name].defaultState, 4); });
  }, [base, plats]);
  await frames(20);

  // ---- walking: the player stands on each platform and its distance counter runs out (the game's own footstep path)
  for (let i = 0; i < plats.length; i++) {
    const [name, fam] = plats[i];
    await ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x + 0.5, y + 1.0, z + 0.5); p.vel[0] = 0; p.vel[2] = 0; }, [base.x + i * 5, base.y, base.z]);
    await frames(12);
    const before = await ev((fam) => VR.game.audio.stats().counts['step:' + fam] || 0, fam);
    await ev(() => { VR.game.player.stepDist = 2.3; });
    await frames(2);
    const after = await ev((fam) => VR.game.audio.stats().counts['step:' + fam] || 0, fam);
    check(after === before + 1, `walking on ${name}: one ${fam} footstep (counted ${before} → ${after})`);
  }

  // ---- placing and breaking: glass (tink), iron (ding), and planks broken (thock, with the pop)
  const r = await ev(([base]) => {
    const g = VR.game, p = g.player, w = g.world, R = VR.R, A = g.audio;
    const x = base.x + 25, y = base.y, z = base.z + 1;     // a fresh spot east of the platforms
    const cnt = (k) => A.stats().counts[k] || 0;
    const c0 = { glass: cnt('hit:glass'), metal: cnt('hit:metal'), brk: cnt('break:wood') };
    const gl = R.byName.glass.defaultState, ir = R.byName.iron_block.defaultState, pl = R.byName.oak_planks.defaultState;
    w.setBlock(x, y, z, gl, 4); p.afterPlace(null, x, y, z, gl);
    w.setBlock(x + 1, y, z, ir, 4); p.afterPlace(null, x + 1, y, z, ir);
    w.setBlock(x + 2, y, z, pl, 4); p.breakBlock(x + 2, y, z, pl, true);
    return { glass: cnt('hit:glass') - c0.glass, metal: cnt('hit:metal') - c0.metal, brk: cnt('break:wood') - c0.brk };
  }, [base]);
  check(r.glass === 1, 'placing glass is a tink (' + r.glass + ')');
  check(r.metal === 1, 'placing iron is a ding (' + r.metal + ')');
  check(r.brk === 1, 'breaking planks is a thock, the last hit with its pop (' + r.brk + ')');
  // a crackle while the block is being broken (the dig timer): one more voice of the family
  const cr = await ev(() => { const A = VR.game.audio, c0 = A.stats().counts['crackle:stone'] || 0; A.dig(VR.R.byName.stone.defaultState, false); return (A.stats().counts['crackle:stone'] || 0) - c0; });
  check(cr === 1, 'breaking progress crackles by family (stone)');

  // ---- a door opened at a place, a mob hurt (both positional), a door 60 blocks away (counted, no voice), a UI click
  const door = await ev(([base]) => {
    const A = VR.game.audio, s0 = A.stats(), c0 = s0.counts.door || 0, h0 = s0.counts.hurt || 0;
    A.play('door', { at: [base.x + 4.5, base.y + 1, base.z + 0.5] });
    A.play('hurt', { at: [base.x + 3.5, base.y + 1, base.z + 0.5] });
    const v1 = A.stats().voices;
    A.play('door', { at: [A.L.x + 60, A.L.y, A.L.z] });   // 60 blocks from the ear (it stands on the grass platform)
    const v2 = A.stats().voices;
    A.play('click');
    const s1 = A.stats();
    return { door: (s1.counts.door || 0) - c0, hurt: (s1.counts.hurt || 0) - h0, click: s1.counts.click || 0, voices: v1, farVoices: v2 - v1 };
  }, [base]);
  check(door.door === 2 && door.hurt === 1, 'two doors (one 60 blocks away) and a hurt mob are counted (' + door.door + ' doors, ' + door.hurt + ' hurt)');
  check(door.farVoices <= 0, 'the door 60 blocks away takes no voice (' + door.farVoices + ')');
  check(door.voices <= 24, 'the world voices stay within 24 (' + door.voices + ')');
  check(door.click >= 1, 'the UI click is counted');

  // ---- indoors: a sealed room of stone three blocks high, air inside, the player in it
  await ev(([base]) => {
    const g = VR.game, w = g.world, R = VR.R, p = g.player;
    const x0 = base.x - 8, z0 = base.z - 8, y0 = base.y, st = R.byName.stone.defaultState;
    for (let dx = -1; dx <= 5; dx++) for (let dz = -1; dz <= 5; dz++) {
      const edge = dx === -1 || dx === 5 || dz === -1 || dz === 5;
      w.setBlock(x0 + dx, y0, z0 + dz, st, 4);                                       // the floor
      for (let dy = 1; dy <= 3; dy++) w.setBlock(x0 + dx, y0 + dy, z0 + dz, edge ? st : 0, 4);   // the walls, or air inside
      w.setBlock(x0 + dx, y0 + 4, z0 + dz, st, 4);                                   // the roof: a sealed room 5 × 5 × 3
    }
    p.teleport(x0 + 2.5, y0 + 1.0, z0 + 2.5);
  }, [base]);
  await frames(60);
  await wait(clockRuns ? 2600 : 300);            // the ambience muffle glides with a 0.3 s time constant
  await frames(30);
  const indoors = await ev(() => { const A = VR.game.audio, m = VR.game.ambience && VR.game.ambience.muffle; return { st: A.state(), amb: m ? m.frequency.value : -1 }; });
  check(indoors.st.indoors === true, 'indoors: the ear reads a sealed room (indoors ' + indoors.st.indoors + ')');
  if (indoors.st.cave && !clockRuns) skip('the room send of a cave waits for the audio clock (the impulse swap)');
  else check(indoors.st.room > 0.3, 'indoors: the room send is on (' + indoors.st.room.toFixed(2) + (indoors.st.cave ? ', a cave' : '') + ')');
  check(indoors.st.muffle >= 15000, 'indoors: the world sound stays dry (' + Math.round(indoors.st.muffle) + ' Hz)');
  if (clockRuns) check(indoors.amb > 0 && indoors.amb <= 900, 'indoors: the ambience bus is lowpassed (' + Math.round(indoors.amb) + ' Hz, target 800)');
  else skip('the ambience muffle glides with a time constant: it needs the audio clock');
  await ev(([x, y, z]) => { VR.game.player.teleport(x + 0.5, y + 1.0, z + 0.5); }, [base.x, base.y, base.z]);   // back on the open platform
  await frames(60);
  await wait(clockRuns ? 1200 : 300);
  await frames(20);
  const outdoors = await ev(() => VR.game.audio.state());
  check(outdoors.indoors === false, 'outdoors again: the ear reads the open sky');
  check(outdoors.room < 0.05, 'outdoors: the room send is off (' + outdoors.room.toFixed(3) + ')');

  // ---- under water: the listener's flag lowpasses the world sound; the surface opens it again
  const water = await ev(() => { const g = VR.game, A = g.audio, p = g.player; A.listen([p.pos[0], p.pos[1] + 1.6, p.pos[2]], p.yaw, g.world, true); const u = A.state().muffle; A.listen([p.pos[0], p.pos[1] + 1.6, p.pos[2]], p.yaw, g.world, false); return { under: u, surface: A.state().muffle }; });
  check(water.under <= 1000 && water.surface >= 15000, 'under water the world sound is lowpassed (' + Math.round(water.under) + ' Hz), on the surface open (' + Math.round(water.surface) + ' Hz)');

  // ---- music: on at 0.45 it schedules notes on the audio clock; at 0 it schedules none; a hostile mob ducks it
  const clock = () => ev(() => { const c = VR.game.audio.ctx; return c ? { t: c.currentTime, st: c.state } : null; });
  await ev(() => { VR.game.audio.setVolumes({ music: 0.45 }); });
  const m1 = await clock(); const n1 = await ev(() => VR.game.audio.noteCount);
  for (let i = 0; i < 40; i++) { await frames(1); await wait(80); }
  const m2 = await clock(); const n2 = await ev(() => VR.game.audio.noteCount);
  if (clockRuns && m2 && m1 && m2.t - m1.t > 1) check(n2 > n1, 'music on: notes are scheduled (' + (n2 - n1) + ' in ' + (m2.t - m1.t).toFixed(1) + ' s of audio time)');
  else skip('music notes on the clock: the audio clock does not run here (' + JSON.stringify(m2) + ')');
  await ev(() => { VR.game.audio.setVolumes({ music: 0 }); });
  const n3 = await ev(() => VR.game.audio.noteCount);
  for (let i = 0; i < 40; i++) { await frames(1); await wait(80); }
  const n4 = await ev(() => VR.game.audio.noteCount);
  check(n4 === n3, 'music at 0: no note is scheduled (' + (n4 - n3) + ' more)');
  await ev(() => { VR.game.audio.setVolumes({ music: 0.45 }); });
  // the hostile mob: a fake zombie five blocks from the player, for a while; the duck follows it
  const duck = await ev(() => {
    const g = VR.game, A = g.audio, p = g.player;
    const mob = { pos: [p.pos[0] + 5, p.pos[1], p.pos[2]], dead: false, def: { hostile: true } };
    for (let i = 0; i < 40; i++) { A.listen([p.pos[0], p.pos[1] + 1.6, p.pos[2]], p.yaw, g.world, false); A.updateMusic(0.1, { enabled: true, mobs: [mob], agents: [], day: 0, cave: false, danger: false, space: false, festival: false, night: 0 }); }
    return A.state().duck;
  });
  check(duck <= 0.3, 'a hostile mob 5 blocks away ducks the music (' + duck.toFixed(2) + ')');

  // ---- the per-frame cost of the ear and the music (ms, reported; the scan runs four times a second)
  const cost = await ev(() => { const g = VR.game, A = g.audio, p = g.player; const t0 = performance.now(); for (let i = 0; i < 600; i++) { A.listen([p.pos[0], p.pos[1] + 1.6, p.pos[2]], p.yaw + i * 0.001, g.world, false); A.updateMusic(0.016, { enabled: true, mobs: g.entities ? g.entities.mobs : null, agents: g.villages ? g.villages.agents : null, day: g.env.day, night: 0 }); } return (performance.now() - t0) / 600; });
  console.log('  info  per frame: listen + updateMusic ' + cost.toFixed(4) + ' ms (600 frames, page)');
  check(cost < 0.5, 'the ear and the music cost under 0.5 ms a frame');

  const errs = errorsSince(k0);
  check(errs.length === 0, 'no page errors (' + errs.length + ')' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
} catch (e) {
  fails++; console.log('  FAIL  exception: ' + (e.stack || e.message).slice(0, 600));
} finally {
  await browser.close();
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

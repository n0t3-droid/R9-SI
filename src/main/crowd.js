// ============================================================================
// Crowd (main): draws the trailer heroes (src/shared/folkcrowd.js has their behaviour and the budget). A hero is the
// folk rig with its helmeted suit and blaster (VR.Folk.heroLook); its model is looked up once and kept on the hero,
// so a frame does no key building. Far heroes are drawn with the half-resolution model, like the villagers.
// Public: VR.Crowd.attach(game) (on every world), addHero({ id, suit, pos, yaw, act, walk }) → hero, clear(),
// update(dt) (once per game step, before the draw), draw(r, E, cam). The Gate Temple's hall places its crew with addHero.
// ============================================================================
(function (VR) {
  'use strict';
  const C = VR.Crowd = VR.Crowd || {};
  const Folk = VR.Folk;
  if (!Folk || !VR.FolkAnim) return;
  C.game = C.game || null; C.enabled = C.enabled !== false; C.time = C.time || 0;
  C.DRAW_D2 = 110 * 110; C.FAR_D2 = 24 * 24;

  // a new world: the crew of the old one goes; the game gives its own state to the crowd
  C.attach = function (g) { C.game = g || null; C.heroes.length = 0; };
  C.clear = function () { C.heroes.length = 0; };
  // suit: an index of VR.Folk.HERO_SUITS (0 = Blau, 6 = Orange); the crew holds blasters unless told otherwise
  C.addHero = function (o) {
    const look = Folk.heroLook({ suit: o.suit | 0, hair: o.hair | 0, hs: o.hs | 0, skin: o.skin | 0, lashes: !!o.lashes, tool: o.tool === undefined ? 'blaster' : o.tool });
    const h = C.newHero(o, look);
    C.heroes.push(h);
    return h;
  };
  // once per game step: the budget of this frame, then the heroes' behaviour and (when due) their poses
  C.update = function (dt) {
    const g = C.game;
    const pre = g && g.settings && g.settings.preset;
    C.tick(dt, pre === 'potato' ? 24 : pre === 'low' ? 40 : 96);
    if (!g || !g.player || !C.heroes.length || !C.enabled) return;
    C.time = g.time || C.time;
    // the switch: with the animation off ('anim' in the graphics settings, off on Very Low) the heroes keep their poses
    if (g.settings && g.settings.anim === false) return;
    C.stepCrowd(dt, g.player.pos);
  };
  C.draw = function (r, E, cam) {
    const g = C.game, ent = g && g.entities;
    if (!ent || !C.enabled || !C.heroes.length) return;
    const gl = r.gl, p = ent.beginVox(r, E);
    for (const h of C.heroes) {
      const dx = h.pos[0] - cam.x, dy = h.pos[1] - cam.y, dz = h.pos[2] - cam.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > C.DRAW_D2 || !VR.mat4.boxInFrustum(r.planes, dx - 1.5, dy - 0.5, dz - 1.5, dx + 1.5, dy + 2.4, dz + 1.5)) continue;
      const far = d2 > C.FAR_D2, k = far ? 1 : 0;
      const model = h.mdl && h.mdl[k] ? h.mdl[k] : ((h.mdl = h.mdl || [null, null])[k] = Folk.model(gl, h.look, far));
      if (!model) continue;
      const light = ent.lightAt(h.pos[0], h.pos[1] + 1.2, h.pos[2]);
      if (h.shadeT === undefined || C.time - h.shadeT > 0.25) { h.shade = ent.sunShade(h.pos, 1.2); h.shadeT = C.time; }   // a terrain-shadow ray 4× a second
      ent.drawModel(r, p, model, h.pos, cam, h.yaw, h.pose || C.heroPose(h, 0), light, { hide: { lids: true, mouth: true }, shade: h.shade, flash: 0 });
    }
  };
})(VR);

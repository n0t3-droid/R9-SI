// ============================================================================
// Lichträtsel · the daylight detector reads the real light. Before, its power was a property nobody ever changed.
// Now, once a second, every known detector near the player measures the light on its top:
//   · where the Schattenuhr has baked the cell above it (clockvol.js), that clock decides — a pillar's shadow
//     crossing the sensor at a known hour switches the circuit (a door that opens only while the morning sun
//     falls through a window onto the plate);
//   · elsewhere the sky light of the cell above (a roof over it: dark).
// power = round(15 · light · day), day = the sun's height ramp (dawn and dusk in between); inverted: 15 − that.
// A right click turns it round (inverted). Detectors are found where they are placed and in every loaded column.
// ============================================================================
(function (VR) {
  'use strict';
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const DS = VR.DaySense = {};
  const R = VR.R, Sim = VR.Sim;
  if (!R || !Sim || !R.byName.daylight_detector) return;
  const DT = R.byName.daylight_detector, TID = DT.id;
  const K = (x, y, z) => x + ',' + y + ',' + z;
  DS.EVERY = 20;    // sim ticks (20 a second): once a second
  DS.REACH = 96;    // blocks round the player
  DS.dayK = (sunY) => { const t = Math.min(1, Math.max(0, (sunY + 0.05) / 0.35)); return t * t * (3 - 2 * t); };
  DS.power = (light, sunY, inv) => { const p = Math.round(15 * Math.min(1, Math.max(0, light)) * DS.dayK(sunY)); return inv ? 15 - p : p; };
  // the light on the detector's top, 0…1: the clock of the cell above, else its sky light
  DS.lightAt = function (game, x, y, z) {
    const w = game.world, E = game.env && game.env.E, CV = VR.ClockVol;
    if (CV && E && E.sunDir && w.dim === 'overworld' && CV.on(game.settings)) {
      const v = CV.visAt(w, x + 0.5, y + 1.2, z + 0.5, CV.arcTime(E.sunDir));
      if (v !== null && v !== undefined) return v;
    }
    return (w.getLight(x, y + 1, z) >>> 12) / 15;
  };
  const SP = Sim.prototype;
  const set = (sim) => sim.daySense || (sim.daySense = new Map());
  const ocl = SP.onColumnLoaded;
  SP.onColumnLoaded = function (c) {
    const r = ocl ? ocl.apply(this, arguments) : undefined;
    const b = c && c.blocks; if (!b) return r;
    const BT = R.T.type, m = set(this);
    for (let i = 0; i < b.length; i++) { const s = b[i]; if (s && BT[s] === TID) { const x = c.cx * 16 + (i & 15), y = i >> 8, z = c.cz * 16 + ((i >> 4) & 15); m.set(K(x, y, z), [x, y, z]); } }
    return r;
  };
  const obc = SP.onBlockChanged;
  SP.onBlockChanged = function (x, y, z, old, s) {
    const m = set(this);
    if (s && R.T.type[s] === TID) { if (!m.has(K(x, y, z))) { m.set(K(x, y, z), [x, y, z]); this.dayDue = true; } }
    else if (old && R.T.type[old] === TID) m.delete(K(x, y, z));
    return obc.apply(this, arguments);
  };
  // measure every detector near the player; a changed power goes to the circuit
  SP.daySenseTick = function () {
    const g = this.game, w = g.world, p = g.player, E = g.env && g.env.E, m = this.daySense;
    if (!m || !m.size || !w || !p || !E || !E.sunDir) return;
    const sunY = E.sunDir[1];
    for (const [x, y, z] of m.values()) {
      if (Math.abs(x - p.pos[0]) > DS.REACH || Math.abs(z - p.pos[2]) > DS.REACH) continue;
      const s = w.getBlock(x, y, z); if (!s || R.T.type[s] !== TID) continue;
      const pw = DS.power(DS.lightAt(g, x, y, z), sunY, !!DT.get(s, 'inverted'));
      if (pw !== DT.get(s, 'power')) { w.setBlock(x, y, z, DT.with(s, 'power', pw), 4); this.schedule(x, y, z, 1, 'volt'); }
    }
  };
  const st0 = SP.step;
  SP.step = function () {
    const r = st0.apply(this, arguments);
    if (this.dayDue || (this.tick % DS.EVERY) === 0) { this.dayDue = false; try { this.daySenseTick(); } catch (e) { /* a missing column: next second */ } }
    return r;
  };
  const in0 = SP.interact;
  SP.interact = function (x, y, z, s, t) {
    if (t && t.id === TID) {
      const w = this.game.world, inv = DT.get(s, 'inverted') ? 0 : 1;
      w.setBlock(x, y, z, DT.with(DT.with(s, 'inverted', inv), 'power', 15 - DT.get(s, 'power')), 4);
      this.schedule(x, y, z, 1, 'volt');
      const g = this.game; if (g.audio) g.audio.play('click');
      if (g.ui && g.ui.chatLine) g.ui.chatLine(T(inv ? 'g.day.inv' : 'g.day.norm'), '#ffe08a');
      return true;
    }
    return in0.apply(this, arguments);
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

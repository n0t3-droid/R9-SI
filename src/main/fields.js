// ============================================================================
// u-fields · VR.Fields — Amarant's ring as the honest dense field, the giant's cloud tops, the Trümmerschwarm and the
// small bodies' anchor boots (plan docs/superpowers/plans/2026-10-30-u-fields.md; U§4.3, §5.7, §7.1–§7.3, §11;
// REFERENCE §1.6–§1.7, §4.2).
//   · pure part (node: test/fields.js) above the line: the chunks by tier, the density law, the sizes, the shell they
//     fill, the swarm (gen_rubble.js), the boots, the cloud tops' floor, the codex line
//   · the GL part below it: the ring's ice chunks (GPU-hashed instances — no per-frame buffers), the 10-m sheet as a lit
//     slab, the cloud-top decks, the swarm's bodies; drawn from the space scene's draw list (spacescene.js hooks)
//   · the game's glue: /raum ring · cassini · ringschatten · wolken · schwarm, the boots (B, the suit switch), drifting
//     off and Funke's tow back, the rubble world's light (Helia at 3.4 AU turning with the body's spin)
// ============================================================================
(function (VR) {
  'use strict';
  const F = VR.Fields = {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const D2R = Math.PI / 180, TAU = Math.PI * 2;

  // ---------------------------------------------------------------- the ring (U§7.1, R§4.2)
  F.COUNT = [300, 1000, 3000, 10000];                  // chunks drawn by spaceDetail tier (Very Low … High)
  F.count = (tier) => F.COUNT[clamp(tier | 0, 0, 3)];
  F.H = 10;                                            // the sheet's thickness, m
  F.DMIN = 0.3; F.DMAX = 4; F.Q = 3;                   // chunk diameters 0.3–4 m, n(D) ∝ D^−q
  // a diameter from u ∈ [0, 1) on the power law q (inverse CDF)
  F.sizeAt = (u) => { const a = Math.pow(F.DMIN, 1 - F.Q), b = Math.pow(F.DMAX, 1 - F.Q); return Math.pow(a + u * (b - a), 1 / (1 - F.Q)); };
  // the mean cross-section π⟨r²⟩ of the law (numerically, once)
  let SIG = 0;
  F.sigma = () => { if (SIG) return SIG; let s = 0; const N = 4000; for (let k = 0; k < N; k++) { const d = F.sizeAt((k + 0.5) / N); s += Math.PI * d * d / 4; } return (SIG = s / N); };
  // the density law: τ = n·σ̄·H → chunks per m³
  F.density = (tau) => Math.max(0, tau) / (F.sigma() * F.H);
  // the spacing of equal chunks of diameter d at optical depth τ (U§7.1: τ 1, 1 m → 2.0 m)
  F.spacingFor = (tau, d) => Math.pow(tau / (Math.PI * d * d / 4 * F.H), -1 / 3);
  // the shell the tier's chunks fill round the eye (a disc of the sheet; 15–40 m, U§7.1)
  F.radius = (tier, tau) => clamp(Math.sqrt(F.count(tier) / (Math.PI * F.H * Math.max(1e-3, F.density(tau)))), 15, 40);
  F.tauAt = (rR) => (VR.BodyTex && VR.BodyTex.ringTau ? VR.BodyTex.ringTau(rR) : 0);
  F.ALBEDO = 0.04;                                     // the rubble bodies (R§1.7)

  // ---------------------------------------------------------------- the swarm (U§7.2)
  F.COMPRESSION = 1e5;
  F.swarm = () => VR.Rubble.swarm();

  // ---------------------------------------------------------------- the anchor boots (U§4.3)
  F.BOOTS = 0.35;                                      // m/s²
  F.JUMP_V = 9.1;                                      // the genre's jump (player.js)
  F.bootsGame = () => 30 * F.BOOTS / 9.81;
  F.jumpHeight = (g) => F.JUMP_V * F.JUMP_V / (2 * g);
  F.airTime = (g) => 2 * F.JUMP_V / g;
  // boots off: the body's own pull as a share of the dim's (boots') gravity
  F.offShare = (dim) => { const d = VR.DimReg && VR.DimReg.get(dim); return d && d.gReal ? d.gReal / d.g : 1; };

  // ---------------------------------------------------------------- the cloud tops (U§5.7)
  F.FLOOR = 1000;                                      // m over the cloud tops: below it the autopilot pulls up
  F.pullUp = (alt) => alt < F.FLOOR;
  F.FLY_V = 5744;                                      // the low orbit over the cloud tops, m/s (U§3)
  F.FLY_H = 15000;                                     // the flyover's height in the upper haze

  F.KEYS = ['g.fields.codex', 'g.fields.boots.on', 'g.fields.boots.off', 'g.fields.drift', 'g.fields.tow', 'g.fields.hello', 'g.fields.hello.m', 'g.fields.ring', 'g.fields.pull',
    'g.space.place.ring', 'g.space.place.cassini', 'g.space.place.ringschatten', 'g.space.place.wolken', 'g.space.place.schwarm', 'g.set.fields', 'g.set.fields.tip'];

  // ================================================================ GL and the game (the page only)
  if (typeof window === 'undefined') return;
})(VR);

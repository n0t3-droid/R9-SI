// ============================================================================
// q-art4 · Runde Inseln (plan docs/superpowers/plans/2026-11-07-q-art4.md; q-art3's self-review 1)
//   (and the round crowns' polish: the leaves' texture planar along the face, a softer top — leaf mode bit 32, Q_RTOP)
//   qIsleForm  the floating isles as rounded rocky forms, near and far alike — the far land (the horizon tiles, lod.js,
//              and ring 1's forms, far.js) draws each isle as one shell (src/shared/isleshell.js: a dome, a moss lip, a soil
//              wall, an underside tapering in strata bands to a moss-and-tuff tip, vines and roots as thin cards) lit by
//              its own normal (LOD_FS under Q_ISLEFORM); the chunks round the same isles' blocks from the q-art3 blob
//              (the mesh job's leaf mode bit 16, Nahtlos only). Render only: generation, saved blocks, collision as before.
//              Balanced and up; Very Low and Low never ask for it (no define, no program, no job flag).
// Pure: the switch by preset, its row, the defines by program, the leaf-mode bit.
// ============================================================================
(function (VR) {
  'use strict';
  const Q4 = VR.QArt4 = VR.QArt4 || {};
  Q4.SW = ['qIsleForm'];
  const OFF = { qIsleForm: false }, ON = { qIsleForm: true };
  const TIERS = { potato: OFF, low: OFF, balanced: ON, high: ON, ultra: ON, ultraLite: ON };
  Q4.defaults = (preset) => Object.assign({}, TIERS[preset] || OFF);
  Q4.off = () => Object.assign({}, OFF);
  Q4.ROWS = [
    { key: 'qIsleForm', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.qIsleForm', tip: 'g.set.qIsleForm.tip', cost: 'low', def: false },
  ];
  // the far land's programs that draw the isles' forms (renderer.js: 'lod', farProgram 'form' / 'lodFar')
  const PROGS = { lod: 1, form: 1, lodFar: 1 };
  // the round crowns' softer top (q-art3's Runde Kronen on: the terrain programs' leaf faces facing up, × RTOP)
  Q4.RTOP = 0.86;
  const TOP_PROGS = { terrain: 1, terrainCut: 1 };
  Q4.definesFor = (name, q) => {
    const out = [];
    if (q && q.qIsleForm && PROGS[name]) out.push('Q_ISLEFORM');
    if (q && q.qRoundTop && TOP_PROGS[name]) out.push('Q_RTOP ' + Q4.RTOP.toFixed(3));
    return out;
  };
  Q4.q = OFF;
  Q4.hook = function (name, defines) {
    const extra = Q4.definesFor(name, Q4.q);
    if (!extra.length) return defines || [];
    return (defines || []).concat(extra.filter(d => !(defines || []).includes(d)));
  };
  Q4.key = (q) => (q && q.qIsleForm ? 1 : 0) + (q && q.qRoundTop ? 2 : 0);
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => Q4.hook(name, prev ? prev(name, defines) : (defines || [])); }
  // the mesh job's leaf mode: q-art3's mode (true / false / a number: bit 2 round crowns, 4 round hills, 8 the leaves not
  // fancy) with the isles' bit (16, the switch) and the round crowns' polish (32: the leaves' texture planar, the softer
  // top Q_RTOP — always with the round crowns; Q4.polish false only for the before | after pictures)
  Q4.polish = true;
  Q4.leafMode = (m, s) => {
    if (typeof m === 'number' && (m & 2) && Q4.polish) m |= 32;
    if (!(s && s.qIsleForm)) return m;
    if (typeof m === 'number') return m | 16;
    return 16 | (m ? 0 : 8);
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

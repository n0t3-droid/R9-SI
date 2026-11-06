// ============================================================================
// q-art4 · Runde Inseln (plan docs/superpowers/plans/2026-11-07-q-art4.md; q-art3's self-review 1)
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
  Q4.definesFor = (name, q) => (q && q.qIsleForm && PROGS[name] ? ['Q_ISLEFORM'] : []);
  Q4.q = OFF;
  Q4.hook = function (name, defines) {
    const extra = Q4.definesFor(name, Q4.q);
    if (!extra.length) return defines || [];
    return (defines || []).concat(extra.filter(d => !(defines || []).includes(d)));
  };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => Q4.hook(name, prev ? prev(name, defines) : (defines || [])); }
  // the mesh job's leaf mode with the isles' bit (16): q-art3's mode (true / false / a number) → a number with bit 16, the
  // fancy bit kept (bit 8: the leaves not fancy)
  Q4.leafMode = (m, s) => {
    if (!(s && s.qIsleForm)) return m;
    if (typeof m === 'number') return m | 16;
    return 16 | (m ? 0 : 8);
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

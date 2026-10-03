// ============================================================================
// R9 Studio · the Modern Living pack (voxmodern.js) in Möbel: its models sort
// into the categories their definitions name (o.cats, German labels) — the
// existing chips (Licht, Küche, Schlafen, Bad, Tische …) and new ones (✨ Modern
// Living, Smart Home, Wohnen, Pflanzen, Mobilität, Laden & Café, Schränke).
// The pack's models are never sorted by the name patterns of the older pack.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore, R = VR.R, VM = VR.VM;
  if (!C || !C.CATS || !VM || !VM.MODERN_CATS) return;
  const packOf = (n) => { const t = R.byName[n]; return t && t.o.modern ? t : null; };
  const has = (n, ids) => { const t = packOf(n); return !!(t && t.o.cats && t.o.cats.some(c => ids.includes(c))); };
  // the older chips: their name pattern for the older models, the pack's own categories for the pack
  const SAME = { light: ['light'], kitchen: ['kitchen'], sleep: ['sleep'], bath: ['bath'], work: ['office'], deco: ['deco'], garden: ['garden'], seat: ['seat'], table: ['table'], chair: ['chair'] };
  for (const c of C.CATS) {
    if (!c[2]) continue;
    const re = c[2], ids = SAME[c[0]] || [];
    c[2] = { test: (n) => (packOf(n) ? has(n, ids) : re.test(n)) };
  }
  // new chips (after "Alle" and before the older ones)
  const L = VM.MODERN_CATS, add = [['modern', '✨ Modern Living', { test: (n) => !!packOf(n) }]];
  const used = new Set(); for (const t of R.types) if (t.o.modern && t.o.cats) for (const c of t.o.cats) used.add(c);
  for (const id of ['living', 'smart', 'plant', 'storage', 'mobility', 'shop']) if (used.has(id)) add.push([id, L[id], { test: (n) => has(n, [id]) }]);
  C.CATS.splice(1, 0, ...add);
})();

// f-quiet3 · when golden.mjs counts the world as settled before a picture (docs/superpowers/plans/2026-11-02-f-quiet3.md)
// s: the page's streaming state a settle round reads — { state, busy (worker jobs), pend (columns asked for), dirty
// (sections within the view radius still to mesh or meshing), up (uploads queued), lod (far tiles in flight) }; i: the round
// (the first three rounds never count: a teleport's columns are asked for in the frames after it)
'use strict';
const G = {};
G.settledOk = (s, i) => !!s && s.state === 'play' && s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && !s.lod && i > 2;
// a ready() keeps settling this long (real ms) after its rounds ran out — a loaded machine meshes slower than the rounds
G.READY_MS = 60000;
module.exports = G;

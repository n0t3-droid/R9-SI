// ============================================================================
// 📍 Where you land (v0.38) — shared by the game and the R9 Studio.
// The Studio notes, per world, the newest thing you set into it (a viewpoint in
// front of it, looking at it) and a spawn point set with 📍; the game reads both
// when you come in: ▶ Spielen lands you in front of the new thing (or at your
// spawn point when there is nothing new); over the open game ▶ shows the new
// thing or lets you play on; from the title you play on where you were.
// Kept in the browser's storage next to the Werkbank's edits and the plans:
// 'r9si.land.<world>' = { landing: {pos, yaw, pitch, label, box, at}, spawn: {pos, at} }
// The game remembers what it has already used in the world's save (seenLanding,
// spawnAt), so a thing is "new" only once.
// ============================================================================
(function () {
  'use strict';
  const L = VR.Landing = {};
  const key = (id) => 'r9si.land.' + id;
  L.key = key;
  L.read = (id) => { try { const o = JSON.parse(localStorage.getItem(key(id)) || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  L.write = (id, o) => { try { localStorage.setItem(key(id), JSON.stringify(o)); return true; } catch (e) { return false; } };
  const num3 = (p) => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite);
  // the newest thing set into a world: where to stand and where to look
  L.note = (id, landing) => {
    if (!id || !landing || !num3(landing.pos)) return false;
    const o = L.read(id);
    o.landing = { pos: landing.pos.slice(0, 3), yaw: +landing.yaw || 0, pitch: +landing.pitch || 0, label: String(landing.label || '').slice(0, 60), box: Array.isArray(landing.box) ? landing.box.slice(0, 6) : null, at: Date.now() };
    return L.write(id, o);
  };
  // 📍 a spawn point chosen in the Studio
  L.setSpawn = (id, pos) => { if (!id || !num3(pos)) return false; const o = L.read(id); o.spawn = { pos: pos.slice(0, 3), at: Date.now() }; return L.write(id, o); };
  // is the noted thing new for this world (the game has not shown it yet)?
  L.fresh = (o, meta) => !!(o && o.landing && num3(o.landing.pos) && o.landing.at > ((meta && meta.seenLanding) || 0));
  L.freshSpawn = (o, meta) => !!(o && o.spawn && num3(o.spawn.pos) && o.spawn.at > ((meta && meta.spawnAt) || 0));
})();

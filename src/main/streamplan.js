// ============================================================================
// p-stream · the streaming plan: which chunk columns are worth asking for while the player moves fast, in what order,
// and how the workers' time is split between the chunks and the far tiles. Pure functions (test/stream_plan.js);
// world.js and horizon.js ask them when world.streamPlan is on (every preset; the 'streamPlan' setting switches it).
//
// The measured problem (docs/reviews/p-stream.md): on Low and Very Low one or two workers make ~25 columns a second
// (a column ≈ 40 ms to generate plus its section meshes). A flight at 40 m/s needs ~40 new columns a second across
// the loading disk, at 80 m/s ~80: the chunks cannot keep up, whatever the order. The old order still spent the time on
// the whole disk — the columns beside and behind the flight, which the camera has left before they are ready — and kept
// the far tiles (one ≈ 40 ms for 64 columns' worth of land) to 30 % of the workers, so the land ahead came late or not
// at all and showed holes.
// The plan:
//  · latency  the world measures how long a requested column takes to be shown (lat, an average in seconds)
//  · worth    while moving fast (FAST blocks/s and up), a column is asked for only if it will still be in the view cone
//             when it is ready: its time until the cone's edge passes it (timeLeft) ≥ WORTH × lat. The columns right
//             round the player (KEEP chunks) are always asked for. A queued request no longer worth it is cancelled.
//  · rest     faster still (the flight crosses the render distance within one latency) no new column is asked for at
//             all: the far tiles get every worker until the flight slows
//  · order    distance, discounted ahead (as before), and OUT_K × for a column outside the view cone
//  · share    the far lane's share of the workers grows from 30 % with the deficit (how far the flight runs ahead of
//             what the chunks can fill: speed × lat against the render distance) up to SHARE_MAX: the far tiles
//             cover the land ahead first, the chunks refine it where they can
//  · tiles    a far tile behind the camera waits (BEHIND_K on its priority) while moving fast
// ============================================================================
(function (VR) {
  'use strict';
  const SP = VR.StreamPlan = {};
  SP.FAST = 14;          // blocks/s: slower (walking, plain flight 11 m/s) the streaming works exactly as before
  SP.KEEP = 1.5;         // chunks: always asked for (the ground under the player and its neighbours)
  SP.WORTH = 0.75;       // a column must stay in view this share of the latency after it is asked for
  SP.MARGIN = 1.5;       // chunks of slack on the cone's edge (a shown column needs its 8 neighbours generated)
  SP.OUT_K = 2.5;        // order: a column outside the view cone counts this much farther
  SP.SHARE_BASE = 0.3;   // the far lane's share while walking (WorkerPool.farShare as before)
  SP.SHARE_MAX = 0.7;
  SP.BEHIND_K = 1.5;     // tile priority units (horizon.js prio: distance in tile widths) added behind the camera
  SP.LAT0 = 1.0; SP.LAT_MIN = 0.15; SP.LAT_MAX = 8;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  SP.moving = (speedB) => speedB >= SP.FAST;
  // seconds until the edge of the view cone (half angle h, cotH = 1 / tan h) passes a column at (ex, ez) chunks from the
  // player, moving at spC chunks/s along the unit (ux, uz); < 0: outside the cone already. MARGIN chunks of slack.
  SP.timeLeft = function (ex, ez, ux, uz, spC, cotH) {
    const a = ex * ux + ez * uz + SP.MARGIN, l = Math.max(0, Math.abs(ex * uz - ez * ux) - SP.MARGIN);
    return spC > 1e-6 ? (a - l * cotH) / spC : Infinity;
  };
  // is the column worth asking for? (speedB: blocks/s; lat: seconds)
  SP.worth = function (ex, ez, ux, uz, speedB, lat, cotH) {
    if (!(speedB >= SP.FAST)) return true;
    if (ex * ex + ez * ez <= SP.KEEP * SP.KEEP) return true;
    return SP.timeLeft(ex, ez, ux, uz, speedB / 16, cotH) >= SP.WORTH * lat;
  };
  // the chunks rest: the flight crosses the whole render distance within one latency — no column asked for now would
  // be shown before the camera has passed it; the workers go to the far tiles until the flight slows (or the world quickens)
  SP.REST = 1;
  SP.rest = function (speedB, lat, rd) { return speedB >= SP.FAST && (speedB / 16) * lat > rd * SP.REST; };
  // the request's place (smaller first): the old order (distance², discounted ahead) and OUT_K outside the cone
  SP.prio = function (ex, ez, ux, uz, ahead, cosH) {
    const d2 = ex * ex + ez * ez, along = ahead ? Math.max(0, ex * ux + ez * uz) : 0;
    let p = d2 - along * along * 0.5;
    if (ahead && d2 > 2) { const c = (ex * ux + ez * uz) / Math.sqrt(d2); if (c < cosH) p = p * SP.OUT_K + 4; }
    return p;
  };
  // the latency average: a new sample (seconds from the request to the column shown)
  SP.lat = function (prev, sample) { const p = prev > 0 ? prev : SP.LAT0; return clamp(p + (sample - p) * 0.15, SP.LAT_MIN, SP.LAT_MAX); };
  // the far lane's share: the deficit = the chunks' reach behind the flight (speed × latency, in chunks) against half the
  // render distance; none while slow
  SP.share = function (speedB, lat, rd) {
    if (!(speedB >= SP.FAST)) return SP.SHARE_BASE;
    const def = (speedB / 16) * lat / Math.max(1, rd * 0.5);
    return SP.SHARE_BASE + (SP.SHARE_MAX - SP.SHARE_BASE) * clamp((def - 0.5) / 1.5, 0, 1);
  };
  // a far tile's priority bonus: behind the camera (relative to its centre) it waits while moving fast
  SP.tileK = function (cx, cz, S, camX, camZ, ux, uz, speedB) {
    if (!(speedB >= SP.FAST)) return 0;
    const dx = cx - camX, dz = cz - camZ, d = Math.hypot(dx, dz);
    if (d < S) return 0;
    const c = (dx * ux + dz * uz) / d;
    return c < 0 ? SP.BEHIND_K * -c * 2 : 0;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

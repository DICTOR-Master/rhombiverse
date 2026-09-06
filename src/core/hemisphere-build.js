// Hemisphere-piece store: Half RD (one real hemisphereSplit() half, sitting
// in a single cell) and Hourglass (two matching halves from adjacent cells,
// bridging them) -- ported from Rhombis (src/rhombis/stages.js's Hourglass/
// Hourglass Chain stages), direct instruction 2026-09-06 ("ship two pieces
// to rhombiverse"). Same "own small store, not core/worldstate-core.js's
// createWorldStore" reasoning core/interstitial-build.js already gives:
// neither piece has a single cellKey(x,y,z) the way a whole RD/Cube cell
// does -- a Half RD needs a cell PLUS a direction PLUS a side, and an
// Hourglass needs two cells plus a direction, so each gets its own key
// scheme below instead of being shoehorned into the main world's schema.
//
// Real, previously-shipped lesson this directly carries forward: Rhombis's
// own Hourglass/Hourglass Chain pieces shipped with a real double-offset
// positioning bug (a bridging piece's geometry was pre-translated to
// absolute world coords via mergeGeometries+.translate(), then ALSO
// repositioned by the group/anchor position at real placement time --
// caught live, "the two hourglasses arent meeting in the middle"). This
// store follows core/interstitial-build.js's own render.js pairing instead
// (buildHemisphereGeometry in render.js bakes ABSOLUTE world-space vertices
// straight from the stored cell coordinates, and the resulting mesh's own
// .position is left untouched at the scene origin forever) -- there is no
// second "group position" applied on top, so that whole bug class can't
// recur here by construction, not by discipline.
import { NEIGHBOR_OFFSETS, cellKey } from './lattice.js';

export function halfRdKey(x, y, z, offsetIndex, side) {
  return `halfrd|${cellKey(x, y, z)}|${offsetIndex}|${side}`;
}

function lexLess(a, b) {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  return a[2] < b[2];
}

// Canonical, click-direction-independent identity for a two-cell bridge --
// same reasoning core/interstitial-build.js's disphenoidKey and
// geometry-extensions/dual-lattice.js's own cell-order-independent keys
// already apply: clicking the shared boundary from either cell's own face
// must resolve to the SAME stored piece, not create two.
export function hourglassKey(ax, ay, az, bx, by, bz) {
  const a = [ax, ay, az];
  const b = [bx, by, bz];
  const [lo, hi] = lexLess(a, b) ? [a, b] : [b, a];
  return `hourglass|${cellKey(...lo)}~${cellKey(...hi)}`;
}

// The real NEIGHBOR_OFFSETS index from lo to hi -- lo/hi must already be
// real FCC neighbors (isValidCell + exactly one NEIGHBOR_OFFSETS apart),
// same precondition every other bootstrap-from-a-clicked-face call site
// in core/build.js relies on (matchNeighborOffset already guarantees the
// clicked face's own outward direction is a real one of the 12).
export function hourglassOffsetIndex(lo, hi) {
  const d = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  return NEIGHBOR_OFFSETS.findIndex(([x, y, z]) => x === d[0] && y === d[1] && z === d[2]);
}

export function canonicalHourglassCells(ax, ay, az, bx, by, bz) {
  const a = [ax, ay, az];
  const b = [bx, by, bz];
  return lexLess(a, b) ? [a, b] : [b, a];
}

// Same store shape/API as core/interstitial-build.js's createInterstitialStore
// (has/get/set/remove/entries/replaceAll/toJSON) -- one Map keyed by the
// piece's own key scheme above, entries tagged `type: 'halfrd' | 'hourglass'`
// so a single store/mesh-group can hold both real piece kinds (they're the
// same underlying hemisphereSplit() geometry, just merged 1x vs 2x).
export function createHemisphereStore(savedJSON) {
  const pieces = new Map(Object.entries(savedJSON?.pieces ?? {}));
  return {
    has(key) { return pieces.has(key); },
    get(key) { return pieces.get(key); },
    set(key, data) { pieces.set(key, data); },
    remove(key) { pieces.delete(key); },
    entries() {
      return Array.from(pieces.entries()).map(([key, data]) => ({ key, ...data }));
    },
    replaceAll(worldJSON) {
      pieces.clear();
      for (const [key, data] of Object.entries(worldJSON?.pieces ?? {})) pieces.set(key, data);
    },
    toJSON() {
      return { worldName: 'Hemisphere Pieces', version: 1, pieces: Object.fromEntries(pieces) };
    },
  };
}

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
import { NEIGHBOR_OFFSETS, CUBE_VERTS, cellKey } from './lattice.js';

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

// Cluster stamps ('hemi3'/'hemi4'): a single click bulk-adds several plain
// halfrd entries at once, all anchored on the same clicked cell. Direct
// user idea 2026-09-06 ("I have ideas for three, four and 12 hemisphere
// clusters"/"they are self evident shapes") -- the 12-direction "shell
// around a whole RD" variant was dropped from scope after direct
// correction ("no you cant cluster 12 it becomes a TO": the union of a
// whole RD plus its own near-hemisphere in all 12 real directions is
// already exactly the shape the 'to' piece type places, not new content --
// see feedback_make_implicit_explicit in memory for why this kind of
// audit-before-building matters here). Three genuinely distinct
// groupings survive: a 3-direction cube-corner wedge, a 4-direction flat
// equatorial band, and (added later the same session) a 3-direction flat
// equilateral-triangle ring -- see TRIANGLE_GROUPS below for why that one
// is a real third family, not a variant of the corner wedge.

// 3-cluster ("corner"): the NEIGHBOR_OFFSETS directions whose every
// nonzero coordinate's sign matches one cube corner (CUBE_VERTS) -- e.g.
// corner (1,1,1) is adjacent to (1,1,0), (1,0,1), (0,1,1), the RD's own 3
// real edges meeting there in this 12-direction frame. Derived directly
// from CUBE_VERTS (not hand-listed) so this stays correct for free if
// that ever changes -- same reasoning core/pyramid.js's own PYRAMID_AXES
// derivation from OCTA_VERTS already follows. Each of the 12 directions
// belongs to exactly 2 of these 8 corner groups (it sits on the edge
// between them), which is exactly why 'hemi3' bootstrap (core/build.js)
// needs the real click POINT, not just the clicked face's direction, to
// pick the intended one.
function cornerGroupIndices(sign) {
  return NEIGHBOR_OFFSETS
    .map(([x, y, z], i) => (
      (x === 0 || Math.sign(x) === sign[0]) &&
      (y === 0 || Math.sign(y) === sign[1]) &&
      (z === 0 || Math.sign(z) === sign[2])
    ) ? i : -1)
    .filter((i) => i >= 0);
}
export const CORNER_GROUPS = CUBE_VERTS.map((sign) => ({ sign, indices: cornerGroupIndices(sign) }));

// Nearest corner to a real click point, local to the anchor cell's own
// center (core/build.js passes hit.point minus that cell's own
// cellToWorld()) -- plain max-dot-product against each corner's own sign
// vector, the same "nearest apex" style resolution core/pyramid.js's own
// harder hit-testing already established for this codebase.
export function nearestCornerGroup(localPoint) {
  let best = CORNER_GROUPS[0];
  let bestDot = -Infinity;
  for (const group of CORNER_GROUPS) {
    const dot = localPoint[0] * group.sign[0] + localPoint[1] * group.sign[1] + localPoint[2] * group.sign[2];
    if (dot > bestDot) { bestDot = dot; best = group; }
  }
  return best;
}

// 4-cluster ("band"): the 4 real directions sharing one zero coordinate --
// every NEIGHBOR_OFFSETS entry has exactly one (two +-1's and a 0), so
// this cleanly PARTITIONS all 12 into 3 groups of 4 with no overlap
// (unlike the corner groups above) -- a flat equatorial ring of
// hemispheres around one cube axis. No click-point disambiguation needed:
// the clicked face's own direction alone always picks exactly one group.
export const BAND_GROUPS = [0, 1, 2].map((axis) => ({
  axis,
  indices: NEIGHBOR_OFFSETS.map((o, i) => (o[axis] === 0 ? i : -1)).filter((i) => i >= 0),
}));

export function bandGroupForOffsetIndex(offsetIndex) {
  return BAND_GROUPS.find((g) => g.indices.includes(offsetIndex));
}

// Triangle cluster ("ring"): 3 directions lying in one shared FLAT plane
// at a genuine 120-degree spacing -- direct user idea 2026-09-06
// ("equilateral triangle with flat sides out"), verified numerically
// before writing this: each of the 4 real body-diagonal axes ((1,1,1)-
// type) has exactly 6 of the 12 NEIGHBOR_OFFSETS perpendicular to it,
// forming a real regular hexagon in that plane (a known real cross-
// section of the cuboctahedron these 12 directions are the vertices of).
// Every OTHER vertex of that hexagon (alternating) gives an equilateral
// triangle at exactly 120 degrees, confirmed via real angle computation
// for all 4 axes x 2 alternating sets = 8 groups. Genuinely distinct from
// CORNER_GROUPS (3D, non-coplanar, converges to a point -- verified NOT
// coplanar via a nonzero determinant) and BAND_GROUPS (a 4-fold square
// ring, no ambiguity) -- a real third symmetric family, not a variant of
// either.
const TRIANGLE_AXES = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1]];

function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function normalize3(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }

function trianglesForAxis(axis) {
  const hexIndices = NEIGHBOR_OFFSETS.map((d, i) => (dot3(d, axis) === 0 ? i : -1)).filter((i) => i >= 0);
  // Order the 6 coplanar directions by real signed angle around the axis
  // (atan2 of the cross-product's projection onto the axis vs. the dot
  // product) -- not assumed, computed -- then even/odd indices are the
  // 2 real alternating triangles.
  const n = normalize3(axis);
  const ref = normalize3(NEIGHBOR_OFFSETS[hexIndices[0]]);
  const angleOf = (i) => {
    const v = normalize3(NEIGHBOR_OFFSETS[i]);
    return Math.atan2(dot3(cross3(ref, v), n), dot3(ref, v));
  };
  const ordered = hexIndices.slice().sort((a, b) => angleOf(a) - angleOf(b));
  return [
    { axis, indices: [ordered[0], ordered[2], ordered[4]] },
    { axis, indices: [ordered[1], ordered[3], ordered[5]] },
  ];
}
export const TRIANGLE_GROUPS = TRIANGLE_AXES.flatMap(trianglesForAxis);

// A clicked direction sits in exactly 2 of the 4 hexagonal planes (real
// consequence of the cuboctahedron's own geometry -- verified: every
// NEIGHBOR_OFFSETS index appears in exactly 2 of TRIANGLE_GROUPS' 4
// distinct axes), so resolving which flat triangle it belongs to needs
// the real click point, same "nearest apex" reasoning nearestCornerGroup
// above already uses -- picks whichever candidate axis the click point
// lies CLOSEST to actually lying within (smallest |dot(localPoint, axis)|).
export function resolveTriangleGroup(offsetIndex, localPoint) {
  const candidates = TRIANGLE_GROUPS.filter((g) => g.indices.includes(offsetIndex));
  let best = candidates[0];
  let bestScore = Infinity;
  for (const g of candidates) {
    const score = Math.abs(dot3(localPoint, g.axis));
    if (score < bestScore) { bestScore = score; best = g; }
  }
  return best;
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

// 2D lattice tier (dimension-select wizard Phase 2): flat layer pinned
// to z=0 in the SAME 3D scene/camera/wheel apparatus 3D already uses --
// direct instruction, "flat layer in the same 3D scene... own world-
// stores/meshes per family (same 'adopted family member' pattern as
// BCC/Hex Prism), just flat. No separate UI mode."
//
// Phase 3 (2026-09-23), direct instruction, replaces the earlier
// Square/Hexagon/Triangle-as-3-separate-hardcoded-families design:
// "variable coordinate 2D lattice that alters primitives... toggle or
// slider with different lattice patterns," refined through discussion
// to a discrete toggle x toggle (not a continuous slider -- no slider
// widget exists anywhere in this app, and a live-reshaping-existing-
// geometry system is a far bigger, riskier undertaking than a discrete
// picker needs) over TWO axes:
//
//   1. NAMED_LATTICE_ANGLES -- which angle the lattice's 2 equal-length
//      basis vectors sit at. All 4 are genuinely NAMED angles, not
//      arbitrary filler picked for visual spacing: 90 (Square), the
//      RD's own rhombus angle (this app's own signature shape --
//      arccos(1/3), verified in the sibling Polyhedraverse project the
//      same day fixing a real face-attach bug caused by this exact
//      angle), the Golden Rhombus angle (arctan(2), diagonal ratio phi --
//      already an established shape in this app's own RVCMG pieces), and
//      60 (Triangular / the hexagonal point lattice).
//   2. LATTICE_PRIMITIVES -- which tile shape gets drawn AT that
//      lattice: 'parallelogram' (the raw unit cell -- what Square
//      already was), 'triangle' (each parallelogram cell split along a
//      diagonal -- what Triangle already was, generalized off its
//      hardcoded 60), or 'hexagon' (the lattice's own Voronoi/Dirichlet
//      cell -- a NEW construction, replacing the old Hexagon 2D, which
//      used to reuse hex-prism.js's separate axial hex system instead
//      of this file's own basis-vector math at all).
//
// Each (angle, primitive) combination is its own separate, non-
// interoperating world/mesh/store, exactly like Square/Hexagon/Triangle
// already were -- confirmed as the right design specifically BECAUSE
// they already worked this way: switching which combination is active
// never needs to reconcile or reshape an already-placed lattice against
// a differently-angled one, since there is never a shared edge between
// two different combinations to begin with (same reason Square tiles
// never needed to line up with Hexagon tiles before this).
//
// A tile gets a small real height (not a literal 0-height flat quad) --
// same "arbitrary extrusion height is fine, no special ratio required"
// reasoning hex-prism.js's own header already established for its own
// prism height, applied here for the same practical reason: a truly
// flat (zero-volume) tile risks total invisibility from a grazing
// camera angle and z-fighting against the ground/other flat content.

export const NAMED_LATTICE_ANGLES = [
  { id: 'square', label: 'Square', angleDeg: 90 },
  // arccos(1/3): RHOMBIC_DODECAHEDRON's own rhombus face angle -- see
  // this file's header. Verified directly against this app's own RD
  // vertex data the same session (70.5288 degrees).
  { id: 'rd-rhombus', label: 'RD Rhombus', angleDeg: (Math.acos(1 / 3) * 180) / Math.PI },
  // arctan(2): the Golden Rhombus (diagonal ratio = golden ratio phi) --
  // already a named, shipped shape family in this app's RVCMG pieces
  // (golden-rhombus-to-U-Hex adapter, golden rhombus prism).
  { id: 'golden-rhombus', label: 'Golden Rhombus', angleDeg: (Math.atan(2) * 180) / Math.PI },
  { id: 'triangular', label: 'Triangular / Hexagonal', angleDeg: 60 },
];

export const LATTICE_PRIMITIVES = [
  { id: 'parallelogram', label: 'Parallelogram' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'kite', label: 'Kite' },
];

// Two equal-length basis vectors at angleDeg apart. The single shared
// construction every primitive below is built from -- parametrized by
// angle (not hardcoded) specifically so all 3 primitives x 4 named
// angles reuse this ONE derivation rather than re-deriving it 12 times.
export function latticeBasis(angleDeg, s = 1) {
  const a = (angleDeg * Math.PI) / 180;
  return [[s, 0], [s * Math.cos(a), s * Math.sin(a)]];
}

function centroid2d(pts) {
  const n = pts.length;
  const cx = pts.reduce((sum, p) => sum + p[0], 0) / n;
  const cy = pts.reduce((sum, p) => sum + p[1], 0) / n;
  return [cx, cy];
}

function extrudePrism(corners2d, h) {
  const [cx, cy] = centroid2d(corners2d);
  const verts = [];
  for (const hz of [h / 2, -h / 2]) {
    for (const [x, y] of corners2d) verts.push([x - cx, y - cy, hz]);
  }
  return verts;
}

// ---------------------------------------------------------------------------
// Parallelogram primitive (formerly "Square", hardcoded to 90 degrees)
// ---------------------------------------------------------------------------

// A parallelogram tile shares a full edge (not just a corner) with
// exactly its 4 neighbors along its own 2 generating directions
// (+-v0, +-v1) -- same "real adjacency, not just proximity" discipline
// NEIGHBOR_OFFSETS already establishes for the 3D lattice. Angle-
// independent: true for every parallelogram regardless of its angle.
export const PARALLELOGRAM_NEIGHBOR_OFFSETS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
];

export function parallelogramCellToWorld(x, y, angleDeg, s = 1, worldZ = 0) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  return [x * v0[0] + y * v1[0], x * v0[1] + y * v1[1], worldZ];
}

// The real parallelogram cross-section (2 equal-length vectors at
// angleDeg apart, centered on its own centroid) in the XY (world)
// plane, height h along the scene's own Z axis.
export function parallelogramTileVerts(angleDeg, s = 1, h = 0.15 * 1) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  const corners2d = [[0, 0], v0, [v0[0] + v1[0], v0[1] + v1[1]], v1];
  return extrudePrism(corners2d, h);
}

// ---------------------------------------------------------------------------
// Triangle primitive (generalized off the old hardcoded-60-degree Triangle)
// ---------------------------------------------------------------------------

// Up-pointing and down-pointing triangles alternating, together filling
// every parallelogram cell of the SAME latticeBasis(angleDeg)
// construction every other primitive here shares. Only a REGULAR
// (equilateral) triangulation at angleDeg=60/120 -- at any other named
// angle this still exactly tiles the plane, but with ISOSCELES (not
// equilateral, and NOT uniform-edge -- a real correction caught by
// scripts/verify-lattice-2d.mjs, an earlier version of this comment
// wrongly assumed uniform edge length here) triangles: 2 edges of
// length s (along v0 and v1) and a third of length
// s*sqrt(2-2cos(angleDeg)) (the chord |v1-v0|), which only happens to
// equal s at exactly angleDeg=60 (cos=0.5). Real fact, not assumed: at
// ANY angle, up(i,j)
// and down(i,j) are related by a 180-degree rotation about their
// shared center (same proof as the original 60-degree-only version --
// it never actually depended on the specific angle, only on v0/v1
// having equal length), so one shared InstancedMesh geometry (the up
// triangle) still covers both orientations via a per-instance 180-
// degree Z-rotation, unchanged from before.
//
// Coordinates: (i, j, orientation) where orientation is 0 (up) or 1
// (down) -- stored in the cell's own z slot (every other primitive here
// pins z to 0; this is the one primitive that needs a real 3rd axis).
// up(i,j) has vertices P(i,j), P(i+1,j), P(i,j+1) (P = i*v0 + j*v1);
// down(i,j) has vertices P(i+1,j), P(i,j+1), P(i+1,j+1).

// Neighbor offsets are orientation-DEPENDENT (unlike the other 2
// primitives' uniform offset tables) and angle-independent (purely
// topological: which cell shares which edge, not how long that edge
// is) -- an up triangle's 3 neighbors are always down triangles and
// vice versa.
export const TRIANGLE_NEIGHBOR_OFFSETS_FROM_UP = [
  [0, -1, 1], [0, 0, 1], [-1, 0, 1],
];
export const TRIANGLE_NEIGHBOR_OFFSETS_FROM_DOWN = [
  [0, 0, 0], [0, 1, 0], [1, 0, 0],
];

function trianglePoint(i, j, angleDeg, s) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  return [i * v0[0] + j * v1[0], i * v0[1] + j * v1[1]];
}

export function triangleCellToWorld(i, j, orientation, angleDeg, s = 1, worldZ = 0) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  const [px, py] = trianglePoint(i, j, angleDeg, s);
  const corners2d = orientation === 0
    ? [[px, py], [px + v0[0], py + v0[1]], [px + v1[0], py + v1[1]]]
    : [[px + v0[0], py + v0[1]], [px + v1[0], py + v1[1]], [px + v0[0] + v1[0], py + v0[1] + v1[1]]];
  return [...centroid2d(corners2d), worldZ];
}

// The canonical "up" triangle prism only -- "down" instances reuse this
// SAME geometry with a 180-degree Z-rotation applied to their own
// instance matrix (see this file's own header for the verified reason
// this is exact at any angle, not an approximation).
export function triangleTileVerts(angleDeg, s = 1, h = 0.15 * 1) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  const corners2d = [[0, 0], v0, v1];
  return extrudePrism(corners2d, h);
}

// ---------------------------------------------------------------------------
// Hexagon primitive (NEW: the lattice's own Voronoi/Dirichlet cell --
// replaces the old Hexagon 2D, which reused hex-prism.js's separate
// axial hex system instead of this file's own basis-vector math)
// ---------------------------------------------------------------------------

// The Voronoi cell of a 2D lattice around one of its own points is
// bounded by the perpendicular bisectors to its nearby lattice
// neighbors. Rather than hand-deriving which of {+-v0, +-v1, +-(v0-v1),
// +-(v0+v1)} are the "real" (Voronoi-relevant) neighbors -- a case
// split on whether angleDeg is acute or obtuse that's easy to get
// subtly wrong -- this clips a large square against the half-plane
// "closer to the origin than to candidate C" for ALL 8 candidates at
// once (standard half-plane intersection / Sutherland-Hodgman against
// a single half-plane per candidate). Irrelevant candidates simply
// clip away nothing; this is correct at every angle without a special
// case, including the exact-90-degree square (verified below: 4
// vertices, not 6 -- 2 of the 8 candidates turn out equidistant and
// contribute no edge) and the exact-60/120-degree REGULAR hexagon
// (verified: 6 equal edges, 6 angles of exactly 120 degrees).
function clipHalfPlane(poly, n, c) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const out = [];
  const inside = (p) => dot(p, n) <= c + 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const next = poly[(i + 1) % poly.length];
    const currIn = inside(curr);
    const nextIn = inside(next);
    if (currIn) out.push(curr);
    if (currIn !== nextIn) {
      const d = [next[0] - curr[0], next[1] - curr[1]];
      const t = (c - dot(curr, n)) / dot(d, n);
      out.push([curr[0] + d[0] * t, curr[1] + d[1] * t]);
    }
  }
  return out;
}

function ijCandidates(v0, v1) {
  return [
    { ij: [1, 0], w: v0 },
    { ij: [-1, 0], w: [-v0[0], -v0[1]] },
    { ij: [0, 1], w: v1 },
    { ij: [0, -1], w: [-v1[0], -v1[1]] },
    { ij: [1, -1], w: [v0[0] - v1[0], v0[1] - v1[1]] },
    { ij: [-1, 1], w: [v1[0] - v0[0], v1[1] - v0[1]] },
    { ij: [1, 1], w: [v0[0] + v1[0], v0[1] + v1[1]] },
    { ij: [-1, -1], w: [-(v0[0] + v1[0]), -(v0[1] + v1[1])] },
  ];
}

function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function clipAgainst(candidateWorlds, bound) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  let poly = [[-bound, -bound], [bound, -bound], [bound, bound], [-bound, bound]];
  for (const w of candidateWorlds) poly = clipHalfPlane(poly, w, dot(w, w) / 2);
  return poly;
}

// Returns the Voronoi cell's 2D polygon (CCW), centered on the origin.
function voronoiPolygon(angleDeg, s = 1, bound = 1000 * s) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  const cands = ijCandidates(v0, v1);
  return clipAgainst(cands.map((c) => c.w), bound);
}

// Which of the 8 candidate directions actually contribute a real
// (non-redundant) edge to the Voronoi cell at this angle -- i.e. this
// primitive's real neighbor-offset table, derived from the geometry
// itself rather than hand-picked per named angle. A candidate is
// relevant iff removing it from the clip set would change the
// resulting polygon's area (a redundant half-plane never cuts
// anything off, so dropping it changes nothing). Memoized per angleDeg
// since it's only ever evaluated for the 4 NAMED_LATTICE_ANGLES.
const neighborOffsetCache = new Map();
export function hexagonNeighborOffsets(angleDeg) {
  const key = angleDeg.toFixed(6);
  if (neighborOffsetCache.has(key)) return neighborOffsetCache.get(key);
  const [v0, v1] = latticeBasis(angleDeg, 1);
  const cands = ijCandidates(v0, v1);
  const bound = 1000;
  const fullArea = polygonArea(clipAgainst(cands.map((c) => c.w), bound));
  const relevant = [];
  for (let k = 0; k < cands.length; k++) {
    const withoutK = cands.filter((_, idx) => idx !== k).map((c) => c.w);
    const areaWithout = polygonArea(clipAgainst(withoutK, bound));
    if (areaWithout > fullArea + 1e-9) relevant.push([...cands[k].ij, 0]);
  }
  neighborOffsetCache.set(key, relevant);
  return relevant;
}

export function hexagonCellToWorld(i, j, angleDeg, s = 1, worldZ = 0) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  return [i * v0[0] + j * v1[0], i * v0[1] + j * v1[1], worldZ];
}

// The Voronoi cell prism -- a real hexagon at any angle except exactly
// 90 degrees (Square), where it correctly degenerates to a square
// (verified: see scripts/verify-lattice-2d.mjs).
export function hexagonTileVerts(angleDeg, s = 1, h = 0.15 * 1) {
  const corners2d = voronoiPolygon(angleDeg, s);
  return extrudePrism(corners2d, h);
}

// ---------------------------------------------------------------------------
// Kite primitive (the hexagon above, fanned into kites from its own
// center) -- ONLY offered at Square and Triangular, the 2 angles where the
// fan is genuinely N congruent kites related by a pure rotation (4-fold,
// 6-fold). At RD Rhombus/Golden Rhombus the Voronoi hexagon is irregular
// (only 180-degree point symmetry, not full N-fold), so its fan produces 3
// GENUINELY DIFFERENT kite shapes there, not rotations of one -- verified
// directly (real side lengths differ between adjacent fan positions, only
// match 3 apart). Rendering that correctly needs real multi-geometry
// support this file's "one shape per primitive" model doesn't have yet
// (the same problem Kagome will need to solve for its own 2 sub-shapes) --
// deferred, not built here. KITE_VALID_ANGLE_IDS is what render.js's
// toggle panel uses to grey Kite out at the other 2 angles instead of
// rendering broken geometry.
// ---------------------------------------------------------------------------

export const KITE_VALID_ANGLE_IDS = ['square', 'triangular'];

// One kite: hexagon center, the midpoint of its incoming edge, the real
// polygon vertex itself, and the midpoint of its outgoing edge -- the
// standard "fan a polygon from its center" kite construction, generic
// over the polygon's own vertex count (4 at Square, 6 elsewhere) rather
// than hardcoded to 6.
function kiteCorners2d(poly, i) {
  const n = poly.length;
  const Vi = poly[i];
  const Vprev = poly[(i - 1 + n) % n];
  const Vnext = poly[(i + 1) % n];
  return [
    [0, 0],
    [(Vprev[0] + Vi[0]) / 2, (Vprev[1] + Vi[1]) / 2],
    Vi,
    [(Vi[0] + Vnext[0]) / 2, (Vi[1] + Vnext[1]) / 2],
  ];
}

// Fan index 0's own real corners only -- every other fan index (only at
// the 2 valid angles) is a pure rotation of this SAME shape about the
// hexagon's own center, same "one geometry, per-instance rotation" trick
// triangle's up/down already uses, generalized from one 180-degree flip to
// N-fold (see kiteInstanceRotationRad below).
export function kiteTileVerts(angleDeg, s = 1, h = 0.15 * 1) {
  return extrudePrism(kiteCorners2d(voronoiPolygon(angleDeg, s), 0), h);
}

export function kiteCellToWorld(x, y, fanIndex, angleDeg, s = 1, worldZ = 0) {
  const poly = voronoiPolygon(angleDeg, s);
  const [hcx, hcy] = hexagonCellToWorld(x, y, angleDeg, s, 0);
  const [ox, oy] = centroid2d(kiteCorners2d(poly, 0));
  const theta = (fanIndex * 2 * Math.PI) / poly.length;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  return [hcx + ox * cos - oy * sin, hcy + ox * sin + oy * cos, worldZ];
}

export function kiteInstanceRotationRad(fanIndex, angleDeg) {
  return (fanIndex * 2 * Math.PI) / voronoiPolygon(angleDeg, 1).length;
}

// Kite's own real neighbor table: 2 intra-hexagon fan-mates (adjacent fan
// index, same hexagon -- always correct, no angle-dependent derivation
// needed) plus 2 cross-hexagon neighbors, one per outer edge -- found by
// matching THIS kite's own vertex (poly[fanIndex]) against each hexagon-
// neighbor's own vertex set in world space (a shared vertex in world space
// IS a shared kite edge, since a kite's outer boundary is exactly the 2
// hexagon-edge half-segments touching its own vertex). Verified directly
// for both valid angles: always exactly 2 cross-hexagon matches per fan
// index, matching a kite's real edge count (4) exactly.
const kiteNeighborOffsetCache = new Map();
export function kiteNeighborOffsets(angleDeg, fanIndex) {
  const key = `${angleDeg.toFixed(6)}:${fanIndex}`;
  if (kiteNeighborOffsetCache.has(key)) return kiteNeighborOffsetCache.get(key);
  const poly = voronoiPolygon(angleDeg, 1);
  const n = poly.length;
  const offsets = [
    [0, 0, (fanIndex - 1 + n) % n],
    [0, 0, (fanIndex + 1) % n],
  ];
  const Vi = poly[fanIndex];
  const eq = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  for (const [ox, oy] of hexagonNeighborOffsets(angleDeg)) {
    const [ncx, ncy] = hexagonCellToWorld(ox, oy, angleDeg, 1, 0);
    for (let j = 0; j < n; j++) {
      if (eq([poly[j][0] + ncx, poly[j][1] + ncy], Vi)) { offsets.push([ox, oy, j]); break; }
    }
  }
  kiteNeighborOffsetCache.set(key, offsets);
  return offsets;
}

// ---------------------------------------------------------------------------
// Rhombille arrangement -- NOT a LATTICE_PRIMITIVES entry. It's a second,
// contextual placement pattern for the SAME rhombus shape Parallelogram
// already draws at the Triangular/Hexagonal (60-degree) angle: instead of
// pure translation (today's Parallelogram, one orientation everywhere),
// this places 3 rotated copies (0/120/240 degrees) around alternating
// hexagon-center points -- real rhombille tiling, dual of the Kagome
// (trihexagonal) tiling. Angle-locked to exactly 60 degrees (unlike Kite,
// this has no partial/irregular fallback at the other 3 named angles: 3
// rotated copies of a rhombus only close up without gaps when its own
// corners are exactly 60/120, which is only true here), so render.js
// offers it as a contextual "Arrangement" toggle under Parallelogram,
// shown only at this one angle, rather than a normal primitive spanning
// all 4.
// ---------------------------------------------------------------------------

export const RHOMBILLE_ANGLE_ID = 'triangular';
const RHOMBILLE_ANGLE_DEG = NAMED_LATTICE_ANGLES.find((a) => a.id === RHOMBILLE_ANGLE_ID).angleDeg;

// A regular hexagon (only true at exactly 60 degrees) splits into 3
// congruent 60/120 rhombi by connecting its own center to 3 alternating
// vertex-pairs: (H0,H1,H2), (H2,H3,H4), (H4,H5,H0) -- a well-known
// dissection, verified directly (all 3 have identical side lengths, and
// each is exactly a 120-degree rotation of the others about the hexagon's
// own center, since shifting the vertex pair by 2 IS a 120-degree
// rotation at 60-degree 6-fold symmetry). Same side length as
// Parallelogram's own rhombus at this angle (both are 60/120 rhombi of
// side s) -- a different placement pattern for an equivalent shape, not a
// differently-sized one.
function rhombusCorners2d(poly, k) {
  const n = poly.length;
  return [[0, 0], poly[(2 * k) % n], poly[(2 * k + 1) % n], poly[(2 * k + 2) % n]];
}

// k=0's own real corners only -- k=1/k=2 are pure 120/240-degree rotations
// of this SAME shape about the hexagon's own center, same "one geometry,
// per-instance rotation" trick Kite's own fan uses, fixed at N=3 (angle-
// locked, so no per-angleDeg N to compute).
export function rhombilleTileVerts(s = 1, h = 0.15 * 1) {
  return extrudePrism(rhombusCorners2d(voronoiPolygon(RHOMBILLE_ANGLE_DEG, s), 0), h);
}

export function rhombilleCellToWorld(x, y, k, s = 1, worldZ = 0) {
  const poly = voronoiPolygon(RHOMBILLE_ANGLE_DEG, s);
  const [hcx, hcy] = hexagonCellToWorld(x, y, RHOMBILLE_ANGLE_DEG, s, 0);
  const [ox, oy] = centroid2d(rhombusCorners2d(poly, 0));
  const theta = (k * 2 * Math.PI) / 3;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  return [hcx + ox * cos - oy * sin, hcy + ox * sin + oy * cos, worldZ];
}

export function rhombilleInstanceRotationRad(k) {
  return (k * 2 * Math.PI) / 3;
}

// Verified directly (real hexagon-edge world-position matching, same
// technique kiteNeighborOffsets uses): each rhombus has exactly 2 intra-
// hexagon neighbors (the other 2 rhombi sharing this same hexagon, across
// their shared center-to-vertex radius edges) plus 2 real cross-hexagon
// neighbors (one per outer edge) -- exactly 4 total, matching a rhombus's
// real edge count. Fixed, angle-locked constants (this only ever runs at
// RHOMBILLE_ANGLE_DEG), same "hardcoded per-orientation table" style as
// TRIANGLE_NEIGHBOR_OFFSETS_FROM_UP/DOWN above rather than a runtime
// derivation like Kite's (which genuinely varies per angleDeg).
const RHOMBILLE_NEIGHBOR_OFFSETS = [
  [[0, 0, 1], [0, 0, 2], [1, 0, 1], [0, 1, 2]], // k=0
  [[0, 0, 0], [0, 0, 2], [-1, 1, 2], [-1, 0, 0]], // k=1
  [[0, 0, 0], [0, 0, 1], [0, -1, 0], [1, -1, 1]], // k=2
];
export function rhombilleNeighborOffsets(k) {
  return RHOMBILLE_NEIGHBOR_OFFSETS[k];
}

// Same shape as a LATTICE_PRIMITIVE_IMPLS entry (tileVerts/cellToWorld/
// neighborOffsets/instanceRotationRad/hasOrientation), so render.js/
// build.js can swap it in for the 'parallelogram' entry wholesale when
// the Rhombille arrangement is active, rather than needing a parallel
// dispatch mechanism. NOT added to LATTICE_PRIMITIVE_IMPLS itself --
// it's reached only via that swap, never as its own primitive id.
export const RHOMBILLE_ARRANGEMENT_IMPL = {
  hasOrientation: true,
  tileVerts: (_angleDeg, s, h) => rhombilleTileVerts(s, h),
  cellToWorld: (i, j, orientation, _angleDeg, s, worldZ) => rhombilleCellToWorld(i, j, orientation, s, worldZ),
  neighborOffsets: (_angleDeg, orientation) => rhombilleNeighborOffsets(orientation),
  instanceRotationRad: (_angleDeg, orientation) => rhombilleInstanceRotationRad(orientation),
};

// ---------------------------------------------------------------------------
// Generic dispatch: one lookup table so callers (render.js/build.js) can
// loop over all NAMED_LATTICE_ANGLES x LATTICE_PRIMITIVES combinations
// generically instead of hand-writing one block per combination.
// ---------------------------------------------------------------------------

export const LATTICE_PRIMITIVE_IMPLS = {
  parallelogram: {
    hasOrientation: false,
    tileVerts: (angleDeg, s, h) => parallelogramTileVerts(angleDeg, s, h),
    cellToWorld: (i, j, _orientation, angleDeg, s, worldZ) => parallelogramCellToWorld(i, j, angleDeg, s, worldZ),
    neighborOffsets: () => PARALLELOGRAM_NEIGHBOR_OFFSETS,
  },
  triangle: {
    hasOrientation: true,
    tileVerts: (angleDeg, s, h) => triangleTileVerts(angleDeg, s, h),
    cellToWorld: (i, j, orientation, angleDeg, s, worldZ) => triangleCellToWorld(i, j, orientation, angleDeg, s, worldZ),
    neighborOffsets: (_angleDeg, orientation) => (orientation === 0 ? TRIANGLE_NEIGHBOR_OFFSETS_FROM_UP : TRIANGLE_NEIGHBOR_OFFSETS_FROM_DOWN),
    instanceRotationRad: (_angleDeg, orientation) => (orientation === 1 ? Math.PI : 0),
  },
  hexagon: {
    hasOrientation: false,
    tileVerts: (angleDeg, s, h) => hexagonTileVerts(angleDeg, s, h),
    cellToWorld: (i, j, _orientation, angleDeg, s, worldZ) => hexagonCellToWorld(i, j, angleDeg, s, worldZ),
    neighborOffsets: (angleDeg) => hexagonNeighborOffsets(angleDeg),
  },
  kite: {
    hasOrientation: true,
    validAngleIds: KITE_VALID_ANGLE_IDS,
    tileVerts: (angleDeg, s, h) => kiteTileVerts(angleDeg, s, h),
    cellToWorld: (i, j, orientation, angleDeg, s, worldZ) => kiteCellToWorld(i, j, orientation, angleDeg, s, worldZ),
    neighborOffsets: (angleDeg, orientation) => kiteNeighborOffsets(angleDeg, orientation),
    instanceRotationRad: (angleDeg, orientation) => kiteInstanceRotationRad(orientation, angleDeg),
  },
};

// Every (angle, primitive) combination this tier offers, flattened --
// the one list render.js/build.js/dimension-wizard.js all iterate to
// build their own per-combination stores/UI rows generically.
export const LATTICE_2D_COMBINATIONS = NAMED_LATTICE_ANGLES.flatMap((angle) =>
  LATTICE_PRIMITIVES.map((primitive) => ({
    id: `${primitive.id}:${angle.id}`,
    angleId: angle.id,
    angleLabel: angle.label,
    angleDeg: angle.angleDeg,
    primitiveId: primitive.id,
    primitiveLabel: primitive.label,
    label: `${angle.label} × ${primitive.label}`,
  })),
);

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
  },
  hexagon: {
    hasOrientation: false,
    tileVerts: (angleDeg, s, h) => hexagonTileVerts(angleDeg, s, h),
    cellToWorld: (i, j, _orientation, angleDeg, s, worldZ) => hexagonCellToWorld(i, j, angleDeg, s, worldZ),
    neighborOffsets: (angleDeg) => hexagonNeighborOffsets(angleDeg),
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

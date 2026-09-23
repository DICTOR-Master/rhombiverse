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
  { id: 'kagome', label: 'Kagome' },
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
// center). At Square and Triangular the fan is genuinely N congruent
// kites related by a pure rotation (4-fold, 6-fold): the single-mesh
// "one geometry, per-instance rotation" path below (kiteTileVerts/
// kiteCellToWorld/kiteInstanceRotationRad, unchanged since first
// shipped). At RD Rhombus/Golden Rhombus the Voronoi hexagon is
// irregular (only 180-degree point symmetry, not full N-fold), so the
// fan produces 3 GENUINELY DIFFERENT kite shapes -- verified directly,
// each antipodal pair (class, class+3) still exactly a 180-degree
// rotation of the other (the SAME real fact triangle's own up/down
// already relies on, just not a FULL N-fold one here) -- so those 2
// angles use the separate "class" path further below: up to 3 real
// meshes instead of 1, each holding one class's own shape, rebuilt by
// render.js's own multi-class mechanism (kite is currently the only
// primitive using it -- Kagome's own multi-mesh need, 2 sub-SHAPES
// sharing one lattice, used a simpler "companions" mechanism instead,
// since none of Kagome's sub-shapes needed more than one geometry each).
// ---------------------------------------------------------------------------

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

// Fan index 0's own real corners only -- at Square/Triangular, every
// other fan index is a pure rotation of this SAME shape about the
// hexagon's own center, same "one geometry, per-instance rotation" trick
// triangle's up/down already uses, generalized from one 180-degree flip
// to N-fold (see kiteInstanceRotationRad below).
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

// How many DISTINCT kite shapes this angle's fan actually needs, derived
// (not hand-picked) by checking real congruence across all N fan
// positions -- 1 at Square/Triangular (full N-fold symmetry), else the
// antipodal-only count ceil(N/2) (currently 3, at RD Rhombus/Golden
// Rhombus). render.js reads this to decide which of the 2 rendering
// paths above to use for the CURRENT angle.
const kiteClassCountCache = new Map();
export function kiteClassCount(angleDeg) {
  const key = angleDeg.toFixed(6);
  if (kiteClassCountCache.has(key)) return kiteClassCountCache.get(key);
  const poly = voronoiPolygon(angleDeg, 1);
  const n = poly.length;
  const sig = (i) => {
    const c = kiteCorners2d(poly, i);
    return [0, 1, 2, 3].map((k) => +Math.hypot(c[k][0] - c[(k + 1) % 4][0], c[k][1] - c[(k + 1) % 4][1]).toFixed(6)).sort().join(',');
  };
  const base = sig(0);
  const allCongruent = Array.from({ length: n }, (_, i) => sig(i)).every((s) => s === base);
  const result = allCongruent ? 1 : Math.ceil(n / 2);
  kiteClassCountCache.set(key, result);
  return result;
}

// Which class (0..classCount-1) a given fan position belongs to, and
// whether it's the "primary" occurrence or its 180-degree-flipped
// antipodal partner -- only meaningful/used when kiteClassCount > 1.
export function kiteClassOf(fanIndex, angleDeg) {
  return fanIndex % kiteClassCount(angleDeg);
}
export function kiteClassIsFlipped(fanIndex, angleDeg) {
  return fanIndex >= kiteClassCount(angleDeg);
}

// A given class's own real corners (angle-general -- unlike the single-
// mesh path above, no N-fold symmetry is assumed).
export function kiteClassTileVerts(angleDeg, classIndex, s = 1, h = 0.15 * 1) {
  return extrudePrism(kiteCorners2d(voronoiPolygon(angleDeg, s), classIndex), h);
}

// The REAL world position for a specific fan instance, computed directly
// from ITS OWN corners -- not a rotation of class 0's position, which
// (unlike the shape-congruence fact above) is NOT generally true off
// Square/Triangular. Position and shape both need to be class-specific.
export function kiteDirectCellToWorld(x, y, fanIndex, angleDeg, s = 1, worldZ = 0) {
  const poly = voronoiPolygon(angleDeg, s);
  const [hcx, hcy] = hexagonCellToWorld(x, y, angleDeg, s, 0);
  const [ox, oy] = centroid2d(kiteCorners2d(poly, fanIndex));
  return [hcx + ox, hcy + oy, worldZ];
}

export function kiteClassInstanceRotationRad(fanIndex, angleDeg) {
  return kiteClassIsFlipped(fanIndex, angleDeg) ? Math.PI : 0;
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
// Kagome (trihexagonal, 3.6.3.6) -- the rectified triangular tiling: a
// small hexagon at each original lattice point, a small triangle at each
// original up/down triangle's own position. NOT hexagonTileVerts's own
// Voronoi construction rescaled (checked directly and rejected: the
// Voronoi hexagon's vertices point BETWEEN neighbor directions -- -30/-45
// degrees off v0 -- a different, incompatible construction). The real
// rectification hexagon's vertices are exactly the MIDPOINTS of the 6
// edges to each neighbor, so it's built directly from those midpoints
// here, not reused from Hexagon. Angle-gated to Triangular only -- see
// KAGOME_VALID_ANGLE_IDS's own header just below for why (rejected at
// Square specifically, not just untested).
//
// Each small triangle is the medial triangle of an ORIGINAL up/down
// triangle (vertices at ITS 3 edge midpoints) -- by construction, a
// hexagon edge between two adjacent neighbor-direction midpoints IS
// exactly one edge of that medial triangle, so hexagon and triangle
// faces share real edges with no separate alignment step, and the
// existing Triangle primitive's own proven "up/down are a 180-degree
// rotation of the same shape, true at any angle" fact applies unchanged
// to these medial triangles too (a medial triangle of a rotated shape is
// the same rotation of the original's medial triangle).
// ---------------------------------------------------------------------------

// Kagome works at ALL 4 named angles -- no validAngleIds restriction
// needed (same as Kite once its own multi-class path shipped). Two real
// corrections got here, in order:
//   1. Initially restricted to Triangular only, by over-generalizing
//      from Rhombille's own genuinely hard 60-degree-only limit --
//      checked directly and that analogy didn't hold: this file's own
//      hexagon/triangle construction never assumed regularity (unlike
//      Rhombille's fixed 120-degree rotation or Kite's rotation trick),
//      so RD Rhombus/Golden Rhombus were added once actually checked.
//   2. Square was then believed genuinely rejected (the down(x,y-1)
//      triangle pairing this file used only shared a real edge with the
//      hexagon at 3 of the 4 angles, failing at exactly Square) --
//      direct user request to re-verify that conclusion instead of
//      trusting it. Systematically checking ALL 3 down-triangle
//      candidates that touch P(x,y), at every angle, found
//      down(x-1,y-1) shares a real edge at ALL 4, including Square --
//      see kagomeTriangleDownTileVerts's own header. There was no
//      geometric wall at Square at all, only a non-optimal choice of
//      which down-triangle to pair with which hexagon.

// Real bug, direct user report ("pointed at both ends... missing
// triangles... at 90") caught AFTER the Square fix above already
// shipped: this used to build the hexagon from hexagonNeighborOffsets,
// which counts VORONOI-adjacent hexagons (4 at Square -- the diagonal
// direction is redundant there for THAT purpose, per that function's own
// header). But the real rectification hexagon needs a vertex per
// TRIANGULATION EDGE at that point, a different count -- verified
// directly by hand-counting triangles: 6 real triangles meet at any
// point at EVERY named angle, including Square (up(x,y) contributes 2
// edges; the 2 squares where this point is a DIAGONAL ENDPOINT each
// contribute 2 more real edges, since P is shared by both halves of
// THOSE squares; the 2 "off-diagonal corner" squares contribute 1 each
// -- 2+2+2+... totals 6, not 4). hexagonNeighborOffsets' own 4-vs-6
// distinction is real for VORONOI adjacency, but Kagome was never
// supposed to be built from that function at all -- the 6 real
// triangulation-edge directions (v0, -v0, v1, -v1, and BOTH ends of the
// one fixed diagonal line, v1-v0 and v0-v1) are the same fixed 6 formulas
// at every angle, dropping the hexagonNeighborOffsets dependency
// entirely rather than special-casing Square. Verified directly: with
// this fix, every edge of a hexagon is covered by a real triangle from
// itself or an immediate neighbor, at all 4 angles, with zero gaps (the
// earlier "shares an edge with ITS OWN up/down triangle" check was true
// but incomplete -- it never checked whether the hexagon's OTHER edges
// were covered by anything at all).
function kagomeNeighborDirsSorted(angleDeg, s) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  const dirs = [v0, [-v0[0], -v0[1]], v1, [-v1[0], -v1[1]], [v1[0] - v0[0], v1[1] - v0[1]], [v0[0] - v1[0], v0[1] - v1[1]]];
  return dirs.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
}

export function kagomeHexagonTileVerts(angleDeg, s = 1, h = 0.15 * 1) {
  const corners2d = kagomeNeighborDirsSorted(angleDeg, s).map(([dx, dy]) => [dx / 2, dy / 2]);
  return extrudePrism(corners2d, h);
}

export function kagomeHexagonCellToWorld(x, y, _orientation, angleDeg, s = 1, worldZ = 0) {
  return hexagonCellToWorld(x, y, angleDeg, s, worldZ);
}

// hexagon(x,y) pairs with up(x,y) [touches P(x,y) directly] and
// down(x-1,y-1) = [P(x,y-1),P(x-1,y),P(x,y)] -- the down-triangle whose
// medial shape is EXACTLY up's own shape rotated 180 degrees about the
// hexagon's own center (proven directly: down(x-1,y-1)'s local corners,
// relative to P(x,y), are the exact negation of up's own -- v0/2, v1/2,
// (v0+v1)/2 vs. -v0/2, -v1/2, -(v0+v1)/2 -- and its real centroid is
// likewise P(x,y)'s own 180-degree-rotated image of up's centroid).
// Real correction, caught by direct user request to re-verify the
// already-shipped "Square genuinely rejected" conclusion: an EARLIER
// version of this file paired hexagon(x,y) with down(x,y-1) instead
// (also a real triangle touching P(x,y), just a different one) --
// that pairing's medial shape is genuinely NOT a 180-degree rotation of
// up's, so a shared 2-vertex geometry+rotation couldn't be used, AND
// (unlike down(x-1,y-1)) it only shares a real edge with the hexagon at
// 3 of the 4 named angles, failing at exactly Square specifically --
// which is what led to the wrong "Kagome doesn't work at Square, and
// that's a hard fact like Rhombille's" conclusion. Re-checked directly,
// systematically, against ALL 3 down-triangle candidates that touch
// P(x,y) at EVERY named angle: down(x-1,y-1) is the one that shares a
// real edge at all 4, including Square -- there was no actual geometric
// wall here, only an arbitrary and, it turns out, non-optimal choice of
// WHICH down-triangle to pair with which hexagon.
export function kagomeTriangleUpTileVerts(angleDeg, s = 1, h = 0.15 * 1) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  const corners2d = [[v0[0] / 2, v0[1] / 2], [v1[0] / 2, v1[1] / 2], [(v0[0] + v1[0]) / 2, (v0[1] + v1[1]) / 2]];
  return extrudePrism(corners2d, h);
}
export function kagomeTriangleUpCellToWorld(x, y, angleDeg, s = 1, worldZ = 0) {
  return [...triangleCellToWorld(x, y, 0, angleDeg, s, 0).slice(0, 2), worldZ];
}
// The exact negation of kagomeTriangleUpTileVerts's own corners (see
// this section's own header for the proof) -- kept as its own real
// geometry/companion mesh rather than refactored into "one shared
// geometry + a per-instance 180-degree rotation" (which the proof above
// would also support): companions currently have no per-instance
// orientation concept, and this fix is scoped to correctness, not a
// rendering-path simplification.
export function kagomeTriangleDownTileVerts(angleDeg, s = 1, h = 0.15 * 1) {
  const [v0, v1] = latticeBasis(angleDeg, s);
  const corners2d = [
    [-v0[0] / 2, -v0[1] / 2],
    [-v1[0] / 2, -v1[1] / 2],
    [-(v0[0] + v1[0]) / 2, -(v0[1] + v1[1]) / 2],
  ];
  return extrudePrism(corners2d, h);
}
export function kagomeTriangleDownCellToWorld(x, y, angleDeg, s = 1, worldZ = 0) {
  return [...triangleCellToWorld(x - 1, y - 1, 1, angleDeg, s, 0).slice(0, 2), worldZ];
}

// Kagome's own LOGICAL placement grid is the same point lattice Hexagon
// already uses, but NOT its neighbor structure -- real bug, same root
// cause as kagomeNeighborDirsSorted's own header just above (this used
// to delegate to hexagonNeighborOffsets too, so it was ALSO wrong at
// Square, missing the 2 real diagonal-line neighbors a 6-edge hexagon
// needs). Same fixed 6 (i,j) index offsets at every angle, matching
// kagomeNeighborDirsSorted's own v0/-v0/v1/-v1/(v1-v0)/(v0-v1) exactly.
export function kagomeNeighborOffsets(_angleDeg) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1], [-1, 1], [1, -1]];
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
    tileVerts: (angleDeg, s, h) => kiteTileVerts(angleDeg, s, h),
    // kiteDirectCellToWorld (not kiteCellToWorld's own rotation-trick
    // shortcut) -- proven identical at Square/Triangular (full N-fold
    // symmetry makes the rotation trick and the direct computation agree
    // exactly) AND correct at RD Rhombus/Golden Rhombus, where the trick
    // alone isn't. Used universally so build.js's click-to-place position
    // lookups are always right regardless of which rendering path
    // (single-mesh or multi-class, see maxClasses below) is active.
    cellToWorld: (i, j, orientation, angleDeg, s, worldZ) => kiteDirectCellToWorld(i, j, orientation, angleDeg, s, worldZ),
    neighborOffsets: (angleDeg, orientation) => kiteNeighborOffsets(angleDeg, orientation),
    // Single-mesh path fields (used only when classCount(angleDeg) === 1,
    // i.e. Square/Triangular) -- kiteInstanceRotationRad's full N-fold
    // rotation, NOT the class path's 180-degree-only one below (those are
    // two different jobs: this rotates EVERY fan position by its own real
    // angle around one shared canonical shape; the class path only ever
    // needs a 0/180 flip because each class mesh already holds ITS OWN
    // real shape).
    instanceRotationRad: (angleDeg, orientation) => kiteInstanceRotationRad(orientation, angleDeg),
    // Multi-class path (RD Rhombus/Golden Rhombus, classCount > 1) --
    // render.js's own rebuildLattice2dInstances branches on classCount
    // itself; maxClasses is the fixed number of real meshes to always
    // pre-create for this primitive (3, this file's own verified count
    // at the 2 irregular angles -- never more at any currently named
    // angle), so switching angle live never needs to create/destroy
    // meshes, only resize how many are actually populated.
    classCount: (angleDeg) => kiteClassCount(angleDeg),
    maxClasses: 3,
    classOf: (orientation, angleDeg) => kiteClassOf(orientation, angleDeg),
    classTileVerts: (angleDeg, classIndex, s, h) => kiteClassTileVerts(angleDeg, classIndex, s, h),
    classInstanceRotationRad: (orientation, angleDeg) => kiteClassInstanceRotationRad(orientation, angleDeg),
  },
  // Kagome's own entry describes its PRIMARY (clickable) mesh only --
  // the hexagon. `companion` describes its second, render-only mesh (the
  // 2 medial triangles per logical cell) -- render.js's own
  // rebuildLattice2dInstances special-cases this ONE field, everything
  // else (persistence, select options, toggle-panel angle-gating) is
  // already fully generic over LATTICE_PRIMITIVES and needs no Kagome-
  // specific code beyond that.
  kagome: {
    hasOrientation: false,
    tileVerts: (angleDeg, s, h) => kagomeHexagonTileVerts(angleDeg, s, h),
    cellToWorld: (i, j, orientation, angleDeg, s, worldZ) => kagomeHexagonCellToWorld(i, j, orientation, angleDeg, s, worldZ),
    neighborOffsets: (angleDeg) => kagomeNeighborOffsets(angleDeg),
    // Two companion meshes (render-only, not raycast/click targets -- see
    // render.js's own rebuildLattice2dInstances header), one up-triangle
    // instance and one down-triangle instance per logical (hexagon) cell.
    // Each is its OWN single fixed shape (see kagomeTriangleUp/Down's own
    // header for why they can't share one geometry + rotation the way
    // Triangle's real up/down pair does), so no `hasOrientation` needed.
    companions: [
      { tileVerts: (angleDeg, s, h) => kagomeTriangleUpTileVerts(angleDeg, s, h), cellToWorld: (i, j, angleDeg, s, worldZ) => kagomeTriangleUpCellToWorld(i, j, angleDeg, s, worldZ) },
      { tileVerts: (angleDeg, s, h) => kagomeTriangleDownTileVerts(angleDeg, s, h), cellToWorld: (i, j, angleDeg, s, worldZ) => kagomeTriangleDownCellToWorld(i, j, angleDeg, s, worldZ) },
    ],
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

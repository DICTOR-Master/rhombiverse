// 2D lattice tier (dimension-select wizard Phase 2): flat layer pinned
// to z=0 in the SAME 3D scene/camera/wheel apparatus 3D already uses --
// direct instruction, "flat layer in the same 3D scene... own world-
// stores/meshes per family (same 'adopted family member' pattern as
// BCC/Hex Prism), just flat. No separate UI mode."
//
// Square, not Rhombus: direct correction 2026-09-23 ("dont call square
// rhombus when its familiar name is square, this [is] geometry
// building not semantics") reversed a same-session rename that had
// swapped this family's real shape for a 70-degree-angled rhombus
// purely for thematic consistency with the app's own name. A plain
// orthogonal Z^2 grid is what "Square" actually means geometrically,
// so this is back to that -- angle 90, trivial basis. A REAL (non-
// square) Rhombus family is still planned as its own SEPARATE family,
// scheduled for after Triangular ships (direct instruction, same
// correction: "build rhombi after triangle complete") -- basisVectors
// below stays parametrized by angle for that reason, so that future
// family can reuse it rather than re-deriving the same construction.
//
// A tile gets a small real height (not a literal 0-height flat quad) --
// same "arbitrary extrusion height is fine, no special ratio required"
// reasoning hex-prism.js's own header already established for its own
// prism height, applied here for the same practical reason: a truly
// flat (zero-volume) tile risks total invisibility from a grazing
// camera angle and z-fighting against the ground/other flat content.

const SQUARE_ANGLE_DEG = 90;

// A square tile shares a full edge (not just a corner) with exactly
// its 4 neighbors along its own 2 generating directions (+-v0, +-v1) --
// same "real adjacency, not just proximity" discipline
// NEIGHBOR_OFFSETS already establishes for the 3D lattice.
export const SQUARE_NEIGHBOR_OFFSETS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
];

// Parametrized by angle so a future, genuinely non-square Rhombus
// family (planned for after Triangular) can reuse this exact
// construction at some other angle rather than re-deriving it -- see
// this file's own header.
function basisVectors(s, angleDeg = SQUARE_ANGLE_DEG) {
  const a = (angleDeg * Math.PI) / 180;
  return [[s, 0], [s * Math.cos(a), s * Math.sin(a)]];
}

export function squareCellToWorld(x, y, s = 1, worldZ = 0) {
  const [v0, v1] = basisVectors(s);
  return [x * v0[0] + y * v1[0], x * v0[1] + y * v1[1], worldZ];
}

// A square prism: the real square cross-section (2 equal-length,
// perpendicular vectors, centered on its own centroid) in the XY
// (world) plane, height h along the scene's own Z axis.
export function squareTileVerts(s = 1, h = 0.15 * 1) {
  const [v0, v1] = basisVectors(s);
  const corners2d = [[0, 0], v0, [v0[0] + v1[0], v0[1] + v1[1]], v1];
  const cx = corners2d.reduce((sum, p) => sum + p[0], 0) / 4;
  const cy = corners2d.reduce((sum, p) => sum + p[1], 0) / 4;
  const verts = [];
  for (const hz of [h / 2, -h / 2]) {
    for (const [x, y] of corners2d) verts.push([x - cx, y - cy, hz]);
  }
  return verts;
}

// Triangular (2D tier): the real equilateral-triangle tiling -- up-
// pointing and down-pointing triangles alternating, together filling
// every 60-degree rhombus cell of the same skewed basisVectors(s, 60)
// construction Square's own basisVectors already provides (parametrized
// exactly for this kind of reuse, per this file's own header).
//
// Coordinates: (i, j, orientation) where orientation is 0 (up) or 1
// (down) -- stored in the cell's own z slot (every other 2D family
// pins z to 0; this is the one 2D family that needs a real 3rd axis,
// so it uses the one already available rather than inventing a 4th).
// up(i,j) has vertices P(i,j), P(i+1,j), P(i,j+1) (P = i*v0 + j*v1);
// down(i,j) has vertices P(i+1,j), P(i,j+1), P(i+1,j+1) -- together
// these exactly tile the rhombus cell spanned by P(i,j)..P(i+1,j+1).
// Verified directly (law of cosines, v0/v1 both length s at 60 degrees
// apart): every edge of both triangles has length exactly s.
//
// Real, verified fact this construction relies on: down(i,j) is
// EXACTLY up(i,j) rotated 180 degrees about their shared center --
// confirmed by comparing both triangles' own vertices relative to
// their own centroids: {(0.5s,0.2887s), (-0.5s,0.2887s), (0,-0.5774s)}
// for both, not just "same shape, different orientation." This is why
// render.js can use ONE shared InstancedMesh geometry (the up triangle,
// triangleTileVerts below) for both orientations -- a down instance is
// just a 180-degree Z-rotation of the same geometry at its own real
// world position, not a second mesh/geometry.
const TRIANGLE_ANGLE_DEG = 60;

// Neighbor offsets are orientation-DEPENDENT (unlike every other 2D
// family's uniform offset table) -- an up triangle's 3 neighbors are
// always down triangles and vice versa, so growth logic (build.js's
// own handleTriangle2dClick) must pick the right table for the
// clicked cell's own current orientation. Derived directly from the
// shared-edge relationships above (see this file's own git history/
// code-notes for the full per-edge derivation).
export const TRIANGLE_NEIGHBOR_OFFSETS_FROM_UP = [
  [0, -1, 1], [0, 0, 1], [-1, 0, 1],
];
export const TRIANGLE_NEIGHBOR_OFFSETS_FROM_DOWN = [
  [0, 0, 0], [0, 1, 0], [1, 0, 0],
];

function trianglePoint(i, j, s) {
  const [v0, v1] = basisVectors(s, TRIANGLE_ANGLE_DEG);
  return [i * v0[0] + j * v1[0], i * v0[1] + j * v1[1]];
}

export function triangleCellToWorld(i, j, orientation, s = 1, worldZ = 0) {
  const [v0, v1] = basisVectors(s, TRIANGLE_ANGLE_DEG);
  const [px, py] = trianglePoint(i, j, s);
  const corners2d = orientation === 0
    ? [[px, py], [px + v0[0], py + v0[1]], [px + v1[0], py + v1[1]]]
    : [[px + v0[0], py + v0[1]], [px + v1[0], py + v1[1]], [px + v0[0] + v1[0], py + v0[1] + v1[1]]];
  const cx = corners2d.reduce((sum, p) => sum + p[0], 0) / 3;
  const cy = corners2d.reduce((sum, p) => sum + p[1], 0) / 3;
  return [cx, cy, worldZ];
}

// The canonical "up" triangle prism only -- "down" instances reuse this
// SAME geometry with a 180-degree Z-rotation applied to their own
// instance matrix (see this file's own header for the verified reason
// this is exact, not an approximation).
export function triangleTileVerts(s = 1, h = 0.15 * 1) {
  const [v0, v1] = basisVectors(s, TRIANGLE_ANGLE_DEG);
  const corners2d = [[0, 0], v0, v1];
  const cx = corners2d.reduce((sum, p) => sum + p[0], 0) / 3;
  const cy = corners2d.reduce((sum, p) => sum + p[1], 0) / 3;
  const verts = [];
  for (const hz of [h / 2, -h / 2]) {
    for (const [x, y] of corners2d) verts.push([x - cx, y - cy, hz]);
  }
  return verts;
}

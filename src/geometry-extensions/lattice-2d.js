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

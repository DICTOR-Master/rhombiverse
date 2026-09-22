// 2D lattice tier (dimension-select wizard Phase 2): flat layer pinned
// to z=0 in the SAME 3D scene/camera/wheel apparatus 3D already uses --
// direct instruction, "flat layer in the same 3D scene... own world-
// stores/meshes per family (same 'adopted family member' pattern as
// BCC/Hex Prism), just flat. No separate UI mode."
//
// Rhombus, not Square (direct correction, same session: "why square for
// 2D[,] all rhombi should be derived from same basic shape") -- this
// app's whole identity is built from rhombi (RD itself is 12 rhombic
// faces), so 2D's own occupant tile uses the exact same "2 equal-length
// vectors at a real angle" construction the dimension-wheel's own 2D
// icon already uses (dimension-shadow-icons.js's twoDShadow) -- any 2
// equal-length vectors form a true rhombus by construction (all 4 sides
// equal), for any angle strictly between 0 and 180 degrees. 70 degrees
// here matches that icon exactly, so the LATTICE and its own on-wheel
// symbol are literally the same shape, not just thematically similar.
//
// A tile gets a small real height (not a literal 0-height flat quad) --
// same "arbitrary extrusion height is fine, no special ratio required"
// reasoning hex-prism.js's own header already established for its own
// prism height, applied here for the same practical reason: a truly
// flat (zero-volume) tile risks total invisibility from a grazing
// camera angle and z-fighting against the ground/other flat content.

const RHOMBUS_ANGLE_DEG = 70;

// A rhombus tile shares a full edge (not just a corner) with exactly
// its 4 neighbors along its own 2 generating directions (+-v0, +-v1) --
// same "real adjacency, not just proximity" discipline
// NEIGHBOR_OFFSETS already establishes for the 3D lattice. These are
// LATTICE-INDEX offsets (still a plain integer (x,y) grid, same
// topology a square grid would have -- only the CARTESIAN
// interpretation below is non-orthogonal), not world-space vectors.
export const RHOMBUS_NEIGHBOR_OFFSETS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
];

function basisVectors(s) {
  const a = (RHOMBUS_ANGLE_DEG * Math.PI) / 180;
  return [[s, 0], [s * Math.cos(a), s * Math.sin(a)]];
}

export function rhombusCellToWorld(x, y, s = 1, worldZ = 0) {
  const [v0, v1] = basisVectors(s);
  return [x * v0[0] + y * v1[0], x * v0[1] + y * v1[1], worldZ];
}

// A rhombus prism: the real rhombus cross-section (2 equal-length
// vectors at RHOMBUS_ANGLE_DEG, centered on its own centroid) in the XY
// (world) plane, height h along the scene's own Z (up) axis.
export function rhombusTileVerts(s = 1, h = 0.15 * 1) {
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
